/**
 * Shared base URLs + API key for direct OpenAI REST calls — the call sites
 * that don't go through `@soroban/llm-client`.
 *
 * Text generation (`…/chat/completions`, `…/responses`) follows
 * `LLM_OPENAI_BASE_URL` — the same env var `@soroban/llm-client` honors — so
 * ALL text-LLM traffic in the app can be repointed at an OpenAI-compatible
 * proxy with a single env change.
 *
 * Media/realtime endpoints (`…/audio/speech`, `…/images/*`,
 * `…/realtime/sessions`) intentionally do NOT follow `LLM_OPENAI_BASE_URL`:
 * a chat-only proxy has no audio/image/realtime routes, so pointing text at a
 * proxy must not strand them. They stay on api.openai.com unless
 * `OPENAI_MEDIA_BASE_URL` is set explicitly.
 *
 * (Deliberately NOT `LLM_OPENAI_MEDIA_BASE_URL`: the llm-client config loader
 * sweeps every extra `LLM_OPENAI_*` var into provider options.)
 *
 * These are functions rather than constants so env is read at call time —
 * runtime env always wins over anything the bundler evaluated at build.
 *
 * Known exception: the browser-side WebRTC SDP exchange in
 * `src/lib/voice/useVoiceCall.ts` calls api.openai.com directly with an
 * ephemeral token and cannot use server env vars.
 */
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/** Base URL for text-generation calls (`…/chat/completions`, `…/responses`). */
export function openAiTextBaseUrl(): string {
  return stripTrailingSlash(process.env.LLM_OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL)
}

/** Base URL for media/realtime calls (`…/audio/speech`, `…/images/*`, `…/realtime/*`). */
export function openAiMediaBaseUrl(): string {
  return stripTrailingSlash(process.env.OPENAI_MEDIA_BASE_URL || DEFAULT_OPENAI_BASE_URL)
}

/**
 * API key for direct OpenAI calls. `LLM_OPENAI_API_KEY` is the canonical name
 * (the only one set in production); `OPENAI_API_KEY` is the legacy fallback.
 */
export function openAiApiKey(): string | undefined {
  return process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
}
