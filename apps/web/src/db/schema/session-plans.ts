import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
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
}

export interface ProblemConstraints {
  requiredSkills?: Partial<SkillSet>
  targetSkills?: Partial<SkillSet>
  forbiddenSkills?: Partial<SkillSet>
  digitRange?: { min: number; max: number }
  termCount?: { min: number; max: number }
  operator?: 'addition' | 'subtraction' | 'mixed'
}

export interface GeneratedProblem {
  /** Problem terms (positive for add, negative for subtract) */
  terms: number[]
  /** Correct answer */
  answer: number
  /** Skills this problem exercises */
  skillsRequired: string[]
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
 * Help level used during a problem
 * - 0: No help requested
 * - 1: Coach hint only (e.g., "Add the tens digit first")
 * - 2: Decomposition shown (e.g., "45 + 27 = 45 + 20 + 7")
 * - 3: Bead highlighting (arrows showing which beads to move)
 */
export type HelpLevel = 0 | 1 | 2 | 3

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

  /** Maximum help level used during this problem (0 = no help) */
  helpLevelUsed: HelpLevel

  /** Number of incorrect attempts before getting the right answer */
  incorrectAttempts: number

  /** How help was triggered */
  helpTrigger?: 'none' | 'manual' | 'auto-time' | 'auto-errors' | 'teacher-approved'
}

export type SessionStatus = 'draft' | 'approved' | 'in_progress' | 'completed' | 'abandoned'

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

    // ---- Session State ----

    /** Current status */
    status: text('status').$type<SessionStatus>().notNull().default('draft'),

    /** Current part index (0-based: 0=abacus, 1=visualization, 2=linear) */
    currentPartIndex: integer('current_part_index').notNull().default(0),

    /** Current problem slot index within the current part (0-based) */
    currentSlotIndex: integer('current_slot_index').notNull().default(0),

    /** Real-time health metrics */
    sessionHealth: text('session_health', { mode: 'json' }).$type<SessionHealth>(),

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
 * Default configuration for plan generation
 */
export const DEFAULT_PLAN_CONFIG = {
  /** Distribution weights for slot purposes (should sum to 1.0) */
  focusWeight: 0.6,
  reinforceWeight: 0.2,
  reviewWeight: 0.15,
  challengeWeight: 0.05,

  /** Distribution weights for session parts (should sum to 1.0)
   * Part 1 (abacus): 50% - This is where new skills are built
   * Part 2 (visualization): 30% - Mental math with visualization
   * Part 3 (linear): 20% - Mental math in sentence format
   */
  partTimeWeights: {
    abacus: 0.5,
    visualization: 0.3,
    linear: 0.2,
  },

  /** Default seconds per problem if no history */
  defaultSecondsPerProblem: 45,

  /** Spaced repetition intervals */
  reviewIntervalDays: {
    mastered: 7,
    practicing: 3,
  },
} as const

export type PlanGenerationConfig = typeof DEFAULT_PLAN_CONFIG
