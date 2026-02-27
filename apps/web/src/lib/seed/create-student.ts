import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../db'
import { computeBktFromHistory, type SkillBktResult } from '../curriculum/bkt'
import { BKT_THRESHOLDS } from '../curriculum/config/bkt-integration'
import { getRecentSessionResults } from '../curriculum/session-planner'
import type { SessionPart, SessionSummary, SlotResult } from '../../db/schema/session-plans'
import type { GameResultsReport } from '../arcade/game-sdk/types'
import { directEnrollStudent } from '../classroom/enrollment-manager'
import type { SkillConfig, TestStudentProfile, TuningRound } from './types'
import { generateSlotResults, checkSuccessCriteria, applyTuningAdjustments } from './helpers'
import { formatActualOutcomes } from './formatting'

/**
 * Create a test student from a profile definition.
 * Returns the player ID, BKT classifications, and raw BKT result.
 */
export async function createTestStudent(
  profile: TestStudentProfile,
  userId: string,
  skillHistoryOverride?: SkillConfig[]
): Promise<{
  playerId: string
  classifications: Record<string, number>
  bktResult: { skills: SkillBktResult[] }
}> {
  let effectiveSkillHistory = skillHistoryOverride ?? profile.skillHistory

  // If ensureAllPracticingHaveHistory is set, add missing practicing skills with default strong history
  if (profile.ensureAllPracticingHaveHistory) {
    const historySkillIds = new Set(effectiveSkillHistory.map((c) => c.skillId))
    const missingSkills: SkillConfig[] = []

    for (const skillId of profile.practicingSkills) {
      if (!historySkillIds.has(skillId)) {
        missingSkills.push({
          skillId,
          targetClassification: 'strong',
          problems: 15,
        })
      }
    }

    if (missingSkills.length > 0) {
      effectiveSkillHistory = [...effectiveSkillHistory, ...missingSkills]
    }
  }

  // Delete existing player with this name (and their parent_child relationship)
  const existing = await db.query.players.findFirst({
    where: eq(schema.players.name, profile.name),
  })
  if (existing) {
    await db.delete(schema.parentChild).where(eq(schema.parentChild.childPlayerId, existing.id))
    await db.delete(schema.players).where(eq(schema.players.id, existing.id))
  }

  // Create player with intention notes only (will update with actual outcomes later)
  const playerId = createId()
  await db.insert(schema.players).values({
    id: playerId,
    userId,
    name: profile.name,
    emoji: profile.emoji,
    color: profile.color,
    isActive: true,
    isExpungeable: true,
    notes: profile.intentionNotes,
  })

  // Create parent-child relationship so access control works
  await db.insert(schema.parentChild).values({
    parentUserId: userId,
    childPlayerId: playerId,
  })

  // Build a map of skill -> age from skill history
  const skillAgeMap = new Map<string, number>()
  for (const config of effectiveSkillHistory) {
    skillAgeMap.set(config.skillId, config.ageDays ?? 1)
  }

  // Create skill mastery records for practicing skills
  for (const skillId of profile.practicingSkills) {
    const ageDays = skillAgeMap.get(skillId) ?? 1
    const lastPracticedAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000)

    await db.insert(schema.playerSkillMastery).values({
      id: createId(),
      playerId,
      skillId,
      isPracticing: true,
      lastPracticedAt,
    })
  }

  // Create tutorial progress records for completed tutorials
  if (profile.tutorialCompletedSkills) {
    for (const skillId of profile.tutorialCompletedSkills) {
      await db.insert(schema.skillTutorialProgress).values({
        id: createId(),
        playerId,
        skillId,
        tutorialCompleted: true,
        completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
        teacherOverride: false,
        skipCount: 0,
      })
    }
  }

  // ==========================================================================
  // MULTI-SESSION DISTRIBUTION
  // ==========================================================================
  const minSessions = profile.minSessions ?? 5
  const sessionSpreadDays = profile.sessionSpreadDays ?? 30

  // Group problems by their skill's ageDays (for staleness preservation)
  interface ProblemWithMeta {
    result: SlotResult
    skillId: string
    skillAgeDays: number
  }

  const problemsByAge = new Map<number, ProblemWithMeta[]>()
  for (const config of effectiveSkillHistory) {
    const ageDays = config.ageDays ?? 1
    const sessionStartTime = new Date() // Placeholder, will be updated per-session
    const results = generateSlotResults(config, 0, sessionStartTime)

    const existing = problemsByAge.get(ageDays) ?? []
    for (const result of results) {
      existing.push({
        result,
        skillId: config.skillId,
        skillAgeDays: ageDays,
      })
    }
    problemsByAge.set(ageDays, existing)
  }

  // Count total problems
  let totalProblems = 0
  for (const problems of problemsByAge.values()) {
    totalProblems += problems.length
  }

  // If no problems, skip session creation
  if (totalProblems > 0) {
    const maxAgeDays = Math.max(...Array.from(problemsByAge.keys()))
    const actualSpreadDays = Math.max(sessionSpreadDays, maxAgeDays)

    const ageGroups = Array.from(problemsByAge.keys()).sort((a, b) => b - a) // oldest first
    const totalAgeGroups = ageGroups.length
    const baseSessionsPerGroup = Math.max(1, Math.floor(minSessions / totalAgeGroups))

    let sessionNumber = 0

    for (const ageDays of ageGroups) {
      const groupProblems = problemsByAge.get(ageDays)!

      const problemsPerSession = Math.max(3, Math.ceil(groupProblems.length / baseSessionsPerGroup))
      const sessionsForGroup = Math.max(
        baseSessionsPerGroup,
        Math.ceil(groupProblems.length / problemsPerSession)
      )

      let problemIndex = 0
      for (let i = 0; i < sessionsForGroup; i++) {
        const sessionAgeDays = ageDays + (sessionsForGroup - 1 - i)
        const sessionStartTime = new Date(Date.now() - sessionAgeDays * 24 * 60 * 60 * 1000)

        const remainingProblems = groupProblems.length - problemIndex
        const remainingSessions = sessionsForGroup - i
        const isLastSession = i === sessionsForGroup - 1
        const problemsThisSession = isLastSession
          ? remainingProblems
          : Math.ceil(remainingProblems / remainingSessions)

        if (problemsThisSession === 0) continue

        const sessionProblems = groupProblems.slice(
          problemIndex,
          problemIndex + problemsThisSession
        )
        problemIndex += problemsThisSession
        sessionNumber++

        // Update timestamps
        const orderedResults: SlotResult[] = sessionProblems.map((p, idx) => ({
          ...p.result,
          slotIndex: idx,
          timestamp: new Date(sessionStartTime.getTime() + idx * 10000),
        }))

        // Create session
        const sessionId = createId()
        const sessionEndTime = new Date(sessionStartTime.getTime() + orderedResults.length * 10000)

        const slots = orderedResults.map((r, idx) => ({
          index: idx,
          purpose: 'focus' as const,
          constraints: {},
          problem: r.problem,
        }))

        const parts: SessionPart[] = [
          {
            partNumber: 1,
            type: 'linear',
            format: 'linear',
            useAbacus: false,
            slots,
            estimatedMinutes: 30,
          },
        ]

        const summary: SessionSummary = {
          focusDescription: `Test session ${sessionNumber} for ${profile.name} (${sessionAgeDays} days ago)`,
          totalProblemCount: orderedResults.length,
          estimatedMinutes: 30,
          parts: [
            {
              partNumber: 1,
              type: 'linear',
              description: 'Mental Math (Linear)',
              problemCount: orderedResults.length,
              estimatedMinutes: 30,
            },
          ],
        }

        await db.insert(schema.sessionPlans).values({
          id: sessionId,
          playerId,
          targetDurationMinutes: 30,
          estimatedProblemCount: orderedResults.length,
          avgTimePerProblemSeconds: 30,
          parts,
          summary,
          masteredSkillIds: profile.practicingSkills,
          status: 'completed',
          currentPartIndex: 1,
          currentSlotIndex: 0,
          sessionHealth: {
            overall: 'good',
            accuracy: 0.6,
            pacePercent: 100,
            currentStreak: 0,
            avgResponseTimeMs: 5000,
          },
          adjustments: [],
          results: orderedResults,
          createdAt: sessionStartTime,
          approvedAt: sessionStartTime,
          startedAt: sessionStartTime,
          completedAt: sessionEndTime,
        })
      }
    }
  }

  // Compute BKT classifications from the generated data
  const problemHistory = await getRecentSessionResults(playerId, 5000)
  const bktResult = computeBktFromHistory(problemHistory, {
    confidenceThreshold: BKT_THRESHOLDS.confidence,
  })

  const classifications: Record<string, number> = {
    weak: 0,
    developing: 0,
    strong: 0,
  }
  for (const skill of bktResult.skills) {
    if (skill.masteryClassification) {
      classifications[skill.masteryClassification]++
    }
  }

  return { playerId, classifications, bktResult }
}

