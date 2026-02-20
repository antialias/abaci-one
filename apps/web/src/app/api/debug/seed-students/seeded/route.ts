import { eq, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getDbUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/debug/seed-students/seeded
 *
 * Returns previously-seeded test students for the current user,
 * keyed by profile name. Only returns the most recently seeded
 * player for each profile.
 */
export const GET = withAuth(async () => {
  try {
    const userId = await getDbUserId()

    // Join seed_profile_players with players to get the data we need,
    // filtered to only players owned by this user
    const rows = await db
      .select({
        profileId: schema.seedProfilePlayers.profileId,
        playerId: schema.seedProfilePlayers.playerId,
        seededAt: schema.seedProfilePlayers.seededAt,
        playerName: schema.players.name,
      })
      .from(schema.seedProfilePlayers)
      .innerJoin(schema.players, eq(schema.seedProfilePlayers.playerId, schema.players.id))
      .where(eq(schema.players.userId, userId))
      .orderBy(desc(schema.seedProfilePlayers.seededAt))

    // Keep only the most recent player per profile
    const seeded: Record<string, { playerId: string; seededAt: string }> = {}
    for (const row of rows) {
      if (!seeded[row.profileId]) {
        seeded[row.profileId] = {
          playerId: row.playerId,
          seededAt:
            row.seededAt instanceof Date
              ? row.seededAt.toISOString()
              : new Date(Number(row.seededAt) * 1000).toISOString(),
        }
      }
    }

    return NextResponse.json({ seeded })
  } catch (error) {
    console.error('[seed-students/seeded] Failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch seeded students' },
      { status: 500 }
    )
  }
}, { role: 'admin' })
