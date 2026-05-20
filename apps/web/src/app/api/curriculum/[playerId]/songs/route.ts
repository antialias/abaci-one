/**
 * Player Songs API — list completed songs for a player.
 *
 * GET /api/curriculum/[playerId]/songs
 */

import { eq, and, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { parseSongPlan } from '@/lib/song-share/songPlan'

export const GET = withAuth(async (_request, { params }) => {
  const { playerId } = (await params) as { playerId: string }

  const songs = await db
    .select({
      id: schema.sessionSongs.id,
      status: schema.sessionSongs.status,
      llmOutput: schema.sessionSongs.llmOutput,
      createdAt: schema.sessionSongs.createdAt,
      completedAt: schema.sessionSongs.completedAt,
    })
    .from(schema.sessionSongs)
    .where(
      and(eq(schema.sessionSongs.playerId, playerId), eq(schema.sessionSongs.status, 'completed'))
    )
    .orderBy(desc(schema.sessionSongs.createdAt))
    .limit(50)

  const mapped = songs.map((s) => {
    const plan = parseSongPlan(s.llmOutput)
    return {
      id: s.id,
      title: plan.title,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      audioPath: `/api/audio/songs/${s.id}`,
      // Sidecar JSON. Route 404s for legacy songs; the player falls back to
      // static lyrics in that case, so we always emit the path.
      alignmentPath: `/api/audio/songs/${s.id}/alignment`,
      lyrics: plan.sections.map((sec) => ({
        name: sec.name,
        lines: sec.lines,
        durationMs: sec.durationMs,
      })),
    }
  })

  return NextResponse.json({ songs: mapped })
})
