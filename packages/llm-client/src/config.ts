import type { LLMClientConfig, ProviderConfig } from "./types";

/**
 * The one provider: Claude Code in print mode (`claude -p`) through the
 * switch proxy. Any falling back between upstreams is the proxy's job, not
 * this client's.
 */
export const PROVIDER_NAME = "claude_code";

const PREFIX = "LLM_CLAUDE_CODE_";

/** Used when LLM_CLAUDE_CODE_DEFAULT_MODEL is not set. */
const DEFAULT_MODEL = "claude-sonnet-5";

/**
 * Parse the claude_code provider's configuration from environment variables.
 *
 * - LLM_CLAUDE_CODE_API_KEY - the proxy client secret (required)
 * - LLM_CLAUDE_CODE_BASE_URL - the proxy root (required; no default, so the
 *   secret can never be sent to a guessed host)
 * - LLM_CLAUDE_CODE_DEFAULT_MODEL - model or class id (optional)
 * - LLM_CLAUDE_CODE_{OPTION} - provider options (e.g. MAX_CONCURRENCY)
 *
 * Returns undefined when no API key is set.
 */
function parseProviderFromEnv(
	env: Record<string, string | undefined>,
): ProviderConfig | undefined {
	const apiKey = env[`${PREFIX}API_KEY`];
	if (!apiKey) {
		return undefined;
	}

	const options: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(env)) {
		if (
			key.startsWith(PREFIX) &&
			!["API_KEY", "BASE_URL", "DEFAULT_MODEL"].includes(
				key.slice(PREFIX.length),
			)
		) {
			options[key.slice(PREFIX.length).toLowerCase()] = value;
		}
	}

	return {
		name: PROVIDER_NAME,
		apiKey,
		baseUrl: env[`${PREFIX}BASE_URL`] ?? "",
		defaultModel: env[`${PREFIX}DEFAULT_MODEL`] ?? DEFAULT_MODEL,
		options: Object.keys(options).length > 0 ? options : undefined,
	};
}

/**
 * Load LLM client configuration from environment variables
 *
 * Env vars:
 * - LLM_DEFAULT_MODEL - Override default model (optional)
 * - LLM_DEFAULT_MAX_RETRIES - Default max retries (optional, default: 2)
 * - LLM_CLAUDE_CODE_* - Provider configuration (see parseProviderFromEnv)
 *
 * @param env - Environment variables (defaults to process.env)
 */
export function loadConfigFromEnv(
	env: Record<string, string | undefined> = process.env,
): LLMClientConfig {
	return {
		defaultModel: env.LLM_DEFAULT_MODEL,
		provider: parseProviderFromEnv(env),
		defaultMaxRetries: parseInt(env.LLM_DEFAULT_MAX_RETRIES ?? "2", 10),
	};
}
