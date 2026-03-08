/**
 * Player Songs API — list completed songs for a player.
 *
 * GET /api/curriculum/[playerId]/songs
 */

import { eq, and, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'

export const GET = withAuth(async (_request, { params }) => {
  const { playerId } = (await params) as { playerId: string }

  const songs = await db
    .select({
      id: schema.sessionSongs.id,
      status: schema.sessionSongs.status,
      title: schema.sessionSongs.llmOutput,
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
    const llmOutput = s.title as { title?: string } | null
    return {
      id: s.id,
      title: llmOutput?.title ?? null,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      audioPath: `/api/audio/songs/${s.id}`,
    }
  })

  return NextResponse.json({ songs: mapped })
})
