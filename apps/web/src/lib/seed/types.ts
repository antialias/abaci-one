import type { GeneratedProblem as GenProblem } from '../../utils/problemGenerator'

/**
 * Target BKT classification for a skill
 */
export type TargetClassification = 'weak' | 'developing' | 'strong'

/**
 * Configuration for a skill's problem history in a test profile
 */
export interface SkillConfig {
  skillId: string
  /** Target BKT classification - sequences will be designed to achieve this */
  targetClassification: TargetClassification
  /** Number of problems to generate */
  problems: number
  /** Days ago this skill was practiced (default: 1 day) */
  ageDays?: number
  /** Simulate legacy data by omitting hadHelp field (tests NaN handling) */
  simulateLegacyData?: boolean
}

/**
 * Success criteria for a profile - defines what "success" means
 */
export interface SuccessCriteria {
  /** Minimum number of weak skills required */
  minWeak?: number
  /** Maximum number of weak skills allowed */
  maxWeak?: number
  /** Minimum number of developing skills required */
  minDeveloping?: number
  /** Maximum number of developing skills allowed */
  maxDeveloping?: number
  /** Minimum number of strong skills required */
  minStrong?: number
  /** Maximum number of strong skills allowed */
  maxStrong?: number
}

/**
 * Tuning adjustment to apply when criteria aren't met
 */
export interface TuningAdjustment {
  /** Skill ID to adjust (or 'all' for all skills) */
  skillId: string | 'all'
  /** Multiply accuracy by this factor */
  accuracyMultiplier?: number
  /** Add this many problems */
  problemsAdd?: number
  /** Multiply problems by this factor */
  problemsMultiplier?: number
}

/**
 * Configuration for seeding game results (scoreboard data)
 */
export interface GameResultConfig {
  /** Which game: 'matching', 'card-sorting', 'complement-race', etc. */
  gameName: string
  /** Human-readable display name */
  displayName: string
  /** Game icon emoji */
  icon: string
  /** Category for leaderboard grouping */
  category: 'puzzle' | 'memory' | 'speed' | 'strategy' | 'geography'
  /** Target score range (0-100), actual will vary within ±5 */
  targetScore: number
  /** Number of games to seed */
  gameCount: number
  /** Days ago spread (games will be distributed over this period) */
  spreadDays?: number
}

/** Profile category for CLI filtering */
export type ProfileCategory = 'bkt' | 'session' | 'edge'

/**
 * A test student profile definition
 */
export interface TestStudentProfile {
  name: string
  emoji: string
  color: string
  /** Category for CLI filtering: 'bkt', 'session', or 'edge' */
  category: ProfileCategory
  description: string
  /** Intention notes - what this profile is TRYING to achieve */
  intentionNotes: string
  /** Skills that should have isPracticing = true (realistic curriculum progression) */
  practicingSkills: string[]
  /** Skills with problem history (can include non-practicing for testing edge cases) */
  skillHistory: SkillConfig[]
  /**
   * If true, auto-generate problems for all practicing skills that don't have explicit history.
   * This ensures all practicing skills have BKT data for proper session mode detection.
   */
  ensureAllPracticingHaveHistory?: boolean
  /** Curriculum phase this student is nominally at */
  currentPhaseId: string
  /** Skills that should have their tutorial marked as completed */
  tutorialCompletedSkills?: string[]
  /** Expected session mode for this profile */
  expectedSessionMode?: 'remediation' | 'progression' | 'maintenance'
  /** Success criteria for this profile */
  successCriteria?: SuccessCriteria
  /** Tuning adjustments to apply if criteria aren't met */
  tuningAdjustments?: TuningAdjustment[]
  /**
   * Minimum number of practice sessions to create.
   * Problems will be distributed across sessions over time.
   * Default: 5
   */
  minSessions?: number
  /**
   * Number of days to spread sessions across.
   * Sessions will be distributed evenly across this period.
   * Default: 30
   */
  sessionSpreadDays?: number
  /**
   * Game results to seed for scoreboard testing.
   * Each entry creates multiple game result records.
   */
  gameHistory?: GameResultConfig[]
}

/**
 * Generated problem with metadata for seeding
 */
export interface RealisticProblem {
  terms: number[]
  answer: number
  skillsUsed: string[]
  generationTrace?: GenProblem['generationTrace']
}

/**
 * Tuning history entry
 */
export interface TuningRound {
  round: number
  classifications: Record<string, number>
  success: boolean
  failureReasons: string[]
  adjustmentsApplied: string[]
}

/**
 * Profile info for the UI - lightweight subset of TestStudentProfile
 */
export interface ProfileInfo {
  name: string
  emoji: string
  description: string
  category: ProfileCategory
  intentionNotes: string
  tags: string[]
  expectedSessionMode?: string
  practicingSkillCount: number
  skillHistoryCount: number
}
