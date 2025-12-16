/**
 * Simulated Student Model - Hill Function Learning
 *
 * Simulates a learning student using exposure-based learning with the Hill function.
 *
 * Learning Model:
 *   P(correct | skill) = exposure^n / (K^n + exposure^n)
 *
 * Where:
 *   - exposure: number of times student has attempted problems using this skill
 *   - K (halfMaxExposure): exposure count where P = 0.5
 *   - n (hillCoefficient): controls curve shape (n>1 delays onset)
 *
 * For multi-skill problems, uses conjunctive model:
 *   P(correct) = P(A) × P(B) × P(C) for skills A, B, C
 *
 * Key behaviors:
 *   - Exposure increments on EVERY attempt (not just correct answers)
 *   - Exposure persists across sessions (same student instance for entire journey)
 *   - Help provides additive bonus to probability
 */

import type { GeneratedProblem, HelpLevel } from '@/db/schema/session-plans'
import type { SeededRandom } from './SeededRandom'
import type { SimulatedAnswer, StudentProfile } from './types'

/**
 * Skill difficulty multipliers for K (halfMaxExposure).
 *
 * Higher multiplier = harder skill = needs more exposures to reach 50% mastery.
 *
 * Example: If profile.halfMaxExposure = 10:
 * - basic.directAddition: K = 10 × 0.8 = 8 (easier, 50% at 8 exposures)
 * - fiveComplements.*: K = 10 × 1.2 = 12 (harder, 50% at 12 exposures)
 * - tenComplements.*: K = 10 × 1.8 = 18 (hardest, 50% at 18 exposures)
 */
const SKILL_DIFFICULTY_MULTIPLIER: Record<string, number> = {
  // Basic skills - easier, foundational
  'basic.directAddition': 0.8,
  'basic.directSubtraction': 0.8,
  'basic.heavenBead': 0.9,
  'basic.heavenBeadSubtraction': 0.9,
  'basic.simpleCombinations': 1.0,
  'basic.simpleCombinationsSub': 1.0,

  // Five-complements - moderate difficulty (single column, but requires decomposition)
  'fiveComplements.4=5-1': 1.2,
  'fiveComplements.3=5-2': 1.2,
  'fiveComplements.2=5-3': 1.2,
  'fiveComplements.1=5-4': 1.2,
  'fiveComplementsSub.-4=-5+1': 1.3,
  'fiveComplementsSub.-3=-5+2': 1.3,
  'fiveComplementsSub.-2=-5+3': 1.3,
  'fiveComplementsSub.-1=-5+4': 1.3,

  // Ten-complements - hardest (cross-column, carrying/borrowing)
  'tenComplements.9=10-1': 1.6,
  'tenComplements.8=10-2': 1.7,
  'tenComplements.7=10-3': 1.7,
  'tenComplements.6=10-4': 1.8,
  'tenComplements.5=10-5': 1.8,
  'tenComplements.4=10-6': 1.8,
  'tenComplements.3=10-7': 1.9,
  'tenComplements.2=10-8': 1.9,
  'tenComplements.1=10-9': 2.0, // Hardest - biggest adjustment
  'tenComplementsSub.-9=+1-10': 1.7,
  'tenComplementsSub.-8=+2-10': 1.8,
  'tenComplementsSub.-7=+3-10': 1.8,
  'tenComplementsSub.-6=+4-10': 1.9,
  'tenComplementsSub.-5=+5-10': 1.9,
  'tenComplementsSub.-4=+6-10': 1.9,
  'tenComplementsSub.-3=+7-10': 2.0,
  'tenComplementsSub.-2=+8-10': 2.0,
  'tenComplementsSub.-1=+9-10': 2.1, // Hardest subtraction
}

/**
 * Get the difficulty multiplier for a skill.
 * Returns 1.0 for unknown skills (baseline difficulty).
 */
function getSkillDifficultyMultiplier(skillId: string): number {
  return SKILL_DIFFICULTY_MULTIPLIER[skillId] ?? 1.0
}

/**
 * Convert true probability to a cognitive load multiplier.
 *
 * Higher P(correct) → lower multiplier (more automated, less fatiguing)
 * Lower P(correct) → higher multiplier (less automated, more fatiguing)
 *
 * This is the "ground truth" multiplier based on actual skill mastery,
 * used to measure fatigue independently of what budgeting system was used.
 */
export function getTrueMultiplier(trueP: number): number {
  if (trueP >= 0.9) return 1.0 // Automated
  if (trueP >= 0.7) return 1.5 // Nearly automated
  if (trueP >= 0.5) return 2.0 // Halfway
  if (trueP >= 0.3) return 3.0 // Struggling
  return 4.0 // Very weak
}

/**
 * Simulates a learning student using exposure-based Hill function model.
 */
export class SimulatedStudent {
  private skillExposures: Map<string, number>
  private profile: StudentProfile
  private rng: SeededRandom

