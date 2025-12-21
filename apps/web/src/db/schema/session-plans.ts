import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import {
  DEFAULT_SECONDS_PER_PROBLEM,
  PART_TIME_WEIGHTS,
  PURPOSE_COMPLEXITY_BOUNDS,
  PURPOSE_WEIGHTS,
  REVIEW_INTERVAL_DAYS,
  SESSION_TIMEOUT_HOURS,
  TERM_COUNT_RANGES,
} from '@/lib/curriculum/config'
import type { SkillSet } from '@/types/tutorial'
import { players } from './players'

// ============================================================================
// Types for JSON fields
// ============================================================================

/**
 * Session part types - every daily session has all three parts:
 * 1. abacus: Student uses physical abacus to solve problems (vertical format)
 * 2. visualization: Mental math by visualizing abacus beads (vertical format, no physical abacus)
 * 3. linear: Mental math with problems in sentence format (e.g., "45 + 27 = ?")
 */
export type SessionPartType = 'abacus' | 'visualization' | 'linear'

/**
 * A session part containing multiple problem slots
 */
export interface SessionPart {
  /** Part number (1, 2, or 3) */
  partNumber: 1 | 2 | 3
  /** Type of practice for this part */
  type: SessionPartType
  /** Display format for problems */
  format: 'vertical' | 'linear'
  /** Whether the physical abacus should be used */
  useAbacus: boolean
  /** Problem slots in this part */
  slots: ProblemSlot[]
  /** Estimated duration in minutes for this part */
  estimatedMinutes: number
}

/**
 * A single problem slot in the session plan
 */
export interface ProblemSlot {
  /** Position within the part */
  index: number
  /** Purpose of this problem */
  purpose: 'focus' | 'reinforce' | 'review' | 'challenge'
  /** Constraints for problem generation */
  constraints: ProblemConstraints
  /** Generated problem (filled when slot is reached) */
  problem?: GeneratedProblem
  /** Complexity bounds that were applied during generation */
  complexityBounds?: {
    min?: number
    max?: number
  }
}

export interface ProblemConstraints {
  allowedSkills?: Partial<SkillSet>
  targetSkills?: Partial<SkillSet>
  forbiddenSkills?: Partial<SkillSet>
  digitRange?: { min: number; max: number }
  termCount?: { min: number; max: number }
  operator?: 'addition' | 'subtraction' | 'mixed'

  /**
   * Maximum complexity budget per term.
   *
   * Each term's skills are costed using the SkillCostCalculator,
   * which factors in both base skill complexity and student mastery.
   *
   * If set, terms with total cost > budget are rejected during generation.
   */
  maxComplexityBudgetPerTerm?: number

  /**
   * Minimum complexity budget per term.
   *
   * If set, terms with total cost < budget are rejected during generation.
   * This ensures every term exercises real skills (no trivial direct additions).
   *
   * Example: min=1 requires at least one five-complement per term.
   */
  minComplexityBudgetPerTerm?: number
}

/**
 * A single step in the generation trace
 */
export interface GenerationTraceStep {
  stepNumber: number
  operation: string // e.g., "0 + 3 = 3" or "3 + 4 = 7"
  accumulatedBefore: number
  termAdded: number
  accumulatedAfter: number
  skillsUsed: string[]
  explanation: string
  /** Complexity cost for this term (if budget system was used) */
  complexityCost?: number
}

/**
 * Skill practice context for a single skill - captured at generation time.
 *
 * Note: BKT handles fine-grained mastery estimation. This just tracks whether
 * the skill is in the student's active practice rotation.
 * Fine-grained mastery info (pKnown) should come from BKT data separately.
 */
export interface SkillMasteryDisplay {
  /** Whether skill is in the student's active practice rotation */
  isPracticing: boolean
  /** Base complexity cost (intrinsic to skill, 0-3) */
  baseCost: number
  /** Effective cost for this student (baseCost × rotationMultiplier) */
  effectiveCost: number
}