/**
 * Generate game results for scoreboard testing.
 * Creates realistic game history based on the profile's gameHistory configs.
 */
export async function generateGameResults(
  playerId: string,
  profile: TestStudentProfile
): Promise<number> {
  if (!profile.gameHistory || profile.gameHistory.length === 0) {
    return 0
  }

  let totalGames = 0
  const now = Date.now()

  for (const gameConfig of profile.gameHistory) {
    const spreadMs = (gameConfig.spreadDays ?? 30) * 24 * 60 * 60 * 1000

    for (let i = 0; i < gameConfig.gameCount; i++) {
      const gameAgeMs = (spreadMs * i) / Math.max(1, gameConfig.gameCount - 1)
      const playedAt = new Date(now - spreadMs + gameAgeMs)

      const scoreVariation = (Math.random() - 0.5) * 10
      const normalizedScore = Math.max(0, Math.min(100, gameConfig.targetScore + scoreVariation))

      const accuracy = normalizedScore * (0.8 + Math.random() * 0.2)

      let difficulty: 'easy' | 'medium' | 'hard' | 'expert'
      if (normalizedScore >= 85) difficulty = 'hard'
      else if (normalizedScore >= 70) difficulty = 'medium'
      else difficulty = 'easy'

      const durationMs = (120 + Math.random() * 480) * 1000

      const fullReport: GameResultsReport = {
        gameName: gameConfig.gameName,
        gameDisplayName: gameConfig.displayName,
        gameIcon: gameConfig.icon,
        durationMs,
        completedNormally: true,
        startedAt: playedAt.getTime() - durationMs,
        endedAt: playedAt.getTime(),
        gameMode: 'single-player',
        playerCount: 1,
        playerResults: [
          {
            playerId,
            playerName: profile.name.replace(/^[^\s]+\s*/, ''), // Remove emoji prefix
            playerEmoji: profile.emoji,
            userId: '',
            score: Math.round(normalizedScore),
            rank: 1,
          },
        ],
        leaderboardEntry: {
          normalizedScore,
          category: gameConfig.category,
          difficulty,
        },
        headline:
          normalizedScore >= 90 ? 'Excellent!' : normalizedScore >= 70 ? 'Great Job!' : 'Good Try!',
        resultTheme: normalizedScore >= 90 ? 'success' : normalizedScore >= 70 ? 'good' : 'neutral',
      }

      await db.insert(schema.gameResults).values({
        playerId,
        gameName: gameConfig.gameName,
        gameDisplayName: gameConfig.displayName,
        gameIcon: gameConfig.icon,
        sessionType: 'practice-break',
        normalizedScore,
        rawScore: Math.round(normalizedScore),
        accuracy,
        category: gameConfig.category,
        difficulty,
        durationMs: Math.round(durationMs),
        playedAt,
        fullReport,
      })

      totalGames++
    }
  }

  return totalGames
}

