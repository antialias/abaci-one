/**
 * Progress manager for curriculum tracking
 * Handles CRUD operations for student curriculum progress and skill mastery
 */

import { and, desc, eq, inArray, lt, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { NewPlayerCurriculum, PlayerCurriculum } from '@/db/schema/player-curriculum'
import type { NewPlayerSkillMastery, PlayerSkillMastery } from '@/db/schema/player-skill-mastery'
import type { PracticeSession } from '@/db/schema/practice-sessions'
import {
  isTutorialSatisfied,
  type NewSkillTutorialProgress,
  type SkillTutorialProgress,
} from '@/db/schema/skill-tutorial-progress'
import { getRecentSessionResults } from '@/lib/curriculum/session-planner'

// ============================================================================
// CURRICULUM POSITION OPERATIONS
// ============================================================================

/**
 * Get a player's curriculum position
 * Returns null if the player hasn't started the curriculum
 */
export async function getPlayerCurriculum(playerId: string): Promise<PlayerCurriculum | null> {
  const result = await db.query.playerCurriculum.findFirst({
    where: eq(schema.playerCurriculum.playerId, playerId),
  })
  return result ?? null
}

/**
 * Create or update a player's curriculum position
 */
export async function upsertPlayerCurriculum(
  playerId: string,
  data: Partial<Omit<NewPlayerCurriculum, 'playerId'>>
): Promise<PlayerCurriculum> {
  const existing = await getPlayerCurriculum(playerId)

  if (existing) {
    // Update existing record
    await db
      .update(schema.playerCurriculum)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.playerCurriculum.playerId, playerId))

    return (await getPlayerCurriculum(playerId))!
  }

  // Create new record with defaults
  const newRecord: NewPlayerCurriculum = {
    playerId,
    currentLevel: data.currentLevel ?? 1,
    currentPhaseId: data.currentPhaseId ?? 'L1.add.+1.direct',
    worksheetPreset: data.worksheetPreset ?? null,
    visualizationMode: data.visualizationMode ?? false,
  }

  await db.insert(schema.playerCurriculum).values(newRecord)
  return (await getPlayerCurriculum(playerId))!
}

/**
 * Advance a player to the next curriculum phase
 */
export async function advanceToNextPhase(
  playerId: string,
  nextPhaseId: string,
  nextLevel?: number
): Promise<PlayerCurriculum> {
  return upsertPlayerCurriculum(playerId, {
    currentPhaseId: nextPhaseId,
    ...(nextLevel !== undefined ? { currentLevel: nextLevel } : {}),
  })
}

// ============================================================================
// SKILL MASTERY OPERATIONS
// ============================================================================

/**
 * Get a player's mastery for a specific skill
 */
export async function getSkillMastery(
  playerId: string,
  skillId: string
): Promise<PlayerSkillMastery | null> {
  const result = await db.query.playerSkillMastery.findFirst({
    where: and(
      eq(schema.playerSkillMastery.playerId, playerId),
      eq(schema.playerSkillMastery.skillId, skillId)
    ),
  })
  return result ?? null
}

/**
 * Get all skill mastery records for a player
 */
export async function getAllSkillMastery(playerId: string): Promise<PlayerSkillMastery[]> {
  return db.query.playerSkillMastery.findMany({
    where: eq(schema.playerSkillMastery.playerId, playerId),
    orderBy: desc(schema.playerSkillMastery.lastPracticedAt),
  })
}

/**
 * Get all skills in a player's active practice rotation
 */
export async function getPracticingSkills(playerId: string): Promise<PlayerSkillMastery[]> {
  return db.query.playerSkillMastery.findMany({
    where: and(
      eq(schema.playerSkillMastery.playerId, playerId),
      eq(schema.playerSkillMastery.isPracticing, true)
    ),
    orderBy: desc(schema.playerSkillMastery.lastPracticedAt),
  })
}

