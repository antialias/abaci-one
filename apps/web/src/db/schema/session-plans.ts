import { createId } from '@paralleldrive/cuid2'
import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { PracticeTypeId } from '@/constants/practiceTypes'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
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
  /**
   * The part kind (`lib/curriculum/parts/registry.ts`). Absent on parts stored
   * before kinds existed: they are arithmetic. Only arithmetic exists, so the
   * type stays this shape until structural slot readers move off it (Phase 5;
   * session architecture §10 P2-2).
   */
  kind?: 'arithmetic'
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
  /** Globally unique ID for this slot (for tracing answers back to the problem) */
  slotId: string
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
 * Note: BKT handles fine-grained mastery estimation. This just tracks the
 * skill's practice level in the student's rotation.
 * Fine-grained mastery info (pKnown) should come from BKT data separately.
 */
export interface SkillMasteryDisplay {
  /** Whether skill is in the student's active practice rotation */
  isPracticing: boolean
  /** Practice level: 'none' | 'abacus' | 'visual' */
  practiceLevel: import('./player-skill-mastery').PracticeLevel
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

/** Why a requested part type was left out of the plan */
export type SkippedPartReason = 'not-ready' | 'vetoed' | 'no-visual-skills'

/** A part type the caller asked for that the planner's readiness gates dropped */
export interface SkippedPart {
  type: SessionPartType
  reason: SkippedPartReason
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
  /** Requested parts the readiness gates dropped (absent on plans saved before this field existed) */
  skippedParts?: SkippedPart[]
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
  /** ID of the problem slot this result answers */
  slotId: string
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
   * Weight applied to mastery/BKT calculation, stamped by the server:
   * `weightOfTry` (try-weight.ts), 1/2^round right or wrong since Phase 1w;
   * 0 for a practice-only do-over. Rows recorded before Phase 1w hold
   * 1/2^epochNumber if correct and 0 if wrong; readers weigh every row through
   * `evidenceWeightOf`, which re-derives a wrong row's weight (§10 P1w-1).
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

  // ---- Try record (session architecture Phase 1) ----
  //
  // Stamped by the server on every row it records from Phase 1 on. Legacy rows
  // lack them; read them through `normalizeTry` (session-plan-normalize.ts),
  // which derives them. The legacy fields above keep being written until
  // Phase 6.

  /** Idempotency key: minted by the client when it shows the item (server-minted for old clients) */
  tryId?: string
  /** first = the item's original try; retry = a retry round; do_over = the kid tapped a finished dot */
  kind?: TryKind
  /** first 0; retry 1..MAX_RETRY_EPOCHS; do_over = prior non-practiceOnly tries of the item */
  round?: number
  /**
   * A do-over of an item whose latest non-practiceOnly try was correct: recorded
   * with weight 0 and skipped by every mastery, readiness, gate, health and
   * verdict reader.
   */
  practiceOnly?: boolean
  /** Index of the part in `parts` (partNumber is kept for legacy readers) */
  partIndex?: number

  /**
   * Voided by an adult (worksheet unapproval, Phase 3a): the try stays in the
   * append-only array but counts nowhere (`isCountedTry`).
   */
  voided?: boolean

  /** The worksheet attachment whose approval appended this try (Phase 3a) */
  attachmentId?: string

  // ---- Timing Integrity (shared contract #156 / #157 / #158) ----
  //
  // All optional; `results` is a JSON text column so absent fields = a plain
  // measurement (no migration required). Written by the #156 timing-integrity
  // guard and the #158 review tool; read by every timing consumer via the
  // shared helpers in `@/lib/curriculum/timing`.

  // ---- Written by #156 (timing-integrity guard); read-only for #157/#158 ----

  /** raw measured value before any guard modified it; present iff a guard fired; never deleted */
  responseTimeMsRaw?: number
  /** Tier-1 auto-quarantine flag: responseTimeMs is NOT the raw measurement */
  wasIdleCapped?: boolean
  capReason?: 'idle-exceeded' | 'clock-anomaly'
  /** cap applied (attempt's autoPauseMs client-side; 300_000 server backstop) */
  capThresholdMs?: number
  capSource?: 'client' | 'server'
  /** hidden-tab time already excluded from responseTimeMs (audit) */
  hiddenTimeExcludedMs?: number

  // ---- Written by #158 (review & repair tool); read by #157 ----

  timingReview?: SlotTimingReview
  /** formalizes the untyped `_originalSource` (results route :92) */
  originalSource?: SlotResultSource

  // ---- Try envelope (practice-kinds plan §1.3, §3.1; K1a) ----
  //
  // Stamped by the recorders and the other writers (worksheet approval, seeds)
  // from K1a on. Absent on rows written before, and on rows a pre-K1 image
  // writes after a rollback (it stores unjudged, R13): read them through
  // `normalizeTry`, which derives them (`envelopeOfRow`). The top-level
  // arithmetic fields above (`slotId`, `slotIndex`, `problem`,
  // `studentAnswer`, `skillsExercised`, `usedOnScreenAbacus`) keep being
  // written on every arithmetic row: they are arithmetic's payload on disk
  // and what every older reader reads (K6, K14).

