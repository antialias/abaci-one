/**
 * BKT (Bayesian Knowledge Tracing) Type Definitions
 *
 * These types are used throughout the BKT computation module.
 */

/**
 * BKT model parameters for a skill.
 * These are the four key probabilities in standard BKT.
 */
export interface BktParams {
  /** P(L0) - Prior probability of knowing before any practice */
  pInit: number
  /** P(T) - Probability of learning on each opportunity */
  pLearn: number
  /** P(S) - Probability of slip (error despite knowing) */
  pSlip: number
  /** P(G) - Probability of guess (correct despite not knowing) */
  pGuess: number
}

/**
 * Internal state tracked for each skill during BKT computation.
 */
export interface BktSkillState {
  pKnown: number
  opportunities: number
  successCount: number
  lastPracticedAt: Date | null
  params: BktParams
}

/**
 * Record passed to conjunctive BKT update functions.
 */
export interface SkillBktRecord {
  skillId: string
  pKnown: number
  params: BktParams
}

/**
 * Result of blame distribution for incorrect answers.
 */
export interface BlameDistribution {
  skillId: string
  /** Higher = more likely this skill caused the error */
  blameWeight: number
  updatedPKnown: number
}

/**
 * Options for BKT computation.
 */
export interface BktComputeOptions {
  /** Confidence threshold for mastery classification (default: 0.5) */
  confidenceThreshold: number
  /** Use cross-student priors (default: false) */
  useCrossStudentPriors: boolean
  /** Apply time-based decay to P(known) (default: false) */
  applyDecay: boolean
  /** Decay half-life in days - after this many days, P(known) decays by 50% toward prior (default: 30) */
  decayHalfLifeDays: number
}

/**
 * Mastery classification based on P(known) and confidence.
 *
 * - 'strong': P(known) >= 0.8 - student has mastered this skill
 * - 'developing': 0.5 <= P(known) < 0.8 - student is making progress
 * - 'weak': P(known) < 0.5 - student needs more practice
 *
 * Note: When confidence is insufficient, classification may be returned as
 * 'developing' (safest default) or the classifier may return null.
 */
export type MasteryClassification = 'strong' | 'developing' | 'weak'

/**
 * Result for a single skill after BKT computation.
 */
export interface SkillBktResult {
  skillId: string
  /** P(known) - Current probability estimate that student has mastered this skill [0, 1] */
  pKnown: number
  /** Confidence in the pKnown estimate [0, 1] */
  confidence: number
  /** Uncertainty range around pKnown */
  uncertaintyRange: { low: number; high: number }
  /** Total problems involving this skill */
  opportunities: number
  /** Problems answered correctly */
  successCount: number
  /** When this skill was last practiced */
  lastPracticedAt: Date | null
  /** Classification based on pKnown and confidence */
  masteryClassification: MasteryClassification
}

/**
 * Per-mode BKT results (e.g. abacus, visualization, linear).
 * Contains the same skill-level data as the overall result but scoped to a single mode.
 */
export interface BktModeResult {
  skills: SkillBktResult[]
  interventionNeeded: SkillBktResult[]
  strengths: SkillBktResult[]
}

/**
 * Full result of BKT computation.
 */
export interface BktComputeResult {
  /** All skills with their BKT results, sorted by pKnown ascending */
  skills: SkillBktResult[]
  /** Skills that need intervention (struggling with confidence) */
  interventionNeeded: SkillBktResult[]
  /** Skills that appear mastered (high pKnown with confidence) */
  strengths: SkillBktResult[]
  /** Per-mode BKT results. Only populated when results have partType. */
  byMode?: Partial<Record<string, BktModeResult>>
}
