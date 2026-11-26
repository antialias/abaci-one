import type {
	ProviderConfig,
	ProviderRequest,
	ProviderResponse,
	ProviderStreamEvent,
	ReasoningEffort,
	RequestPriority,
} from "../types";
import {
	LLMAbortedError,
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
 * The prompt goes in as one `stream-json` user message, so images (data URLs)
 * travel as base64 image blocks beside the text. The zod schema goes to
 * --json-schema and the answer is the run's structured output; a text request
 * (LLMClient.streamText) has no schema and its answer is the run's text.
 *
 * stream() adds --include-partial-messages and maps the CLI's stream events
 * onto llm-client's: thinking (summarized) and, in a structured call, the
 * model's prose before its answer become `reasoning`; the structured answer's
 * JSON (or a text answer) becomes `output_delta`.
 *
 * Model and class ids: a request naming an OpenAI model (gpt-*, o1, o3, …) is
 * left over from before and gets the configured default instead. Claude Code
 * knows nothing about a proxy class id such as `claude-abaci`, and for a model
 * it does not know it sends no thinking and ignores --effort; the run declares
 * the requested id as a custom model with those capabilities so both apply.
 *
 * Queue: at most LLM_CLAUDE_CODE_MAX_CONCURRENCY runs at once, process-wide.
 * "interactive" requests (a child waiting) go ahead of "background" ones, and
 * background runs may hold at most limit−1 slots so one is always free for
 * an interactive request. Time spent waiting counts against the request's
 * timeout, and aborting its signal takes it out of the queue.
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
	/** Aborting ends the process (a caller that stopped reading a stream). */
	signal?: AbortSignal;
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

const TEXT_SYSTEM_PROMPT =
	"You are a component of the abaci.one learning app. Do exactly what the " +
	"request asks and reply in plain text.";

/** What Claude Code is told a proxy model or class id can do. */
const MODEL_CAPABILITIES = "effort,thinking,adaptive_thinking";

/** Model ids that belong to OpenAI, not to the proxy's Claude wire. */
const OPENAI_MODEL = /^(gpt-|chatgpt-|o\d)/i;

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

interface SlotWaiter {
	priority: RequestPriority;
	grant: () => void;
}

/**
 * Run slots shared by every claude_code request in the process. A freed slot
 * is handed straight to the next waiter (counted before it resumes), so a
 * newcomer can never slip in ahead of the queue and exceed the limit.
 */
export class SlotPool {
	private running = 0;
	private background = 0;
	private limit = DEFAULT_MAX_CONCURRENCY;
	private readonly queues: Record<RequestPriority, SlotWaiter[]> = {
		interactive: [],
		background: [],
	};

	/** Runs now holding a slot, and how many of them are background. */
	get usage(): { running: number; background: number; waiting: number } {
		return {
			running: this.running,
			background: this.background,
			waiting: this.queues.interactive.length + this.queues.background.length,
		};
	}

	/**
	 * Wait for a slot. Resolves to its release function; rejects with
	 * LLMAbortedError when `signal` fires, or LLMTimeoutError once `timeoutMs`
	 * passes, while still waiting.
	 */
	acquire(opts: {
		limit: number;
		priority: RequestPriority;
		provider: string;
		timeoutMs: number;
		signal?: AbortSignal;
	}): Promise<() => void> {
		this.limit = Math.max(1, opts.limit);
		const { priority, signal } = opts;
		if (signal?.aborted) {
			return Promise.reject(new LLMAbortedError(opts.provider));
		}
		return new Promise((resolve, reject) => {
			let timer: ReturnType<typeof setTimeout> | undefined;
			const leave = () => {
				const queue = this.queues[priority];
				const at = queue.indexOf(waiter);
				if (at !== -1) queue.splice(at, 1);
				if (timer) clearTimeout(timer);
				signal?.removeEventListener("abort", onAbort);
			};
			const onAbort = () => {
				leave();
				reject(new LLMAbortedError(opts.provider));
			};
			const waiter: SlotWaiter = {
				priority,
				grant: () => {
					leave();
					let released = false;
					resolve(() => {
						if (released) return;
						released = true;
						this.release(priority);
					});
				},
			};
			this.queues[priority].push(waiter);
			signal?.addEventListener("abort", onAbort, { once: true });
			if (opts.timeoutMs > 0) {
				timer = setTimeout(() => {
					leave();
					reject(new LLMTimeoutError(opts.provider, opts.timeoutMs));
				}, opts.timeoutMs);
			}
			this.dispatch();
		});
	}

	private release(priority: RequestPriority): void {
		this.running--;
		if (priority === "background") this.background--;
		this.dispatch();
	}

	/** Background may hold every slot but one (all of them when there is one). */
	private canTake(priority: RequestPriority): boolean {
		if (this.running >= this.limit) return false;
		if (priority === "interactive") return true;
		return this.background < Math.max(1, this.limit - 1);
	}

	private dispatch(): void {
		while (true) {
			const priority: RequestPriority | undefined =
				this.queues.interactive.length > 0 && this.canTake("interactive")
					? "interactive"
					: this.queues.background.length > 0 && this.canTake("background")
						? "background"
						: undefined;
			if (!priority) return;
			const waiter = this.queues[priority][0];
			this.running++;
			if (priority === "background") this.background++;
			waiter.grant();
		}
	}
}

/** The one pool every ClaudeCodeProvider in the process shares. */
export const claudeCodeSlots = new SlotPool();

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
		// timeoutMs 0: no limit.
		const timer =
			run.timeoutMs > 0
				? setTimeout(() => {
						timedOut = true;
						end();
					}, run.timeoutMs)
				: undefined;

		if (run.signal) {
			const onAbort = () => {
				stopped = true;
				end();
			};
			if (run.signal.aborted) onAbort();
			else run.signal.addEventListener("abort", onAbort, { once: true });
		}

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
	private readonly slots: SlotPool;

	constructor(
		config: ProviderConfig,
		runner: ClaudeCliRunner = spawnClaudeCli,
		slots: SlotPool = claudeCodeSlots,
	) {
		super(config);
		this.runner = runner;
		this.slots = slots;
	}

	async call(request: ProviderRequest): Promise<ProviderResponse> {
		let response: ProviderResponse | undefined;
		for await (const event of this.run(request, false)) {
			if (event.type === "result") response = event.response;
		}
		if (!response) {
			throw new LLMNetworkError(this.name, new Error("claude gave no result"));
		}
		return response;
	}

	stream(
		request: ProviderRequest,
	): AsyncGenerator<ProviderStreamEvent, void, unknown> {
		return this.run(request, true);
	}

	/**
	 * One `claude -p` run. Streaming, its events are yielded as they arrive;
	 * either way the last thing yielded is the `result`. Stopping early (a
	 * consumer that breaks out) ends the process.
	 */
	private async *run(
		request: ProviderRequest,
		streaming: boolean,
	): AsyncGenerator<ProviderStreamEvent, void, unknown> {
		const opts = this.config.options ?? {};
		const limit =
			Number.parseInt(String(opts.max_concurrency ?? ""), 10) ||
			DEFAULT_MAX_CONCURRENCY;
		const timeoutMs = request.timeoutMs ?? 120_000;
		const model = this.resolveModel(request.model);
		const stdin = this.buildInput(request);

		let result: ResultEvent | undefined;
		let retry: RetryEvent | undefined;
		const events = new EventQueue<ProviderStreamEvent>();
		const mapper = new StreamMapper(request.textOutput === true);
		const abort = new AbortController();

		const signal = request.signal;
		const onCallerAbort = () => abort.abort();
		signal?.addEventListener("abort", onCallerAbort, { once: true });
		const queuedAt = Date.now();

		const finished = (async () => {
			const release = await this.slots.acquire({
				limit,
				priority: request.priority ?? "background",
				provider: this.name,
				timeoutMs,
				signal,
			});
			try {
				// Aborted while the slot was on its way: give it back unused.
				if (signal?.aborted) throw new LLMAbortedError(this.name);
				// The wait for a slot counted against the request's timeout.
				const remaining = timeoutMs - (Date.now() - queuedAt);
				if (timeoutMs > 0 && remaining <= 0) {
					throw new LLMTimeoutError(this.name, timeoutMs);
				}
				return await this.runner({
					command: String(opts.cli_path ?? "claude"),
					args: this.buildArgs(request, model, streaming),
					stdin,
					env: this.buildEnv(model),
					cwd: this.home(),
					timeoutMs: timeoutMs > 0 ? remaining : 0,
					signal: abort.signal,
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
						} else if (streaming) {
							for (const mapped of mapper.map(event)) events.push(mapped);
						}
						return undefined;
					},
				});
			} finally {
				release();
			}
		})().finally(() => events.close());
		// Read below, after the stream drains; never an unhandled rejection.
		finished.catch(() => {});

		try {
			yield* events;

			let run: ClaudeCliResult;
			try {
				run = await finished;
			} catch (err) {
				if (err instanceof LLMAbortedError || err instanceof LLMTimeoutError) {
					throw err;
				}
				const e = err as NodeJS.ErrnoException;
				if (e?.code === "ENOENT") {
					throw new Error(
						`claude_code provider: Claude Code CLI not found at '${String(opts.cli_path ?? "claude")}' (set LLM_CLAUDE_CODE_CLI_PATH)`,
					);
				}
				throw new LLMNetworkError(this.name, e);
			}

			yield {
				type: "result",
				response: this.toResponse(run, result, retry, timeoutMs, request),
			};
		} finally {
			signal?.removeEventListener("abort", onCallerAbort);
			abort.abort();
		}
	}

	private toResponse(
		run: ClaudeCliResult,
		result: ResultEvent | undefined,
		retry: RetryEvent | undefined,
		timeoutMs: number,
		request: ProviderRequest,
	): ProviderResponse {
		if (request.signal?.aborted) {
			throw new LLMAbortedError(this.name);
		}
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
			throw new LLMApiError(this.name, errorStatus(text), text.slice(0, 500));
		}

		const content = request.textOutput
			? String(result.result ?? "").trim()
			: this.readContent(result);
		const u = result.usage ?? {};
		return {
			content,
			rawContent:
				typeof content === "string" ? content : JSON.stringify(content),
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

	/** An OpenAI model id left in a request gets the configured default. */
	private resolveModel(model: string): string {
		return !model || OPENAI_MODEL.test(model)
			? this.config.defaultModel
			: model;
	}

	private buildArgs(
		request: ProviderRequest,
		model: string,
		streaming: boolean,
	): string[] {
		const text = request.textOutput === true;
		const system = text
			? (request.system ?? TEXT_SYSTEM_PROMPT)
			: request.system
				? `${SYSTEM_PROMPT}\n\n${request.system}`
				: SYSTEM_PROMPT;
		const args = [
			"-p",
			"--bare",
			"--model",
			model,
			"--system-prompt",
			system,
			"--tools",
			"",
			"--setting-sources",
			"",
			"--no-session-persistence",
			"--input-format",
			"stream-json",
			"--output-format",
			"stream-json",
			"--verbose",
		];
		if (streaming) {
			args.push(
				"--include-partial-messages",
				"--thinking-display",
				"summarized",
			);
		}
		if (!text) {
			args.push("--json-schema", JSON.stringify(cliSchema(request.jsonSchema)));
		}
		const effort = request.reasoningEffort && EFFORT[request.reasoningEffort];
		if (effort) args.push("--effort", effort);
		return args;
	}

	/** The prompt (and any images) as one stream-json user message. */
	private buildInput(request: ProviderRequest): string {
		const prompt = request.textOutput
			? request.prompt
			: this.buildPrompt({ ...request, system: undefined });
		const content: Array<Record<string, unknown>> = (request.images ?? []).map(
			(image) => imageBlock(image, this.name),
		);
		content.push({ type: "text", text: prompt });
		return `${JSON.stringify({
			type: "user",
			message: { role: "user", content },
		})}\n`;
	}

	private buildEnv(model: string): Record<string, string> {
		const home = this.home();
		return {
			PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
			HOME: home,
			CLAUDE_CONFIG_DIR: `${home}/.claude`,
			ANTHROPIC_BASE_URL: proxyRoot(this.config.baseUrl),
			ANTHROPIC_AUTH_TOKEN: this.config.apiKey,
			ANTHROPIC_CUSTOM_MODEL_OPTION: model,
			ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES: MODEL_CAPABILITIES,
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

/**
 * The HTTP status behind a failed run's result text. Claude Code reports an
 * API refusal as "API Error: <status> …"; a 4xx (an image too large, an
 * invalid request) is the request's own fault and is not retried.
 */
export function errorStatus(text: string): number {
	const reported = /API Error:?\s*(\d{3})\b/i.exec(text);
	if (reported) return Number(reported[1]);
	if (/usage limit|rate.?limit|\b429\b/i.test(text)) return 429;
	if (/invalid_request|request_too_large|\b(400|413)\b/i.test(text)) return 400;
	return 502;
}

/** The image format its first bytes say, whatever the data URL claims. */
export function sniffImageType(base64: string): string | undefined {
	let head: string;
	try {
		head = atob(base64.slice(0, 16));
	} catch {
		return undefined;
	}
	const at = (i: number) => head.charCodeAt(i);
	if (at(0) === 0x89 && head.slice(1, 4) === "PNG") return "image/png";
	if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
	if (head.startsWith("GIF8")) return "image/gif";
	if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") {
		return "image/webp";
	}
	return undefined;
}

/** A data URL as an Anthropic base64 image block. */
function imageBlock(
	dataUrl: string,
	provider: string,
): Record<string, unknown> {
	const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
	if (!match) {
		// Not retryable: the same image would be refused again.
		throw new LLMApiError(
			provider,
			400,
			"claude_code provider takes images as base64 data URLs (data:<type>;base64,…)",
		);
	}
	// The API checks the declared type against the bytes: trust the bytes.
	const mediaType = sniffImageType(match[2]) ?? match[1];
	return {
		type: "image",
		source: { type: "base64", media_type: mediaType, data: match[2] },
	};
}

/**
 * Maps Claude Code's stream-json events onto llm-client stream events.
 * Reasoning from separate blocks is joined with a blank line, since the
 * persistence middleware accumulates every reasoning delta into one text.
 */
class StreamMapper {
	private readonly blocks = new Map<number, string>();
	private reasoningBlocks = 0;
	private reasoningOpen = false;
	private outputShown = false;
	/** A new model turn began after output: void it once that turn answers. */
	private resetPending = false;

	constructor(private readonly textOutput: boolean) {}

	map(event: Record<string, unknown>): ProviderStreamEvent[] {
		if (event.type === "system" && event.subtype === "init") {
			return [{ type: "started", responseId: String(event.session_id ?? "") }];
		}
		if (event.type !== "stream_event") return [];
		const inner = event.event as Record<string, unknown> | undefined;
		if (!inner) return [];
		const index = typeof inner.index === "number" ? inner.index : 0;

		if (inner.type === "message_start") {
			this.blocks.clear();
			if (this.outputShown) {
				// The CLI asked the model again. Its answer starts over, but only
				// if this turn streams one: a closing turn with no output must
				// not blank the answer already given.
				this.outputShown = false;
				this.resetPending = true;
			}
			return [];
		}
		if (inner.type === "content_block_start") {
			const block = inner.content_block as { type?: string } | undefined;
			this.blocks.set(index, block?.type ?? "");
			this.reasoningOpen = false;
			return [];
		}
		if (inner.type !== "content_block_delta") return [];
		const delta = inner.delta as Record<string, unknown> | undefined;
		if (!delta) return [];

		if (delta.type === "thinking_delta") {
			return this.reasoning(String(delta.thinking ?? ""));
		}
		if (delta.type === "text_delta") {
			const text = String(delta.text ?? "");
			if (this.textOutput) return text ? this.output(text) : [];
			// Before a structured answer, the model's prose is its working.
			return this.reasoning(text);
		}
		if (delta.type === "input_json_delta" && !this.textOutput) {
			const json = String(delta.partial_json ?? "");
			return json ? this.output(json) : [];
		}
		return [];
	}

	private output(text: string): ProviderStreamEvent[] {
		this.outputShown = true;
		const delta: ProviderStreamEvent = {
			type: "output_delta",
			text,
			outputIndex: 0,
		};
		if (!this.resetPending) return [delta];
		this.resetPending = false;
		return [{ type: "output_reset" }, delta];
	}

	private reasoning(text: string): ProviderStreamEvent[] {
		if (!text) return [];
		let chunk = text;
		if (!this.reasoningOpen) {
			if (this.reasoningBlocks > 0) chunk = `\n\n${text}`;
			this.reasoningBlocks++;
			this.reasoningOpen = true;
		}
		return [
			{
				type: "reasoning",
				text: chunk,
				summaryIndex: this.reasoningBlocks - 1,
				isDelta: true,
			},
		];
	}
}

/** A push queue read with for-await; ends once closed and drained. */
class EventQueue<T> implements AsyncIterable<T> {
	private readonly items: T[] = [];
	private closed = false;
	private wake: (() => void) | undefined;

	push(item: T): void {
		if (this.closed) return;
		this.items.push(item);
		this.wake?.();
	}

	close(): void {
		this.closed = true;
		this.wake?.();
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
		while (true) {
			const item = this.items.shift();
			if (item !== undefined) {
				yield item;
				continue;
			}
			if (this.closed) return;
			await new Promise<void>((resolve) => {
				this.wake = resolve;
			});
			this.wake = undefined;
		}
	}
}
