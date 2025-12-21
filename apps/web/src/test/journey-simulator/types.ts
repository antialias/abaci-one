/**
 * Journey Simulator Types
 *
 * Type definitions for the BKT validation test infrastructure.
 */

import type { HelpLevel } from '@/db/schema/session-plans'
import type { BlameMethod } from '@/lib/curriculum/bkt'
import type { ProblemGenerationMode } from '@/lib/curriculum/config/bkt-integration'

// ============================================================================
// Student Model Types
// ============================================================================

/**
 * Configuration for a simulated student profile using Hill function learning model.
 *
 * The Hill function models learning as: P = exposure^n / (K^n + exposure^n)
 * - exposure: number of times student has attempted problems using this skill
 * - K (halfMaxExposure): exposure count where P = 0.5 (half-maximum)
 * - n (hillCoefficient): controls curve shape (n>1 delays onset, then rapid learning)
 *
 * This creates a realistic learning curve where:
 * - Early exposures build foundation (slow visible progress)
 * - Understanding "clicks" after sufficient exposure (rapid improvement)
 * - Mastery approaches but never quite reaches 100%
 */
export interface StudentProfile {
  /** Human-readable name for the profile */
  name: string
  /** Description of this student type */
  description: string

  /**
   * K in Hill function: exposure count where P(correct) = 0.5
   * Lower = faster learner (reaches 50% mastery with fewer exposures)
   * Typical range: 5-25
   */
  halfMaxExposure: number

  /**
   * n in Hill function: controls curve steepness
   * - n=1: Smooth hyperbolic curve (fast initial learning)
   * - n=2: Delayed onset with steeper ramp once it kicks in
   * - n=3+: Very delayed onset, then rapid learning
   * Typical range: 1-3
   */
  hillCoefficient: number

  /**
   * Pre-seeded exposure counts per skill (simulates prior learning).
   * Skills not in this map start at 0 exposures.
   * Example: { 'basic.directAddition': 20 } means student has 20 prior exposures
   */
  initialExposures: Record<string, number>

  /**
   * Probability of using help: [P(no help), P(help)]
   * Must sum to 1.0
   * Example: [0.7, 0.3] means 70% no help, 30% uses help
   */
  helpUsageProbabilities: [number, number]

  /**
   * Additive bonus to P(correct) when help is used: [no help bonus, help bonus]
   * Example: [0, 0.15] means using help adds 15% to success chance
   */
  helpBonuses: [number, number]

  /** Base response time in milliseconds */
  baseResponseTimeMs: number

  /** Response time variance factor (0 = no variance, 1 = high variance) */
  responseTimeVariance: number
}

// ============================================================================
// Journey Configuration Types
// ============================================================================

/**
 * Configuration for a simulation journey
 */
export interface JourneyConfig {
  /** Student profile to use */
  profile: StudentProfile
  /** Number of sessions to simulate */
  sessionCount: number
  /** Duration of each session in minutes */
  sessionDurationMinutes: number
  /** Problem generation mode to test */
  mode: ProblemGenerationMode
  /** Random seed for reproducibility */
  seed: number
  /** Which skills to enable for practice */
  practicingSkills: string[]
  /**
   * Blame attribution method for multi-skill incorrect answers.
   * - 'heuristic': blame ∝ (1 - P(known)) - fast, approximate (default)
   * - 'bayesian': proper P(~known | fail) via marginalization - exact
   */
  blameMethod?: BlameMethod
}

// ============================================================================
// Simulation Result Types
// ============================================================================

/**
 * Result of simulating a single problem answer
 */
export interface SimulatedAnswer {
  /** Whether the student answered correctly */
  isCorrect: boolean
  /** Time taken to answer in milliseconds */
  responseTimeMs: number
  /** Help level used (0 = no help, 1 = used help) */
  helpLevelUsed: HelpLevel
  /** Skills that were actually challenged by this problem */
  skillsChallenged: string[]
  /**
   * Cognitive fatigue contribution of this problem.
   * Sum of getTrueMultiplier(trueP) for each skill, calculated BEFORE exposure increment.
   * This is the "ground truth" fatigue based on actual skill mastery at the moment.
   */
  fatigue: number
}

/**
 * Snapshot of state after completing a session
 */
