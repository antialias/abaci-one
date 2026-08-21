/**
 * Server-only data fetching for curriculum/practice pages
 *
 * These functions make direct database calls for use in Server Components,
 * avoiding the HTTP round-trip that would occur with API routes.
 *
 * Use these for SSR prefetching with React Query's HydrationBoundary.
 */

import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import type { Player } from '@/db/schema/players'
import { getPlayer } from '@/lib/arcade/player-manager'
import { batchGetEnrolledClassrooms, batchGetStudentPresence } from '@/lib/classroom'
import { getParentedPlayerIds } from '@/lib/classroom/access-control'
import { metrics } from '@/lib/metrics'
import { getUserId } from '@/lib/viewer'
import {
  computeIntervention,
  computeSkillCategory,
  type SkillDistribution,
  type StudentActiveSessionInfo,
  type StudentWithSkillData,
} from '@/utils/studentGrouping'
import { computeBktFromHistory, getStalenessWarning, type BktEvidence } from './bkt'
import { batchGetRecentBktEvidence, BKT_EVIDENCE_PLAYER_CHUNK_SIZE } from './bkt/evidence-query'
import { getAllSkillMastery, getPlayerCurriculum, getRecentSessions } from './progress-manager'
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
 * Uses getUserId() to identify the current user and fetches their players.
 */
export async function getPlayersForViewer(): Promise<Player[]> {
  const userId = await getUserId()

  // Get all players for this user
  const players = await db.query.players.findMany({
    where: eq(schema.players.userId, userId),
    orderBy: (players, { desc }) => [desc(players.createdAt)],
  })

  return players
}

/**
 * Compute skill distribution for a player from pre-fetched problem history.
 * Uses BKT to determine mastery levels and staleness.
 *
 * Accepts pre-fetched BKT evidence to avoid per-player DB queries.
 */
function computePlayerSkillDistribution(
  practicingSkillIds: string[],
  problemHistory: readonly BktEvidence[]
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
  const loadStartedAt = performance.now()

  try {
    return await loadPlayersWithSkillData(loadStartedAt)
  } catch (error) {
    metrics.practicePicker.loadDuration.observe(
      { outcome: 'error' },
      (performance.now() - loadStartedAt) / 1000
    )
    throw error
  }
}

async function loadPlayersWithSkillData(loadStartedAt: number): Promise<StudentWithSkillData[]> {
  let loadOutcome: 'complete' | 'degraded' = 'complete'

  const observeResult = (result: readonly StudentWithSkillData[]) => {
    const activeCount = result.reduce((count, player) => count + (player.isArchived ? 0 : 1), 0)
    const archivedCount = result.length - activeCount

    metrics.practicePicker.loadDuration.observe(
      { outcome: loadOutcome },
      (performance.now() - loadStartedAt) / 1000
    )
    metrics.practicePicker.studentsReturned.observe({ state: 'active' }, activeCount)
    metrics.practicePicker.studentsReturned.observe({ state: 'archived' }, archivedCount)

    // This is the exact data object serialized into the RSC boundary and API response.
    // Keep telemetry fail-open so measurement can never take down the picker.
    try {
      const payloadBytes = new TextEncoder().encode(JSON.stringify(result)).byteLength
      metrics.practicePicker.payloadSize.observe({ outcome: loadOutcome }, payloadBytes)
    } catch (error) {
      console.error('[Practice] Failed to measure picker payload size', error)
    }
  }

  const userId = await getUserId()

  // Get all player IDs the user has parent access to (owned + linked, with guest expiry)
  const parentedIds = await getParentedPlayerIds(userId)

  // Get practice students from the parented set
  // Only returns players flagged as practice students (excludes arcade-only players)
  let players: Player[]
  if (parentedIds.length > 0) {
    players = await db.query.players.findMany({
      where: and(
        inArray(schema.players.id, parentedIds),
        eq(schema.players.isPracticeStudent, true)
      ),
      orderBy: (players, { desc }) => [desc(players.createdAt)],
    })
  } else {
    players = []
  }

  if (players.length === 0) {
    observeResult([])
    return []
  }

  const playerIds = players.map((p) => p.id)

  // Batch-fetch the lightweight enrichment data in parallel (single query each).
  const [allSkillMastery, enrollmentMap, presenceMap, activeSessionMap] = await Promise.all([
    db.query.playerSkillMastery.findMany({
      where: inArray(schema.playerSkillMastery.playerId, playerIds),
    }),
    batchGetEnrolledClassrooms(playerIds),
    batchGetStudentPresence(playerIds),
    batchGetActiveSessions(playerIds),
  ])

  // BKT history is only needed for active students with skills in rotation.
  // Fetch a narrow projection with the per-player cap enforced in SQL so the
  // practice picker never transfers full historical problem payloads.
  const activePlayerIds = new Set(players.filter((player) => !player.isArchived).map((p) => p.id))
  const bktPlayerIds = [
    ...new Set(
      allSkillMastery
        .filter((skill) => skill.isPracticing && activePlayerIds.has(skill.playerId))
        .map((skill) => skill.playerId)
    ),
  ]

  metrics.practicePicker.bktPlayers.observe(bktPlayerIds.length)
  metrics.practicePicker.bktChunks.observe(
    Math.ceil(bktPlayerIds.length / BKT_EVIDENCE_PLAYER_CHUNK_SIZE)
  )

  let sessionResultsByPlayer = new Map<string, BktEvidence[]>()
  if (bktPlayerIds.length > 0) {
    const finishBktLoad = metrics.practicePicker.bktLoadDuration.startTimer()
    try {
      sessionResultsByPlayer = await batchGetRecentBktEvidence(bktPlayerIds, 100)
      finishBktLoad({ outcome: 'complete' })
      metrics.practicePicker.bktEvidence.observe(
        [...sessionResultsByPlayer.values()].reduce((count, evidence) => count + evidence.length, 0)
      )
    } catch (error) {
      finishBktLoad({ outcome: 'error' })
      loadOutcome = 'degraded'
      // Skill distribution is advisory enrichment. If history loading fails,
      // render the student picker without interventions rather than taking the
      // entire practice route down.
      console.error('[Practice] Failed to load BKT evidence for student picker', {
        playerCount: bktPlayerIds.length,
        error,
      })
      metrics.errors.total.inc({
        type: 'database',
        location: 'practice-bkt-enrichment',
      })
    }
  } else {
    metrics.practicePicker.bktEvidence.observe(0)
  }

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
      const distribution = computePlayerSkillDistribution(
        practicingSkills,
        sessionResultsByPlayer.get(player.id) ?? []
      )
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

  observeResult(playersWithSkills)
  return playersWithSkills
}

// Re-export the individual functions for granular prefetching
export { getPlayer } from '@/lib/arcade/player-manager'
export { getPracticeStudent } from './practice-student'
export {
  getAllSkillMastery,
  getPaceAssessment,
  getPaginatedSessions,
  getPlayerCurriculum,
  getRecentSessions,
} from './progress-manager'
export type { PaginatedSessionsResponse } from './progress-manager'
export type { PaceAssessment } from './timing/pace-estimation'
export {
  getActiveSessionPlan,
  getMostRecentCompletedSession,
  getRecentSessionResults,
  getSessionPlan,
} from './session-planner'
export type { ProblemResultWithContext } from './session-planner'
