import { and, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { seedProfilePlayers } from '@/db/schema/seed-profile-players'
import { getUserId } from '@/lib/viewer'

/**
 * Find all expungeable players owned by the current user.
 *
 * Players are expungeable when `is_expungeable = true`, which is set at
 * creation time by debug endpoints, seed tools, and e2e tests.
 *
 * As a fallback for players created before the flag existed, also matches:
 * - Debug-{timestamp} name + 🐛 emoji (debug hub)
 * - * Test Child name suffix (e2e tests)
 * - Entries in seed_profile_players (seed tool)
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

  // Find seed players (tracked in seed_profile_players) for source annotation
  const seedEntries = await db
    .select({ playerId: seedProfilePlayers.playerId, profileId: seedProfilePlayers.profileId })
    .from(seedProfilePlayers)
    .where(inArray(seedProfilePlayers.playerId, ownedIds))

  const seedPlayerIds = new Set(seedEntries.map((e) => e.playerId))

  // Fetch all owned players
  const allOwned = await db
    .select({
      id: schema.players.id,
      name: schema.players.name,
      emoji: schema.players.emoji,
      color: schema.players.color,
      createdAt: schema.players.createdAt,
      isExpungeable: schema.players.isExpungeable,
    })
    .from(schema.players)
    .where(inArray(schema.players.id, ownedIds))

  const candidates = allOwned.filter((p) => {
    // Primary: flag set at creation time
    if (p.isExpungeable) return true
    // Fallback: legacy patterns for players created before the flag existed
    if (seedPlayerIds.has(p.id)) return true
    if (p.name.startsWith('Debug-') && p.emoji === '🐛') return true
    if (p.name.endsWith(' Test Child')) return true
    return false
  })

  // Annotate with source
  return candidates.map((p) => {
    const seedEntry = seedEntries.find((e) => e.playerId === p.id)
    let source: string = 'debug'
    if (seedEntry) source = `seed:${seedEntry.profileId}`
    else if (p.name.endsWith(' Test Child')) source = 'e2e'
    return {
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      createdAt: p.createdAt,
      source,
    }
  })
}

/**
 * GET /api/debug/cleanup
 *
 * Preview: returns the list of expungeable players that would be deleted.
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
 * Deletes all expungeable players owned by the current user.
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