export interface SessionSnapshot {
  /** Session number (1-indexed) */
  sessionNumber: number
  /** BKT estimates at end of session */
  bktEstimates: Map<string, BktEstimate>
  /** Cumulative skill exposure counts (total across all sessions so far) */
  cumulativeExposures: Map<string, number>
  /** Skill exposure counts in THIS session only */
  sessionExposures: Map<string, number>
  /** Computed P(correct) per skill based on Hill function (ground truth) */
  trueSkillProbabilities: Map<string, number>
  /** Accuracy in this session (0-1) */
  accuracy: number
  /** Total problems attempted in this session */
  problemsAttempted: number
  /** Session plan ID for reference */
  sessionPlanId: string
  /**
   * Total cognitive fatigue for this session.
   * Sum of fatigue for all problems in the session.
   * Lower is better (less cognitive strain).
   */
  sessionFatigue: number
}

/**
 * BKT estimate for a single skill
 */
export interface BktEstimate {
  pKnown: number
  confidence: number
}

/**
 * Trajectory of a single skill across the journey
 */
export interface SkillTrajectory {
  skillId: string
  /** Per-session data points */
  dataPoints: SkillDataPoint[]
}

/**
 * Single data point in a skill trajectory
 */
export interface SkillDataPoint {
  session: number
  /** P(correct) for this skill based on Hill function (ground truth) */
  trueProbability: number
  /** Cumulative exposure count for this skill */
  cumulativeExposures: number
  /** BKT's estimate of P(known) */
  bktPKnown: number
  /** BKT's confidence in the estimate */
  bktConfidence: number
  /** Accuracy on problems involving this skill in this session */
  accuracy: number
}

/**
 * Final metrics computed from a journey
 */
export interface JourneyMetrics {
  /** Pearson correlation between BKT pKnown and true mastery */
  bktCorrelation: number
  /** Ratio of weak skill exposure to baseline expectation (>1 = surfacing weak skills more) */
  weakSkillSurfacing: number
  /** Accuracy improvement from first to last session */
  accuracyImprovement: number
  /** Per-skill trajectory data */
  skillTrajectories: Map<string, SkillTrajectory>
  /**
   * Total cognitive fatigue across all sessions.
   * Sum of sessionFatigue for all sessions.
   * Lower is better (less cognitive strain for the same learning).
   */
  totalFatigue: number
  /**
   * Average cognitive fatigue per session.
   * totalFatigue / sessionCount.
   */
  avgFatiguePerSession: number
}

/**
 * Complete result of a journey simulation
 */
export interface JourneyResult {
  /** Configuration used for this journey */
  config: JourneyConfig
  /** Snapshots from each session */
  snapshots: SessionSnapshot[]
  /** Final computed metrics */
  finalMetrics: JourneyMetrics
  /** Total runtime in milliseconds */
  runtimeMs: number
}

// ============================================================================
// Comparison Types
// ============================================================================

/**
 * Result of an A/B comparison between two modes
 */
export interface ComparisonResult {
  adaptiveResult: JourneyResult
  classicResult: JourneyResult
  /** Difference in BKT correlation (adaptive - classic) */
  correlationDelta: number
  /** Difference in weak skill surfacing (adaptive - classic) */
  weakSkillSurfacingDelta: number
  /** Difference in accuracy improvement (adaptive - classic) */
  accuracyImprovementDelta: number
}

// ============================================================================
// Export for JSON serialization
// ============================================================================

/**
 * JSON-serializable version of JourneyResult (Maps converted to objects)
 */
export interface JourneyResultJson {
  config: {
    profileName: string
    mode: ProblemGenerationMode
    sessionCount: number
    sessionDurationMinutes: number
    seed: number
    practicingSkills: string[]
  }
  metrics: {
    bktCorrelation: number
    weakSkillSurfacing: number
    accuracyImprovement: number
  }
  trajectories: Record<string, SkillTrajectory>
  snapshots: Array<{
    session: number
    accuracy: number
    problemsAttempted: number
    bktEstimates: Record<string, BktEstimate>
    trueSkillProbabilities: Record<string, number>
    cumulativeExposures: Record<string, number>
    sessionExposures: Record<string, number>
  }>
}