  /** The item the try answered (arithmetic: the slot's id) */
  itemId?: string
  /** A skip stores the legacy projection at top level and `outcome: 'skipped'` here (§3.1) */
  outcome?: TryOutcome
  /** The kid's answer; null unless `outcome` is 'answered' */
  answer?: unknown
  /** What the try is evidence of; null = recorded, not counted (absent ≠ null) */
  evidence?: TryEvidence | null
  /** The kind's snapshot beyond the shared fields; arithmetic's is `{ kind: 'arithmetic' }` (its snapshot is the top-level fields) */
  payload?: TryPayload
}

/** How a try came about (session architecture §1.2). */
export type TryKind = 'first' | 'retry' | 'do_over'

/** Whether the kid answered (practice-kinds plan K3): only an answered try is judged. */
export type TryOutcome = 'answered' | 'skipped' | 'timeout'

/**
 * What a try is evidence of (practice-kinds plan K2): the skills and the
 * presentation it was practiced in. The mastery mode is resolved from the
 * presentation at read time, never stored.
 */
export interface TryEvidence {
  skills: string[]
  presentation: string
}

/**
 * A stored try as the kind contract names it (practice-kinds plan §1.3): the
 * row keeps its `SlotResult` name in code until the ledger.
 */
export type StoredTry = SlotResult

/** A try's kind payload: the kind id plus whatever the kind stores (§1.3). */
export type TryPayload = { kind: string } & Record<string, unknown>

/**
 * One try as a client submits it; the server fills in the rest. `partIndex`,
 * when sent, names the part of the problem answered (checked, then stamped by
 * the server). `kind`, `round`, `practiceOnly` and `masteryWeight` are the
 * server's to stamp; anything a client sends for them is ignored.
 */
export type SlotResultSubmission = Omit<
  SlotResult,
  'timestamp' | 'partNumber' | 'kind' | 'round' | 'practiceOnly'
> & {
  partIndex?: number
}

/**
 * Adult review/repair metadata for a single attempt's timing sample (#158).
 *
 * Scopes are independent from mastery exclusion (`source: 'teacher-excluded'`):
 * `omitFromTiming` removes only the timing sample. Review never mutates
 * `responseTimeMs`; raw values (`responseTimeMsRaw`) are never deleted.
 */
export interface SlotTimingReview {
  /** scope: timing — attempt contributes no timing sample */
  omitFromTiming?: boolean
  /** adult-entered replacement; "restore raw" = set to responseTimeMsRaw */
  adjustedResponseTimeMs?: number
  /** adult vouched a flagged value is genuine; silences warnings, value stays in calcs */
  timingConfirmed?: boolean
  /** userId of last modifying adult */
  reviewedBy: string
  /** ISO-8601 */
  reviewedAt: string
}

export type SessionStatus =
  | 'draft'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'recency-refresh'
  /**
   * Soft-deleted by an adult via the timing review/repair tool (#158).
   * The prior status is preserved in `statusBeforeDeletion` for exact restore.
   * Every `sessionPlans.status` reader is a positive allow-list, so a deleted
   * session drops out of history/estimates/BKT automatically — the sole
   * exception (the history route, which filters on `completedAt`) filters
   * `'deleted'` explicitly.
   */
  | 'deleted'

export type SessionFlowState =
  | 'practicing'
  | 'part_transition'
  | 'break_pending'
  | 'break_active'
  | 'break_results'
  | 'completed'
  | 'abandoned'

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
   * Per-player allowlist of enabled game names.
   * Only games in this list (that also pass manifest + system whitelist checks)
   * will be available during game breaks.
   */
  enabledGames?: string[]

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

export type GameBreakEndReason = 'timeout' | 'skipped' | 'gameFinished'

// ============================================================================
// Retry System Types
// ============================================================================

/**
 * A single problem queued for retry
 */
export interface RetryItem {
  /** Slot ID from the original problem slot */
  slotId: string

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
// Breaks and pauses (session architecture §3.1, Phase 3a)
// ============================================================================

/** One break between parts, as the flow machine records it. */
export interface BreakRecord {
  breakIndex: number
  /** The part the break follows; null when unknown (reconstructed legacy breaks) */
  afterPartIndex: number | null
  /** ISO time; null only on a reconstructed legacy break whose start was cleared */
  startedAt: string | null
  /** Absent while the break is open */
  endedAt?: string
  reason?: GameBreakEndReason
  game?: string | null
  results?: GameResultsReport | null
  gameResultId?: string
  durationMs?: number
  /** True when reconstructed from `game_results` or the legacy columns */
  estimated?: boolean
}

/** One pause interval (§8 Q5). */
export interface PauseRecord {
  pausedAt: string
  resumedAt?: string
  pausedBy?: string | null
  reason?: string | null
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

