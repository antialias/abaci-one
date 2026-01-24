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
import type { Player } from '@/db/schema/players'
import { getPlayer } from '@/lib/arcade/player-manager'
import { getViewerId } from '@/lib/viewer'
import {
  computeIntervention,
  computeSkillCategory,
  type SkillDistribution,
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
 * Compute skill distribution for a player from their problem history.
 * Uses BKT to determine mastery levels and staleness.
 */
async function computePlayerSkillDistribution(
  playerId: string,
  practicingSkillIds: string[]
): Promise<SkillDistribution> {
  const distribution: SkillDistribution = {
    strong: 0,
    stale: 0,
    developing: 0,
    weak: 0,
    unassessed: 0,
    total: practicingSkillIds.length,
  }

  if (practicingSkillIds.length === 0) return distribution

  // Fetch recent problem history (last 100 problems is enough for BKT)
  const problemHistory = await getRecentSessionResults(playerId, 100)

  if (problemHistory.length === 0) {
    // No history = all unassessed
    distribution.unassessed = practicingSkillIds.length
    return distribution
  }

  // Compute BKT
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
      // Check staleness
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
 * Get all players for the current viewer with enhanced skill data.
 *
 * Includes:
 * - practicingSkills: List of skill IDs being practiced
 * - lastPracticedAt: Most recent practice timestamp (max of all skill lastPracticedAt)
 * - skillCategory: Computed highest-level skill category
 * - intervention: Intervention data if student needs attention
 *
 * Performance: Uses batched queries to avoid N+1 query patterns.
 * - Single query for all skill mastery records across all players
 * - Single query for session history across all players needing intervention
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

  if (players.length === 0) {
    return []
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

  // Identify players needing intervention computation (non-archived with practicing skills)
  const playersNeedingIntervention = playersWithBasicSkills.filter(
    (p) => !p.isArchived && p.practicingSkills.length > 0
  )

  if (playersNeedingIntervention.length === 0) {
    return playersWithBasicSkills
  }

  // OPTIMIZATION: Batch query session history for all players needing intervention
  const interventionPlayerIds = playersNeedingIntervention.map((p) => p.id)
  const allSessionResults = await db.query.sessionPlans.findMany({
    where: and(
      inArray(schema.sessionPlans.playerId, interventionPlayerIds),
      inArray(schema.sessionPlans.status, ['completed', 'recency-refresh'])
    ),
    orderBy: (plans, { desc }) => [desc(plans.completedAt)],
    // Limit per player approximation - fetch enough for all players
    limit: interventionPlayerIds.length * 100,
  })

  // Group sessions by player ID
  const sessionsByPlayerId = new Map<string, typeof allSessionResults>()
  for (const session of allSessionResults) {
    const existing = sessionsByPlayerId.get(session.playerId) || []
    // Keep only first 100 sessions per player for BKT
    if (existing.length < 100) {
      existing.push(session)
    }
    sessionsByPlayerId.set(session.playerId, existing)
  }

  // Compute intervention for players that need it (now using in-memory data)
  const now = new Date()
  for (const player of playersWithBasicSkills) {
    if (player.isArchived || player.practicingSkills.length === 0) {
      continue
    }

    const sessions = sessionsByPlayerId.get(player.id) || []

    // Build problem history from sessions (same logic as getRecentSessionResults)
    const problemHistory: ProblemResultWithContext[] = []

    for (const session of sessions) {
      if (!session.completedAt) continue
      for (const result of session.results) {
        const part = session.parts.find((p) => p.partNumber === result.partNumber)
        const partType = part?.type ?? 'linear'
        problemHistory.push({
          ...result,
          sessionId: session.id,
          sessionCompletedAt: session.completedAt,
          partType,
        })
      }
    }

    // Sort by timestamp descending
    problemHistory.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime()
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime()
      return timeB - timeA
    })

    // Compute skill distribution from BKT
    const distribution: SkillDistribution = {
      strong: 0,
      stale: 0,
      developing: 0,
      weak: 0,
      unassessed: 0,
      total: player.practicingSkills.length,
    }

    if (problemHistory.length === 0) {
      distribution.unassessed = player.practicingSkills.length
    } else {
      const bktResult = computeBktFromHistory(problemHistory, {})
      const bktMap = new Map(bktResult.skills.map((s) => [s.skillId, s]))

      for (const skillId of player.practicingSkills) {
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
    }

    const daysSinceLastPractice = player.lastPracticedAt
      ? (now.getTime() - player.lastPracticedAt.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity

    player.intervention = computeIntervention(distribution, daysSinceLastPractice, true)
  }

  return playersWithBasicSkills
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
