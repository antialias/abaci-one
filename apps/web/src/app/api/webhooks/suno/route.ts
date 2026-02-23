/**
 * Suno Webhook — receives callbacks from sunoapi.org when song generation completes.
 *
 * POST /api/webhooks/suno?songId={songId}
 *
 * Public endpoint (no auth) — Suno sends callbacks here.
 * Handles callbackType: 'text' (lyrics), 'first' (streaming), 'complete' (done).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { db, schema } from '@/db'
import { getSocketIO } from '@/lib/socket-io'
import type { SunoCallbackPayload } from '@/lib/suno/client'

const SONGS_DIR = join(process.cwd(), 'data', 'audio', 'songs')

export async function POST(request: NextRequest) {
  const songId = request.nextUrl.searchParams.get('songId')

  if (!songId) {
    return NextResponse.json({ error: 'Missing songId parameter' }, { status: 400 })
  }

  try {
    const payload = (await request.json()) as SunoCallbackPayload

    // Look up the song record
    const [song] = await db
      .select()
      .from(schema.sessionSongs)
      .where(eq(schema.sessionSongs.id, songId))
      .limit(1)

    if (!song) {
      console.warn(`[suno-webhook] Song not found: ${songId}`)
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    const sunoItem = payload.data?.[0]
    if (!sunoItem) {
      console.warn(`[suno-webhook] No data in callback for song: ${songId}`)
      return NextResponse.json({ ok: true })
    }

    switch (payload.callbackType) {
      case 'first': {
        // First audio available (streaming)
        await db
          .update(schema.sessionSongs)
          .set({
            status: 'streaming',
            audioUrl: sunoItem.stream_audio_url ?? sunoItem.audio_url,
          })
          .where(eq(schema.sessionSongs.id, songId))
        break
      }

      case 'complete': {
        // Final audio ready — download and save locally
        const audioUrl = sunoItem.audio_url
        if (!audioUrl) {
          console.error(`[suno-webhook] No audio_url in complete callback for song: ${songId}`)
          await db
            .update(schema.sessionSongs)
            .set({
              status: 'failed',
              errorMessage: 'No audio URL in Suno callback',
            })
            .where(eq(schema.sessionSongs.id, songId))
          break
        }

        try {
          // Download the MP3
          await db
            .update(schema.sessionSongs)
            .set({ status: 'downloading' })
            .where(eq(schema.sessionSongs.id, songId))

          const audioResponse = await fetch(audioUrl)
          if (!audioResponse.ok) {
            throw new Error(`Failed to download audio: ${audioResponse.status}`)
          }

          const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
          const localPath = join(SONGS_DIR, `${songId}.mp3`)

          // Ensure directory exists
          await mkdir(dirname(localPath), { recursive: true })
          await writeFile(localPath, audioBuffer)

          // Update record as completed
          await db
            .update(schema.sessionSongs)
            .set({
              status: 'completed',
              audioUrl,
              localFilePath: localPath,
              durationSeconds: sunoItem.duration ?? null,
              completedAt: new Date(),
            })
            .where(eq(schema.sessionSongs.id, songId))

          // Emit Socket.IO event for instant client notification
          try {
            const io = await getSocketIO()
            if (io) {
              io.emit(`session-song:ready:${song.sessionPlanId}`, {
                songId,
                planId: song.sessionPlanId,
              })
            }
          } catch {
            // Socket.IO not available — client will pick up via polling
          }
        } catch (downloadError) {
          const message = downloadError instanceof Error ? downloadError.message : 'Download failed'
          console.error(`[suno-webhook] Download error for song ${songId}:`, message)
          await db
            .update(schema.sessionSongs)
            .set({
              status: 'failed',
              errorMessage: message,
            })
            .where(eq(schema.sessionSongs.id, songId))
        }
        break
      }

      case 'text':
      default:
        // Text/lyrics callback or unknown type — acknowledge but no action needed
        break
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[suno-webhook] Error processing callback:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
