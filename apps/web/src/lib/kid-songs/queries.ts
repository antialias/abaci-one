import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { db, schema } from '@/db'

const songSelection = {
  id: schema.sessionSongs.id,
  playerId: schema.sessionSongs.playerId,
  status: schema.sessionSongs.status,
  contentReviewStatus: schema.sessionSongs.contentReviewStatus,
  llmOutput: schema.sessionSongs.llmOutput,
  durationSeconds: schema.sessionSongs.durationSeconds,
  createdAt: schema.sessionSongs.createdAt,
  completedAt: schema.sessionSongs.completedAt,
}

export interface SongRow {
  id: string
  playerId: string
  status: string
  contentReviewStatus: string
  llmOutput: unknown
  durationSeconds: number | null
  createdAt: Date
  completedAt: Date | null
}

const eligibleDbPredicate = (playerId: string) =>
  and(
    eq(schema.sessionSongs.playerId, playerId),
    eq(schema.sessionSongs.status, 'completed'),
    ne(schema.sessionSongs.contentReviewStatus, 'flagged')
  )

export async function getLatestSongCandidates(playerId: string): Promise<SongRow[]> {
  return db
    .select(songSelection)
    .from(schema.sessionSongs)
    .where(eligibleDbPredicate(playerId))
    .orderBy(
      sql`coalesce(${schema.sessionSongs.completedAt}, ${schema.sessionSongs.createdAt}) desc`,
      desc(schema.sessionSongs.id)
    )
}

export async function getSongCandidateById(
  playerId: string,
  songId: string
): Promise<SongRow | null> {
  const [row] = await db
    .select(songSelection)
    .from(schema.sessionSongs)
    .where(and(eligibleDbPredicate(playerId), eq(schema.sessionSongs.id, songId)))
    .limit(1)
  return row ?? null
}
