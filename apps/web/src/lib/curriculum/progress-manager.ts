/**
 * Progress manager for curriculum tracking
 * Handles CRUD operations for student curriculum progress and skill mastery
 */

import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { NewPlayerCurriculum, PlayerCurriculum } from '@/db/schema/player-curriculum'
import {
  calculateFluencyState,
  type FluencyState,
  type NewPlayerSkillMastery,
  type PlayerSkillMastery,
} from '@/db/schema/player-skill-mastery'
// Import directly from source to avoid circular dependency issues with re-exports
import { REINFORCEMENT_CONFIG } from '@/lib/curriculum/config/fluency-thresholds'
import type { NewPracticeSession, PracticeSession } from '@/db/schema/practice-sessions'
import type { HelpLevel } from '@/db/schema/session-plans'

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
        attempts: 0,
        correct: 0,
        consecutiveCorrect: 0,
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
 * Refresh skill recency by updating lastPracticedAt to now
 *
 * Use this when a teacher wants to mark a skill as "recently practiced"
 * (e.g., student did offline workbooks). This updates the recency state
 * from "rusty" to "fluent" without changing mastery statistics.
 *
 * @param playerId - The player's ID
 * @param skillId - The skill to refresh
 * @returns Updated skill mastery record, or null if skill not found
 */
export async function refreshSkillRecency(
  playerId: string,
  skillId: string
): Promise<PlayerSkillMastery | null> {
  const existing = await getSkillMastery(playerId, skillId)

  if (!existing) {
    return null
  }

  const now = new Date()

  const [updated] = await db
    .update(schema.playerSkillMastery)
    .set({
      lastPracticedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.playerSkillMastery.id, existing.id))
    .returning()

  return updated
}

/**
 * Record a skill attempt (correct or incorrect)
 * Updates the skill mastery record and recalculates mastery level
 */
