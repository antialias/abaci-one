/**
 * Progress manager for curriculum tracking
 * Handles CRUD operations for student curriculum progress and skill mastery
 */

import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { NewPlayerCurriculum, PlayerCurriculum } from '@/db/schema/player-curriculum'
import {
  calculateMasteryLevel,
  type MasteryLevel,
  type NewPlayerSkillMastery,
  type PlayerSkillMastery,
} from '@/db/schema/player-skill-mastery'
import type { NewPracticeSession, PracticeSession } from '@/db/schema/practice-sessions'

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
 * Get skill mastery filtered by mastery level
 */
export async function getSkillsByMasteryLevel(
  playerId: string,
  level: MasteryLevel
): Promise<PlayerSkillMastery[]> {
  return db.query.playerSkillMastery.findMany({
    where: and(
      eq(schema.playerSkillMastery.playerId, playerId),
      eq(schema.playerSkillMastery.masteryLevel, level)
    ),
    orderBy: desc(schema.playerSkillMastery.lastPracticedAt),
  })
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
    const newMasteryLevel = calculateMasteryLevel(newAttempts, newCorrect, newConsecutive)

    await db
      .update(schema.playerSkillMastery)
      .set({
        attempts: newAttempts,
        correct: newCorrect,
        consecutiveCorrect: newConsecutive,
        masteryLevel: newMasteryLevel,
        lastPracticedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.playerSkillMastery.id, existing.id))

    return (await getSkillMastery(playerId, skillId))!
  }

  // Create new record
  const newRecord: NewPlayerSkillMastery = {
    playerId,
    skillId,
    attempts: 1,
    correct: isCorrect ? 1 : 0,
    consecutiveCorrect: isCorrect ? 1 : 0,
    masteryLevel: 'learning',
    lastPracticedAt: now,
  }

  await db.insert(schema.playerSkillMastery).values(newRecord)
  return (await getSkillMastery(playerId, skillId))!
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
 * Calculate overall mastery percentage for a set of skills
 */
export async function calculateMasteryPercent(
  playerId: string,
  skillIds: string[]
): Promise<number> {
  if (skillIds.length === 0) return 0

  const masteryRecords = await getAllSkillMastery(playerId)
  const relevantRecords = masteryRecords.filter((r) => skillIds.includes(r.skillId))

  const masteredCount = relevantRecords.filter((r) => r.masteryLevel === 'mastered').length

  return Math.round((masteredCount / skillIds.length) * 100)
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
  masteredSkills: number
  practicingSkills: number
  learningSkills: number
  masteryPercent: number
  recentSessions: PracticeSession[]
  recentSkills: PlayerSkillMastery[]
}

export async function getPlayerProgressSummary(playerId: string): Promise<PlayerProgressSummary> {
  const [curriculum, allSkills, recentSessions] = await Promise.all([
    getPlayerCurriculum(playerId),
    getAllSkillMastery(playerId),
    getRecentSessions(playerId, 5),
  ])

  const masteredSkills = allSkills.filter((s) => s.masteryLevel === 'mastered').length
  const practicingSkills = allSkills.filter((s) => s.masteryLevel === 'practicing').length
  const learningSkills = allSkills.filter((s) => s.masteryLevel === 'learning').length
  const totalSkills = allSkills.length

  const masteryPercent = totalSkills > 0 ? Math.round((masteredSkills / totalSkills) * 100) : 0

  // Get 5 most recently practiced skills
  const recentSkills = allSkills.slice(0, 5)

  return {
    curriculum,
    totalSkills,
    masteredSkills,
    practicingSkills,
    learningSkills,
    masteryPercent,
    recentSessions,
    recentSkills,
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