/**
 * Set which skills are in a player's active practice rotation (teacher checkbox UI)
 * Skills in the list will have isPracticing=true, others isPracticing=false.
 *
 * @param playerId - The player to update
 * @param practicingSkillIds - Array of skill IDs to mark as practicing
 * @returns All skill mastery records for the player after update
 */
export async function setPracticingSkills(
  playerId: string,
  practicingSkillIds: string[]
): Promise<PlayerSkillMastery[]> {
  const now = new Date()
  const practicingSet = new Set(practicingSkillIds)

  // Get all existing skills for this player
  const existingSkills = await getAllSkillMastery(playerId)
  const existingSkillIds = new Set(existingSkills.map((s) => s.skillId))

  // Update existing skills
  for (const skill of existingSkills) {
    const shouldBePracticing = practicingSet.has(skill.skillId)

    // Only update if isPracticing changed
    if (skill.isPracticing !== shouldBePracticing) {
      await db
        .update(schema.playerSkillMastery)
        .set({
          isPracticing: shouldBePracticing,
          updatedAt: now,
        })
        .where(eq(schema.playerSkillMastery.id, skill.id))
    }
  }

  // Create new skills that don't exist yet
  for (const skillId of practicingSkillIds) {
    if (!existingSkillIds.has(skillId)) {
      const newRecord: NewPlayerSkillMastery = {
        playerId,
        skillId,
        isPracticing: true,
        lastPracticedAt: now,
      }
      await db.insert(schema.playerSkillMastery).values(newRecord)
    }
  }

  return getAllSkillMastery(playerId)
}

/**
 * @deprecated Use setPracticingSkills instead. Kept for backwards compatibility.
 */
export async function setMasteredSkills(
  playerId: string,
  masteredSkillIds: string[]
): Promise<PlayerSkillMastery[]> {
  return setPracticingSkills(playerId, masteredSkillIds)
}

/**
 * Refresh skill recency by inserting a sentinel record
 *
 * Use this when a teacher wants to mark a skill as "recently practiced"
 * (e.g., student did offline workbooks). This inserts a "recency-refresh"
 * sentinel record that BKT sees for lastPracticedAt but ignores for pKnown.
 *
 * The sentinel approach means:
 * - Single source of truth: all lastPracticedAt comes from problem history
 * - No abstraction gap: BKT naturally handles recency from the same data source
 * - Clear semantics: sentinel records are clearly marked with source='recency-refresh'
 *
 * @param playerId - The player's ID
 * @param skillId - The skill to refresh
 * @returns The created session plan containing the sentinel, or null if skill not found
 */
export async function refreshSkillRecency(
  playerId: string,
  skillId: string
): Promise<{ sessionId: string; timestamp: Date } | null> {
  const existing = await getSkillMastery(playerId, skillId)

  if (!existing) {
    return null
  }

  const now = new Date()

  // Create a minimal session plan with status='recency-refresh'
  // This contains a single sentinel SlotResult
  const sentinelResult: schema.SlotResult = {
    partNumber: 1,
    slotIndex: 0,
    problem: {
      terms: [0],
      answer: 0,
      skillsRequired: [skillId],
    },
    studentAnswer: 0,
    isCorrect: true, // Doesn't matter - BKT ignores for recency-refresh
    responseTimeMs: 0,
    skillsExercised: [skillId],
    usedOnScreenAbacus: false,
    timestamp: now,
    hadHelp: false,
    incorrectAttempts: 0,
    source: 'recency-refresh', // This marks it as a sentinel record
  }

  const sessionPlan: schema.NewSessionPlan = {
    playerId,
    targetDurationMinutes: 0,
    estimatedProblemCount: 0,
    avgTimePerProblemSeconds: 0,
    parts: [], // No actual parts - just the sentinel result
    summary: {
      focusDescription: 'Recency refresh',
      totalProblemCount: 0,
      estimatedMinutes: 0,
      parts: [],
    },
    status: 'recency-refresh',
    results: [sentinelResult],
    createdAt: now,
    completedAt: now,
  }

  const [inserted] = await db.insert(schema.sessionPlans).values(sessionPlan).returning()

  return {
    sessionId: inserted.id,
    timestamp: now,
  }
}

