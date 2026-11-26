/**
 * What the on-demand route (POST /api/audio/generate-clip) is allowed to say.
 *
 * Guests may call that route (they're real families practising), so the text
 * can't simply be trusted: anyone could otherwise write any words under any
 * clip id into a voice folder children hear. A clip id already pins its
 * words, so the route only speaks what the id stands for:
 *
 * - Hash ids (`h-xxxxxxxx`) are `computeClipHash(say, tone)`. The request's
 *   text and tone must hash to the id.
 * - Named ids (manifest clips, collected clips) have server-side text. The
 *   request's text must equal it, and the server's own text and tone are
 *   what get spoken.
 *
 * A request in another locale (text ≠ the canonical English the id was
 * hashed from) is refused too; it falls through to subtitles rather than
 * caching translated audio under an id English listeners also use.
 */
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { ttsCollectedClipSay, ttsCollectedClips } from '@/db/schema'
import { AUDIO_MANIFEST_MAP } from '@/lib/audio/audioManifest'
import { computeClipHash, isHashClipId, resolveCanonicalText } from '@/lib/audio/clipHash'

export type ClipAuthority =
  | { ok: true; text: string; tone: string }
  | { ok: false; status: number; error: string }

export type CollectedClipLookup = (clipId: string) => Promise<{ text: string; tone: string } | null>

/** The server's canonical text and tone for a collected clip, or null. */
export const lookupCollectedClip: CollectedClipLookup = async (clipId) => {
  const [clip] = await db
    .select()
    .from(ttsCollectedClips)
    .where(eq(ttsCollectedClips.id, clipId))
    .limit(1)
  if (!clip) return null
  const sayRows = await db
    .select()
    .from(ttsCollectedClipSay)
    .where(eq(ttsCollectedClipSay.clipId, clipId))
  const say = Object.fromEntries(sayRows.map((r) => [r.locale, r.text]))
  const text = resolveCanonicalText(say)
  return text ? { text, tone: clip.tone } : null
}

const MISMATCH = 'Clip text does not match the clip id.'

export async function authorizeClipText(
  clipId: string,
  text: string,
  tone: string | null | undefined,
  lookupCollected: CollectedClipLookup = lookupCollectedClip
): Promise<ClipAuthority> {
  if (isHashClipId(clipId)) {
    const effectiveTone = tone ?? ''
    return computeClipHash({ en: text }, effectiveTone) === clipId
      ? { ok: true, text, tone: effectiveTone }
      : { ok: false, status: 400, error: MISMATCH }
  }

  const manifest = AUDIO_MANIFEST_MAP[clipId]
  if (manifest) {
    return manifest.text === text
      ? { ok: true, text: manifest.text, tone: manifest.tone }
      : { ok: false, status: 400, error: MISMATCH }
  }

  const collected = await lookupCollected(clipId)
  if (!collected) {
    return { ok: false, status: 404, error: 'Unknown clip id.' }
  }
  return collected.text === text
    ? { ok: true, text: collected.text, tone: collected.tone }
    : { ok: false, status: 400, error: MISMATCH }
}