/**
 * Create a test student with iterative tuning (up to maxRounds)
 */
export async function createTestStudentWithTuning(
  profile: TestStudentProfile,
  userId: string,
  classroomId: string,
  maxRounds: number = 3,
  onProgress?: (message: string) => void
): Promise<{
  playerId: string
  classifications: Record<string, number>
  tuningHistory: TuningRound[]
}> {
  const tuningHistory: TuningRound[] = []
  let currentSkillHistory = profile.skillHistory
  let result: {
    playerId: string
    classifications: Record<string, number>
    bktResult: { skills: SkillBktResult[] }
  }

  for (let round = 1; round <= maxRounds; round++) {
    result = await createTestStudent(profile, userId, currentSkillHistory)

    const { success, reasons } = checkSuccessCriteria(
      result.classifications,
      profile.successCriteria
    )

    const roundEntry: TuningRound = {
      round,
      classifications: { ...result.classifications },
      success,
      failureReasons: reasons,
      adjustmentsApplied: [],
    }

    if (success || round === maxRounds) {
      tuningHistory.push(roundEntry)
      break
    }

    // Need to tune - apply adjustments
    if (profile.tuningAdjustments) {
      currentSkillHistory = applyTuningAdjustments(currentSkillHistory, profile.tuningAdjustments)
      roundEntry.adjustmentsApplied = profile.tuningAdjustments.map((adj) => {
        const parts: string[] = []
        if (adj.accuracyMultiplier) parts.push(`accuracy × ${adj.accuracyMultiplier}`)
        if (adj.problemsAdd) parts.push(`problems + ${adj.problemsAdd}`)
        if (adj.problemsMultiplier) parts.push(`problems × ${adj.problemsMultiplier}`)
        return `${adj.skillId}: ${parts.join(', ')}`
      })
    }

    tuningHistory.push(roundEntry)

    if (onProgress) {
      onProgress(`Tuning round ${round}: ${reasons.join(', ')}`)
    }

    // Delete the student so we can recreate with adjusted params
    await db.delete(schema.players).where(eq(schema.players.id, result.playerId))
  }

  // Update the final student's notes with tuning history
  const actualOutcomes = formatActualOutcomes(result!.bktResult, profile, tuningHistory)
  const fullNotes = profile.intentionNotes + actualOutcomes

  await db
    .update(schema.players)
    .set({ notes: fullNotes })
    .where(eq(schema.players.id, result!.playerId))

  // Generate game results for this student
  const gameCount = await generateGameResults(result!.playerId, profile)
  if (gameCount > 0 && onProgress) {
    onProgress(`Generated ${gameCount} game results`)
  }

  // Enroll the student in the teacher's classroom
  await directEnrollStudent(classroomId, result!.playerId)

  // Record the seed profile → player mapping
  await db.insert(schema.seedProfilePlayers).values({
    profileId: profile.name,
    playerId: result!.playerId,
  })

  return {
    playerId: result!.playerId,
    classifications: result!.classifications,
    tuningHistory,
  }
}