/**
 * Record a skill attempt (correct or incorrect)
 * Updates the lastPracticedAt timestamp on the skill mastery record.
 *
 * NOTE: Attempt/correct statistics are now computed on-the-fly from session results.
 * This function only updates metadata fields (lastPracticedAt) and ensures the
 * skill record exists.
 */
export async function recordSkillAttempt(
  playerId: string,
  skillId: string,
  _isCorrect: boolean
): Promise<PlayerSkillMastery> {
  const existing = await getSkillMastery(playerId, skillId)
  const now = new Date()

  if (existing) {
    // Update lastPracticedAt timestamp
    await db
      .update(schema.playerSkillMastery)
      .set({
        lastPracticedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.playerSkillMastery.id, existing.id))

    return (await getSkillMastery(playerId, skillId))!
  }

  // Create new record - if we're recording an attempt, this skill is being practiced
  const newRecord: NewPlayerSkillMastery = {
    playerId,
    skillId,
    isPracticing: true, // skill is being practiced
    lastPracticedAt: now,
  }

  await db.insert(schema.playerSkillMastery).values(newRecord)
  return (await getSkillMastery(playerId, skillId))!
}

/**
 * Record a skill attempt with help tracking
 *
 * Updates the lastPracticedAt timestamp and tracks whether help was used.
 * BKT handles mastery estimation via evidence weighting (helped answers get 0.5x weight).
 *
 * NOTE: BKT's conjunctive blame attribution identifies weak skills from multi-skill problems.
 */
export async function recordSkillAttemptWithHelp(
  playerId: string,
  skillId: string,
  _isCorrect: boolean,
  hadHelp: boolean,
  _responseTimeMs?: number
): Promise<PlayerSkillMastery> {
  const existing = await getSkillMastery(playerId, skillId)
  const now = new Date()

  if (existing) {
    await db
      .update(schema.playerSkillMastery)
      .set({
        lastPracticedAt: now,
        updatedAt: now,
        lastHadHelp: hadHelp,
      })
      .where(eq(schema.playerSkillMastery.id, existing.id))

    return (await getSkillMastery(playerId, skillId))!
  }

  // Create new record with help tracking - skill is being practiced
  const newRecord: NewPlayerSkillMastery = {
    playerId,
    skillId,
    isPracticing: true, // skill is being practiced
    lastPracticedAt: now,
    lastHadHelp: hadHelp,
  }

  await db.insert(schema.playerSkillMastery).values(newRecord)

  return (await getSkillMastery(playerId, skillId))!
}

/**
 * Record multiple skill attempts with help tracking (for batch updates after a problem)
 * Response time is shared across all skills since they come from the same problem
 */
export async function recordSkillAttemptsWithHelp(
  playerId: string,
  skillResults: Array<{ skillId: string; isCorrect: boolean }>,
  hadHelp: boolean,
  responseTimeMs?: number
): Promise<PlayerSkillMastery[]> {
  const results: PlayerSkillMastery[] = []

  for (const { skillId, isCorrect } of skillResults) {
    const result = await recordSkillAttemptWithHelp(
      playerId,
      skillId,
      isCorrect,
      hadHelp,
      responseTimeMs
    )
    results.push(result)
  }

  return results
}

/**
 * Record multiple skill attempts at once (for batch updates after a problem)
 */
export async function recordSkillAttempts(
  playerId: string,
  skillResults: Array<{ skillId: string; isCorrect: boolean }>
): Promise<PlayerSkillMastery[]> {
  const results: PlayerSkillMastery[] = []

  for (const { skillId, isCorrect } of skillResults) {
    const result = await recordSkillAttempt(playerId, skillId, isCorrect)
    results.push(result)
  }

  return results
}

