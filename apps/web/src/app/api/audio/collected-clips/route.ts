import { sql } from 'drizzle-orm'
import { existsSync } from 'fs'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { db } from '@/db'
import { ttsCollectedClipSay, ttsCollectedClips } from '@/db/schema'
import { AUDIO_MANIFEST_MAP } from '@/lib/audio/audioManifest'
import { resolveCanonicalText } from '@/lib/audio/clipHash'
import { isNonVoiceFolder, isSafeVoiceFolder } from '@/lib/audio/voices'
import { withAuth } from '@/lib/auth/withAuth'
import { clipFileStem } from '@/lib/speech/clipStorage'

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
 * Payload: { clips: [{ clipId, say?, tone, playCount }] }
 *   - clipId: human-readable clip ID
 *   - say: optional locale -> text map (e.g. { "en-US": "Hello" })
 *   - tone: freeform tone/instruction for TTS generation
 *   - playCount: number of times played since last flush
 */
export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const clips = body?.clips as
      | Array<{
          clipId: string
          say?: Record<string, string>
          tone: string
          playCount: number
        }>
      | undefined

    if (!Array.isArray(clips) || clips.length === 0) {
      return NextResponse.json({ ok: true, upserted: 0 })
    }

    const now = new Date().toISOString()
    let upserted = 0

    for (const clip of clips) {
      if (!clip.clipId) continue

      // Upsert the clip row
      await db
        .insert(ttsCollectedClips)
        .values({
          id: clip.clipId,
          tone: clip.tone || '',
          playCount: clip.playCount || 0,
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: ttsCollectedClips.id,
          set: {
            playCount: sql`${ttsCollectedClips.playCount} + ${clip.playCount || 0}`,
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
 * and `fileFor`: the file stem each clip is stored under in that voice
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
    if (voice) {
      if (!isSafeVoiceFolder(voice) || isNonVoiceFolder(voice)) {
        return NextResponse.json({ error: 'Invalid voice' }, { status: 400 })
      }
      const voiceDir = join(audioDir(), voice)
      generatedFor = {}
      deactivatedFor = {}
      fileFor = {}
      for (const clip of clips) {
        // Same text and tone the bulk task speaks (lib/tasks/collected-clip-generate).
        const manifest = AUDIO_MANIFEST_MAP[clip.id]
        const text = manifest?.text ?? (resolveCanonicalText(sayByClipId.get(clip.id)) || clip.id)
        let stem = clip.id
        try {
          stem = clipFileStem(voice, clip.id, text, manifest?.tone ?? clip.tone)
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
    })
  } catch (error) {
    console.error('Error fetching collected clips:', error)
    return NextResponse.json({ error: 'Failed to fetch collected clips' }, { status: 500 })
  }
})
