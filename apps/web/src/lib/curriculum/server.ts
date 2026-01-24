/**
 * Server-only data fetching for curriculum/practice pages
 *
 * These functions make direct database calls for use in Server Components,
 * avoiding the HTTP round-trip that would occur with API routes.
 *
 * Use these for SSR prefetching with React Query's HydrationBoundary.
 */

import 'server-only'

import { eq, inArray, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import { parentChild } from '@/db/schema'
import type { Player } from '@/db/schema/players'
import { getPlayer } from '@/lib/arcade/player-manager'
import { getViewerId } from '@/lib/viewer'
import { computeIntervention, computeSkillCategory, type StudentWithSkillData } from '@/utils/studentGrouping'
import {
  getAllSkillMastery,
  getPaginatedSessions,
  getPlayerCurriculum,
  getRecentSessions,
} from './progress-manager'
import { getActiveSessionPlan, getRecentSessionResults } from './session-planner'

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
 * Result from getPlayersWithSkillData including context for page rendering
 */
export interface PlayersWithSkillDataResult {
  players: StudentWithSkillData[]
  viewerId: string
  userId: string
}

/**
 * Get all players for the current viewer with enhanced skill data.
 *
 * Includes:
 * - practicingSkills: List of skill IDs being practiced
 * - lastPracticedAt: Most recent practice timestamp (max of all skill lastPracticedAt)
 * - skillCategory: Computed highest-level skill category
 * - intervention: Intervention data if student needs attention
 *
 * Also returns viewerId and userId to avoid redundant calls in page components.
 *
 * Performance: Uses batched queries to avoid N+1 query patterns.
 * - Single query for all skill mastery records across all players
 * - Returns viewerId/userId to avoid redundant getViewerId() calls
 */
export async function getPlayersWithSkillData(): Promise<PlayersWithSkillDataResult> {
  const viewerId = await getViewerId()

  // Get or create user record
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  })

  if (!user) {
    const [newUser] = await db.insert(schema.users).values({ guestId: viewerId }).returning()
    user = newUser
  }

  const userId = user.id

  // Get player IDs linked via parent_child table
  const linkedPlayerIds = await db.query.parentChild.findMany({
    where: eq(parentChild.parentUserId, user.id),
  })
  const linkedIds = linkedPlayerIds.map((link) => link.childPlayerId)

  // Get all players: created by this user OR linked via parent_child
  let players: Player[]
  if (linkedIds.length > 0) {
    players = await db.query.players.findMany({
      where: or(eq(schema.players.userId, user.id), inArray(schema.players.id, linkedIds)),
      orderBy: (players, { desc }) => [desc(players.createdAt)],
    })
  } else {
    players = await db.query.players.findMany({
      where: eq(schema.players.userId, user.id),
      orderBy: (players, { desc }) => [desc(players.createdAt)],
    })
  }

  if (players.length === 0) {
    return { players: [], viewerId, userId }
  }

  // OPTIMIZATION: Batch query all skill mastery records for all players at once
  const playerIds = players.map((p) => p.id)
  const allSkillMastery = await db.query.playerSkillMastery.findMany({
    where: inArray(schema.playerSkillMastery.playerId, playerIds),
  })

  // Group skill mastery by player ID for O(1) lookups
  const skillsByPlayerId = new Map<string, typeof allSkillMastery>()
  for (const skill of allSkillMastery) {
    const existing = skillsByPlayerId.get(skill.playerId) || []
    existing.push(skill)
    skillsByPlayerId.set(skill.playerId, existing)
  }

  // First pass: compute basic skill data without intervention (no additional DB queries)
  const playersWithBasicSkills = players.map((player) => {
    const skills = skillsByPlayerId.get(player.id) || []

    // Get practicing skills and compute lastPracticedAt
    const practicingSkills: string[] = []
    let lastPracticedAt: Date | null = null

    for (const skill of skills) {
      if (skill.isPracticing) {
        practicingSkills.push(skill.skillId)
      }
      if (skill.lastPracticedAt) {
        if (!lastPracticedAt || skill.lastPracticedAt > lastPracticedAt) {
          lastPracticedAt = skill.lastPracticedAt
        }
      }
    }

    const skillCategory = computeSkillCategory(practicingSkills)

    return {
      ...player,
      practicingSkills,
      lastPracticedAt,
      skillCategory,
      intervention: null as ReturnType<typeof computeIntervention>,
    }
  })

  // PERFORMANCE: Skip expensive intervention computation during SSR
  // Intervention badges are helpful but not critical for initial render.
  // They can be computed lazily on the client if needed.
  // This avoids N additional database queries for session history.
  return { players: playersWithBasicSkills, viewerId, userId }
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