/**
 * Calculate what percentage of given skills are being practiced
 */
export async function calculatePracticingPercent(
  playerId: string,
  skillIds: string[]
): Promise<number> {
  if (skillIds.length === 0) return 0

  const masteryRecords = await getAllSkillMastery(playerId)
  const relevantRecords = masteryRecords.filter((r) => skillIds.includes(r.skillId))

  const practicingCount = relevantRecords.filter((r) => r.isPracticing).length

  return Math.round((practicingCount / skillIds.length) * 100)
}

/**
 * @deprecated Use calculatePracticingPercent instead.
 */
export async function calculateMasteryPercent(
  playerId: string,
  skillIds: string[]
): Promise<number> {
  return calculatePracticingPercent(playerId, skillIds)
}

// ============================================================================
// PRACTICE SESSION OPERATIONS
// ============================================================================

/**
 * Get recent practice sessions for a player
 *
 * NOTE: This queries from session_plans (the active session system) and
 * transforms results into PracticeSession format for the dashboard.
 * The old practice_sessions table is no longer populated.
 */
export async function getRecentSessions(
  playerId: string,
  limit: number = 10
): Promise<PracticeSession[]> {
  // Query completed/abandoned sessions from session_plans
  const sessions = await db.query.sessionPlans.findMany({
    where: and(
      eq(schema.sessionPlans.playerId, playerId),
      inArray(schema.sessionPlans.status, ['completed', 'abandoned'])
    ),
    orderBy: desc(schema.sessionPlans.completedAt),
    limit,
  })

  // Transform session_plans data into PracticeSession format
  return sessions.map((session) => {
    // Parse results from JSON
    const results =
      (session.results as Array<{
        isCorrect: boolean
        responseTimeMs: number
        skillsExercised: string[]
      }>) || []

    const problemsAttempted = results.length
    const problemsCorrect = results.filter((r) => r.isCorrect).length
    const totalTimeMs = results.reduce((sum, r) => sum + (r.responseTimeMs || 0), 0)
    const averageTimeMs = problemsAttempted > 0 ? Math.round(totalTimeMs / problemsAttempted) : null
    const skillsUsed = [...new Set(results.flatMap((r) => r.skillsExercised || []))]

    return {
      id: session.id,
      playerId: session.playerId,
      phaseId: 'session', // session_plans don't have phaseId
      problemsAttempted,
      problemsCorrect,
      averageTimeMs,
      totalTimeMs,
      skillsUsed,
      visualizationMode: false, // Not tracked in session_plans
      startedAt: session.startedAt || session.createdAt,
      completedAt: session.completedAt,
    } as PracticeSession
  })
}

/**
 * Response type for paginated sessions
 */
export interface PaginatedSessionsResponse {
  sessions: PracticeSession[]
  nextCursor: string | null
  hasMore: boolean
}

/**
 * Get paginated sessions with cursor-based pagination
 * Cursor is the session ID to start after (for "load more" functionality)
 */
