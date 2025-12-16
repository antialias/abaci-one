/**
 * Journey Runner
 *
 * Orchestrates a simulated learning journey through multiple practice sessions.
 * Uses REAL session planner code (not mocked) to generate problems.
 *
 * The runner:
 * 1. Sets up practicing skills for the student
 * 2. Generates session plans using the real planner
 * 3. Simulates student answers based on their true mastery
 * 4. Records results to the database
 * 5. Computes BKT estimates after each session
 * 6. Calculates final metrics comparing BKT to ground truth
 */

import type { TestDatabase } from './EphemeralDatabase'
import type { SeededRandom } from './SeededRandom'
import type { SimulatedStudent } from './SimulatedStudent'
import type {
  BktEstimate,
  JourneyConfig,
  JourneyMetrics,
  JourneyResult,
  SessionSnapshot,
  SkillTrajectory,
} from './types'

// These imports will use the mocked database
import { computeBktFromHistory } from '@/lib/curriculum/bkt'
import {
  approveSessionPlan,
  generateSessionPlan,
  getRecentSessionResults,
  recordSlotResult,
  startSessionPlan,
} from '@/lib/curriculum/session-planner'
import { setPracticingSkills } from '@/lib/curriculum/progress-manager'

/**
 * Runs a simulated learning journey through multiple sessions.
 */
export class JourneyRunner {
  private db: TestDatabase
  private student: SimulatedStudent
  private config: JourneyConfig
  private rng: SeededRandom
  private playerId: string
  private originalMathRandom: () => number

  constructor(
    db: TestDatabase,
    student: SimulatedStudent,
    config: JourneyConfig,
    rng: SeededRandom,
    playerId: string
  ) {
    this.db = db
    this.student = student
    this.config = config
    this.rng = rng
    this.playerId = playerId
    this.originalMathRandom = Math.random
  }

  /**
   * Run the full journey simulation.
   *
   * @returns Complete journey result with all snapshots and metrics
   */
  async run(): Promise<JourneyResult> {
    const startTime = Date.now()
    const snapshots: SessionSnapshot[] = []

    // Ensure the student is tracking all skills (for exposure counting)
    this.student.ensureSkillsTracked(this.config.practicingSkills)

    // Set up practicing skills in the database
    await setPracticingSkills(this.playerId, this.config.practicingSkills)

    // Mock Math.random for deterministic problem generation
    Math.random = this.rng.createMathRandomMock()

    try {
      for (let sessionNum = 1; sessionNum <= this.config.sessionCount; sessionNum++) {
        const snapshot = await this.runSession(sessionNum)
        snapshots.push(snapshot)
      }
    } finally {
      // Restore Math.random
      Math.random = this.originalMathRandom
    }

    // Calculate final metrics
    const finalMetrics = this.calculateFinalMetrics(snapshots)
    const runtimeMs = Date.now() - startTime

    return {
      config: this.config,
      snapshots,
      finalMetrics,
      runtimeMs,
    }
  }

