import type { LLMClientConfig, ProviderConfig } from "./types";

/**
 * Known provider defaults
 *
 * OpenAI GPT-5.2 variants:
 * - gpt-5.2 (Thinking) - Best for vision + structured work, reasoning enabled
 * - gpt-5.2-chat-latest (Instant) - Faster, lower latency
 * - gpt-5.2-pro - Most accurate, highest quality
 */
const PROVIDER_DEFAULTS: Record<string, Partial<ProviderConfig>> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.2", // GPT-5.2 Thinking - best for vision + structured outputs
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
  },
};

/**
 * Parse provider configuration from environment variables
 *
 * Env var convention:
 * - LLM_{PROVIDER}_API_KEY - API key (required)
 * - LLM_{PROVIDER}_BASE_URL - Base URL (optional, has defaults)
 * - LLM_{PROVIDER}_DEFAULT_MODEL - Default model (optional)
 * - LLM_{PROVIDER}_{OPTION} - Additional options
 */
function parseProviderFromEnv(
  providerName: string,
  env: Record<string, string | undefined>,
): ProviderConfig | null {
  const prefix = `LLM_${providerName.toUpperCase()}_`;

  const apiKey = env[`${prefix}API_KEY`];
  if (!apiKey) {
    return null;
  }

  const defaults = PROVIDER_DEFAULTS[providerName.toLowerCase()] ?? {};

  const baseUrl =
    env[`${prefix}BASE_URL`] ??
    defaults.baseUrl ??
    `https://api.${providerName}.com/v1`;

  const defaultModel =
    env[`${prefix}DEFAULT_MODEL`] ?? defaults.defaultModel ?? "default";

  // Collect any additional options
  const options: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(env)) {
    if (
      key.startsWith(prefix) &&
      !["API_KEY", "BASE_URL", "DEFAULT_MODEL"].includes(
        key.slice(prefix.length),
      )
    ) {
      const optionName = key.slice(prefix.length).toLowerCase();
      options[optionName] = value;
    }
  }

  return {
    name: providerName.toLowerCase(),
    apiKey,
    baseUrl,
    defaultModel,
    options: Object.keys(options).length > 0 ? options : undefined,
  };
}

/**
 * Load LLM client configuration from environment variables
 *
 * Env vars:
 * - LLM_DEFAULT_PROVIDER - Default provider to use (required)
 * - LLM_DEFAULT_MODEL - Override default model (optional)
 * - LLM_DEFAULT_MAX_RETRIES - Default max retries (optional, default: 2)
 * - LLM_{PROVIDER}_* - Provider-specific configuration
 *
 * @param env - Environment variables (defaults to process.env)
 */
export function loadConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): LLMClientConfig {
  const defaultProvider = env.LLM_DEFAULT_PROVIDER?.toLowerCase() ?? "openai";
  const defaultModel = env.LLM_DEFAULT_MODEL;
  const defaultMaxRetries = parseInt(env.LLM_DEFAULT_MAX_RETRIES ?? "2", 10);

  // Discover configured providers by scanning for API keys
  const providers: Record<string, ProviderConfig> = {};

  // Check known providers
  const knownProviders = ["openai", "anthropic"];
  for (const provider of knownProviders) {
    const config = parseProviderFromEnv(provider, env);
    if (config) {
      providers[provider] = config;
    }
  }

  // Also check for any LLM_*_API_KEY pattern to discover custom providers
  for (const key of Object.keys(env)) {
    const match = key.match(/^LLM_([A-Z0-9_]+)_API_KEY$/);
    if (match) {
      const providerName = match[1].toLowerCase();
      if (!providers[providerName]) {
        const config = parseProviderFromEnv(providerName, env);
        if (config) {
          providers[providerName] = config;
        }
      }
    }
  }

  return {
    defaultProvider,
    defaultModel,
    providers,
    defaultMaxRetries,
  };
}

/**
 * Get a specific provider config
 */
export function getProviderConfig(
  config: LLMClientConfig,
  providerName?: string,
): ProviderConfig | undefined {
  const name = providerName?.toLowerCase() ?? config.defaultProvider;
  return config.providers[name];
}

/**
 * Check if a provider is configured
 */
export function isProviderConfigured(
  config: LLMClientConfig,
  providerName: string,
): boolean {
  return providerName.toLowerCase() in config.providers;
}

/**
 * Get list of configured provider names
 */
export function getConfiguredProviders(config: LLMClientConfig): string[] {
  return Object.keys(config.providers);
}