/**
 * Full generation trace for a problem
 */
export interface GenerationTrace {
  terms: number[]
  answer: number
  steps: GenerationTraceStep[]
  allSkills: string[]
  /** Max budget constraint used during generation (if any) */
  budgetConstraint?: number
  /** Min budget constraint used during generation (if any) */
  minBudgetConstraint?: number
  /** Total complexity cost across all terms */
  totalComplexityCost?: number
  /** Per-skill mastery context at generation time (for UI display) */
  skillMasteryContext?: Record<string, SkillMasteryDisplay>
}

export interface GeneratedProblem {
  /** Problem terms (positive for add, negative for subtract) */
  terms: number[]
  /** Correct answer */
  answer: number
  /** Skills this problem exercises */
  skillsRequired: string[]
  /** Generation trace with per-step skills and costs */
  generationTrace?: GenerationTrace
}

/**
 * Summary for a single session part
 */
export interface PartSummary {
  /** Part number */
  partNumber: 1 | 2 | 3
  /** Part type */
  type: SessionPartType
  /** Description (e.g., "Use Abacus", "Mental Math (Visualization)", "Mental Math (Linear)") */
  description: string
  /** Number of problems in this part */
  problemCount: number
  /** Estimated duration in minutes */
  estimatedMinutes: number
}

/**
 * Human-readable summary for display
 */
export interface SessionSummary {
  /** Description of the focus skill */
  focusDescription: string
  /** Total number of problems across all parts */
  totalProblemCount: number
  /** Estimated total session duration */
  estimatedMinutes: number
  /** Summary for each part */
  parts: PartSummary[]
}

/**
 * Real-time session health metrics
 */
export interface SessionHealth {
  /** Overall health status */
  overall: 'good' | 'warning' | 'struggling'
  /** Current accuracy (0-1) */
  accuracy: number
  /** Pace relative to expected (100 = on track) */
  pacePercent: number
  /** Current streak (positive = correct, negative = wrong) */
  currentStreak: number
  /** Average response time in milliseconds */
  avgResponseTimeMs: number
}

/**
 * Record of a teacher adjustment during session
 */
export interface SessionAdjustment {
  timestamp: Date
  type:
    | 'difficulty_reduced'
    | 'scaffolding_enabled'
    | 'focus_narrowed'
    | 'paused'
    | 'resumed'
    | 'extended'
    | 'ended_early'
  reason?: string
  previousHealth: SessionHealth
}

/**
 * Source of a slot result record.
 *
 * - 'practice': Normal practice session result (default when undefined)
 * - 'recency-refresh': Teacher marked skill as recently practiced offline.
 *   These records update lastPracticedAt but are ZERO-WEIGHT for BKT mastery.
 *   They don't affect pKnown calculation - they only reset staleness.
 */
export type SlotResultSource = 'practice' | 'recency-refresh'

/**
 * Result of a single problem slot
 */
export interface SlotResult {
  /** Which part this result belongs to (1, 2, or 3) */
  partNumber: 1 | 2 | 3
  /** Index within the part */
  slotIndex: number
  problem: GeneratedProblem
  studentAnswer: number
  isCorrect: boolean
  responseTimeMs: number
  skillsExercised: string[]
  usedOnScreenAbacus: boolean
  timestamp: Date

  // ---- Help Tracking (for feedback loop) ----

  /** Whether the student used help during this problem */
  hadHelp: boolean

  /** Number of incorrect attempts before getting the right answer */
  incorrectAttempts: number

  /** How help was triggered */
  helpTrigger?: 'none' | 'manual' | 'auto-time' | 'auto-errors' | 'teacher-approved'

  // ---- Record Source (for sentinel records) ----

  /**
   * Source of this record. Defaults to 'practice' when undefined.
   *
   * 'recency-refresh' records are sentinels inserted when a teacher clicks
   * "Mark Current" to indicate offline practice. BKT uses these for
   * lastPracticedAt but skips them for pKnown calculation (zero-weight).
   */
  source?: SlotResultSource
}