  /**
   * Run a single session and return a snapshot of the state.
   */
  private async runSession(sessionNumber: number): Promise<SessionSnapshot> {
    // Check BKT data BEFORE generating session
    const preHistory = await getRecentSessionResults(this.playerId, 50)
    console.log(
      `[DEBUG] Session ${sessionNumber} PRE-GENERATION: ${preHistory.length} results available for BKT`
    )

    // Generate session plan using REAL session planner
    const plan = await generateSessionPlan({
      playerId: this.playerId,
      durationMinutes: this.config.sessionDurationMinutes,
      problemGenerationMode: this.config.mode,
    })

    // Approve and start the session
    await approveSessionPlan(plan.id)
    const startedPlan = await startSessionPlan(plan.id)

    // Track skill exposures THIS session (separate from cumulative)
    const sessionExposures = new Map<string, number>()
    let correctCount = 0
    let totalProblems = 0
    let sessionFatigue = 0

    // Process all parts and slots
    for (const part of startedPlan.parts) {
      for (const slot of part.slots) {
        if (!slot.problem) continue

        totalProblems++

        // Simulate the student answering this problem
        // Note: This also increments exposure counts in the student model
        // and calculates fatigue based on true probabilities BEFORE learning
        const answer = this.student.answerProblem(slot.problem)

        if (answer.isCorrect) correctCount++
        sessionFatigue += answer.fatigue

        // Track session-specific skill exposures
        for (const skillId of answer.skillsChallenged) {
          sessionExposures.set(skillId, (sessionExposures.get(skillId) ?? 0) + 1)
        }

        // Record result using real API
        await recordSlotResult(plan.id, {
          slotIndex: slot.index,
          problem: slot.problem,
          studentAnswer: answer.isCorrect ? slot.problem.answer : slot.problem.answer + 1,
          isCorrect: answer.isCorrect,
          responseTimeMs: answer.responseTimeMs,
          skillsExercised: answer.skillsChallenged,
          usedOnScreenAbacus: false,
          helpLevelUsed: answer.helpLevelUsed,
          incorrectAttempts: answer.isCorrect ? 0 : 1,
          helpTrigger: answer.helpLevelUsed > 0 ? 'manual' : 'none',
        })
      }
    }

    // DEBUG: Check session status after processing all slots
    const { getSessionPlan } = await import('@/lib/curriculum/session-planner')
    const finalPlan = await getSessionPlan(plan.id)
    console.log(
      `[DEBUG] Session ${sessionNumber} final status: ${finalPlan?.status}, results count: ${finalPlan?.results?.length ?? 0}`
    )

    // Get BKT estimates after this session
    const problemHistory = await getRecentSessionResults(this.playerId, 50)
    console.log(`[DEBUG] getRecentSessionResults returned ${problemHistory.length} results`)

    // Check if skillsExercised is populated
    if (problemHistory.length > 0) {
      const sample = problemHistory[0]
      console.log(
        `[DEBUG] Sample result: isCorrect=${sample.isCorrect}, skillsExercised=${JSON.stringify(sample.skillsExercised)}`
      )
    }

    const bktResult = computeBktFromHistory(problemHistory)

    const bktEstimates = new Map<string, BktEstimate>()
    for (const skill of bktResult.skills) {
      bktEstimates.set(skill.skillId, {
        pKnown: skill.pKnown,
        confidence: skill.confidence,
      })
    }

    return {
      sessionNumber,
      bktEstimates,
      // Cumulative exposures from student model (persists across sessions)
      cumulativeExposures: this.student.getAllExposures(),
      // Exposures just from this session
      sessionExposures,
      // True P(correct) per skill based on Hill function (ground truth)
      trueSkillProbabilities: this.student.getAllTrueProbabilities(),
      accuracy: totalProblems > 0 ? correctCount / totalProblems : 0,
      problemsAttempted: totalProblems,
      sessionPlanId: plan.id,
      // Cognitive fatigue accumulated during this session
      sessionFatigue,
    }
  }

  /**
   * Calculate final metrics from all session snapshots.
   */
  private calculateFinalMetrics(snapshots: SessionSnapshot[]): JourneyMetrics {
    const lastSnapshot = snapshots[snapshots.length - 1]
    const firstSnapshot = snapshots[0]

    // Calculate BKT vs true mastery correlation
    const bktCorrelation = this.calculateCorrelation(lastSnapshot)

    // Calculate weak skill surfacing ratio
    const weakSkillSurfacing = this.calculateWeakSkillSurfacing(snapshots)

    // Calculate accuracy improvement
    const accuracyImprovement = lastSnapshot.accuracy - firstSnapshot.accuracy

    // Build skill trajectories
    const skillTrajectories = this.buildSkillTrajectories(snapshots)

    // Calculate total fatigue across all sessions
    const totalFatigue = snapshots.reduce((sum, s) => sum + s.sessionFatigue, 0)
    const avgFatiguePerSession = snapshots.length > 0 ? totalFatigue / snapshots.length : 0

    return {
      bktCorrelation,
      weakSkillSurfacing,
      accuracyImprovement,
      skillTrajectories,
      totalFatigue,
      avgFatiguePerSession,
    }
  }

