/**
 * Where abaci's ElevenLabs requests go, and the login they carry. Shared by
 * music (`music-client.ts`) and speech (`lib/speech/synthesize.ts`).
 *
 * ELEVENLABS_API_BASE_URL points requests at the switch proxy's ElevenLabs
 * door (`http://<nas>:8788/elevenlabs`), which takes ElevenLabs' own paths and
 * bodies and pays from the brain's ElevenLabs accounts; there,
 * ELEVENLABS_MUSIC_API_KEY is the app's proxy login, not an ElevenLabs key.
 * Both are read at call time so runtime env wins over anything bundled.
 */

const ELEVENLABS_DEFAULT_BASE = 'https://api.elevenlabs.io'

export function elevenLabsBaseUrl(): string {
  return (process.env.ELEVENLABS_API_BASE_URL || ELEVENLABS_DEFAULT_BASE).replace(/\/+$/, '')
}

export function elevenLabsApiKey(): string {
  const key = process.env.ELEVENLABS_MUSIC_API_KEY
  if (!key) {
    throw new Error('ELEVENLABS_MUSIC_API_KEY environment variable is not set')
  }
  return key
}