export async function getPaginatedSessions(
  playerId: string,
  limit: number = 20,
  cursor?: string
): Promise<PaginatedSessionsResponse> {
  console.log(`[getPaginatedSessions] playerId=${playerId}, limit=${limit}, cursor=${cursor}`)

  // If we have a cursor, we need to find sessions older than that cursor's completedAt
  let cursorSession: typeof schema.sessionPlans.$inferSelect | null = null
  if (cursor) {
    cursorSession =
      (await db.query.sessionPlans.findFirst({
        where: eq(schema.sessionPlans.id, cursor),
      })) ?? null
    console.log(
      `[getPaginatedSessions] cursorSession found: ${!!cursorSession}, completedAt=${cursorSession?.completedAt}`
    )
  }

  // Build the query conditions - include cursor condition in SQL for proper pagination
  const conditions = [
    eq(schema.sessionPlans.playerId, playerId),
    inArray(schema.sessionPlans.status, ['completed', 'abandoned']),
  ]

  // Add cursor condition to SQL query (sessions older than cursor)
  if (cursorSession?.completedAt) {
    // Sessions with earlier completedAt, OR same completedAt but smaller ID (for tie-breaking)
    conditions.push(
      or(
        lt(schema.sessionPlans.completedAt, cursorSession.completedAt),
        and(
          eq(schema.sessionPlans.completedAt, cursorSession.completedAt),
          lt(schema.sessionPlans.id, cursorSession.id)
        )
      )!
    )
  }

  // Query one extra to check if there are more
  const sessions = await db.query.sessionPlans.findMany({
    where: and(...conditions),
    orderBy: desc(schema.sessionPlans.completedAt),
    limit: limit + 1,
  })

  console.log(`[getPaginatedSessions] Raw query returned ${sessions.length} sessions`)

  // Check if there are more results
  const hasMore = sessions.length > limit
  const resultSessions = hasMore ? sessions.slice(0, limit) : sessions
  console.log(`[getPaginatedSessions] Final: ${resultSessions.length} sessions, hasMore=${hasMore}`)

  // Transform to PracticeSession format
  const practiceSessionsResult = resultSessions.map((session) => {
    const results =
      (session.results as Array<{
        isCorrect: boolean
        responseTimeMs: number
        skillsExercised: string[]
      }>) || []

    const problemsAttempted = results.length
    const problemsCorrect = results.filter((r) => r.isCorrect).length
    const totalTimeMs = results.reduce((sum, r) => sum + (r.responseTimeMs || 0), 0)
    const averageTimeMs = problemsAttempted > 0 ? Math.round(totalTimeMs / problemsAttempted) : null
    const skillsUsed = [...new Set(results.flatMap((r) => r.skillsExercised || []))]

    return {
      id: session.id,
      playerId: session.playerId,
      phaseId: 'session',
      problemsAttempted,
      problemsCorrect,
      averageTimeMs,
      totalTimeMs,
      skillsUsed,
      visualizationMode: false,
      startedAt: session.startedAt || session.createdAt,
      completedAt: session.completedAt,
    } as PracticeSession
  })

  // Next cursor is the last session's ID
  const nextCursor =
    hasMore && resultSessions.length > 0 ? resultSessions[resultSessions.length - 1].id : null

  return {
    sessions: practiceSessionsResult,
    nextCursor,
    hasMore,
  }
}

// ============================================================================
// COMPOSITE OPERATIONS
// ============================================================================

/**
 * Get full progress summary for a player
 */
export interface PlayerProgressSummary {
  curriculum: PlayerCurriculum | null
  totalSkills: number
  /** Number of skills with isPracticing=true */
  practicingSkillCount: number
  /** Percentage of skills being practiced */
  practicingPercent: number
  recentSessions: PracticeSession[]
  recentSkills: PlayerSkillMastery[]
  /** @deprecated Use practicingSkillCount instead */
  masteredSkills: number
  /** @deprecated No longer used - was always 0 */
  practicingSkills: number
  /** @deprecated No longer used */
  learningSkills: number
  /** @deprecated Use practicingPercent instead */
  masteryPercent: number
}

export async function getPlayerProgressSummary(playerId: string): Promise<PlayerProgressSummary> {
  const [curriculum, allSkills, recentSessions] = await Promise.all([
    getPlayerCurriculum(playerId),
    getAllSkillMastery(playerId),
    getRecentSessions(playerId, 5),
  ])

  const practicingSkillCount = allSkills.filter((s) => s.isPracticing).length
  const totalSkills = allSkills.length

  const practicingPercent =
    totalSkills > 0 ? Math.round((practicingSkillCount / totalSkills) * 100) : 0

  // Get 5 most recently practiced skills
  const recentSkills = allSkills.slice(0, 5)

  return {
    curriculum,
    totalSkills,
    practicingSkillCount,
    practicingPercent,
    recentSessions,
    recentSkills,
    // Backwards compat - deprecated fields
    masteredSkills: practicingSkillCount,
    practicingSkills: 0,
    learningSkills: totalSkills - practicingSkillCount,
    masteryPercent: practicingPercent,
  }
}

