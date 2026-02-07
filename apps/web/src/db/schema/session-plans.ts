import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { PracticeTypeId } from '@/constants/practiceTypes'
import {
  DEFAULT_SECONDS_PER_PROBLEM,
  PART_TIME_WEIGHTS,
  PURPOSE_COMPLEXITY_BOUNDS,
  PURPOSE_WEIGHTS,
  REVIEW_INTERVAL_DAYS,
  SESSION_TIMEOUT_HOURS,
  TERM_COUNT_RANGES,
} from '@/lib/curriculum/config'
import type { TermCountExplanation } from '@/lib/curriculum/config/term-count-scaling'
import type { SkillSet } from '@/types/tutorial'
import { players } from './players'

// ============================================================================
// Types for JSON fields
// ============================================================================

/**
 * Session part types - defined centrally in @/constants/practiceTypes
 * @see PRACTICE_TYPES for the full list with labels and icons
 */
export type SessionPartType = PracticeTypeId

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
  /** Explanation of how term count range was determined (for tooltip display) */
  termCountExplanation?: TermCountExplanation
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
 * - 'teacher-corrected': Teacher/parent marked an incorrect result as correct.
 *   This is used for typo fixes or verbal confirmation. Affects BKT calculation.
 * - 'teacher-excluded': Teacher/parent excluded this result from tracking.
 *   BKT should skip these entirely (zero-weight, no effect on pKnown).
 */
export type SlotResultSource =
  | 'practice'
  | 'recency-refresh'
  | 'teacher-corrected'
  | 'teacher-excluded'

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

  // ---- Retry Tracking ----

  /** Whether this was a retry attempt (not the original) */
  isRetry?: boolean

  /**
   * Which retry epoch this result belongs to.
   * 0 = original attempt, 1 = first retry, 2 = second retry
   */
  epochNumber?: number

  /**
   * Weight applied to mastery/BKT calculation.
   * Formula: 1.0 / (2 ^ epochNumber) if correct, 0 if wrong
   * - Epoch 0 correct: 1.0 (100%)
   * - Epoch 1 correct: 0.5 (50%)
   * - Epoch 2 correct: 0.25 (25%)
   * - Any wrong: 0
   */
  masteryWeight?: number

  /** Original slot index (for retries, tracks which slot is being retried) */
  originalSlotIndex?: number

  // ---- Manual Redo Tracking ----

  /**
   * Whether this result was from a manual redo (student tapped a completed problem).
   * Manual redos don't advance the session position but can affect the retry queue.
   */
  isManualRedo?: boolean
}

export type SessionStatus =
  | 'draft'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'recency-refresh'

// ============================================================================
// Game Break Settings
// ============================================================================

/**
 * Mode for how the game is selected during a break.
 * - 'auto-start': Pre-selected game starts immediately (kid can skip)
 * - 'kid-chooses': Show game selection screen with optional default highlighted
 */
export type GameBreakSelectionMode = 'auto-start' | 'kid-chooses'

/**
 * Type-safe partial configs for practice break games.
 * Uses string index to avoid importing all game config types here.
 * Runtime validation ensures type safety.
 */
export type PracticeBreakGameConfig = Record<string, Record<string, unknown>>

/**
 * Settings for game breaks between practice session parts.
 *
 * When enabled, students get rewarded game time between parts
 * (e.g., after finishing abacus section, before starting visualization).
 */
export interface GameBreakSettings {
  /** Whether game breaks are enabled */
  enabled: boolean
  /** Maximum duration in minutes (default: 5) */
  maxDurationMinutes: number
  /** How the game is selected: auto-start bypasses selection, kid-chooses shows grid */
  selectionMode: GameBreakSelectionMode
  /**
   * Selected game name, 'random', or null.
   * - For auto-start: This game starts immediately (or random picks one)
   * - For kid-chooses: This game is highlighted as default (or null for no highlight)
   */
  selectedGame: string | 'random' | null

  /**
   * Pre-configured game settings, nested by game name.
   * Allows teachers or the adaptive system to customize game difficulty.
   * Example: { 'memory-quiz': { selectedCount: 5, displayTime: 2.0 } }
   */
  gameConfig?: PracticeBreakGameConfig

  /**
   * Skip the setup phase and go directly to playing.
   * When true, games use getInitialStateForPracticeBreak() to create
   * a playing-ready state instead of showing the setup screen.
   * Default: true for practice breaks (faster start).
   */
  skipSetupPhase?: boolean

  /**
   * Use adaptive game selection based on student performance.
   * When true, the practice system may override selectedGame and gameConfig
   * based on the student's current mood and performance metrics.
   */
  useAdaptiveSelection?: boolean
}

