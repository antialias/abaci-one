import type {
	ProviderConfig,
	ProviderRequest,
	ProviderResponse,
	ReasoningEffort,
} from "../types";
import {
	LLMApiError,
	LLMJsonParseError,
	LLMNetworkError,
	LLMTimeoutError,
} from "../types";
import { BaseProvider } from "./base";

/**
 * The `claude_code` provider: every call is one `claude -p` run.
 *
 * Claude Code is pointed at the house switch proxy (ANTHROPIC_BASE_URL) with
 * the proxy's client secret (ANTHROPIC_AUTH_TOKEN), so the proxy routes the
 * request to a Claude lane or class. The client really is Claude Code, which
 * is what a Claude subscription lane requires; nothing here imitates it.
 *
 * Configured like any provider:
 * - LLM_CLAUDE_CODE_API_KEY        the switch proxy's client secret
 * - LLM_CLAUDE_CODE_BASE_URL       the proxy's root, e.g. http://nas:8787 (required)
 * - LLM_CLAUDE_CODE_DEFAULT_MODEL  a model or class id the proxy serves
 * - LLM_CLAUDE_CODE_CLI_PATH       the claude binary (default: `claude` on PATH)
 * - LLM_CLAUDE_CODE_HOME           a writable directory for the CLI's own state
 * - LLM_CLAUDE_CODE_MAX_CONCURRENCY  runs allowed at once (default 2)
 *
 * The child gets a minimal environment: none of the app's own variables
 * (database URLs, other keys) reach it, and the secret goes only to the
 * proxy's base URL.
 *
 * Failures: Claude Code retries a refused request by itself, silently, for
 * minutes. The run is read as `stream-json`, which reports each of those
 * retries; the first one ends the run and becomes an LLMApiError carrying the
 * status, so llm-client's own retry rules decide what happens next.
 */

/** One `claude` process to run. */
export interface ClaudeCliRun {
	command: string;
	args: string[];
	/** Written to the process's stdin, then stdin is closed. */
	stdin: string;
	env: Record<string, string>;
	cwd: string;
	timeoutMs: number;
	/** Called for each stdout line; return "stop" to end the process. */
	onLine: (line: string) => "stop" | undefined;
}

export interface ClaudeCliResult {
	exitCode: number | null;
	stderr: string;
	timedOut: boolean;
	stopped: boolean;
}

export type ClaudeCliRunner = (run: ClaudeCliRun) => Promise<ClaudeCliResult>;

const SYSTEM_PROMPT =
	"You are a component of the abaci.one learning app. Do exactly what the " +
	"request asks and give your answer through the structured output.";

const DEFAULT_MAX_CONCURRENCY = 2;
const STDERR_LIMIT = 8 * 1024;
const KILL_GRACE_MS = 5_000;

/** Claude Code's --effort levels for llm-client's reasoning efforts. */
const EFFORT: Partial<Record<ReasoningEffort, string>> = {
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: "xhigh",
};

interface ResultEvent {
	type: "result";
	subtype?: string;
	is_error?: boolean;
	result?: string;
	structured_output?: unknown;
	usage?: {
		input_tokens?: number;
		cache_creation_input_tokens?: number;
		cache_read_input_tokens?: number;
		output_tokens?: number;
	};
}

interface RetryEvent {
	status: number | null;
	error: string;
	retryDelayMs?: number;
}

// ---- process-wide concurrency cap --------------------------------------

let running = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(limit: number, fn: () => Promise<T>): Promise<T> {
	if (running >= limit) {
		await new Promise<void>((resolve) => waiting.push(resolve));
	}
	running++;
	try {
		return await fn();
	} finally {
		running--;
		waiting.shift()?.();
	}
}

// ---- the real runner ---------------------------------------------------

type ChildProcessModule = typeof import("node:child_process");
type FsModule = typeof import("node:fs");

/**
 * Node builtins are loaded at call time with process.getBuiltinModule, never
 * imported: this package is bundled into client components (via apps/web's
 * lib/llm.ts), and a static node:child_process import would break them.
 */