export async function recordSkillAttempt(
  playerId: string,
  skillId: string,
  isCorrect: boolean
): Promise<PlayerSkillMastery> {
  const existing = await getSkillMastery(playerId, skillId)
  const now = new Date()

  if (existing) {
    // Update existing record
    const newAttempts = existing.attempts + 1
    const newCorrect = existing.correct + (isCorrect ? 1 : 0)
    const newConsecutive = isCorrect ? existing.consecutiveCorrect + 1 : 0

    await db
      .update(schema.playerSkillMastery)
      .set({
        attempts: newAttempts,
        correct: newCorrect,
        consecutiveCorrect: newConsecutive,
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
    attempts: 1,
    correct: isCorrect ? 1 : 0,
    consecutiveCorrect: isCorrect ? 1 : 0,
    isPracticing: true, // skill is being practiced
    lastPracticedAt: now,
  }

  await db.insert(schema.playerSkillMastery).values(newRecord)
  return (await getSkillMastery(playerId, skillId))!
}

/**
 * Record a skill attempt with help level tracking and response time
 * Applies credit multipliers based on help used and manages reinforcement
 *
 * Credit multipliers:
 * - L0 (no help) or L1 (hint): Full credit (1.0)
 * - L2 (decomposition): Half credit (0.5)
 * - L3 (bead arrows): Quarter credit (0.25)
 *
 * Reinforcement logic:
 * - If help level >= threshold, mark skill as needing reinforcement
 * - If correct answer without heavy help, increment reinforcement streak
 * - After N consecutive correct answers, clear reinforcement flag
 *
 * Response time tracking:
 * - Accumulates total response time for calculating per-skill averages
 * - Only recorded if responseTimeMs is provided (> 0)
 */
export async function recordSkillAttemptWithHelp(
  playerId: string,
  skillId: string,
  isCorrect: boolean,
  helpLevel: HelpLevel,
  responseTimeMs?: number
): Promise<PlayerSkillMastery> {
  const existing = await getSkillMastery(playerId, skillId)
  const now = new Date()

  // Calculate effective credit based on help level
  const creditMultiplier = REINFORCEMENT_CONFIG.creditMultipliers[helpLevel]

  // Determine if this help level triggers reinforcement tracking
  const isHeavyHelp = helpLevel >= REINFORCEMENT_CONFIG.helpLevelThreshold

  if (existing) {
    // Update existing record with help-adjusted progress
    const newAttempts = existing.attempts + 1

    // Apply credit multiplier - only count fraction of correct answer
    // For simplicity, we round: 1.0 = full credit, 0.5+ = credit, <0.5 = no credit
    const effectiveCorrect = isCorrect && creditMultiplier >= 0.5 ? 1 : 0
    const newCorrect = existing.correct + effectiveCorrect

    // Consecutive streak logic with help consideration
    // Heavy help (L2, L3) breaks the streak even if correct
    const newConsecutive =
      isCorrect && !isHeavyHelp ? existing.consecutiveCorrect + 1 : isCorrect ? 1 : 0

    // Reinforcement tracking
    let needsReinforcement = existing.needsReinforcement
    let reinforcementStreak = existing.reinforcementStreak

    if (isHeavyHelp) {
      // Heavy help triggers reinforcement flag
      needsReinforcement = true
      reinforcementStreak = 0
    } else if (isCorrect && existing.needsReinforcement) {
      // Correct answer without heavy help - increment streak toward clearing
      reinforcementStreak = existing.reinforcementStreak + 1

      // Clear reinforcement if streak reaches threshold
      if (reinforcementStreak >= REINFORCEMENT_CONFIG.streakToClear) {
        needsReinforcement = false
        reinforcementStreak = 0
      }
    } else if (!isCorrect) {
      // Incorrect answer resets reinforcement streak
      reinforcementStreak = 0
    }

    // Calculate response time updates (only if provided)
    const hasResponseTime = responseTimeMs !== undefined && responseTimeMs > 0
    const newTotalResponseTimeMs = hasResponseTime
      ? existing.totalResponseTimeMs + responseTimeMs
      : existing.totalResponseTimeMs
    const newResponseTimeCount = hasResponseTime
      ? existing.responseTimeCount + 1
      : existing.responseTimeCount

    await db
      .update(schema.playerSkillMastery)
      .set({
        attempts: newAttempts,
        correct: newCorrect,
        consecutiveCorrect: newConsecutive,
        lastPracticedAt: now,
        updatedAt: now,
        needsReinforcement,
        lastHelpLevel: helpLevel,
        reinforcementStreak,
        totalResponseTimeMs: newTotalResponseTimeMs,
        responseTimeCount: newResponseTimeCount,
      })
      .where(eq(schema.playerSkillMastery.id, existing.id))

    return (await getSkillMastery(playerId, skillId))!
  }

  // Calculate response time for new record (only if provided)
  const hasResponseTime = responseTimeMs !== undefined && responseTimeMs > 0

  // Create new record with help tracking - skill is being practiced
  const newRecord: NewPlayerSkillMastery = {
    playerId,
    skillId,
    attempts: 1,
    correct: isCorrect && creditMultiplier >= 0.5 ? 1 : 0,
    consecutiveCorrect: isCorrect && !isHeavyHelp ? 1 : 0,
    isPracticing: true, // skill is being practiced
    lastPracticedAt: now,
    needsReinforcement: isHeavyHelp,
    lastHelpLevel: helpLevel,
    reinforcementStreak: 0,
    totalResponseTimeMs: hasResponseTime ? responseTimeMs : 0,
    responseTimeCount: hasResponseTime ? 1 : 0,
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
  helpLevel: HelpLevel,
  responseTimeMs?: number
): Promise<PlayerSkillMastery[]> {
  const results: PlayerSkillMastery[] = []

  for (const { skillId, isCorrect } of skillResults) {
    const result = await recordSkillAttemptWithHelp(
      playerId,
      skillId,
      isCorrect,
      helpLevel,
      responseTimeMs
    )
    results.push(result)
  }

  return results
}

/**
 * Get skills that need reinforcement for a player
 */
export async function getSkillsNeedingReinforcement(
  playerId: string
): Promise<PlayerSkillMastery[]> {
  return db.query.playerSkillMastery.findMany({
    where: and(
      eq(schema.playerSkillMastery.playerId, playerId),
      eq(schema.playerSkillMastery.needsReinforcement, true)
    ),
    orderBy: desc(schema.playerSkillMastery.lastPracticedAt),
  })
}

/**
 * Clear reinforcement for a specific skill (teacher override)
 */
export async function clearSkillReinforcement(playerId: string, skillId: string): Promise<void> {
  await db
    .update(schema.playerSkillMastery)
    .set({
      needsReinforcement: false,
      reinforcementStreak: 0,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.playerSkillMastery.playerId, playerId),
        eq(schema.playerSkillMastery.skillId, skillId)
      )
    )
}

/**
 * Clear all reinforcement flags for a player (teacher override)
 */
export async function clearAllReinforcement(playerId: string): Promise<void> {
  await db
    .update(schema.playerSkillMastery)
    .set({
      needsReinforcement: false,
      reinforcementStreak: 0,
      updatedAt: new Date(),
    })
    .where(eq(schema.playerSkillMastery.playerId, playerId))
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
 * Start a new practice session
 */
export async function startPracticeSession(
  playerId: string,
  phaseId: string,
  visualizationMode: boolean = false
): Promise<PracticeSession> {
  const newSession: NewPracticeSession = {
    playerId,
    phaseId,
    problemsAttempted: 0,
    problemsCorrect: 0,
    skillsUsed: [],
    visualizationMode,
    startedAt: new Date(),
  }

  await db.insert(schema.practiceSessions).values(newSession)

  // Return the most recent session for this player
  const sessions = await db.query.practiceSessions.findMany({
    where: eq(schema.practiceSessions.playerId, playerId),
    orderBy: desc(schema.practiceSessions.startedAt),
    limit: 1,
  })

  return sessions[0]
}

/**
 * Update a practice session with problem results
 */
export async function updatePracticeSession(
  sessionId: string,
  data: {
    problemsAttempted?: number
    problemsCorrect?: number
    skillsUsed?: string[]
    averageTimeMs?: number
    totalTimeMs?: number
  }
): Promise<PracticeSession | null> {
  await db
    .update(schema.practiceSessions)
    .set(data)
    .where(eq(schema.practiceSessions.id, sessionId))

  return db.query.practiceSessions.findFirst({
    where: eq(schema.practiceSessions.id, sessionId),
  }) as Promise<PracticeSession | null>
}

/**
 * Complete a practice session
 */
export async function completePracticeSession(
  sessionId: string,
  finalData?: {
    problemsAttempted?: number
    problemsCorrect?: number
    skillsUsed?: string[]
    averageTimeMs?: number
    totalTimeMs?: number
  }
): Promise<PracticeSession | null> {
  await db
    .update(schema.practiceSessions)
    .set({
      ...finalData,
      completedAt: new Date(),
    })
    .where(eq(schema.practiceSessions.id, sessionId))

  return db.query.practiceSessions.findFirst({
    where: eq(schema.practiceSessions.id, sessionId),
  }) as Promise<PracticeSession | null>
}

/**
 * Get recent practice sessions for a player
 */
export async function getRecentSessions(
  playerId: string,
  limit: number = 10
): Promise<PracticeSession[]> {
  return db.query.practiceSessions.findMany({
    where: eq(schema.practiceSessions.playerId, playerId),
    orderBy: desc(schema.practiceSessions.startedAt),
    limit,
  })
}

/**
 * Get practice sessions for a specific phase
 */
export async function getSessionsForPhase(
  playerId: string,
  phaseId: string,
  limit: number = 10
): Promise<PracticeSession[]> {
  return db.query.practiceSessions.findMany({
    where: and(
      eq(schema.practiceSessions.playerId, playerId),
      eq(schema.practiceSessions.phaseId, phaseId)
    ),
    orderBy: desc(schema.practiceSessions.startedAt),
    limit,
  })
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
  isPracticing: boolean
  fluencyState: FluencyState
  attempts: number
  accuracy: number // 0-1
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
  /** Skills with low accuracy that may need intervention */
  lowAccuracySkills: SkillPerformance[]
  /** Skills needing reinforcement (from help system) */
  reinforcementSkills: SkillPerformance[]
}

/**
 * Thresholds for performance analysis
 */
const PERFORMANCE_THRESHOLDS = {
  /** Speed deviation threshold (percentage faster/slower than average to flag) */
  speedDeviationPercent: 0.3, // 30% faster/slower
  /** Minimum accuracy to not flag as low */
  minAccuracyThreshold: 0.7, // 70%
  /** Minimum responses needed for timing analysis */
  minResponsesForTiming: 3,
} as const

/**
 * Analyze a player's skill performance to identify strengths and weaknesses
 * Uses response time data to find skills where the student excels vs struggles
 */
export async function analyzeSkillPerformance(playerId: string): Promise<SkillPerformanceAnalysis> {
  const allSkills = await getAllSkillMastery(playerId)
  const now = new Date()

  // Calculate performance data for each skill
  const skills: SkillPerformance[] = allSkills.map((s) => {
    // Calculate days since last practice
    const daysSincePractice = s.lastPracticedAt
      ? Math.floor((now.getTime() - new Date(s.lastPracticedAt).getTime()) / (1000 * 60 * 60 * 24))
      : undefined

    // Compute fluency state
    const fluencyState = s.isPracticing
      ? calculateFluencyState(s.attempts, s.correct, s.consecutiveCorrect, daysSincePractice)
      : ('practicing' as FluencyState) // Non-practicing skills default to 'practicing' state

    return {
      skillId: s.skillId,
      isPracticing: s.isPracticing,
      fluencyState,
      attempts: s.attempts,
      accuracy: s.attempts > 0 ? s.correct / s.attempts : 0,
      avgResponseTimeMs:
        s.responseTimeCount > 0 ? Math.round(s.totalResponseTimeMs / s.responseTimeCount) : null,
      responseTimeCount: s.responseTimeCount,
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

  // Identify low accuracy skills
  const lowAccuracySkills = skills.filter(
    (s) =>
      s.attempts >= PERFORMANCE_THRESHOLDS.minResponsesForTiming &&
      s.accuracy < PERFORMANCE_THRESHOLDS.minAccuracyThreshold
  )

  // Get skills needing reinforcement
  const reinforcementRecords = await getSkillsNeedingReinforcement(playerId)
  const reinforcementSkillIds = new Set(reinforcementRecords.map((r) => r.skillId))
  const reinforcementSkills = skills.filter((s) => reinforcementSkillIds.has(s.skillId))

  return {
    skills,
    overallAvgResponseTimeMs,
    fastSkills,
    slowSkills,
    lowAccuracySkills,
    reinforcementSkills,
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