export type SessionStatus =
  | 'draft'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'recency-refresh'

// ============================================================================
// Database Table
// ============================================================================

/**
 * Session plans table - planned and active practice sessions
 */
export const sessionPlans = sqliteTable(
  'session_plans',
  {
    /** Primary key */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Foreign key to players table */
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    // ---- Setup Parameters ----

    /** Target session duration in minutes */
    targetDurationMinutes: integer('target_duration_minutes').notNull(),

    /** Estimated number of problems */
    estimatedProblemCount: integer('estimated_problem_count').notNull(),

    /** Average time per problem in seconds (based on student history) */
    avgTimePerProblemSeconds: integer('avg_time_per_problem_seconds').notNull(),

    // ---- Plan Content (JSON) ----

    /** Session parts (3 parts: abacus, visualization, linear) */
    parts: text('parts', { mode: 'json' }).notNull().$type<SessionPart[]>(),

    /** Human-readable summary */
    summary: text('summary', { mode: 'json' }).notNull().$type<SessionSummary>(),

    /** Skill IDs that were mastered when this session was generated (for mismatch detection) */
    masteredSkillIds: text('mastered_skill_ids', { mode: 'json' })
      .notNull()
      .default('[]')
      .$type<string[]>(),

    // ---- Session State ----

    /** Current status */
    status: text('status').$type<SessionStatus>().notNull().default('draft'),

    /** Current part index (0-based: 0=abacus, 1=visualization, 2=linear) */
    currentPartIndex: integer('current_part_index').notNull().default(0),

    /** Current problem slot index within the current part (0-based) */
    currentSlotIndex: integer('current_slot_index').notNull().default(0),

    /** Real-time health metrics */
    sessionHealth: text('session_health', {
      mode: 'json',
    }).$type<SessionHealth>(),

    /** Teacher adjustments made during session */
    adjustments: text('adjustments', { mode: 'json' })
      .notNull()
      .default('[]')
      .$type<SessionAdjustment[]>(),

    /** Results for each completed slot */
    results: text('results', { mode: 'json' }).notNull().default('[]').$type<SlotResult[]>(),

    // ---- Timestamps ----

    /** When the plan was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** When the teacher approved the plan */
    approvedAt: integer('approved_at', { mode: 'timestamp' }),

    /** When the session actually started */
    startedAt: integer('started_at', { mode: 'timestamp' }),

    /** When the session was completed */
    completedAt: integer('completed_at', { mode: 'timestamp' }),
  },
  (table) => ({
    /** Index for fast lookups by playerId */
    playerIdIdx: index('session_plans_player_id_idx').on(table.playerId),

    /** Index for filtering by status */
    statusIdx: index('session_plans_status_idx').on(table.status),

    /** Index for recent plans */
    createdAtIdx: index('session_plans_created_at_idx').on(table.createdAt),
  })
)

export type SessionPlan = typeof sessionPlans.$inferSelect
export type NewSessionPlan = typeof sessionPlans.$inferInsert

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate session accuracy from results
 */
export function getSessionPlanAccuracy(plan: SessionPlan): number {
  if (plan.results.length === 0) return 0
  const correct = plan.results.filter((r) => r.isCorrect).length
  return correct / plan.results.length
}

/**
 * Get the current part
 */
export function getCurrentPart(plan: SessionPlan): SessionPart | undefined {
  return plan.parts[plan.currentPartIndex]
}

/**
 * Get the next incomplete slot in the current part
 */
export function getNextSlot(plan: SessionPlan): ProblemSlot | undefined {
  const currentPart = getCurrentPart(plan)
  if (!currentPart) return undefined
  return currentPart.slots[plan.currentSlotIndex]
}

/**
 * Get total problem count across all parts
 */
export function getTotalProblemCount(plan: SessionPlan): number {
  return plan.parts.reduce((sum, part) => sum + part.slots.length, 0)
}

/**
 * Get count of completed problems across all parts
 */
