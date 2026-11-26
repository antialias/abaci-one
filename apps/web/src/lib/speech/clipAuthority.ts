/**
 * What the on-demand route (POST /api/audio/generate-clip) speaks for a
 * request.
 *
 * Authority comes from storage, not from this check: text-keyed clips
 * (lib/audio/textKeyedClips) are written under a key the server computes
 * from the text it speaks (lib/speech/clipStorage), so a request can only
 * ever create audio for its own text. What's left here:
 *
 * - Manifest ids name constant text: the request's text must equal it, and
 *   the manifest's text and tone are spoken (stored under the id).
 * - Hash ids get a sanity check: the text and tone must FNV-hash to the id.
 *   FNV-1a 32 is forgeable in milliseconds, so this only turns away
 *   malformed requests; it protects nothing.
 * - Other named ids speak the request's text and tone.
 */
import { AUDIO_MANIFEST_MAP } from '@/lib/audio/audioManifest'
import { computeClipHash, isHashClipId } from '@/lib/audio/clipHash'

export type ClipAuthority =
  | { ok: true; text: string; tone: string }
  | { ok: false; status: number; error: string }

const MISMATCH = 'Clip text does not match the clip id.'

export function authorizeClipText(
  clipId: string,
  text: string,
  tone: string | null | undefined
): ClipAuthority {
  const manifest = AUDIO_MANIFEST_MAP[clipId]
  if (manifest) {
    return manifest.text === text
      ? { ok: true, text: manifest.text, tone: manifest.tone }
      : { ok: false, status: 400, error: MISMATCH }
  }
  const effectiveTone = tone ?? ''
  if (isHashClipId(clipId) && computeClipHash({ en: text }, effectiveTone) !== clipId) {
    return { ok: false, status: 400, error: MISMATCH }
  }
  return { ok: true, text, tone: effectiveTone }
}