  /**
   * Calculate Pearson correlation between BKT pKnown and true probability (Hill function).
   */
  private calculateCorrelation(snapshot: SessionSnapshot): number {
    const pairs: Array<[number, number]> = []

    for (const skillId of this.config.practicingSkills) {
      // True probability from Hill function (ground truth)
      const trueProbability = snapshot.trueSkillProbabilities.get(skillId) ?? 0
      // BKT's estimate
      const bktEstimate = snapshot.bktEstimates.get(skillId)?.pKnown ?? 0.5
      pairs.push([trueProbability, bktEstimate])
    }

    if (pairs.length < 2) return 0

    // Pearson correlation coefficient
    const n = pairs.length
    const sumX = pairs.reduce((s, [x]) => s + x, 0)
    const sumY = pairs.reduce((s, [, y]) => s + y, 0)
    const sumXY = pairs.reduce((s, [x, y]) => s + x * y, 0)
    const sumX2 = pairs.reduce((s, [x]) => s + x * x, 0)
    const sumY2 = pairs.reduce((s, [, y]) => s + y * y, 0)

    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2))

    return denominator === 0 ? 0 : numerator / denominator
  }

  /**
   * Calculate weak skill surfacing ratio.
   *
   * This measures whether the session planner is exposing weak skills
   * more than their fair share (baseline expectation).
   *
   * - Ratio > 1.0 means weak skills are surfaced more than baseline
   * - Ratio < 1.0 means weak skills are under-represented
   *
   * A skill is considered "weak" if its true P(correct) based on
   * the Hill function is < 0.5.
   */
  private calculateWeakSkillSurfacing(snapshots: SessionSnapshot[]): number {
    const lastSnapshot = snapshots[snapshots.length - 1]

    // Identify weak skills (true probability < 0.5 based on Hill function)
    const weakSkills = this.config.practicingSkills.filter(
      (id) => (lastSnapshot.trueSkillProbabilities.get(id) ?? 0) < 0.5
    )

    if (weakSkills.length === 0) return 1.0 // No weak skills

    // Count total session exposures for weak vs strong skills
    let weakExposures = 0
    let strongExposures = 0

    for (const snapshot of snapshots) {
      for (const skillId of this.config.practicingSkills) {
        const exposures = snapshot.sessionExposures.get(skillId) ?? 0
        if (weakSkills.includes(skillId)) {
          weakExposures += exposures
        } else {
          strongExposures += exposures
        }
      }
    }

    const total = weakExposures + strongExposures
    if (total === 0) return 0

    // Calculate ratio of actual weak exposure to expected
    const weakRatio = weakExposures / total
    const expectedRatio = weakSkills.length / this.config.practicingSkills.length

    return expectedRatio > 0 ? weakRatio / expectedRatio : 1.0
  }

  /**
   * Build skill trajectories across all sessions.
   */
  private buildSkillTrajectories(snapshots: SessionSnapshot[]): Map<string, SkillTrajectory> {
    const trajectories = new Map<string, SkillTrajectory>()

    for (const skillId of this.config.practicingSkills) {
      const dataPoints = snapshots.map((s) => ({
        session: s.sessionNumber,
        // True P(correct) from Hill function (ground truth)
        trueProbability: s.trueSkillProbabilities.get(skillId) ?? 0,
        // Cumulative exposures for this skill
        cumulativeExposures: s.cumulativeExposures.get(skillId) ?? 0,
        // BKT estimates
        bktPKnown: s.bktEstimates.get(skillId)?.pKnown ?? 0.5,
        bktConfidence: s.bktEstimates.get(skillId)?.confidence ?? 0,
        accuracy: s.accuracy,
      }))

      trajectories.set(skillId, { skillId, dataPoints })
    }

    return trajectories
  }

  /**
   * Get the player ID used in this journey.
   */
  getPlayerId(): string {
    return this.playerId
  }
}
