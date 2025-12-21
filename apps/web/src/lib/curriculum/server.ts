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
import { computeSkillCategory, type StudentWithSkillData } from '@/utils/studentGrouping'
import {
  getAllSkillMastery,
  getPaginatedSessions,
  getPlayerCurriculum,
  getRecentSessions,
} from './progress-manager'
import { getActiveSessionPlan } from './session-planner'

export type { PlayerCurriculum } from '@/db/schema/player-curriculum'
export type { PlayerSkillMastery } from '@/db/schema/player-skill-mastery'
export type { Player } from '@/db/schema/players'
export type { PracticeSession } from '@/db/schema/practice-sessions'
// Re-export types that consumers might need
export type { SessionPlan } from '@/db/schema/session-plans'
export type { StudentWithSkillData } from '@/utils/studentGrouping'

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

/**
 * Get all players for the current viewer with enhanced skill data.
 *
 * Includes:
 * - practicingSkills: List of skill IDs being practiced
 * - lastPracticedAt: Most recent practice timestamp (max of all skill lastPracticedAt)
 * - skillCategory: Computed highest-level skill category
 */
export async function getPlayersWithSkillData(): Promise<StudentWithSkillData[]> {
  const viewerId = await getViewerId()

  // Get or create user record
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  })

  if (!user) {
    const [newUser] = await db.insert(schema.users).values({ guestId: viewerId }).returning()
    user = newUser
  }

  // Get all players for this user
  const players = await db.query.players.findMany({
    where: eq(schema.players.userId, user.id),
    orderBy: (players, { desc }) => [desc(players.createdAt)],
  })

  // Fetch skill mastery for all players in parallel
  const playersWithSkills = await Promise.all(
    players.map(async (player) => {
      const skills = await db.query.playerSkillMastery.findMany({
        where: eq(schema.playerSkillMastery.playerId, player.id),
      })

      // Get practicing skills and compute lastPracticedAt
      const practicingSkills: string[] = []
      let lastPracticedAt: Date | null = null

      for (const skill of skills) {
        if (skill.isPracticing) {
          practicingSkills.push(skill.skillId)
        }
        // Track the most recent practice date across all skills
        if (skill.lastPracticedAt) {
          if (!lastPracticedAt || skill.lastPracticedAt > lastPracticedAt) {
            lastPracticedAt = skill.lastPracticedAt
          }
        }
      }

      // Compute skill category
      const skillCategory = computeSkillCategory(practicingSkills)

      return {
        ...player,
        practicingSkills,
        lastPracticedAt,
        skillCategory,
      }
    })
  )

  return playersWithSkills
}

// Re-export the individual functions for granular prefetching
export { getPlayer } from '@/lib/arcade/player-manager'
export {
  getAllSkillMastery,
  getPaginatedSessions,
  getPlayerCurriculum,
  getRecentSessions,
} from './progress-manager'
export type { PaginatedSessionsResponse } from './progress-manager'
export {
  getActiveSessionPlan,
  getMostRecentCompletedSession,
  getRecentSessionResults,
  getSessionPlan,
} from './session-planner'
export type { ProblemResultWithContext } from './session-planner'
