import { type NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { join } from 'path'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { ttsCollectedClips } from '@/db/schema'
import crypto from 'crypto'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

function clipId(text: string, tone: string): string {
  return crypto.createHash('sha256').update(`${tone}::${text}`).digest('hex').slice(0, 16)
}

/**
 * POST /api/audio/collected-clips
 *
 * Upserts a batch of collected clips from the client.
 * Increments play_count and updates last_seen_at.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const clips = body?.clips as Array<{ text: string; tone: string; playCount: number }> | undefined

    if (!Array.isArray(clips) || clips.length === 0) {
      return NextResponse.json({ ok: true, upserted: 0 })
    }

    const now = new Date().toISOString()
    let upserted = 0

    for (const clip of clips) {
      if (!clip.text || !clip.tone) continue

      const id = clipId(clip.text, clip.tone)

      await db
        .insert(ttsCollectedClips)
        .values({
          id,
          text: clip.text,
          tone: clip.tone,
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

      upserted++
    }

    return NextResponse.json({ ok: true, upserted })
  } catch (error) {
    console.error('Error upserting collected clips:', error)
    return NextResponse.json(
      { error: 'Failed to upsert collected clips' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/audio/collected-clips
 *
 * Returns all collected clips, sorted by play count descending.
 * Optional `?voice=onyx` param adds per-clip generation status for that voice.
 */
export async function GET(request: NextRequest) {
  try {
    const voice = request.nextUrl.searchParams.get('voice')

    const clips = await db
      .select()
      .from(ttsCollectedClips)
      .orderBy(sql`${ttsCollectedClips.playCount} DESC`)

    let generatedFor: Record<string, boolean> | undefined
    if (voice) {
      const voiceDir = join(AUDIO_DIR, voice)
      generatedFor = {}
      for (const clip of clips) {
        generatedFor[clip.id] = existsSync(join(voiceDir, `cc-${clip.id}.mp3`))
      }
    }

    return NextResponse.json({ clips, ...(generatedFor ? { generatedFor } : {}) })
  } catch (error) {
    console.error('Error fetching collected clips:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collected clips' },
      { status: 500 }
    )
  }
}