/** Default game break settings */
export const DEFAULT_GAME_BREAK_SETTINGS: GameBreakSettings = {
  enabled: true,
  maxDurationMinutes: 5,
  selectionMode: 'kid-chooses',
  selectedGame: null,
  gameConfig: undefined,
  skipSetupPhase: true, // Default to skipping setup for faster game breaks
  useAdaptiveSelection: false,
}

// ============================================================================
// Retry System Types
// ============================================================================

/**
 * Maximum number of retry epochs (original + 2 retries = 3 total attempts)
 */
export const MAX_RETRY_EPOCHS = 2

/**
 * A single problem queued for retry
 */
export interface RetryItem {
  /** Original slot index within the part */
  originalSlotIndex: number

  /** The exact same problem to retry (never regenerated) */
  problem: GeneratedProblem

  /** Which epoch this retry is for (1 = first retry, 2 = second retry) */
  epochNumber: number

  /** Purpose from the original slot (for display) */
  originalPurpose: 'focus' | 'reinforce' | 'review' | 'challenge'
}

/**
 * Retry state for a single session part
 */
export interface PartRetryState {
  /**
   * Current epoch number within this part.
   * 0 = still working original slots
   * 1 = first retry epoch
   * 2 = second retry epoch (final)
   */
  currentEpoch: number

  /**
   * Problems queued for the next epoch (accumulated during current epoch).
   * When a problem is wrong, it gets added here for the next retry round.
   */
  pendingRetries: RetryItem[]

  /**
   * Problems being worked through in the current retry epoch.
   * Set when starting a new epoch by moving pendingRetries here.
   */
  currentEpochItems: RetryItem[]

  /**
   * Index into currentEpochItems (which retry we're on within this epoch).
   */
  currentRetryIndex: number

  /**
   * Slot indices that were redeemed via manual redo (correct answer on originally wrong problem).
   * When processing retry epochs, these slots are skipped since the student already got them right.
   */
  redeemedSlots?: number[]
}

/**
 * Retry state across all parts of a session
 */
export type SessionRetryState = {
  [partIndex: number]: PartRetryState
}

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

    /** Game break settings for rewards between parts */
    gameBreakSettings: text('game_break_settings', {
      mode: 'json',
    }).$type<GameBreakSettings>(),

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

    // ---- Retry State ----

    /** Retry state per part - tracks problems that need retrying */
    retryState: text('retry_state', {
      mode: 'json',
    }).$type<SessionRetryState>(),

    // ---- Vision/Camera State ----

    /** Remote camera session ID for phone camera streaming */
    remoteCameraSessionId: text('remote_camera_session_id'),

    // ---- Pause State (for teacher observation control) ----

    /** Whether the session is currently paused by a teacher */
    isPaused: integer('is_paused', { mode: 'boolean' }).notNull().default(false),

    /** When the session was paused */
    pausedAt: integer('paused_at', { mode: 'timestamp' }),

    /** Observer ID (teacher user ID) who paused the session */
    pausedBy: text('paused_by'),

    /** Optional reason for pausing (e.g., "Let's review this concept together") */
    pauseReason: text('paused_reason'),

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
  focusWeight: PURPOSE_WEIGHTS.focus,
  reinforceWeight: PURPOSE_WEIGHTS.reinforce,
  reviewWeight: PURPOSE_WEIGHTS.review,
  challengeWeight: 0.2,

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

// ============================================================================
// Retry System Helper Functions
// ============================================================================

/**
 * Calculate mastery weight for a result based on epoch and correctness.
 *
 * Formula: 1.0 / (2 ^ epochNumber) if correct, 0 if wrong
 * - Epoch 0 correct: 1.0 (100%)
 * - Epoch 1 correct: 0.5 (50%)
 * - Epoch 2 correct: 0.25 (25%)
 * - Any wrong: 0
 */
export function calculateMasteryWeight(isCorrect: boolean, epochNumber: number): number {
  if (!isCorrect) return 0
  return 1.0 / 2 ** epochNumber
}

/**
 * Check if we're currently in a retry epoch for the given part
 */
export function isInRetryEpoch(plan: SessionPlan, partIndex: number): boolean {
  const retryState = plan.retryState?.[partIndex]
  if (!retryState) return false
  return retryState.currentEpochItems.length > 0 && retryState.currentEpoch > 0
}

/**
 * Get the current problem to display (either from original slots or retry queue)
 */