  constructor(profile: StudentProfile, rng: SeededRandom) {
    this.profile = profile
    this.rng = rng
    this.skillExposures = new Map()

    // Initialize exposures from profile (pre-seeded learning)
    for (const [skillId, exposure] of Object.entries(profile.initialExposures)) {
      this.skillExposures.set(skillId, exposure)
    }
  }

  /**
   * Hill function: calculates P(correct) based on exposure count.
   *
   * P = exposure^n / (K^n + exposure^n)
   *
   * Curve behavior (example with K=10, n=2):
   * - 0 exposures → P = 0
   * - 5 exposures → P ≈ 0.20
   * - 10 exposures → P = 0.50 (by definition of K)
   * - 20 exposures → P ≈ 0.80
   * - 30 exposures → P ≈ 0.90
   *
   * @param exposure - Number of exposures to this skill
   * @param K - Half-maximum constant (exposure where P = 0.5)
   * @param n - Hill coefficient (controls curve steepness)
   * @returns Probability of correct answer [0, 1]
   */
  hillFunction(exposure: number, K: number, n: number): number {
    if (exposure <= 0) return 0
    if (K <= 0) return 1 // Edge case: instant mastery

    const expN = exposure ** n
    const kN = K ** n
    return expN / (kN + expN)
  }

  /**
   * Simulate answering a problem.
   *
   * IMPORTANT: Exposure increments BEFORE calculating probability,
   * simulating that the student is learning from the attempt itself.
   * This matches real learning where engaging with material teaches you,
   * regardless of whether you get it right.
   *
   * Fatigue is calculated BEFORE exposure increment, representing the
   * cognitive load of the problem based on the student's state when
   * they first see it.
   */
  answerProblem(problem: GeneratedProblem): SimulatedAnswer {
    const skillsChallenged = problem.skillsRequired ?? []

    // Calculate fatigue BEFORE incrementing exposure
    // This represents cognitive load at the moment of problem presentation
    let fatigue = 0
    for (const skillId of skillsChallenged) {
      const trueP = this.getTrueProbability(skillId)
      fatigue += getTrueMultiplier(trueP)
    }

    // Increment exposure for all skills BEFORE calculating probability
    // (Learning happens from the attempt, not from success)
    for (const skillId of skillsChallenged) {
      const current = this.skillExposures.get(skillId) ?? 0
      this.skillExposures.set(skillId, current + 1)
    }

    // Determine help level (probabilistic based on profile)
    const helpLevel = this.selectHelpLevel()

    // Calculate answer probability using Hill function + conjunctive model
    const answerProbability = this.calculateAnswerProbability(skillsChallenged, helpLevel)

    const isCorrect = this.rng.chance(answerProbability)

    // Calculate response time
    const responseTimeMs = this.calculateResponseTime(skillsChallenged, helpLevel, isCorrect)

    return {
      isCorrect,
      responseTimeMs,
      helpLevelUsed: helpLevel,
      skillsChallenged,
      fatigue,
    }
  }

  /**
   * Calculate probability of correct answer using conjunctive Hill function model.
   *
   * For multi-skill problems, each skill must be applied correctly:
   *   P(correct) = P(skill_A) × P(skill_B) × P(skill_C) × ...
   *
   * Help bonuses are additive (applied after the product).
   */
  private calculateAnswerProbability(skillIds: string[], helpLevel: HelpLevel): number {
    if (skillIds.length === 0) {
      // Basic problems (no special skills) almost always correct
      return 0.95
    }

    // Conjunctive model: product of individual skill probabilities
    let probability = 1.0
    for (const skillId of skillIds) {
      const exposure = this.skillExposures.get(skillId) ?? 0
      // Apply skill-specific difficulty multiplier to K
      // Higher multiplier = harder skill = needs more exposures
      const effectiveK = this.profile.halfMaxExposure * getSkillDifficultyMultiplier(skillId)
      const skillProb = this.hillFunction(exposure, effectiveK, this.profile.hillCoefficient)
      probability *= skillProb
    }

    // Add help bonus (additive, not multiplicative)
    const helpBonus = this.profile.helpBonuses[helpLevel]
    probability += helpBonus

    // Clamp to valid probability range
    // Never 0% (lucky guess) or 100% (always room for error)
    return Math.max(0.02, Math.min(0.98, probability))
  }

  /**
   * Select a help level based on the student's profile probabilities.
   */
  private selectHelpLevel(): HelpLevel {
    const [p0, p1, p2, p3] = this.profile.helpUsageProbabilities
    const roll = this.rng.next()

    // Cumulative probability check
    if (roll < p0) return 0
    if (roll < p0 + p1) return 1
    if (roll < p0 + p1 + p2) return 2
    return 3
  }