/**
 * Initialize a new student in the curriculum
 * Creates curriculum position if it doesn't exist
 */
export async function initializeStudent(playerId: string): Promise<PlayerCurriculum> {
  return upsertPlayerCurriculum(playerId, {
    currentLevel: 1,
    currentPhaseId: 'L1.add.+1.direct',
    visualizationMode: false,
  })
}

// ============================================================================
// SKILL PERFORMANCE ANALYSIS
// ============================================================================

/**
 * Skill performance data with calculated averages
 */
export interface SkillPerformance {
  skillId: string
  /** BKT-based mastery classification (null = insufficient data, computed client-side) */
  bktClassification: 'strong' | 'developing' | 'weak' | null
  attempts: number
  correct: number
  avgResponseTimeMs: number | null // null if no timing data
  responseTimeCount: number
}

/**
 * Analysis of a player's skill strengths and weaknesses
 */
export interface SkillPerformanceAnalysis {
  /** All skills with performance data */
  skills: SkillPerformance[]
  /** Overall average response time (ms) across all skills with timing data */
  overallAvgResponseTimeMs: number | null
  /** Skills where student is significantly faster than average (excelling) */
  fastSkills: SkillPerformance[]
  /** Skills where student is significantly slower than average (struggling) */
  slowSkills: SkillPerformance[]
}

/**
 * Thresholds for performance analysis
 */
const PERFORMANCE_THRESHOLDS = {
  /** Speed deviation threshold (percentage faster/slower than average to flag) */
  speedDeviationPercent: 0.3, // 30% faster/slower
  /** Minimum responses needed for timing analysis */
  minResponsesForTiming: 3,
} as const

/**
 * Analyze a player's skill performance to identify strengths and weaknesses
 * Uses response time data to find skills where the student excels vs struggles
 *
 * Note: BKT classification is computed client-side from session plan data,
 * so we return null here. The client enriches this with BKT data.
 *
 * Stats (attempts, correct, responseTime) are computed from session results,
 * not from the playerSkillMastery table, ensuring single source of truth.
 */
export async function analyzeSkillPerformance(playerId: string): Promise<SkillPerformanceAnalysis> {
  const allSkills = await getAllSkillMastery(playerId)
  const sessionResults = await getRecentSessionResults(playerId, 100)

  // Aggregate stats per skill from session results
  const skillStats = new Map<
    string,
    { attempts: number; correct: number; responseTimes: number[] }
  >()

  for (const result of sessionResults) {
    for (const skillId of result.skillsExercised) {
      if (!skillStats.has(skillId)) {
        skillStats.set(skillId, { attempts: 0, correct: 0, responseTimes: [] })
      }
      const stats = skillStats.get(skillId)!
      stats.attempts++
      if (result.isCorrect) {
        stats.correct++
      }
      if (result.responseTimeMs > 0) {
        stats.responseTimes.push(result.responseTimeMs)
      }
    }
  }

  // Calculate performance data for each skill
  // Note: bktClassification is computed client-side from session history
  const skills: SkillPerformance[] = allSkills.map((s) => {
    const stats = skillStats.get(s.skillId)
    const attempts = stats?.attempts ?? 0
    const correct = stats?.correct ?? 0
    const responseTimes = stats?.responseTimes ?? []

    return {
      skillId: s.skillId,
      bktClassification: null, // Computed client-side from session plans
      attempts,
      correct,
      avgResponseTimeMs:
        responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : null,
      responseTimeCount: responseTimes.length,
    }
  })

  // Calculate overall average response time (only from skills with sufficient data)
  const skillsWithTiming = skills.filter(
    (s) =>
      s.avgResponseTimeMs !== null &&
      s.responseTimeCount >= PERFORMANCE_THRESHOLDS.minResponsesForTiming
  )
  const overallAvgResponseTimeMs =
    skillsWithTiming.length > 0
      ? Math.round(
          skillsWithTiming.reduce((sum, s) => sum + (s.avgResponseTimeMs ?? 0), 0) /
            skillsWithTiming.length
        )
      : null

  // Identify fast skills (significantly faster than average)
  const fastSkills =
    overallAvgResponseTimeMs !== null
      ? skillsWithTiming.filter(
          (s) =>
            s.avgResponseTimeMs !== null &&
            s.avgResponseTimeMs <
              overallAvgResponseTimeMs * (1 - PERFORMANCE_THRESHOLDS.speedDeviationPercent)
        )
      : []

  // Identify slow skills (significantly slower than average)
  const slowSkills =
    overallAvgResponseTimeMs !== null
      ? skillsWithTiming.filter(
          (s) =>
            s.avgResponseTimeMs !== null &&
            s.avgResponseTimeMs >
              overallAvgResponseTimeMs * (1 + PERFORMANCE_THRESHOLDS.speedDeviationPercent)
        )
      : []

  return {
    skills,
    overallAvgResponseTimeMs,
    fastSkills,
    slowSkills,
  }
}

