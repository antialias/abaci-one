import { sql } from 'drizzle-orm'
import { existsSync } from 'fs'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { db } from '@/db'
import { ttsCollectedClipSay, ttsCollectedClips } from '@/db/schema'
import { AUDIO_MANIFEST_MAP } from '@/lib/audio/audioManifest'
import { isNonVoiceFolder, isSafeVoiceFolder } from '@/lib/audio/voices'
import { withAuth } from '@/lib/auth/withAuth'
import { clipFileStem } from '@/lib/speech/clipStorage'
import { FLUSH_LIMITS } from '@/lib/speech/collectedClipLimits'
import { firstWrittenSayText } from '@/lib/speech/collectedClipText'
import { speechRequestText } from '@/lib/speech/synthesize'

type FlushClip = {
  clipId: string
  say?: Record<string, string>
  tone?: string
  playCount?: number
}

/** A well-formed entry within the bounds; anything else is skipped. */
function isAcceptableClip(c: unknown): c is FlushClip {
  if (!c || typeof c !== 'object') return false
  const { clipId, say, tone, playCount } = c as Record<string, unknown>
  if (typeof clipId !== 'string' || !clipId || clipId.length > FLUSH_LIMITS.clipIdChars)
    return false
  if (tone != null && (typeof tone !== 'string' || tone.length > FLUSH_LIMITS.toneChars))
    return false
  if (playCount != null && (typeof playCount !== 'number' || !Number.isFinite(playCount))) {
    return false
  }
  if (say == null) return true
  if (typeof say !== 'object' || Array.isArray(say)) return false
  const entries = Object.entries(say)
  return (
    entries.length <= FLUSH_LIMITS.localesPerClip &&
    entries.every(
      ([locale, text]) =>
        locale.length > 0 &&
        locale.length <= FLUSH_LIMITS.localeChars &&
        typeof text === 'string' &&
        text.length <= FLUSH_LIMITS.textChars
    )
  )
}

function audioDir(): string {
  return join(process.cwd(), 'data', 'audio')
}

/**
 * POST /api/audio/collected-clips
 *
 * Upserts a batch of collected clips from the client.
 * Increments play_count and updates last_seen_at. A clip's tone and each
 * (clip, locale) say text are first-write-wins: guests can call this, so a
 * later request can't rewrite the words an existing clip is known by.
 *
 * Payload: { clips: [{ clipId, say?, tone, playCount }] }, within
 * FLUSH_LIMITS (the first 1,000 clips are kept; an entry over a length
 * limit is skipped).
 *   - clipId: human-readable clip ID
 *   - say: optional locale -> text map (e.g. { "en": "Hello" })
 *   - tone: freeform tone/instruction for TTS generation
 *   - playCount: number of times played since last flush
 */
export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const sent: unknown = body?.clips

    if (!Array.isArray(sent) || sent.length === 0) {
      return NextResponse.json({ ok: true, upserted: 0 })
    }
    if (sent.length > FLUSH_LIMITS.clips) {
      console.warn(
        `[collected-clips] flush of ${sent.length} clips; keeping the first ${FLUSH_LIMITS.clips}`
      )
    }
    const clips = sent.slice(0, FLUSH_LIMITS.clips).filter(isAcceptableClip)

    const now = new Date().toISOString()
    let upserted = 0

    for (const clip of clips) {
      // Upsert the clip row
      await db
        .insert(ttsCollectedClips)
        .values({
          id: clip.clipId,
          tone: clip.tone || '',
          playCount: Math.max(0, Math.floor(clip.playCount || 0)),
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: ttsCollectedClips.id,
          set: {
            playCount: sql`${ttsCollectedClips.playCount} + ${Math.max(0, Math.floor(clip.playCount || 0))}`,
            lastSeenAt: now,
          },
        })

      // Upsert say entries
      if (clip.say) {
        for (const [locale, text] of Object.entries(clip.say)) {
          if (!text) continue
          await db
            .insert(ttsCollectedClipSay)
            .values({
              clipId: clip.clipId,
              locale,
              text,
            })
            .onConflictDoNothing({
              target: [ttsCollectedClipSay.clipId, ttsCollectedClipSay.locale],
            })
        }
      }

      upserted++
    }

    return NextResponse.json({ ok: true, upserted })
  } catch (error) {
    console.error('Error upserting collected clips:', error)
    return NextResponse.json({ error: 'Failed to upsert collected clips' }, { status: 500 })
  }
})