  /**
   * Calculate response time based on skill exposure and other factors.
   */
  private calculateResponseTime(
    skillIds: string[],
    helpLevel: HelpLevel,
    isCorrect: boolean
  ): number {
    const base = this.profile.baseResponseTimeMs
    const variance = this.profile.responseTimeVariance

    // Higher exposure = faster response (more automatic)
    let avgExposure = 0
    if (skillIds.length > 0) {
      avgExposure =
        skillIds.reduce((sum, id) => sum + (this.skillExposures.get(id) ?? 0), 0) / skillIds.length
    }
    // Normalize exposure effect: 0 exposures → 2x time, many exposures → 1x time
    const exposureFactor = 2.0 - Math.min(1.0, avgExposure / (this.profile.halfMaxExposure * 2))

    // Help usage adds time (reading hints, etc.)
    const helpFactor = 1.0 + helpLevel * 0.25

    // Incorrect answers: sometimes faster (gave up), sometimes slower (struggled)
    const correctnessFactor = isCorrect ? 1.0 : this.rng.chance(0.5) ? 0.7 : 1.4

    // Add randomness
    const randomFactor = 1.0 + (this.rng.next() - 0.5) * variance

    return Math.round(base * exposureFactor * helpFactor * correctnessFactor * randomFactor)
  }

  /**
   * Get the current exposure count for a skill.
   */
  getExposure(skillId: string): number {
    return this.skillExposures.get(skillId) ?? 0
  }

  /**
   * Get all exposure counts.
   */
  getAllExposures(): Map<string, number> {
    return new Map(this.skillExposures)
  }

  /**
   * Get the computed P(correct) for a skill based on current exposure.
   * This is the "ground truth" that BKT is trying to estimate.
   *
   * Uses skill-specific difficulty multiplier:
   * - Ten-complements (multiplier ~1.8) need ~80% more exposures than baseline
   * - Five-complements (multiplier ~1.2) need ~20% more exposures than baseline
   * - Basic skills (multiplier ~0.8-0.9) need fewer exposures
   */
  getTrueProbability(skillId: string): number {
    const exposure = this.skillExposures.get(skillId) ?? 0
    // Apply skill-specific difficulty multiplier to K
    const effectiveK = this.profile.halfMaxExposure * getSkillDifficultyMultiplier(skillId)
    return this.hillFunction(exposure, effectiveK, this.profile.hillCoefficient)
  }

  /**
   * Get all true probabilities for skills with any exposure.
   */
  getAllTrueProbabilities(): Map<string, number> {
    const result = new Map<string, number>()
    for (const [skillId] of this.skillExposures) {
      result.set(skillId, this.getTrueProbability(skillId))
    }
    return result
  }

  /**
   * Get the student's profile.
   */
  getProfile(): StudentProfile {
    return this.profile
  }

  /**
   * Ensure a skill is tracked (initialize to 0 exposures if not already tracked).
   * Useful when journey includes skills not pre-seeded in the profile.
   */
  ensureSkillTracked(skillId: string): void {
    if (!this.skillExposures.has(skillId)) {
      this.skillExposures.set(skillId, 0)
    }
  }

  /**
   * Ensure all skills in a list are tracked.
   */
  ensureSkillsTracked(skillIds: string[]): void {
    for (const skillId of skillIds) {
      this.ensureSkillTracked(skillId)
    }
  }

  /**
   * Assess a single skill WITHOUT learning (no exposure increment).
   *
   * This simulates giving the student a test on just this skill.
   * Used to measure true mastery after practice sessions.
   *
   * @param skillId - The skill to assess
   * @param trials - Number of assessment trials (default 20)
   * @returns Assessment result with accuracy and probability
   */
  assessSkill(skillId: string, trials: number = 20): SkillAssessment {
    const trueProbability = this.getTrueProbability(skillId)
    const exposure = this.getExposure(skillId)

    // Run trials WITHOUT incrementing exposure
    let correct = 0
    for (let i = 0; i < trials; i++) {
      if (this.rng.chance(trueProbability)) {
        correct++
      }
    }

    return {
      skillId,
      exposure,
      trueProbability,
      assessedAccuracy: correct / trials,
      trials,
      correct,
    }
  }

  /**
   * Assess multiple skills WITHOUT learning.
   *
   * @param skillIds - Skills to assess
   * @param trialsPerSkill - Number of trials per skill (default 20)
   * @returns Map of skill ID to assessment result
   */
  assessSkills(skillIds: string[], trialsPerSkill: number = 20): Map<string, SkillAssessment> {
    const results = new Map<string, SkillAssessment>()
    for (const skillId of skillIds) {
      results.set(skillId, this.assessSkill(skillId, trialsPerSkill))
    }
    return results
  }
}

/**
 * Result of assessing a single skill.
 */
export interface SkillAssessment {
  skillId: string
  /** Number of exposures during practice */
  exposure: number
  /** True P(correct) from Hill function */
  trueProbability: number
  /** Measured accuracy from assessment trials */
  assessedAccuracy: number
  /** Number of assessment trials */
  trials: number
  /** Number correct in assessment */
  correct: number
}