/**
 * Get skills ranked by response time (slowest first)
 * Useful for identifying skills that need practice
 */
export async function getSkillsByResponseTime(
  playerId: string,
  order: 'slowest' | 'fastest' = 'slowest'
): Promise<SkillPerformance[]> {
  const analysis = await analyzeSkillPerformance(playerId)

  // Filter to only skills with timing data
  const skillsWithTiming = analysis.skills.filter(
    (s) =>
      s.avgResponseTimeMs !== null &&
      s.responseTimeCount >= PERFORMANCE_THRESHOLDS.minResponsesForTiming
  )

  // Sort by response time
  return skillsWithTiming.sort((a, b) => {
    const timeA = a.avgResponseTimeMs ?? 0
    const timeB = b.avgResponseTimeMs ?? 0
    return order === 'slowest' ? timeB - timeA : timeA - timeB
  })
}

// ============================================================================
// SKILL TUTORIAL PROGRESS OPERATIONS
// ============================================================================

/**
 * Get a player's tutorial progress for a specific skill
 */
export async function getSkillTutorialProgress(
  playerId: string,
  skillId: string
): Promise<SkillTutorialProgress | null> {
  const result = await db.query.skillTutorialProgress.findFirst({
    where: and(
      eq(schema.skillTutorialProgress.playerId, playerId),
      eq(schema.skillTutorialProgress.skillId, skillId)
    ),
  })
  return result ?? null
}

/**
 * Get all tutorial progress records for a player
 */
export async function getAllTutorialProgress(playerId: string): Promise<SkillTutorialProgress[]> {
  return db.query.skillTutorialProgress.findMany({
    where: eq(schema.skillTutorialProgress.playerId, playerId),
  })
}

/**
 * Check if a skill's tutorial requirement is satisfied for a player.
 * Returns true if tutorial completed OR teacher override applied.
 */
export async function isSkillTutorialSatisfied(
  playerId: string,
  skillId: string
): Promise<boolean> {
  const progress = await getSkillTutorialProgress(playerId, skillId)
  return isTutorialSatisfied(progress)
}

/**
 * Mark a skill's tutorial as completed
 */
