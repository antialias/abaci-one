import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { join } from 'path'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { ttsCollectedClips, ttsCollectedClipSay } from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

/**
 * POST /api/audio/collected-clips
 *
 * Upserts a batch of collected clips from the client.
 * Increments play_count, updates last_seen_at, and upserts say entries.
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
            .onConflictDoUpdate({
              target: [ttsCollectedClipSay.clipId, ttsCollectedClipSay.locale],
              set: { text },
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
 * Optional `?voice=onyx` param adds per-clip generation status for that voice.
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
    if (voice) {
      const voiceDir = join(AUDIO_DIR, voice)
      generatedFor = {}
      deactivatedFor = {}
      for (const clip of clips) {
        generatedFor[clip.id] =
          existsSync(join(voiceDir, `${clip.id}.mp3`)) ||
          existsSync(join(voiceDir, `cc-${clip.id}.mp3`)) ||
          existsSync(join(voiceDir, `${clip.id}.webm`)) ||
          existsSync(join(voiceDir, `cc-${clip.id}.webm`))
        deactivatedFor[clip.id] =
          existsSync(join(voiceDir, '.deactivated', `cc-${clip.id}.mp3`)) ||
          existsSync(join(voiceDir, '.deactivated', `cc-${clip.id}.webm`)) ||
          existsSync(join(voiceDir, '.deactivated', `${clip.id}.mp3`)) ||
          existsSync(join(voiceDir, '.deactivated', `${clip.id}.webm`))
      }
    }

    return NextResponse.json({
      clips: clipsWithSay,
      ...(generatedFor ? { generatedFor } : {}),
      ...(deactivatedFor ? { deactivatedFor } : {}),
    })
  } catch (error) {
    console.error('Error fetching collected clips:', error)
    return NextResponse.json({ error: 'Failed to fetch collected clips' }, { status: 500 })
  }
})