function builtin<T>(id: string): T {
	const get = (
		process as unknown as { getBuiltinModule?: (id: string) => unknown }
	).getBuiltinModule;
	if (typeof get !== "function") {
		throw new Error(
			"claude_code provider needs Node >= 20.16 (process.getBuiltinModule)",
		);
	}
	return get(id) as T;
}

export const spawnClaudeCli: ClaudeCliRunner = (run) =>
	new Promise((resolve, reject) => {
		const { spawn } = builtin<ChildProcessModule>("node:child_process");
		builtin<FsModule>("node:fs").mkdirSync(run.cwd, { recursive: true });

		const child = spawn(run.command, run.args, {
			cwd: run.cwd,
			env: run.env,
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stderr = "";
		let pending = "";
		let timedOut = false;
		let stopped = false;
		let killTimer: ReturnType<typeof setTimeout> | undefined;

		const end = () => {
			if (child.exitCode !== null || child.signalCode !== null) return;
			child.kill("SIGTERM");
			killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
		};
		const timer = setTimeout(() => {
			timedOut = true;
			end();
		}, run.timeoutMs);

		const handle = (line: string) => {
			if (stopped || !line.trim()) return;
			if (run.onLine(line) === "stop") {
				stopped = true;
				end();
			}
		};

		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => {
			pending += chunk;
			let nl = pending.indexOf("\n");
			while (nl !== -1) {
				handle(pending.slice(0, nl));
				pending = pending.slice(nl + 1);
				nl = pending.indexOf("\n");
			}
		});
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk: string) => {
			if (stderr.length < STDERR_LIMIT) stderr += chunk;
		});
		// A process that exits before reading its stdin is reported by 'close'.
		child.stdin.on("error", () => {});

		child.on("error", (err) => {
			clearTimeout(timer);
			if (killTimer) clearTimeout(killTimer);
			reject(err);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (killTimer) clearTimeout(killTimer);
			handle(pending);
			resolve({
				exitCode: code,
				stderr: stderr.slice(0, STDERR_LIMIT),
				timedOut,
				stopped,
			});
		});

		child.stdin.end(run.stdin);
	});

// ---- the provider ------------------------------------------------------

export class ClaudeCodeProvider extends BaseProvider {
	private readonly runner: ClaudeCliRunner;

	constructor(
		config: ProviderConfig,
		runner: ClaudeCliRunner = spawnClaudeCli,
	) {
		super(config);
		this.runner = runner;
	}

