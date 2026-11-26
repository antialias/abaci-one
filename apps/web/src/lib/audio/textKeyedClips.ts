/**
 * Which clips are stored under a key derived from their spoken text rather
 * than under their clip id. Safe to import on the client.
 *
 * For ElevenLabs voices, every clip whose text isn't a constant of the app
 * (hash ids, collected named ids) is stored under `t-…`, a key the SERVER
 * computes from exactly what it sends ElevenLabs (lib/speech/clipStorage).
 * A clip id never decides where audio is written, so a request with forged
 * text can only ever create audio under its own text's key, which nobody
 * else's request reaches.
 *
 * Manifest clips keep their named files: their text is a constant.
 * Retired OpenAI and custom voices keep their files by clip id.
 *
 * The client can't compute the key, so it never fetches these clips by id:
 * it POSTs the text to /api/audio/generate-clip (`cacheOnly` to just look).
 */
import { AUDIO_MANIFEST_MAP } from './audioManifest'
import { isElevenLabsVoice } from './voices'

export function isTextKeyedClip(voice: string, clipId: string): boolean {
  return isElevenLabsVoice(voice) && !AUDIO_MANIFEST_MAP[clipId]
}