    /** Authoritative UI flow state for practice lifecycle */
    flowState: text('flow_state').$type<SessionFlowState>().notNull().default('practicing'),

    /** Last time flow state was updated */
    flowUpdatedAt: integer('flow_updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** Monotonic version for optimistic concurrency on flow events */
    flowVersion: integer('flow_version').notNull().default(0),

    /** Current part index (0-based: 0=abacus, 1=visualization, 2=linear) */
    currentPartIndex: integer('current_part_index').notNull().default(0),

    // The legacy position and break columns (`current_slot_index`,
    // `break_started_at`, `break_reason`, `break_selected_game`,
    // `break_results`, `retry_state`) were last written by Phase 6b-0 and
    // dropped by migration 0149 (Phase 6b-2). Position is `partStates`,
    // breaks are `breaks`.

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

    // ---- Row version, breaks, part states, pauses (session architecture Phase 3a) ----
    //
    // Expand/contract (plan of record §5, D5): written since Phase 3a, read
    // since Phase 5, the only position and break columns since Phase 6b-1.

    /**
     * Compare-and-set version for every writer of the row (`withRowCas`),
     * bumped on every write. Distinct from `flowVersion`, which moves only on
     * flow transitions and is the client's optimistic token (D2).
     */
    rowVersion: integer('row_version').notNull().default(0),

    // The three JSON columns below default to a value, not a JSON string: drizzle
    // stringifies a json-mode default, so `.default('[]')` would store `"[]"`.
    /** Every break of the session, in order (written by the flow machine) */
    breaks: text('breaks', { mode: 'json' }).notNull().default([]).$type<BreakRecord[]>(),

    /** Each part's cursor, keyed by part index; opaque to structure (the kind's `State`) */
    partStates: text('part_states', { mode: 'json' })
      .notNull()
      .default({})
      .$type<Record<string, unknown>>(),

    /** Pause intervals (§8 Q5); nothing writes them yet */
    pauses: text('pauses', { mode: 'json' }).notNull().default([]).$type<PauseRecord[]>(),

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

    // ---- Soft Delete (#158 timing review/repair tool) ----
    //
    // A session is soft-deleted (status = 'deleted') by an adult from the
    // review tool. Raw results are preserved (they feed BKT history) and the
    // session stays loadable by ID so `session/[sessionId]` can show a
    // "removed — restore" banner. Restore reads `statusBeforeDeletion`.
    // NOTE: the drizzle migration for these three columns is generated
    // separately (via the /db-migrate skill) — this is only the table typing.

    /** Status the session had immediately before it was soft-deleted (for exact restore) */
    statusBeforeDeletion: text('status_before_deletion').$type<SessionStatus>(),

    /** When the session was soft-deleted */
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),

    /** User ID of the adult who soft-deleted the session (audit) */
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    /** Index for fast lookups by playerId */
    playerIdIdx: index('session_plans_player_id_idx').on(table.playerId),

    /** Index for filtering by status */
    statusIdx: index('session_plans_status_idx').on(table.status),

    /** Index for recent plans */
    createdAtIdx: index('session_plans_created_at_idx').on(table.createdAt),

    /** Supports bounded per-player BKT history scans for practice summaries. */
    bktRecentIdx: index('session_plans_bkt_recent_idx')
      // SQLite can scan this composite index backward for the DESC query.
      .on(table.playerId, table.completedAt, table.id)
      .where(
        sql`${table.status} in ('completed', 'recency-refresh') and ${table.completedAt} is not null`
      ),
  })
)

export type SessionPlan = typeof sessionPlans.$inferSelect
export type NewSessionPlan = typeof sessionPlans.$inferInsert

// ============================================================================
// Helper Functions & Constants
//
// Canonical definitions live in session-plan-helpers.ts (drizzle-free).
// Re-exported here for backward compatibility with server-side code.
// Client components should import directly from session-plan-helpers.ts
// to avoid pulling drizzle-orm into the browser bundle.
// ============================================================================

export type { PlanGenerationConfig } from './session-plan-helpers'
export {
  calculateMasteryWeight,
  calculateSessionHealth,
  countedTries,
  DEFAULT_GAME_BREAK_SETTINGS,
  DEFAULT_PLAN_CONFIG,
  getCompletedProblemCount,
  getCurrentPart,
  getNextSlot,
  getSessionPlanAccuracy,
  getSlotRetryStatus,
  getTotalProblemCount,
  isCountedTry,
  isPartComplete,
  isSessionComplete,
  summarizeTries,
  type TryStats,
} from './session-plan-helpers'