export function getCompletedProblemCount(plan: SessionPlan): number {
  return plan.results.length
}

/**
 * Check if the current part is complete
 */
export function isPartComplete(plan: SessionPlan): boolean {
  const currentPart = getCurrentPart(plan)
  if (!currentPart) return true
  return plan.currentSlotIndex >= currentPart.slots.length
}

/**
 * Check if the entire session is complete
 */
export function isSessionComplete(plan: SessionPlan): boolean {
  if (plan.status === 'completed') return true
  // Check if we're past the last part
  if (plan.currentPartIndex >= plan.parts.length) return true
  // Check if we're on the last part and finished all slots
  if (plan.currentPartIndex === plan.parts.length - 1) {
    const lastPart = plan.parts[plan.currentPartIndex]
    return plan.currentSlotIndex >= lastPart.slots.length
  }
  return false
}

/**
 * Calculate updated health metrics
 */
export function calculateSessionHealth(plan: SessionPlan, elapsedTimeMs: number): SessionHealth {
  const results = plan.results
  const completed = results.length
  const expectedCompleted = Math.floor(elapsedTimeMs / 1000 / plan.avgTimePerProblemSeconds)

  // Calculate metrics
  const accuracy = completed > 0 ? results.filter((r) => r.isCorrect).length / completed : 1

  const pacePercent = expectedCompleted > 0 ? (completed / expectedCompleted) * 100 : 100

  const avgResponseTimeMs =
    completed > 0 ? results.reduce((sum, r) => sum + r.responseTimeMs, 0) / completed : 0

  // Calculate streak
  let currentStreak = 0
  for (let i = results.length - 1; i >= 0; i--) {
    if (i === results.length - 1) {
      currentStreak = results[i].isCorrect ? 1 : -1
    } else if (results[i].isCorrect === results[i + 1].isCorrect) {
      currentStreak += results[i].isCorrect ? 1 : -1
    } else {
      break
    }
  }

  // Determine overall health
  let overall: 'good' | 'warning' | 'struggling' = 'good'
  if (accuracy < 0.6 || pacePercent < 70 || currentStreak <= -3) {
    overall = 'struggling'
  } else if (accuracy < 0.8 || pacePercent < 90 || currentStreak <= -2) {
    overall = 'warning'
  }

  return {
    overall,
    accuracy,
    pacePercent,
    currentStreak,
    avgResponseTimeMs,
  }
}

/**
 * Default configuration for plan generation.
 *
 * All values are imported from @/lib/curriculum/config for centralized tuning.
 * Edit those config files to change these defaults.
 */
export const DEFAULT_PLAN_CONFIG = {
  // Slot purpose distribution (from config/slot-distribution.ts)
  // Note: Challenge slots use CHALLENGE_RATIO_BY_PART_TYPE instead of a fixed weight
  focusWeight: PURPOSE_WEIGHTS.focus,
  reinforceWeight: PURPOSE_WEIGHTS.reinforce,
  reviewWeight: PURPOSE_WEIGHTS.review,

  // Session part time distribution (from config/slot-distribution.ts)
  partTimeWeights: PART_TIME_WEIGHTS,

  // Term count ranges (from config/slot-distribution.ts)
  abacusTermCount: TERM_COUNT_RANGES.abacus,
  visualizationTermCount: TERM_COUNT_RANGES.visualization,
  linearTermCount: TERM_COUNT_RANGES.linear,

  // Timing (from config/session-timing.ts)
  defaultSecondsPerProblem: DEFAULT_SECONDS_PER_PROBLEM,
  reviewIntervalDays: REVIEW_INTERVAL_DAYS,
  sessionTimeoutHours: SESSION_TIMEOUT_HOURS,

  // Per-purpose complexity bounds (from config/complexity-budgets.ts)
  purposeComplexityBounds: PURPOSE_COMPLEXITY_BOUNDS,
}

export type PlanGenerationConfig = typeof DEFAULT_PLAN_CONFIG