	async call(request: ProviderRequest): Promise<ProviderResponse> {
		if (request.images?.length) {
			throw new Error(
				"claude_code provider does not take images yet; pin this call to another provider",
			);
		}

		const opts = this.config.options ?? {};
		const limit =
			Number.parseInt(String(opts.max_concurrency ?? ""), 10) ||
			DEFAULT_MAX_CONCURRENCY;
		const timeoutMs = request.timeoutMs ?? 120_000;

		let result: ResultEvent | undefined;
		let retry: RetryEvent | undefined;

		const run = await withSlot(limit, async () => {
			try {
				return await this.runner({
					command: String(opts.cli_path ?? "claude"),
					args: this.buildArgs(request),
					stdin: this.buildPrompt(request),
					env: this.buildEnv(),
					cwd: this.home(),
					timeoutMs,
					onLine: (line) => {
						const event = parseLine(line);
						if (!event) return undefined;
						if (event.type === "system" && event.subtype === "api_retry") {
							retry = {
								status:
									typeof event.error_status === "number"
										? event.error_status
										: null,
								error: String(event.error ?? "api_retry"),
								retryDelayMs:
									typeof event.retry_delay_ms === "number"
										? event.retry_delay_ms
										: undefined,
							};
							return "stop";
						}
						if (event.type === "result") {
							result = event as unknown as ResultEvent;
						}
						return undefined;
					},
				});
			} catch (err) {
				const e = err as NodeJS.ErrnoException;
				if (e?.code === "ENOENT") {
					throw new Error(
						`claude_code provider: Claude Code CLI not found at '${String(opts.cli_path ?? "claude")}' (set LLM_CLAUDE_CODE_CLI_PATH)`,
					);
				}
				throw new LLMNetworkError(this.name, e);
			}
		});

		if (retry) {
			if (retry.status === null) {
				throw new LLMNetworkError(
					this.name,
					new Error(`proxy unreachable: ${retry.error}`),
				);
			}
			throw new LLMApiError(
				this.name,
				retry.status,
				retry.error,
				retry.status === 429 ? retry.retryDelayMs : undefined,
			);
		}
		if (run.timedOut) {
			throw new LLMTimeoutError(this.name, timeoutMs);
		}
		if (!result && run.exitCode === 1 && run.stderr.trim()) {
			// The CLI refused the run itself (a bad flag, an invalid schema):
			// retrying the same arguments cannot help.
			throw new LLMApiError(
				this.name,
				400,
				`claude refused the run: ${run.stderr.trim().slice(0, 300)}`,
			);
		}
		if (!result) {
			throw new LLMNetworkError(
				this.name,
				new Error(
					`claude exited ${run.exitCode} without a result${run.stderr ? `: ${run.stderr.trim().slice(0, 300)}` : ""}`,
				),
			);
		}
		if (result.is_error) {
			const text = String(result.result ?? result.subtype ?? "error");
			const status = /usage limit|rate.?limit|\b429\b/i.test(text) ? 429 : 502;
			throw new LLMApiError(this.name, status, text.slice(0, 500));
		}

		const content = this.readContent(result);
		const u = result.usage ?? {};
		return {
			content,
			rawContent: JSON.stringify(content),
			usage: {
				promptTokens:
					(u.input_tokens ?? 0) +
					(u.cache_creation_input_tokens ?? 0) +
					(u.cache_read_input_tokens ?? 0),
				completionTokens: u.output_tokens ?? 0,
			},
			finishReason: result.subtype ?? "success",
		};
	}

	private buildArgs(request: ProviderRequest): string[] {
		const args = [
			"-p",
			"--bare",
			"--model",
			request.model,
			"--system-prompt",
			SYSTEM_PROMPT,
			"--tools",
			"",
			"--setting-sources",
			"",
			"--no-session-persistence",
			"--output-format",
			"stream-json",
			"--verbose",
			"--json-schema",
			JSON.stringify(cliSchema(request.jsonSchema)),
		];
		const effort = request.reasoningEffort && EFFORT[request.reasoningEffort];
		if (effort) args.push("--effort", effort);
		return args;
	}

	private buildEnv(): Record<string, string> {
		const home = this.home();
		return {
			PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
			HOME: home,
			CLAUDE_CONFIG_DIR: `${home}/.claude`,
			ANTHROPIC_BASE_URL: proxyRoot(this.config.baseUrl),
			ANTHROPIC_AUTH_TOKEN: this.config.apiKey,
			DISABLE_AUTOUPDATER: "1",
			DISABLE_TELEMETRY: "1",
			DISABLE_ERROR_REPORTING: "1",
			CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
		};
	}

	private home(): string {
		const configured = this.config.options?.home;
		if (configured) return String(configured);
		const tmp = process.env.TMPDIR || "/tmp";
		return `${tmp.replace(/\/+$/, "")}/claude-code-llm`;
	}

	private readContent(result: ResultEvent): unknown {
		if (result.structured_output !== undefined) return result.structured_output;
		const text = (result.result ?? "").trim();
		const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
		const body = fenced ? fenced[1] : text;
		try {
			return JSON.parse(body);
		} catch (err) {
			throw new LLMJsonParseError(text, (err as Error).message);
		}
	}
}

/**
 * Claude Code validates --json-schema with a draft-07 validator, which rejects
 * the 2020-12 `$schema` URI that zod's toJSONSchema puts at the root.
 */
export function cliSchema(
	schema: Record<string, unknown>,
): Record<string, unknown> {
	const { $schema: _ignored, ...rest } = schema;
	return rest;
}

/** Claude Code appends /v1/messages itself: strip a trailing /v1 and slashes. */
export function proxyRoot(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
}

function parseLine(line: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(line);
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}