export function getCurrentProblemInfo(plan: SessionPlan): {
  problem: GeneratedProblem
  isRetry: boolean
  epochNumber: number
  originalSlotIndex: number
  purpose: 'focus' | 'reinforce' | 'review' | 'challenge'
  partNumber: 1 | 2 | 3
} | null {
  const partIndex = plan.currentPartIndex
  if (partIndex >= plan.parts.length) return null

  const part = plan.parts[partIndex]
  const retryState = plan.retryState?.[partIndex]

  // Check if we're in a retry epoch
  if (retryState && retryState.currentEpochItems.length > 0 && retryState.currentEpoch > 0) {
    // Find the first non-redeemed retry item starting from currentRetryIndex
    let itemIndex = retryState.currentRetryIndex
    while (itemIndex < retryState.currentEpochItems.length) {
      const item = retryState.currentEpochItems[itemIndex]
      // Skip items that were redeemed via manual redo
      if (retryState.redeemedSlots?.includes(item.originalSlotIndex)) {
        itemIndex++
        continue
      }
      // Found a non-redeemed item
      return {
        problem: item.problem,
        isRetry: true,
        epochNumber: item.epochNumber,
        originalSlotIndex: item.originalSlotIndex,
        purpose: item.originalPurpose,
        partNumber: part.partNumber,
      }
    }
    // All remaining items were redeemed, epoch is effectively done
    return null
  }

  // Working original slots
  if (plan.currentSlotIndex >= part.slots.length) {
    // Finished original slots, check if there are pending retries
    return null
  }

  const slot = part.slots[plan.currentSlotIndex]
  if (!slot.problem) return null

  return {
    problem: slot.problem,
    isRetry: false,
    epochNumber: 0,
    originalSlotIndex: plan.currentSlotIndex,
    purpose: slot.purpose,
    partNumber: part.partNumber,
  }
}

/**
 * Initialize retry state for a part if not already present
 */
export function initRetryState(plan: SessionPlan, partIndex: number): PartRetryState {
  if (!plan.retryState) {
    plan.retryState = {}
  }
  if (!plan.retryState[partIndex]) {
    plan.retryState[partIndex] = {
      currentEpoch: 0,
      pendingRetries: [],
      currentEpochItems: [],
      currentRetryIndex: 0,
    }
  }
  return plan.retryState[partIndex]
}

/**
 * Get retry status for a specific slot (for UI display)
 */
export function getSlotRetryStatus(
  plan: SessionPlan,
  partIndex: number,
  slotIndex: number
): {
  hasBeenAttempted: boolean
  isCorrect: boolean | null
  attemptCount: number
  finalMasteryWeight: number | null
} {
  // Find all results for this slot
  const partNumber = plan.parts[partIndex]?.partNumber
  if (!partNumber) {
    return {
      hasBeenAttempted: false,
      isCorrect: null,
      attemptCount: 0,
      finalMasteryWeight: null,
    }
  }

  const slotResults = plan.results.filter(
    (r) => r.partNumber === partNumber && (r.originalSlotIndex ?? r.slotIndex) === slotIndex
  )

  if (slotResults.length === 0) {
    return {
      hasBeenAttempted: false,
      isCorrect: null,
      attemptCount: 0,
      finalMasteryWeight: null,
    }
  }

  // Get the latest result for this slot
  const latestResult = slotResults[slotResults.length - 1]

  return {
    hasBeenAttempted: true,
    isCorrect: latestResult.isCorrect,
    attemptCount: slotResults.length,
    finalMasteryWeight: latestResult.masteryWeight ?? null,
  }
}

/**
 * Calculate total problems including pending retries for progress display
 */
export function calculateTotalProblemsWithRetries(plan: SessionPlan): number {
  let total = 0

  for (let partIndex = 0; partIndex < plan.parts.length; partIndex++) {
    const part = plan.parts[partIndex]
    total += part.slots.length

    const retryState = plan.retryState?.[partIndex]
    if (retryState) {
      // Add current epoch items (retries being worked through)
      total += retryState.currentEpochItems.length
      // Add pending retries (queued for next epoch)
      total += retryState.pendingRetries.length
    }
  }

  return total
}

/**
 * Check if the current part needs retry transition
 * (original slots done but there are pending retries)
 */
export function needsRetryTransition(plan: SessionPlan): boolean {
  const partIndex = plan.currentPartIndex
  if (partIndex >= plan.parts.length) return false

  const part = plan.parts[partIndex]
  const retryState = plan.retryState?.[partIndex]

  // Check if we finished original slots
  if (plan.currentSlotIndex < part.slots.length) return false

  // Check if there are pending retries and we haven't started retry epoch yet
  if (retryState && retryState.pendingRetries.length > 0 && retryState.currentEpoch === 0) {
    return true
  }

  // Check if we finished current retry epoch but have more pending
  if (
    retryState &&
    retryState.currentEpochItems.length > 0 &&
    retryState.currentRetryIndex >= retryState.currentEpochItems.length &&
    retryState.pendingRetries.length > 0 &&
    retryState.currentEpoch < MAX_RETRY_EPOCHS
  ) {
    return true
  }

  return false
}
