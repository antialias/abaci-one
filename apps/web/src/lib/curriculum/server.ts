/**
 * Server-only data fetching for curriculum/practice pages
 *
 * These functions make direct database calls for use in Server Components,
 * avoiding the HTTP round-trip that would occur with API routes.
 *
 * Use these for SSR prefetching with React Query's HydrationBoundary.
 */

import 'server-only'

import { and, eq, inArray, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import { parentChild } from '@/db/schema'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import type { Player } from '@/db/schema/players'
import { getPlayer } from '@/lib/arcade/player-manager'
import { batchGetEnrolledClassrooms, batchGetStudentPresence } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'
import {
  computeIntervention,
  computeSkillCategory,
  type SkillDistribution,
  type StudentActiveSessionInfo,
  type StudentWithSkillData,
} from '@/utils/studentGrouping'
import { computeBktFromHistory, getStalenessWarning } from './bkt'
import {
  getAllSkillMastery,
  getPaginatedSessions,
  getPlayerCurriculum,
  getRecentSessions,
} from './progress-manager'
import {
  batchGetRecentSessionResults,
  getActiveSessionPlan,
  getRecentSessionResults,
  type ProblemResultWithContext,
} from './session-planner'

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
 * Compute skill distribution for a player from pre-fetched problem history.
 * Uses BKT to determine mastery levels and staleness.
 *
 * Accepts pre-fetched ProblemResultWithContext[] to avoid per-player DB queries.
 */
function computePlayerSkillDistribution(
  practicingSkillIds: string[],
  problemHistory: ProblemResultWithContext[]
): SkillDistribution {
  const distribution: SkillDistribution = {
    strong: 0,
    stale: 0,
    developing: 0,
    weak: 0,
    unassessed: 0,
    total: practicingSkillIds.length,
  }

  if (practicingSkillIds.length === 0) return distribution

  if (problemHistory.length === 0) {
    distribution.unassessed = practicingSkillIds.length
    return distribution
  }

  const now = new Date()
  const bktResult = computeBktFromHistory(problemHistory, {})
  const bktMap = new Map(bktResult.skills.map((s) => [s.skillId, s]))

  for (const skillId of practicingSkillIds) {
    const bkt = bktMap.get(skillId)

    if (!bkt || bkt.opportunities === 0) {
      distribution.unassessed++
      continue
    }

    const classification = bkt.masteryClassification ?? 'developing'

    if (classification === 'strong') {
      const lastPracticed = bkt.lastPracticedAt
      if (lastPracticed) {
        const daysSince = (now.getTime() - lastPracticed.getTime()) / (1000 * 60 * 60 * 24)
        if (getStalenessWarning(daysSince)) {
          distribution.stale++
        } else {
          distribution.strong++
        }
      } else {
        distribution.strong++
      }
    } else {
      distribution[classification]++
    }
  }

  return distribution
}

/**
 * Batch-fetch active sessions for multiple players in a single query.
 *
 * Returns a Map<playerId, StudentActiveSessionInfo>.
 * Players without active sessions are omitted from the map.
 */
async function batchGetActiveSessions(
  playerIds: string[]
): Promise<Map<string, StudentActiveSessionInfo>> {
  const result = new Map<string, StudentActiveSessionInfo>()
  if (playerIds.length === 0) return result

  // Single query: active session plans for all players
  const activePlans = await db
    .select({
      id: schema.sessionPlans.id,
      playerId: schema.sessionPlans.playerId,
      status: schema.sessionPlans.status,
      parts: schema.sessionPlans.parts,
      results: schema.sessionPlans.results,
    })
    .from(schema.sessionPlans)
    .where(
      and(
        inArray(schema.sessionPlans.playerId, playerIds),
        inArray(schema.sessionPlans.status, ['approved', 'in_progress'])
      )
    )

  // Group by player (take most recent if multiple — though unlikely)
  for (const plan of activePlans) {
    if (result.has(plan.playerId)) continue // first one wins
    const parts = (plan.parts as SessionPart[]) || []
    const results = (plan.results as SlotResult[]) || []
    const totalProblems = parts.reduce((sum, part) => sum + part.slots.length, 0)
    result.set(plan.playerId, {
      sessionId: plan.id,
      status: plan.status,
      completedProblems: results.length,
      totalProblems,
    })
  }

  return result
}

/**
 * Get all players for the current viewer with enhanced skill data.
 *
 * Includes:
 * - practicingSkills: List of skill IDs being practiced
 * - lastPracticedAt: Most recent practice timestamp (max of all skill lastPracticedAt)
 * - skillCategory: Computed highest-level skill category
 * - intervention: Intervention data if student needs attention
 * - enrolledClassrooms: Batch-fetched classroom enrollments
 * - currentPresence: Batch-fetched presence info
 * - activeSession: Batch-fetched active session info
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

  if (players.length === 0) return []

  const playerIds = players.map((p) => p.id)

  // Batch-fetch all enrichment data in parallel (single query each)
  const [allSkillMastery, enrollmentMap, presenceMap, activeSessionMap, sessionResultsByPlayer] =
    await Promise.all([
      db.query.playerSkillMastery.findMany({
        where: inArray(schema.playerSkillMastery.playerId, playerIds),
      }),
      batchGetEnrolledClassrooms(playerIds),
      batchGetStudentPresence(playerIds),
      batchGetActiveSessions(playerIds),
      batchGetRecentSessionResults(playerIds, 100),
    ])

  // Group skill mastery by player
  const skillsByPlayer = new Map<string, typeof allSkillMastery>()
  for (const skill of allSkillMastery) {
    let list = skillsByPlayer.get(skill.playerId)
    if (!list) {
      list = []
      skillsByPlayer.set(skill.playerId, list)
    }
    list.push(skill)
  }

  // Build enriched players (all data is pre-fetched, no async work per player)
  const playersWithSkills = players.map((player) => {
      const skills = skillsByPlayer.get(player.id) ?? []

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

      // Compute skill category
      const skillCategory = computeSkillCategory(practicingSkills)

      // Compute intervention data (only for non-archived students with skills)
      let intervention = null
      if (!player.isArchived && practicingSkills.length > 0) {
        const distribution = computePlayerSkillDistribution(practicingSkills, sessionResultsByPlayer.get(player.id) ?? [])
        const daysSinceLastPractice = lastPracticedAt
          ? (Date.now() - lastPracticedAt.getTime()) / (1000 * 60 * 60 * 24)
          : Infinity

        intervention = computeIntervention(
          distribution,
          daysSinceLastPractice,
          practicingSkills.length > 0
        )
      }

      // Convert server presence to client-compatible shape
      const serverPresence = presenceMap.get(player.id)
      const currentPresence = serverPresence
        ? {
            playerId: serverPresence.playerId,
            classroomId: serverPresence.classroomId,
            enteredAt: serverPresence.enteredAt.toISOString(),
            enteredBy: serverPresence.enteredBy,
            classroom: serverPresence.classroom,
          }
        : null

      return {
        ...player,
        practicingSkills,
        lastPracticedAt,
        skillCategory,
        intervention,
        enrolledClassrooms: enrollmentMap.get(player.id) ?? [],
        currentPresence,
        activeSession: activeSessionMap.get(player.id) ?? null,
      }
  })

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
