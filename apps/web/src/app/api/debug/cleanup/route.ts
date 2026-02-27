import { eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { seedProfilePlayers } from '@/db/schema/seed-profile-players'
import { getUserId } from '@/lib/viewer'

/**
 * Find all debug/seed players owned by the current user.
 *
 * A player is considered a debug/seed player if:
 * 1. It has an entry in seed_profile_players (was created by the seeder), OR
 * 2. Its name matches the Debug-{timestamp} pattern AND emoji is 🐛
 *
 * Only returns players owned by the requesting user (via parent_child).
 */
async function findCleanupCandidates(userId: string) {
  // Get all player IDs owned by this user
  const ownedRelations = await db
    .select({ playerId: schema.parentChild.childPlayerId })
    .from(schema.parentChild)
    .where(eq(schema.parentChild.parentUserId, userId))

  const ownedIds = ownedRelations.map((r) => r.playerId)
  if (ownedIds.length === 0) return []

  // Find seed players (tracked in seed_profile_players)
  const seedEntries = await db
    .select({ playerId: seedProfilePlayers.playerId, profileId: seedProfilePlayers.profileId })
    .from(seedProfilePlayers)
    .where(inArray(seedProfilePlayers.playerId, ownedIds))

  const seedPlayerIds = new Set(seedEntries.map((e) => e.playerId))

  // Find debug players by naming convention (Debug-* + 🐛 emoji)
  const allOwned = await db
    .select({
      id: schema.players.id,
      name: schema.players.name,
      emoji: schema.players.emoji,
      color: schema.players.color,
      createdAt: schema.players.createdAt,
    })
    .from(schema.players)
    .where(inArray(schema.players.id, ownedIds))

  const candidates = allOwned.filter((p) => {
    // Seed player
    if (seedPlayerIds.has(p.id)) return true
    // Debug player (name pattern + emoji)
    if (p.name.startsWith('Debug-') && p.emoji === '🐛') return true
    return false
  })

  // Annotate with source
  return candidates.map((p) => {
    const seedEntry = seedEntries.find((e) => e.playerId === p.id)
    return {
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      createdAt: p.createdAt,
      source: seedEntry ? (`seed:${seedEntry.profileId}` as const) : ('debug' as const),
    }
  })
}

/**
 * GET /api/debug/cleanup
 *
 * Preview: returns the list of debug/seed players that would be deleted.
 */
export const GET = withAuth(
  async () => {
    try {
      const userId = await getUserId()
      const candidates = await findCleanupCandidates(userId)

      return NextResponse.json({
        players: candidates,
        count: candidates.length,
      })
    } catch (error) {
      console.error('[debug/cleanup] Preview failed:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to preview cleanup' },
        { status: 500 }
      )
    }
  },
  { role: 'admin' }
)

/**
 * DELETE /api/debug/cleanup
 *
 * Deletes all debug/seed players owned by the current user.
 * All related data (sessions, skills, enrollments, etc.) cascades automatically.
 */
export const DELETE = withAuth(
  async () => {
    try {
      const userId = await getUserId()
      const candidates = await findCleanupCandidates(userId)

      if (candidates.length === 0) {
        return NextResponse.json({ deleted: 0, players: [] })
      }

      const ids = candidates.map((c) => c.id)

      // Delete seed_profile_players entries first (FK references players)
      await db.delete(seedProfilePlayers).where(inArray(seedProfilePlayers.playerId, ids))

      // Delete the players (cascades to all related tables)
      await db.delete(schema.players).where(inArray(schema.players.id, ids))

      return NextResponse.json({
        deleted: candidates.length,
        players: candidates.map((c) => ({ id: c.id, name: c.name, source: c.source })),
      })
    } catch (error) {
      console.error('[debug/cleanup] Delete failed:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to cleanup' },
        { status: 500 }
      )
    }
  },
  { role: 'admin' }
)
