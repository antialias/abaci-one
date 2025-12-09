/**
 * Server-only data fetching for curriculum/practice pages
 *
 * These functions make direct database calls for use in Server Components,
 * avoiding the HTTP round-trip that would occur with API routes.
 *
 * Use these for SSR prefetching with React Query's HydrationBoundary.
 */

import 'server-only'

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { Player } from '@/db/schema/players'
import { getPlayer } from '@/lib/arcade/player-manager'
import { getViewerId } from '@/lib/viewer'
import { getAllSkillMastery, getPlayerCurriculum, getRecentSessions } from './progress-manager'
import { getActiveSessionPlan } from './session-planner'

export type { PlayerCurriculum } from '@/db/schema/player-curriculum'
export type { PlayerSkillMastery } from '@/db/schema/player-skill-mastery'
export type { Player } from '@/db/schema/players'
export type { PracticeSession } from '@/db/schema/practice-sessions'
// Re-export types that consumers might need
export type { SessionPlan } from '@/db/schema/session-plans'

/**
 * Prefetch all data needed for the practice page
 *
 * This fetches in parallel for optimal performance:
 * - Player details
 * - Active session plan
 * - Curriculum position
 * - Skill mastery records
 * - Recent practice sessions
 */
export async function prefetchPracticeData(playerId: string) {
  const [player, activeSession, curriculum, skills, recentSessions] = await Promise.all([
    getPlayer(playerId),
    getActiveSessionPlan(playerId),
    getPlayerCurriculum(playerId),
    getAllSkillMastery(playerId),
    getRecentSessions(playerId, 10),
  ])

  return {
    player: player ?? null,
    activeSession,
    curriculum,
    skills,
    recentSessions,
  }
}

/**
 * Get all players for the current viewer (server-side)
 *
 * Uses getViewerId() to identify the current user/guest and fetches their players.
 */
export async function getPlayersForViewer(): Promise<Player[]> {
  const viewerId = await getViewerId()

  // Get or create user record
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  })

  if (!user) {
    // Create user if doesn't exist
    const [newUser] = await db.insert(schema.users).values({ guestId: viewerId }).returning()
    user = newUser
  }

  // Get all players for this user
  const players = await db.query.players.findMany({
    where: eq(schema.players.userId, user.id),
    orderBy: (players, { desc }) => [desc(players.createdAt)],
  })

  return players
}

// Re-export the individual functions for granular prefetching
export { getPlayer } from '@/lib/arcade/player-manager'
export { getAllSkillMastery, getPlayerCurriculum, getRecentSessions } from './progress-manager'
export { getActiveSessionPlan, getMostRecentCompletedSession } from './session-planner'