/**
 * GET /api/audio/collected-clips
 *
 * Returns all collected clips with their say entries, sorted by play count descending.
 * Optional `?voice=onyx` param adds per-clip generation status for that voice,
 * `charsFor` (characters generating each clip would bill; absent if it
 * can't be spoken), and `fileFor`: the file stem each clip is stored under in that voice
 * (text-keyed `t-…` for ElevenLabs voices; see lib/speech/clipStorage), so
 * the admin page plays and manages the right file.
 */
export const GET = withAuth(async (request) => {
  try {
    const voice = request.nextUrl.searchParams.get('voice')

    const clips = await db
      .select()
      .from(ttsCollectedClips)
      .orderBy(sql`${ttsCollectedClips.playCount} DESC`)

    // Fetch all say entries and group by clipId
    const sayEntries = await db.select().from(ttsCollectedClipSay)

    const sayByClipId = new Map<string, Record<string, string>>()
    for (const entry of sayEntries) {
      let map = sayByClipId.get(entry.clipId)
      if (!map) {
        map = {}
        sayByClipId.set(entry.clipId, map)
      }
      map[entry.locale] = entry.text
    }

    // Build response with say maps attached
    const clipsWithSay = clips.map((clip) => ({
      ...clip,
      say: sayByClipId.get(clip.id) ?? null,
    }))

    let generatedFor: Record<string, boolean> | undefined
    let deactivatedFor: Record<string, boolean> | undefined
    let fileFor: Record<string, string> | undefined
    let charsFor: Record<string, number> | undefined
    if (voice) {
      if (!isSafeVoiceFolder(voice) || isNonVoiceFolder(voice)) {
        return NextResponse.json({ error: 'Invalid voice' }, { status: 400 })
      }
      const voiceDir = join(audioDir(), voice)
      const sayText = await firstWrittenSayText()
      generatedFor = {}
      deactivatedFor = {}
      fileFor = {}
      charsFor = {}
      for (const clip of clips) {
        // Same text and tone the bulk task speaks (lib/tasks/collected-clip-generate).
        const manifest = AUDIO_MANIFEST_MAP[clip.id]
        const text = manifest?.text ?? sayText.get(clip.id) ?? clip.id
        const tone = manifest?.tone ?? clip.tone
        let stem = clip.id
        try {
          stem = clipFileStem(voice, clip.id, text, tone)
          // Characters ElevenLabs bills for generating it (text plus audio tag).
          charsFor[clip.id] = speechRequestText(text, tone).length
        } catch {
          // Unspeakable text (empty/too long): nothing can be stored for it.
        }
        fileFor[clip.id] = stem
        generatedFor[clip.id] =
          existsSync(join(voiceDir, `${stem}.mp3`)) ||
          existsSync(join(voiceDir, `cc-${stem}.mp3`)) ||
          existsSync(join(voiceDir, `${stem}.webm`)) ||
          existsSync(join(voiceDir, `cc-${stem}.webm`))
        deactivatedFor[clip.id] =
          existsSync(join(voiceDir, '.deactivated', `cc-${stem}.mp3`)) ||
          existsSync(join(voiceDir, '.deactivated', `cc-${stem}.webm`)) ||
          existsSync(join(voiceDir, '.deactivated', `${stem}.mp3`)) ||
          existsSync(join(voiceDir, '.deactivated', `${stem}.webm`))
      }
    }

    return NextResponse.json({
      clips: clipsWithSay,
      ...(generatedFor ? { generatedFor } : {}),
      ...(deactivatedFor ? { deactivatedFor } : {}),
      ...(fileFor ? { fileFor } : {}),
      ...(charsFor ? { charsFor } : {}),
    })
  } catch (error) {
    console.error('Error fetching collected clips:', error)
    return NextResponse.json({ error: 'Failed to fetch collected clips' }, { status: 500 })
  }
})