export async function markTutorialComplete(
  playerId: string,
  skillId: string
): Promise<SkillTutorialProgress> {
  const existing = await getSkillTutorialProgress(playerId, skillId)
  const now = new Date()

  if (existing) {
    await db
      .update(schema.skillTutorialProgress)
      .set({
        tutorialCompleted: true,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.skillTutorialProgress.id, existing.id))

    return (await getSkillTutorialProgress(playerId, skillId))!
  }

  // Create new record
  const newRecord: NewSkillTutorialProgress = {
    playerId,
    skillId,
    tutorialCompleted: true,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(schema.skillTutorialProgress).values(newRecord)
  return (await getSkillTutorialProgress(playerId, skillId))!
}

/**
 * Apply teacher override to bypass tutorial requirement.
 * Use case: student learned the technique offline with their teacher.
 */
export async function applyTutorialOverride(
  playerId: string,
  skillId: string,
  reason?: string
): Promise<SkillTutorialProgress> {
  const existing = await getSkillTutorialProgress(playerId, skillId)
  const now = new Date()

  if (existing) {
    await db
      .update(schema.skillTutorialProgress)
      .set({
        teacherOverride: true,
        overrideAt: now,
        overrideReason: reason ?? null,
        updatedAt: now,
      })
      .where(eq(schema.skillTutorialProgress.id, existing.id))

    return (await getSkillTutorialProgress(playerId, skillId))!
  }

  // Create new record
  const newRecord: NewSkillTutorialProgress = {
    playerId,
    skillId,
    teacherOverride: true,
    overrideAt: now,
    overrideReason: reason ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(schema.skillTutorialProgress).values(newRecord)
  return (await getSkillTutorialProgress(playerId, skillId))!
}

/**
 * Record that a student skipped the tutorial prompt.
 * Used to surface to teachers if student is repeatedly avoiding tutorials.
 */
export async function recordTutorialSkip(
  playerId: string,
  skillId: string
): Promise<SkillTutorialProgress> {
  const existing = await getSkillTutorialProgress(playerId, skillId)
  const now = new Date()

  if (existing) {
    await db
      .update(schema.skillTutorialProgress)
      .set({
        skipCount: existing.skipCount + 1,
        lastSkippedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.skillTutorialProgress.id, existing.id))

    return (await getSkillTutorialProgress(playerId, skillId))!
  }

  // Create new record
  const newRecord: NewSkillTutorialProgress = {
    playerId,
    skillId,
    skipCount: 1,
    lastSkippedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(schema.skillTutorialProgress).values(newRecord)
  return (await getSkillTutorialProgress(playerId, skillId))!
}

/**
 * Get skills that have been skipped multiple times (for teacher dashboard).
 * Returns skills where the student has skipped the tutorial 3+ times.
 */
export async function getRepeatedlySkippedTutorials(
  playerId: string,
  minSkipCount: number = 3
): Promise<SkillTutorialProgress[]> {
  const allProgress = await getAllTutorialProgress(playerId)
  return allProgress.filter(
    (p) => p.skipCount >= minSkipCount && !p.tutorialCompleted && !p.teacherOverride
  )
}

// Re-export the helper function
export { isTutorialSatisfied }

// ============================================================================
// SKILL ACTIVATION OPERATIONS
// ============================================================================

/**
 * Enable a single skill for practice.
 * Creates a new skill mastery record if one doesn't exist, or updates isPracticing to true.
 * This is typically called after a tutorial is completed.
 *
 * @param playerId - The player's ID
 * @param skillId - The skill to enable
 * @returns Updated skill mastery record
 */
export async function enableSkillForPractice(
  playerId: string,
  skillId: string
): Promise<PlayerSkillMastery> {
  const existing = await getSkillMastery(playerId, skillId)
  const now = new Date()

  if (existing) {
    // Only update if not already practicing
    if (!existing.isPracticing) {
      await db
        .update(schema.playerSkillMastery)
        .set({
          isPracticing: true,
          updatedAt: now,
        })
        .where(eq(schema.playerSkillMastery.id, existing.id))
    }
    return (await getSkillMastery(playerId, skillId))!
  }

  // Create new record with skill enabled for practice
  const newRecord: NewPlayerSkillMastery = {
    playerId,
    skillId,
    isPracticing: true,
    lastPracticedAt: now,
  }

  await db.insert(schema.playerSkillMastery).values(newRecord)
  return (await getSkillMastery(playerId, skillId))!
}
