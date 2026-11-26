/**
 * Base URL for the one call that stays on OpenAI: realtime voice
 * (`…/realtime/*`). Speech goes to ElevenLabs through the proxy's door
 * (`src/lib/speech/synthesize.ts`).
 *
 * Realtime voice is the one documented exception to "every LLM call goes
 * through `@soroban/llm-client`": a live speech-to-speech session has no
 * `claude -p` equivalent. Text and vision calls go through the LLM client
 * (default provider `claude_code`); images go through the switch proxy
 * (`src/lib/images/switch-images.ts`).
 *
 * Follows `OPENAI_MEDIA_BASE_URL`, else api.openai.com. (Deliberately NOT
 * `LLM_OPENAI_*`: the llm-client config loader sweeps every extra
 * `LLM_OPENAI_*` var into provider options.)
 *
 * A function rather than a constant so env is read at call time: runtime env
 * always wins over anything the bundler evaluated at build.
 *
 * Known exception: the browser-side WebRTC SDP exchange in
 * `src/lib/voice/useVoiceCall.ts` calls api.openai.com directly with an
 * ephemeral token and cannot use server env vars.
 */
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

/** Base URL for realtime voice calls (`…/realtime/*`). */
export function openAiMediaBaseUrl(): string {
  return (process.env.OPENAI_MEDIA_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '')
}
