/**
 * Session Planner - Generates adaptive practice session plans
 *
 * Creates a three-part plan based on:
 * - Part 1: Abacus practice (use physical abacus, vertical format)
 * - Part 2: Visualization (mental math by picturing beads, vertical format)
 * - Part 3: Linear (mental math in sentence format, e.g., "45 + 27 = ?")
 *
 * Each part's duration is based on configured weights.
 * Skills and difficulty are determined by:
 * - Student's current curriculum position
 * - Skill mastery levels (what needs work vs. what's mastered)
 * - Spaced repetition needs (when skills were last practiced)
 */

import { createId } from '@paralleldrive/cuid2'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { getSkillCategory, type SkillCategoryKey } from '@/constants/skillCategories'
import { db, schema } from '@/db'
import { appSettings } from '@/db/schema'
import {
  itemSlotIndexOfRow,
  retryRoundOfRow,
  tryKindOfRow,
  tryRoundOfRow,
} from '@/db/schema/legacy-try-fields'
import { isActive, isVisualReady, type PlayerSkillMastery } from '@/db/schema/player-skill-mastery'
import { isCountedTry, sameProblem } from '@/db/schema/session-plan-helpers'
import {
  currentItemOf,
  doOverStamp,
  evidencePartsOf,
  isClientTryId,
  mintTryId,
  normalizeTries,
  partStateOf,
  resolvedEvidenceOfRow,
} from '@/db/schema/session-plan-normalize'
import {
  calculateSessionHealth,
  DEFAULT_GAME_BREAK_SETTINGS,
  DEFAULT_PLAN_CONFIG,
  type GameBreakSettings,
  type GeneratedProblem,
  type NewSessionPlan,
  type PartSummary,
  type PlanGenerationConfig,
  type ProblemSlot,
  type SessionHealth,
  type SessionPart,
  type SessionPartType,
  type SessionPlan,
  type SessionSummary,
  type SkippedPart,
  type SlotResult,
  type SlotResultSubmission,
  type TryEvidence,
  type TryOutcome,
} from '@/db/schema/session-plans'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { resolveLinearEntryPolicy } from '@/lib/curriculum/linear-entry-policy'
import { MAX_RETRY_EPOCHS } from '@/lib/curriculum/parts/arithmetic/state'
import { getFlag } from '@/lib/feature-flags'
import { revokeSharesForSession } from '@/lib/session-share'
import {
  buildStudentSkillHistoryFromRecords,
  calculateMaxSkillCost,
  createSkillCostCalculator,
  type SkillCostCalculator,
} from '@/utils/skillComplexity'
import { computeBktFromHistory, type SkillBktResult } from './bkt'
import {
  applyTermCountOverride,
  computeComfortLevel,
  computeComfortLevelByMode,
} from './comfort-level'
import {
  BKT_INTEGRATION_CONFIG,
  DEFAULT_PROBLEM_GENERATION_MODE,
  type ProblemGenerationMode,
  WEAK_SKILL_THRESHOLDS,
} from './config'
import {
  computeTermCountRange,
  parseTermCountScaling,
  type TermCountExplanation,
  type TermCountScalingConfig,
} from './config/term-count-scaling'
import {
  type CurriculumPhase,
  getPhase,
  getPhaseDisplayInfo,
  type getPhaseSkillConstraints,
} from './definitions'
import {
  deriveLinearGateState,
  linearPartUsesAbacus,
  resolveLinearGateThresholds,
} from './linear-gate'
import { explainLinearReadiness } from './linear-readiness'
import { resolveEnabledPartTypes } from './part-gating'
import { arithmeticCursorSlotIndex } from './parts/arithmetic/session-view'
import type { AnyPartKind } from './parts/kind'
import { isPartPlayable, kindIdOf, partKindOf } from './parts/registry'
import { generateProblemFromConstraints } from './problem-generator'
import {
  getAllSkillMastery,
  getLinearReadinessVetoes,
  getPaceAssessment,
  getPlayerCurriculum,
  recordSkillAttemptsWithHelp,
} from './progress-manager'
import { noWrite, type SessionPlanPatch, setPlanFields, withRowCas } from './row-cas'
import {
  applyFlowEvent,
  CLIENT_FLOW_EVENT_TYPES,
  type ClientFlowEvent,
  InvalidFlowTransitionError,
  type RecordedTry,
  type SessionFlowEvent,
} from './session-flow'
import { getWeakSkillIds, type SessionMode } from './session-mode'
import { describeSkippedPart } from './skipped-parts'
import { sanitizeResultTiming } from './timing/response-time-guard'
import { weightOfTry } from './try-weight'

// ============================================================================
// Plan Generation
// ============================================================================

/**
 * Which session parts to include in the generated plan
 */
export interface EnabledParts {
  abacus: boolean
  visualization: boolean
  linear: boolean
}

export interface GenerateSessionPlanOptions {
  playerId: string
  durationMinutes: number
  config?: Partial<PlanGenerationConfig>
  enabledParts?: EnabledParts
  confidenceThreshold?: number
  problemGenerationMode?: ProblemGenerationMode
  sessionMode?: SessionMode
  gameBreakSettings?: GameBreakSettings
  /** Override the number of problems per part (for debug/testing) */
  overrideProblemsPerPart?: number
  /** When true, shuffle problem purposes within each part (default: true) */
  shufflePurposes?: boolean
  /** Comfort level adjustment from problem length preference (shorter=-0.3, recommended=0, longer=+0.2) */
  comfortAdjustment?: number
  /** Optional progress callback for background task integration */
  onProgress?: (event: SessionPlanProgressEvent) => void
}

/** Progress events emitted during session plan generation */
export type SessionPlanProgressEvent =
  | { type: 'plan_loading_data'; message: string }
  | { type: 'plan_analyzing_skills'; message: string; skillCount: number }
  | {
      type: 'plan_structure_ready'
      message: string
      parts: Array<{ type: string; problemCount: number }>
      /** Requested parts the readiness gates dropped */
      skippedParts?: SkippedPart[]
    }
  | {
      type: 'plan_generating_problem'
      partType: string
      partLabel: string
      current: number
      total: number
    }
  | { type: 'plan_part_complete'; partType: string; problemCount: number; durationMs: number }
  | { type: 'plan_saving'; message: string }
  | {
      type: 'plan_complete'
      planId: string
      timing: {
        totalMs: number
        loadDataMs: number
        bktMs: number
        parts: Array<{
          type: string
          totalMs: number
          problemCount: number
          avgProblemMs: number
        }>
        saveMs: number
      }
    }

/**
 * Error thrown when a player already has an active session
 */
export class ActiveSessionExistsError extends Error {
  code = 'ACTIVE_SESSION_EXISTS' as const
  existingSession: SessionPlan

  constructor(existingSession: SessionPlan) {
    super('An active session already exists for this player')
    this.name = 'ActiveSessionExistsError'
    this.existingSession = existingSession
  }
}

/**
 * Error thrown when trying to generate a session for a student with no skills enabled
 */
export class NoSkillsEnabledError extends Error {
  code = 'NO_SKILLS_ENABLED' as const

  constructor() {
    super(
      'Cannot generate a practice session: no skills are enabled for this student. ' +
        'Please enable at least one skill in the skill selector before starting a session.'
    )
    this.name = 'NoSkillsEnabledError'
  }
}

/**
 * Error thrown when every requested part type gates out (e.g. abacus was disabled
 * by the caller and there are no visual-ready / linear-ready skills). Previously
 * this produced a 0-part plan that crashed downstream with a NaN weight.
 */
export class NoEligiblePartsError extends Error {
  code = 'NO_ELIGIBLE_PARTS' as const
  /** Why each requested part was gated out — the same reasons a successful plan reports. */
  skippedParts: SkippedPart[]

  constructor(skippedParts: SkippedPart[] = []) {
    const detail =
      skippedParts.length > 0 ? ` ${skippedParts.map(describeSkippedPart).join('. ')}.` : ''
    super(
      'Cannot generate a practice session: none of the requested part types have ' +
        `eligible skills.${detail} Enable abacus practice, or advance skills to visual/linear readiness.`
    )
    this.skippedParts = skippedParts
    this.name = 'NoEligiblePartsError'
  }
}

/**
 * Generate a three-part session plan for a student
 *
 * @throws {ActiveSessionExistsError} If the player already has an active session that hasn't timed out
 * @throws {NoSkillsEnabledError} If the player has no skills enabled for practice
 */
export async function generateSessionPlan(
  options: GenerateSessionPlanOptions
): Promise<SessionPlan> {
  const {
    playerId,
    durationMinutes,
    config: configOverrides,
    enabledParts,
    problemGenerationMode = DEFAULT_PROBLEM_GENERATION_MODE,
    sessionMode,
    gameBreakSettings = DEFAULT_GAME_BREAK_SETTINGS,
    overrideProblemsPerPart,
    shufflePurposes = true,
    comfortAdjustment = 0,
    onProgress,
  } = options

  const totalStartTime = performance.now()
  const config = { ...DEFAULT_PLAN_CONFIG, ...configOverrides }

  // Default: all parts enabled
  const partsToInclude: EnabledParts = enabledParts ?? {
    abacus: true,
    visualization: true,
    linear: true,
  }

  // Check for existing active session (one active session per kid rule)
  const existingActive = await getActiveSessionPlan(playerId)
  if (existingActive) {
    const sessionAgeMs = Date.now() - new Date(existingActive.createdAt).getTime()
    const timeoutMs = config.sessionTimeoutHours * 60 * 60 * 1000

    if (sessionAgeMs > timeoutMs) {
      // Session has timed out - auto-abandon it
      await abandonSessionPlan(existingActive.id)
    } else {
      // Session is still active - throw error with session data
      throw new ActiveSessionExistsError(existingActive)
    }
  }

  onProgress?.({ type: 'plan_loading_data', message: 'Loading student data...' })

  // 1. Load student state and app config (in parallel for performance)
  const loadDataStart = performance.now()
  const [
    curriculum,
    skillMastery,
    paceAssessment,
    problemHistory,
    dbSettings,
    linearVetoes,
    linearReadinessFlag,
  ] = await Promise.all([
    getPlayerCurriculum(playerId),
    getAllSkillMastery(playerId),
    getPaceAssessment(playerId),
    // Only load problem history for BKT in adaptive modes
    problemGenerationMode === 'adaptive' || problemGenerationMode === 'adaptive-bkt'
      ? getRecentSessionResults(playerId, BKT_INTEGRATION_CONFIG.sessionHistoryDepth)
      : Promise.resolve([]),
    // Load term count scaling config from DB
    db.select().from(appSettings).where(eq(appSettings.id, 'default')).limit(1),
    // L3: teacher vetoes + feature gate for derived linear-readiness
    getLinearReadinessVetoes(playerId),
    getFlag('linear_readiness.enabled'),
  ])

  const loadDataMs = performance.now() - loadDataStart

  // Parse DB term count scaling config (falls back to defaults if null/invalid)
  const termCountScalingConfig = parseTermCountScaling(dbSettings[0]?.termCountScaling ?? null)

  // The L3 flag carries the ramp-gate thresholds in its JSON `config` (tunable live via
  // /admin/feature-flags, no redeploy). One flag read yields both the on/off gate and
  // the thresholds; a null/missing config falls back to DEFAULT_LINEAR_GATE_THRESHOLDS.
  const linearReadinessEnabled = linearReadinessFlag?.enabled ?? false
  const linearGateThresholds = resolveLinearGateThresholds(linearReadinessFlag?.config)
  const linearEntryPolicy = resolveLinearEntryPolicy(linearReadinessFlag?.config)

  // Compute BKT if in adaptive modes and we have problem history
  const bktStart = performance.now()
  let bktResults: Map<string, SkillBktResult> | undefined
  let byModeBkt: ReturnType<typeof computeBktFromHistory>['byMode']
  const usesBktTargeting =
    problemGenerationMode === 'adaptive' || problemGenerationMode === 'adaptive-bkt'
  if (usesBktTargeting && problemHistory.length > 0) {
    const bktResult = computeBktFromHistory(problemHistory)
    bktResults = new Map(bktResult.skills.map((s) => [s.skillId, s]))
    byModeBkt = bktResult.byMode

    // Debug: Log BKT usage
    if (process.env.DEBUG_SESSION_PLANNER === 'true') {
      console.log(
        `[SessionPlanner] Mode: ${problemGenerationMode}, BKT skills: ${bktResult.skills.length}`
      )
      for (const skill of bktResult.skills.slice(0, 3)) {
        console.log(
          `  ${skill.skillId}: pKnown=${(skill.pKnown * 100).toFixed(0)}%, ` +
            `confidence=${skill.confidence.toFixed(2)}, opportunities=${skill.opportunities}`
        )
      }
    }
  } else if (process.env.DEBUG_SESSION_PLANNER === 'true') {
    console.log(
      `[SessionPlanner] Mode: ${problemGenerationMode}, no BKT (usesBktTargeting=${usesBktTargeting}, history=${problemHistory.length})`
    )
  }

  const bktMs = performance.now() - bktStart

  const practicingCount = skillMastery.filter((s) => isActive(s.practiceLevel)).length
  onProgress?.({
    type: 'plan_analyzing_skills',
    message: `Analyzing ${practicingCount} skill${practicingCount !== 1 ? 's' : ''}...`,
    skillCount: practicingCount,
  })

  // Build student-aware cost calculator for complexity budgeting
  const studentHistory = buildStudentSkillHistoryFromRecords(skillMastery)
  const costCalculator = createSkillCostCalculator(studentHistory, {
    bktResults,
    mode: problemGenerationMode,
  })

  // Debug: Show multipliers for all modes (not just when BKT data exists)
  if (process.env.DEBUG_SESSION_PLANNER === 'true') {
    console.log(`[SessionPlanner] Multiplier comparison (mode=${problemGenerationMode}):`)
    const practicingIds = skillMastery
      .filter((s) => isActive(s.practiceLevel))
      .map((s) => s.skillId)
    for (const skillId of practicingIds.slice(0, 5)) {
      const multiplier = costCalculator.getMultiplier(skillId)
      const isPracticing = costCalculator.getIsPracticing(skillId)
      const bkt = costCalculator.getBktResult(skillId)
      console.log(
        `  ${skillId}: mult=${multiplier.toFixed(2)} inRotation=${isPracticing} ` +
          `bkt_pKnown=${bkt?.pKnown.toFixed(2) ?? 'N/A'} bkt_conf=${bkt?.confidence.toFixed(2) ?? 'N/A'}`
      )
    }
  }

  // Calculate max skill cost for dynamic visualization budget
  // This ensures the student's most expensive skill can appear in visualization
  const practicingSkillIds = skillMastery
    .filter((s) => isActive(s.practiceLevel))
    .map((s) => s.skillId)
  const studentMaxSkillCost = calculateMaxSkillCost(costCalculator, practicingSkillIds)

  // Compute comfort level for dynamic term count scaling
  const rawComfortResult = sessionMode
    ? computeComfortLevel(bktResults, practicingSkillIds, sessionMode)
    : {
        comfortLevel: 0.3,
        factors: {
          avgMastery: null,
          sessionMode: 'maintenance',
          modeMultiplier: 1.0,
          skillCountBonus: 0,
        } as TermCountExplanation['factors'],
      }

  // Compute per-mode comfort levels
  const comfortByMode = sessionMode
    ? computeComfortLevelByMode(byModeBkt, practicingSkillIds, sessionMode)
    : undefined

  // Apply comfort adjustment from problem length preference
  const rawComfortLevel = rawComfortResult.comfortLevel
  const adjustedComfortLevel = Math.max(0, Math.min(1, rawComfortLevel + comfortAdjustment))
  const comfortResult = {
    ...rawComfortResult,
    comfortLevel: adjustedComfortLevel,
  }

  if (process.env.DEBUG_SESSION_PLANNER === 'true') {
    console.log(
      `[SessionPlanner] Comfort level: ${(comfortResult.comfortLevel * 100).toFixed(0)}% ` +
        `(raw=${(rawComfortLevel * 100).toFixed(0)}%, adj=${comfortAdjustment}, ` +
        `avgMastery=${comfortResult.factors.avgMastery?.toFixed(2) ?? 'N/A'}, ` +
        `mode=${comfortResult.factors.sessionMode}, mult=${comfortResult.factors.modeMultiplier}, ` +
        `bonus=${comfortResult.factors.skillCountBonus.toFixed(3)})`
    )
  }

  // Get current phase
  const currentPhaseId = curriculum?.currentPhaseId || 'L1.add.+1.direct'
  const currentPhase = getPhase(currentPhaseId)

  // 2. Personalized timing — the robust, outlier-aware pace estimate (#157).
  // `getPaceAssessment` is the single producer: it excludes Tier-1 (provably
  // broken) samples, winsorizes Tier-2, and clamps to [MIN, MAX]_SECONDS_PER_PROBLEM,
  // so no further clamp is needed here. Falls back to the configured default when
  // there aren't enough clean samples yet.
  const avgTimeSeconds = paceAssessment.isDefault
    ? config.defaultSecondsPerProblem
    : paceAssessment.avgSecondsPerProblem

  // 3. Build skill constraints from the student's ACTUAL practicing skills
  //    Three constraint sets: abacus (all active skills), visualization (visual-ready
  //    skills), and linear (skills DERIVED as "aged out" onto number sentences — L3).
  const activeSkills = skillMastery.filter((s) => isActive(s.practiceLevel))
  const visualReadySkills = skillMastery.filter((s) => isVisualReady(s.practiceLevel))

  // Cannot generate a session without any skills enabled
  if (activeSkills.length === 0) {
    throw new NoSkillsEnabledError()
  }

  // L3: linear-readiness is DERIVED (not the manual visual gate) and gated by a flag.
  // Computed AFTER the empty-skills guard above. When the flag is off, this is empty
  // and linear falls back to the visual coupling in the part gate below.
  const linearExplanation = linearReadinessEnabled
    ? explainLinearReadiness({
        skillMastery,
        problemHistory,
        bktResults,
        vetoedCategories: linearVetoes,
        policy: linearEntryPolicy,
      })
    : null
  const linearReadyIds = linearExplanation?.readySkillIds ?? new Set<string>()
  const linearReadySkills = skillMastery.filter((s) => linearReadyIds.has(s.skillId))

  // Ramp gate (linear-with-abacus): linear-ready categories keep the working abacus
  // until their first-attempt linear accuracy passes the tunable gate. Single
  // homogeneous linear part → the abacus stays on until EVERY linear category has
  // passed, then the linear part becomes pure mental math.
  const linearReadyCategories = new Set<SkillCategoryKey>()
  for (const s of linearReadySkills) {
    const category = getSkillCategory(s.skillId)
    if (category) linearReadyCategories.add(category)
  }
  const linearGateByCategory = deriveLinearGateState({
    problemHistory,
    categories: linearReadyCategories,
    thresholds: linearGateThresholds,
  })
  const linearUsesAbacus = linearPartUsesAbacus(linearGateByCategory)

  const abacusConstraints = buildConstraintsFromPracticingSkills(activeSkills)
  const visualConstraints =
    visualReadySkills.length > 0
      ? buildConstraintsFromPracticingSkills(visualReadySkills)
      : abacusConstraints // Fallback: if no visual skills, use abacus constraints
  // No fallback for linear: an empty linear pool must gate the linear part OUT (see
  // the part gate below), never borrow the abacus set into the hardest format.
  const linearConstraints =
    linearReadySkills.length > 0 ? buildConstraintsFromPracticingSkills(linearReadySkills) : null

  // Legacy alias for compatibility within this function
  const practicingSkillConstraints = abacusConstraints

  // Find skills needing spaced repetition review
  const needsReview = findSkillsNeedingReview(skillMastery, config.reviewIntervalDays)

  // Identify weak skills for targeting
  // When sessionMode is provided, use its pre-computed weak skills (single source of truth)
  // This ensures the session targets exactly what was shown in the UI (no "rug-pulling")
  let weakSkills: string[]
  if (sessionMode) {
    // Use pre-computed weak skills from sessionMode
    weakSkills = getWeakSkillIds(sessionMode)
    if (process.env.DEBUG_SESSION_PLANNER === 'true') {
      console.log(
        `[SessionPlanner] Using weak skills from sessionMode (${sessionMode.type}): ${weakSkills.length}`
      )
    }
  } else {
    // Fallback: compute locally (for backwards compatibility)
    weakSkills = usesBktTargeting ? identifyWeakSkills(bktResults) : []
  }

  if (process.env.DEBUG_SESSION_PLANNER === 'true' && weakSkills.length > 0) {
    console.log(`[SessionPlanner] Targeting ${weakSkills.length} weak skills:`)
    for (const skillId of weakSkills) {
      const bkt = bktResults?.get(skillId)
      console.log(`  ${skillId}: pKnown=${(bkt?.pKnown ?? 0 * 100).toFixed(0)}%`)
    }
  }

  // 4. Build parts using STUDENT'S MASTERED SKILLS (only enabled parts)
  // Gate visualization and linear INDEPENDENTLY (L3): visualization on visual-ready
  // skills, linear on DERIVED linear-readiness. When the flag is off, hasLinearSkills
  // falls back to the visual coupling so behavior is unchanged.
  const hasVisualSkills = visualReadySkills.length > 0
  const { enabledPartTypes, skippedParts } = resolveEnabledPartTypes({
    partsToInclude,
    hasVisualSkills,
    linearReadinessEnabled,
    linearReadyCount: linearReadySkills.length,
    linearReadyBeforeVetoCount: linearExplanation?.readyBeforeVetoSkillIds.size ?? 0,
  })

  // Every requested part gated out (e.g. caller disabled abacus and there are no
  // visual/linear skills). Fail loudly instead of persisting a 0-part plan that
  // crashes downstream with a NaN weight.
  if (enabledPartTypes.length === 0) {
    throw new NoEligiblePartsError(skippedParts)
  }

  const totalEnabledWeight = enabledPartTypes.reduce(
    (sum, type) => sum + config.partTimeWeights[type],
    0
  )

  // Build slot structures (without problems) first to report structure
  const partSlotStructures: Array<{
    partType: SessionPartType
    normalizedWeight: number
    adjustedModeComfortLevel: number
    modeComfortFactors: TermCountExplanation['factors']
    rawModeComfortLevel: number
  }> = []

  for (const partType of enabledPartTypes) {
    const normalizedWeight = config.partTimeWeights[partType] / totalEnabledWeight
    const modeComfort = comfortByMode?.[partType] ?? rawComfortResult
    const rawModeComfortLevel = modeComfort.comfortLevel
    const adjustedModeComfortLevel = Math.max(
      0,
      Math.min(1, rawModeComfortLevel + comfortAdjustment)
    )

    partSlotStructures.push({
      partType,
      normalizedWeight,
      adjustedModeComfortLevel,
      modeComfortFactors: modeComfort.factors,
      rawModeComfortLevel,
    })
  }

  // Build only enabled parts with normalized time weights
  const parts: SessionPart[] = []
  let partNumber = 1 as 1 | 2 | 3
  const partTimings: Array<{
    type: string
    totalMs: number
    problemCount: number
    avgProblemMs: number
  }> = []

  // Build slot structures first (fast) to get problem counts for progress reporting
  const previewParts: Array<{ type: string; problemCount: number }> = []
  for (const { partType, normalizedWeight } of partSlotStructures) {
    const partDurationMinutes = durationMinutes * normalizedWeight
    const partProblemCount =
      overrideProblemsPerPart ??
      Math.max(2, Math.floor((partDurationMinutes * 60) / avgTimeSeconds))
    previewParts.push({ type: partType, problemCount: partProblemCount })
  }

  onProgress?.({
    type: 'plan_structure_ready',
    message: `Generating ${previewParts.reduce((s, p) => s + p.problemCount, 0)} problems...`,
    parts: previewParts,
    skippedParts,
  })

  const PART_TYPE_LABELS: Record<string, string> = {
    abacus: 'Abacus',
    visualization: 'Visualization',
    linear: 'Linear',
  }

  for (const {
    partType,
    normalizedWeight,
    adjustedModeComfortLevel,
    modeComfortFactors,
    rawModeComfortLevel,
  } of partSlotStructures) {
    const partStartTime = performance.now()

    // Abacus → abacus constraints; visualization → visual constraints; linear →
    // derived linear constraints. `linearConstraints` is non-null whenever a linear
    // part survives the flag-on gate; the `?? visualConstraints` fallback preserves
    // today's behavior when the linear-readiness flag is off.
    const partConstraints =
      partType === 'abacus'
        ? abacusConstraints
        : partType === 'visualization'
          ? visualConstraints
          : (linearConstraints ?? visualConstraints)

    const rawPart = await buildSessionPartAsync(
      partNumber,
      partType,
      durationMinutes,
      avgTimeSeconds,
      {
        ...config,
        partTimeWeights: {
          ...config.partTimeWeights,
          [partType]: normalizedWeight,
        },
      },
      partConstraints,
      needsReview,
      currentPhase,
      normalizedWeight,
      costCalculator,
      studentMaxSkillCost,
      weakSkills,
      overrideProblemsPerPart,
      shufflePurposes,
      adjustedModeComfortLevel,
      modeComfortFactors,
      comfortAdjustment,
      rawModeComfortLevel,
      termCountScalingConfig,
      onProgress
        ? (current, total) => {
            onProgress({
              type: 'plan_generating_problem',
              partType,
              partLabel: PART_TYPE_LABELS[partType] ?? partType,
              current,
              total,
            })
          }
        : undefined
    )

    // Ramp: keep the working abacus on a linear part until the gate opens (every
    // linear category passed). Non-linear parts keep the useAbacus the builder set.
    const part = partType === 'linear' ? { ...rawPart, useAbacus: linearUsesAbacus } : rawPart
    parts.push(part)

    const partMs = performance.now() - partStartTime
    partTimings.push({
      type: partType,
      totalMs: partMs,
      problemCount: part.slots.length,
      avgProblemMs: part.slots.length > 0 ? partMs / part.slots.length : 0,
    })

    onProgress?.({
      type: 'plan_part_complete',
      partType,
      problemCount: part.slots.length,
      durationMs: partMs,
    })

    partNumber = (partNumber + 1) as 1 | 2 | 3
  }

  // 5. Build summary
  const summary = buildSummary(parts, currentPhase, durationMinutes, skippedParts)

  // 6. Calculate total problems
  const totalProblemCount = parts.reduce((sum, part) => sum + part.slots.length, 0)

  onProgress?.({ type: 'plan_saving', message: 'Saving session plan...' })
  const saveStart = performance.now()

  const plan: NewSessionPlan = {
    id: createId(),
    playerId,
    targetDurationMinutes: durationMinutes,
    estimatedProblemCount: totalProblemCount,
    avgTimePerProblemSeconds: avgTimeSeconds,
    gameBreakSettings,
    parts,
    summary,
    masteredSkillIds: activeSkills.map((s) => s.skillId),
    status: 'draft',
    currentPartIndex: 0,
    sessionHealth: null,
    adjustments: [],
    results: [],
    createdAt: new Date(),
  }

  const [savedPlan] = await db.insert(schema.sessionPlans).values(plan).returning()

  const saveMs = performance.now() - saveStart
  const totalMs = performance.now() - totalStartTime

  const timing = {
    totalMs,
    loadDataMs,
    bktMs,
    parts: partTimings,
    saveMs,
  }

  if (process.env.DEBUG_SESSION_PLANNER === 'true') {
    console.log(
      `[SessionPlanner] Timing: total=${totalMs.toFixed(0)}ms, ` +
        `loadData=${loadDataMs.toFixed(0)}ms, bkt=${bktMs.toFixed(0)}ms, ` +
        `save=${saveMs.toFixed(0)}ms`
    )
    for (const pt of partTimings) {
      console.log(
        `  ${pt.type}: ${pt.totalMs.toFixed(0)}ms (${pt.problemCount} problems, ` +
          `avg ${pt.avgProblemMs.toFixed(1)}ms/problem)`
      )
    }
  }

  onProgress?.({
    type: 'plan_complete',
    planId: savedPlan.id,
    timing,
  })

  return savedPlan
}

/**
 * Build a single session part with the appropriate slots
 *
 * @param weakSkills - Skills identified by BKT as weak (low P(known)).
 *   These are used for both focus and reinforce slots to prioritize practice.
 */
function buildSessionPart(
  partNumber: 1 | 2 | 3,
  type: SessionPartType,
  totalDurationMinutes: number,
  avgTimeSeconds: number,
  config: PlanGenerationConfig,
  phaseConstraints: ReturnType<typeof getPhaseSkillConstraints>,
  needsReview: PlayerSkillMastery[],
  currentPhase: CurriculumPhase | undefined,
  normalizedWeight?: number,
  costCalculator?: SkillCostCalculator,
  studentMaxSkillCost?: number,
  weakSkills?: string[],
  overrideProblemsPerPart?: number,
  shufflePurposes = true,
  comfortLevel = 0.3,
  comfortFactors?: TermCountExplanation['factors'],
  comfortAdjustment?: number,
  rawComfortLevel?: number,
  termCountScalingConfig?: TermCountScalingConfig
): SessionPart {
  // Get time allocation for this part (use normalized weight if provided)
  const partWeight = normalizedWeight ?? config.partTimeWeights[type]
  const partDurationMinutes = totalDurationMinutes * partWeight
  const partProblemCount =
    overrideProblemsPerPart ?? Math.max(2, Math.floor((partDurationMinutes * 60) / avgTimeSeconds))

  // Calculate slot distribution using unified 4-weight proportional allocation.
  //
  // IMPORTANT: Challenge slots require min complexity budget of 1.
  // Basic skills have cost 0, so students with ONLY basic skills can't generate challenge problems.
  // When canDoChallenge is false, challenge weight is set to 0 and its share
  // automatically redistributes to the other 3 purposes via normalization.
  const challengeMinBudget = config.purposeComplexityBounds.challenge[type].min ?? 0
  const canDoChallenge =
    studentMaxSkillCost !== undefined && studentMaxSkillCost >= challengeMinBudget

  const weights = {
    focus: config.focusWeight,
    reinforce: config.reinforceWeight,
    review: config.reviewWeight,
    challenge: canDoChallenge ? (config.challengeWeight ?? 0.2) : 0,
  }
  const totalWeight = weights.focus + weights.reinforce + weights.review + weights.challenge

  const focusCount = Math.round((partProblemCount * weights.focus) / totalWeight)
  const reinforceCount = Math.round((partProblemCount * weights.reinforce) / totalWeight)
  const reviewCount = Math.round((partProblemCount * weights.review) / totalWeight)
  // Challenge absorbs rounding remainder (clamped to 0 if canDoChallenge is false)
  const challengeCount = canDoChallenge
    ? Math.max(0, partProblemCount - focusCount - reinforceCount - reviewCount)
    : 0
  // If no challenge, give remainder to focus
  const adjustedFocusCount =
    focusCount + (canDoChallenge ? 0 : partProblemCount - focusCount - reinforceCount - reviewCount)

  // Build slots
  const slots: ProblemSlot[] = []

  // Build constraints for focus slots that prioritize weak skills
  // This adds BKT-identified weak skills to targetSkills so problem generator prefers them
  const focusConstraints =
    weakSkills && weakSkills.length > 0
      ? addWeakSkillsToTargets(phaseConstraints, weakSkills)
      : phaseConstraints

  if (process.env.DEBUG_SESSION_PLANNER === 'true' && weakSkills && weakSkills.length > 0) {
    const targetSkillsList = Object.entries(focusConstraints.targetSkills || {}).flatMap(
      ([cat, skills]) =>
        Object.entries(skills)
          .filter(([, v]) => v)
          .map(([s]) => `${cat}.${s}`)
    )
    console.log(`[SessionPlanner] Focus slots will target: ${targetSkillsList.join(', ')}`)
  }

  // Focus slots: current phase, primary skill (with weak skill targeting)
  // Uses adjustedFocusCount which includes redistributed challenge slots for basic-skill-only students
  for (let i = 0; i < adjustedFocusCount; i++) {
    slots.push(
      createSlot(
        slots.length,
        'focus',
        focusConstraints,
        type,
        config,
        costCalculator,
        studentMaxSkillCost,
        comfortLevel,
        comfortFactors,
        comfortAdjustment,
        rawComfortLevel,
        termCountScalingConfig
      )
    )
  }

  // Reinforce slots: weak skills (from BKT) get extra practice
  // Uses same targeting as focus slots - problems that exercise weak skills
  for (let i = 0; i < reinforceCount; i++) {
    slots.push(
      createSlot(
        slots.length,
        'reinforce',
        focusConstraints, // Same weak skill targeting as focus slots
        type,
        config,
        costCalculator,
        studentMaxSkillCost,
        comfortLevel,
        comfortFactors,
        comfortAdjustment,
        rawComfortLevel,
        termCountScalingConfig
      )
    )
  }

  // Review slots: spaced repetition of mastered skills
  for (let i = 0; i < reviewCount; i++) {
    const skill = needsReview[i % Math.max(1, needsReview.length)]
    slots.push(
      createSlot(
        slots.length,
        'review',
        skill ? buildConstraintsForSkill(skill, phaseConstraints) : phaseConstraints,
        type,
        config,
        costCalculator,
        studentMaxSkillCost,
        comfortLevel,
        comfortFactors,
        comfortAdjustment,
        rawComfortLevel,
        termCountScalingConfig
      )
    )
  }

  // Challenge slots: use same mastered skills constraints (all problems should use student's skills)
  for (let i = 0; i < challengeCount; i++) {
    slots.push(
      createSlot(
        slots.length,
        'challenge',
        phaseConstraints,
        type,
        config,
        costCalculator,
        studentMaxSkillCost,
        comfortLevel,
        comfortFactors,
        comfortAdjustment,
        rawComfortLevel,
        termCountScalingConfig
      )
    )
  }

  // Optionally shuffle to interleave purposes (default: shuffled)
  const shuffledSlots = shufflePurposes ? intelligentShuffle(slots) : slots

  // Generate problems for each slot (persisted in DB for resume capability)
  const slotsWithProblems = shuffledSlots.map((slot) => ({
    ...slot,
    problem: generateProblemFromConstraints(slot.constraints, costCalculator),
  }))

  return {
    kind: 'arithmetic',
    partNumber,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: type === 'abacus',
    slots: slotsWithProblems,
    estimatedMinutes: Math.round(partDurationMinutes),
  }
}

/**
 * Async version of buildSessionPart that yields the event loop periodically
 * to allow Socket.IO broadcasts to flush during problem generation.
 */
async function buildSessionPartAsync(
  partNumber: 1 | 2 | 3,
  type: SessionPartType,
  totalDurationMinutes: number,
  avgTimeSeconds: number,
  config: PlanGenerationConfig,
  phaseConstraints: ReturnType<typeof getPhaseSkillConstraints>,
  needsReview: PlayerSkillMastery[],
  currentPhase: CurriculumPhase | undefined,
  normalizedWeight?: number,
  costCalculator?: SkillCostCalculator,
  studentMaxSkillCost?: number,
  weakSkills?: string[],
  overrideProblemsPerPart?: number,
  shufflePurposes = true,
  comfortLevel = 0.3,
  comfortFactors?: TermCountExplanation['factors'],
  comfortAdjustment?: number,
  rawComfortLevel?: number,
  termCountScalingConfig?: TermCountScalingConfig,
  onProblemGenerated?: (current: number, total: number) => void
): Promise<SessionPart> {
  // Get time allocation for this part (use normalized weight if provided)
  const partWeight = normalizedWeight ?? config.partTimeWeights[type]
  const partDurationMinutes = totalDurationMinutes * partWeight
  const partProblemCount =
    overrideProblemsPerPart ?? Math.max(2, Math.floor((partDurationMinutes * 60) / avgTimeSeconds))

  const challengeMinBudget = config.purposeComplexityBounds.challenge[type].min ?? 0
  const canDoChallenge =
    studentMaxSkillCost !== undefined && studentMaxSkillCost >= challengeMinBudget

  const weights = {
    focus: config.focusWeight,
    reinforce: config.reinforceWeight,
    review: config.reviewWeight,
    challenge: canDoChallenge ? (config.challengeWeight ?? 0.2) : 0,
  }
  const totalWeight = weights.focus + weights.reinforce + weights.review + weights.challenge

  const focusCount = Math.round((partProblemCount * weights.focus) / totalWeight)
  const reinforceCount = Math.round((partProblemCount * weights.reinforce) / totalWeight)
  const reviewCount = Math.round((partProblemCount * weights.review) / totalWeight)
  const challengeCount = canDoChallenge
    ? Math.max(0, partProblemCount - focusCount - reinforceCount - reviewCount)
    : 0
  const adjustedFocusCount =
    focusCount + (canDoChallenge ? 0 : partProblemCount - focusCount - reinforceCount - reviewCount)

  const slots: ProblemSlot[] = []

  const focusConstraints =
    weakSkills && weakSkills.length > 0
      ? addWeakSkillsToTargets(phaseConstraints, weakSkills)
      : phaseConstraints

  for (let i = 0; i < adjustedFocusCount; i++) {
    slots.push(
      createSlot(
        slots.length,
        'focus',
        focusConstraints,
        type,
        config,
        costCalculator,
        studentMaxSkillCost,
        comfortLevel,
        comfortFactors,
        comfortAdjustment,
        rawComfortLevel,
        termCountScalingConfig
      )
    )
  }
  for (let i = 0; i < reinforceCount; i++) {
    slots.push(
      createSlot(
        slots.length,
        'reinforce',
        focusConstraints,
        type,
        config,
        costCalculator,
        studentMaxSkillCost,
        comfortLevel,
        comfortFactors,
        comfortAdjustment,
        rawComfortLevel,
        termCountScalingConfig
      )
    )
  }
  for (let i = 0; i < reviewCount; i++) {
    const skill = needsReview[i % Math.max(1, needsReview.length)]
    slots.push(
      createSlot(
        slots.length,
        'review',
        skill ? buildConstraintsForSkill(skill, phaseConstraints) : phaseConstraints,
        type,
        config,
        costCalculator,
        studentMaxSkillCost,
        comfortLevel,
        comfortFactors,
        comfortAdjustment,
        rawComfortLevel,
        termCountScalingConfig
      )
    )
  }
  for (let i = 0; i < challengeCount; i++) {
    slots.push(
      createSlot(
        slots.length,
        'challenge',
        phaseConstraints,
        type,
        config,
        costCalculator,
        studentMaxSkillCost,
        comfortLevel,
        comfortFactors,
        comfortAdjustment,
        rawComfortLevel,
        termCountScalingConfig
      )
    )
  }

  const shuffledSlots = shufflePurposes ? intelligentShuffle(slots) : slots

  // Generate problems with async yielding for Socket.IO broadcast flushing
  const slotsWithProblems: ProblemSlot[] = []
  for (let i = 0; i < shuffledSlots.length; i++) {
    const slot = shuffledSlots[i]
    slotsWithProblems.push({
      ...slot,
      problem: generateProblemFromConstraints(slot.constraints, costCalculator),
    })
    onProblemGenerated?.(i + 1, shuffledSlots.length)

    // Yield event loop every 3 problems to allow Socket.IO broadcasts to flush
    if (onProblemGenerated && (i + 1) % 3 === 0 && i < shuffledSlots.length - 1) {
      await new Promise<void>((r) => setTimeout(r, 0))
    }
  }

  return {
    kind: 'arithmetic',
    partNumber,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: type === 'abacus',
    slots: slotsWithProblems,
    estimatedMinutes: Math.round(partDurationMinutes),
  }
}

// ============================================================================
// Plan Management
// ============================================================================

/**
 * Get a session plan by ID
 */
export async function getSessionPlan(planId: string): Promise<SessionPlan | null> {
  const result = await db.query.sessionPlans.findFirst({
    where: eq(schema.sessionPlans.id, planId),
  })
  return result ?? null
}

/**
 * Whether every part of a session can be played (its kind's `isPlayable`).
 * Old arithmetic sessions from before problem pre-generation fail this check.
 */
function sessionIsPlayable(plan: SessionPlan): boolean {
  return plan.parts.every(isPartPlayable)
}

/**
 * Get active session plan for a player (in_progress status)
 * Returns the most recent in_progress session if multiple exist
 * Auto-abandons sessions that are missing pre-generated problems (legacy data)
 */
export async function getActiveSessionPlan(playerId: string): Promise<SessionPlan | null> {
  // Find any session that's not completed or abandoned
  // This includes: draft, approved, in_progress
  // IMPORTANT: Also check completedAt IS NULL to handle inconsistent data
  // where status may be in_progress but completedAt is set
  const result = await db.query.sessionPlans.findFirst({
    where: and(
      eq(schema.sessionPlans.playerId, playerId),
      inArray(schema.sessionPlans.status, ['draft', 'approved', 'in_progress']),
      isNull(schema.sessionPlans.completedAt)
    ),
    orderBy: (plans, { desc }) => [desc(plans.createdAt)],
  })

  if (!result) {
    return null
  }

  // Validate every part is playable (old sessions may lack pre-generated
  // problems) - auto-abandon those
  if (!sessionIsPlayable(result)) {
    console.warn(
      `[getActiveSessionPlan] Session ${result.id} missing pre-generated problems, auto-abandoning`
    )
    await abandonSessionPlan(result.id)
    // Recursively check for another active session
    return getActiveSessionPlan(playerId)
  }

  return result
}

/**
 * Get the most recently completed session plan for a player
 * Used for the summary page after completing a session
 */
export async function getMostRecentCompletedSession(playerId: string): Promise<SessionPlan | null> {
  const result = await db.query.sessionPlans.findFirst({
    where: and(
      eq(schema.sessionPlans.playerId, playerId),
      eq(schema.sessionPlans.status, 'completed')
    ),
    orderBy: (plans, { desc }) => [desc(plans.completedAt)],
  })
  return result ?? null
}

/**
 * One recorded try in a student's history, with its session and what it is
 * evidence of (practice-kinds plan §1.3, K1b). The stored row is whole, so
 * every reader of its shared fields reads it as before; the evidence readers
 * read `evidence` and `mode` (`evidenceSkillsOf`, `try-evidence.ts`).
 *
 * The plan names this `Try & { … }`; the history reads the row as stored,
 * not normalized, because normalizing needs the plan's `parts` (its slots),
 * which this query skips by design (amendment A7).
 */
export interface HistoryTry extends SlotResult {
  /** Session ID this result came from */
  sessionId: string
  /** When the session was completed */
  sessionCompletedAt: Date
  /** What the try is evidence of: stamped, else derived (§3.1) */
  evidence: TryEvidence
  /** The presentation it was practiced in (`evidence.presentation`) */
  presentation: string
  /** The mastery mode it counts toward, resolved now (`masteryModeOf`) */
  mode: string
}

/** The history row's name before K1b, kept for its readers */
export type ProblemResultWithContext = HistoryTry

/**
 * Get recent problem results across multiple sessions for skills analysis
 *
 * Returns a flat list of problem results with session context,
 * ordered by most recent first.
 *
 * @param playerId - The player to fetch results for
 * @param sessionCount - Number of recent sessions to include (default 50)
 */
export async function getRecentSessionResults(
  playerId: string,
  sessionCount = 50
): Promise<ProblemResultWithContext[]> {
  const map = await batchGetRecentSessionResults([playerId], sessionCount)
  return map.get(playerId) ?? []
}

/**
 * Batch-fetch recent problem results for multiple players in a single query.
 *
 * Returns a Map<playerId, ProblemResultWithContext[]> with results ordered
 * by timestamp descending (most recent first).
 *
 * @param playerIds - The players to fetch results for
 * @param sessionCountPerPlayer - Max sessions per player (default 50)
 */
export async function batchGetRecentSessionResults(
  playerIds: string[],
  sessionCountPerPlayer = 50
): Promise<Map<string, ProblemResultWithContext[]>> {
  const resultMap = new Map<string, ProblemResultWithContext[]>()
  if (playerIds.length === 0) return resultMap

  // Include both 'completed' sessions and 'recency-refresh' sentinels
  // Recency-refresh sessions contain sentinel records that update lastPracticedAt
  // but are zero-weight for BKT mastery calculation
  //
  // Use .select() instead of .findMany() to skip the massive `parts` column
  // (which contains full problem generation traces, 10-50KB per session).
  // Instead, extract just the partNumber→type mapping via a SQLite JSON subquery.
  const sessions = await db
    .select({
      id: schema.sessionPlans.id,
      playerId: schema.sessionPlans.playerId,
      completedAt: schema.sessionPlans.completedAt,
      results: schema.sessionPlans.results,
      // Extract lightweight [{n: partNumber, t: type, k: kind}, ...] from the
      // parts JSON, in order (a row's `partIndex` is a position in it),
      // instead of fetching the entire parts column with all slots/problems
      partTypeMap: sql<string>`(
        SELECT json_group_array(json_object(
          'n', json_extract(value, '$.partNumber'),
          't', json_extract(value, '$.type'),
          'k', json_extract(value, '$.kind')
        )) FROM json_each(${schema.sessionPlans.parts})
      )`,
    })
    .from(schema.sessionPlans)
    .where(
      and(
        inArray(schema.sessionPlans.playerId, playerIds),
        inArray(schema.sessionPlans.status, ['completed', 'recency-refresh'])
      )
    )
    .orderBy(desc(schema.sessionPlans.completedAt))

  // Cap sessions per player and flatten results with session context
  const sessionCountByPlayer = new Map<string, number>()

  for (const session of sessions) {
    if (!session.completedAt) continue

    const count = sessionCountByPlayer.get(session.playerId) ?? 0
    if (count >= sessionCountPerPlayer) continue
    sessionCountByPlayer.set(session.playerId, count + 1)

    let list = resultMap.get(session.playerId)
    if (!list) {
      list = []
      resultMap.set(session.playerId, list)
    }

    // The parts as the evidence derivation reads them, from the extraction
    const parts = evidencePartsOf(session.partTypeMap)

    for (const result of session.results) {
      // What the row is evidence of and the mode it counts toward: stamped,
      // else derived from its part (§3.1), as the SQL path derives it. A row
      // with none counts toward nothing and is left out, as SQL leaves it:
      // a stamped `null` (recorded, not counted, §1.3), a kind this image
      // does not know (never called 'linear'), and pre-schema fixtures
      // (e.g. validation seed plans) with no `skillsExercised` array.
      const resolved = resolvedEvidenceOfRow(result, parts)
      if (!resolved) continue
      // Practice-only do-overs (Phase 1) carry no evidence for any history
      // reader: readiness, the linear gate, skill metrics, leaderboards, MCP.
      if (!isCountedTry(result)) continue

      list.push({
        ...result,
        sessionId: session.id,
        sessionCompletedAt: session.completedAt,
        ...resolved,
      })
    }
  }

  // Sort each player's results by timestamp descending (most recent first)
  for (const list of resultMap.values()) {
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  return resultMap
}

/**
 * Approve a plan (teacher says "Let's Go!")
 */
export async function approveSessionPlan(planId: string): Promise<SessionPlan> {
  return setPlanFields(planId, { status: 'approved', approvedAt: new Date() })
}

/**
 * Start a session (first problem displayed)
 */
export async function startSessionPlan(planId: string): Promise<SessionPlan> {
  const now = new Date()
  const initialHealth: SessionHealth = {
    overall: 'good',
    accuracy: 1,
    pacePercent: 100,
    currentStreak: 0,
    avgResponseTimeMs: 0,
  }

  return setPlanFields(planId, (plan) => ({
    status: 'in_progress',
    flowState: 'practicing',
    flowUpdatedAt: now,
    flowVersion: (plan.flowVersion ?? 0) + 1,
    startedAt: now,
    sessionHealth: initialHealth,
  }))
}

/**
 * A try was submitted for a different item than the one the server expects
 * next, and it is not a resubmit of the try just recorded. The client's plan is
 * stale; the route answers 409 and the client refetches.
 */
export class SlotResultMismatchError extends Error {
  constructor(
    public readonly submittedSlotId: string | undefined,
    public readonly expectedSlotId: string | null
  ) {
    super(
      `Answer is for slot ${submittedSlotId ?? '(none)'}, but the current problem is ${expectedSlotId ?? '(none)'}`
    )
    this.name = 'SlotResultMismatchError'
  }
}

/**
 * A do-over whose `itemId` and indices name different slots: a client bug, not
 * a stale plan, so the route answers 400 rather than the quiet 409 refetch
 * that would drop the kid's do-over without a word (§10 P5a-7).
 */
export class MalformedDoOverError extends Error {
  constructor(
    public readonly itemId: string,
    public readonly originalPartIndex: number | undefined,
    public readonly originalSlotIndex: number | undefined
  ) {
    super(
      `Do-over names item ${itemId} but part ${originalPartIndex}, slot ${originalSlotIndex}, which is another slot`
    )
    this.name = 'MalformedDoOverError'
  }
}

/**
 * A first or retry try reached a live session that is not `practicing` (a part
 * transition or a break owns the next step). Nothing is recorded; the route
 * answers 409 `not_practicing` with this plan in the body, and the client
 * applies it, which renders the transition or break screen (plan of record
 * §1.1, Phase 3c). Replaces Phase 3a's implicit `PART_TRANSITION_COMPLETED` for
 * a try in `part_transition` and its `INVALID_FLOW_TRANSITION` for a try during
 * a break.
 */
export class NotPracticingError extends Error {
  readonly code = 'not_practicing'
  constructor(public readonly plan: SessionPlan) {
    super(`The session is in ${plan.flowState}, not practicing; the try was not recorded`)
    this.name = 'NotPracticingError'
  }
}

/**
 * A submitted try without the fields only the server stamps. Clients from
 * before Phase 1 send `isRetry`/`epochNumber` guesses and `masteryWeight`;
 * `epochNumber` stays (it tells a resubmit from the next round), the rest go.
 * A `tryId` not in the form the client mints (see `isClientTryId`) is treated
 * as absent: the server mints one and the exact-match rule applies.
 */
type Unstamped<T> = Omit<
  T,
  | 'kind'
  | 'round'
  | 'practiceOnly'
  | 'masteryWeight'
  | 'isRetry'
  | 'originalSlotIndex'
  | 'voided'
  | 'attachmentId'
>

function withoutServerStamps<T extends Partial<SlotResult>>(submission: T): Unstamped<T> {
  const {
    kind: _kind,
    round: _round,
    practiceOnly: _practiceOnly,
    masteryWeight: _masteryWeight,
    isRetry: _isRetry,
    originalSlotIndex: _originalSlotIndex,
    voided: _voided,
    attachmentId: _attachmentId,
    tryId,
    ...rest
  } = submission
  if (tryId !== undefined && !isClientTryId(tryId)) {
    console.warn('[session-planner] ignoring malformed tryId', {
      tryId: String(tryId).slice(0, 80),
    })
    return rest as Unstamped<T>
  }
  return (tryId === undefined ? rest : { ...rest, tryId }) as Unstamped<T>
}

/**
 * A submission without the legacy try fields a client may still send
 * (`epochNumber` is read before this, to tell a resubmit from the next round;
 * the others are dropped by `withoutServerStamps`). New rows carry none of
 * them since Phase 6b-1 (§10 P6b1-4).
 */
function withoutLegacyTryFields<T extends Partial<SlotResult>>(
  submission: T
): Omit<T, 'isRetry' | 'epochNumber' | 'isManualRedo' | 'originalSlotIndex'> {
  const {
    isRetry: _isRetry,
    epochNumber: _epochNumber,
    isManualRedo: _isManualRedo,
    originalSlotIndex: _originalSlotIndex,
    ...rest
  } = submission
  return rest
}

/** Whether a try with this id is already recorded (idempotent record by `tryId`). */
function isRecordedTry(plan: SessionPlan, tryId: string | undefined): boolean {
  return tryId !== undefined && plan.results.some((r) => r.tryId === tryId)
}

/**
 * The outcome of a try sent in the legacy body (`record`/`record_redo`), the
 * only body there is until K2. A skip arrives as `handleSkip` has always sent
 * it (`ActiveSession.tsx`): the correct answer, wrong, with manual help. The
 * one place this heuristic lives (practice-kinds plan K1a): every other
 * reader takes `outcome` from the row. A client's verdict is its own judge
 * (`answer === problem.answer`), so an answered try that stores the correct
 * answer is never wrong and cannot be taken for a skip.
 */
function outcomeOfLegacyBody(
  body: Pick<SlotResult, 'hadHelp' | 'helpTrigger' | 'studentAnswer' | 'isCorrect' | 'problem'>
): TryOutcome {
  return body.hadHelp &&
    body.helpTrigger === 'manual' &&
    body.studentAnswer === body.problem?.answer &&
    !body.isCorrect
    ? 'skipped'
    : 'answered'
}

/**
 * The row with its try envelope stamped (practice-kinds plan §1.3, K1a):
 * `itemId`, `outcome` (from the legacy body), `answer` (null unless
 * answered), `evidence` (the kind's `evidenceOf`) and `payload` (arithmetic:
 * `{ kind: 'arithmetic' }`; its snapshot stays in the top-level fields, which
 * are written as they always were, K14).
 *
 * The server judges an answered try with the kind's `judge`. K1a is
 * behaviour-identical: the row keeps the client's verdict, the one every
 * client and reader acts on today, and a disagreement is returned for the
 * recorder to log once its write commits (`logJudgeDisagreement`), never
 * stored, so no kid's record changes. Storing the server's verdict waits
 * for zero disagreements in production (plan §8, amendment A1; K2).
 */
function withTryEnvelope(
  part: SessionPart,
  kind: AnyPartKind,
  itemId: string,
  row: SlotResult
): { row: SlotResult; evidence: TryEvidence | null; disagreement: JudgeDisagreement | null } {
  const outcome = outcomeOfLegacyBody(row)
  const answer = outcome === 'answered' ? row.studentAnswer : null
  const verdict = outcome === 'answered' && kind.judge(kind.contentOf(part), itemId, answer)
  const disagreement =
    verdict === row.isCorrect
      ? null
      : { tryId: row.tryId, itemId, outcome, clientVerdict: row.isCorrect, judge: verdict }
  const payload = { kind: kindIdOf(part) }
  const evidence = kind.evidenceOf(part, {
    result: row,
    outcome,
    payload: kind.payloadOf({ ...row, payload }),
  })
  return { row: { ...row, itemId, outcome, answer, evidence, payload }, evidence, disagreement }
}

/** The server's judge and the client's verdict on one try, when they differ. */
interface JudgeDisagreement {
  tryId: string | undefined
  itemId: string
  outcome: TryOutcome
  clientVerdict: boolean
  judge: boolean
}

/** Judge parity (K1a): logged once per recorded try, after its write commits. */
function logJudgeDisagreement(
  caller: string,
  planId: string,
  disagreement: JudgeDisagreement | null
): void {
  if (!disagreement) return
  console.warn(`[${caller}] judge disagrees with the client verdict; storing the client's`, {
    planId,
    ...disagreement,
  })
}

/** Revoke any active share links once a session completes (non-critical). */
async function revokeSharesIfComplete(planId: string, isComplete: boolean, caller: string) {
  if (!isComplete) return
  try {
    await revokeSharesForSession(planId)
  } catch (shareError) {
    // Non-critical: log and continue (session already completed successfully)
    console.error(`[${caller}] revokeSharesForSession FAILED:`, shareError)
  }
}

/** Elapsed practice time for session health: since the start, 0 before it. */
function elapsedSinceStart(plan: SessionPlan): number {
  return plan.startedAt ? Date.now() - plan.startedAt.getTime() : 0
}

/** The row write for a recorded try: the machine's patch plus session health. */
function tryWrite(plan: SessionPlan, row: SlotResult, t: RecordedTry): SessionPlanPatch {
  const { patch } = applyFlowEvent(plan, { type: 'TRY_RECORDED', row, try: t })
  return {
    ...patch,
    sessionHealth: calculateSessionHealth(
      { ...plan, results: patch.results ?? plan.results },
      elapsedSinceStart(plan)
    ),
  }
}

/** What a committed try write reports back to its recorder, for side effects and traces. */
interface RecordedTryOutcome {
  previousPartIndex: number
  previousSlotIndex: number
  inRetryEpoch: boolean
  /** The stamped evidence: what the skill-attempt bump reads after commit */
  evidence: TryEvidence | null
  /** Logged after commit, once per recorded try */
  disagreement: JudgeDisagreement | null
}

/**
 * Record a result for the current item and advance to the next.
 *
 * `recordTry` = `withRowCas(planId, plan => idempotency check → kind → machine)`
 * (plan of record §7 Phase 3a). Every attempt re-reads the row, so a request
 * that lost a race against the same `tryId` sees it recorded and returns
 * without a second write or a second skill-attempt bump (§10 P1-10).
 *
 * The try is attributed to the item the current part's state names
 * (`currentItemOf`: `part_states` since Phase 5, the legacy cursor for a row
 * without it or with a stale entry; the item the client shows), identified by
 * content: the submitted `problem` and `slotIndex` must be that
 * item's (and `epochNumber`, when sent, its round). The submitted `slotId` is
 * not trusted: older clients can send the previous slot's id after an
 * optimistic advance, so the stored `slotId` is always the item's own.
 *
 * Idempotent by `tryId`: a try whose id is already recorded returns the plan
 * unchanged. Without a `tryId` (clients from before Phase 1), a resubmit that
 * equals the last recorded try exactly (slot, round when sent, problem, answer)
 * returns the plan unchanged. Anything else that is not the current item
 * throws SlotResultMismatchError.
 *
 * The server stamps `kind`, `round`, `practiceOnly`, `partIndex` and
 * `masteryWeight` (weightOfTry); client-sent values for them are ignored. The
 * flow machine (`TRY_RECORDED`) moves the part's cursor through its kind and
 * decides the rhythm.
 */
export async function recordSlotResult(
  planId: string,
  submission: SlotResultSubmission
): Promise<SessionPlan> {
  const { partIndex: submittedPartIndex, ...submitted } = withoutServerStamps(submission)
  // Server-side timing backstop (#156): cap any value that outran the absolute
  // ceiling (stale/hostile clients, clock anomalies) before it is ever stored
  // or fed to BKT via recordSkillAttemptsWithHelp below. Independently
  // deployable — this alone ends unbounded writes even if the client guard
  // never ran. Client-capped values pass through untouched.
  const result = { ...submitted, ...sanitizeResultTiming(submitted) }
  const traceStart = Date.now()

  const {
    plan: updated,
    value: outcome,
    committed,
  } = await withRowCas<RecordedTryOutcome | null>(planId, (plan) => {
    // Defensive check: ensure parts array exists and is valid
    if (!plan.parts || !Array.isArray(plan.parts)) {
      throw new Error(
        `Plan ${planId} has invalid parts: ${typeof plan.parts} (status: ${plan.status}, partIndex: ${plan.currentPartIndex})`
      )
    }
    if (plan.parts.length === 0) {
      throw new Error(`Plan ${planId} has empty parts array`)
    }
    // Defensive check: ensure results array exists
    if (!plan.results || !Array.isArray(plan.results)) {
      throw new Error(`Plan ${planId} has invalid results: ${typeof plan.results} (expected array)`)
    }

    // A try already recorded (a resend after a lost reply, a double submit,
    // or the request this one raced)
    if (isRecordedTry(plan, result.tryId)) {
      console.log('[recordSlotResult] duplicate tryId ignored', { planId, tryId: result.tryId })
      return noWrite(null)
    }

    // Attribute the try to the item the student is shown, by content. Checked
    // before the position checks so a resubmit of a session's final answer is
    // still a no-op.
    const expected = currentItemOf(plan)
    //
    // Transitional gap: clients from before this check send no epochNumber (or
    // partIndex). For them a resubmit of a wrong answer to a part's last slot,
    // arriving once that slot's first retry is current, has the same content as
    // the retry and is recorded as it. Clients that send epochNumber are exact.
    const isSubmittedTry = (t: {
      partIndex: number
      slotIndex: number
      epochNumber?: number
      problem: GeneratedProblem | undefined
    }) =>
      (submittedPartIndex === undefined || t.partIndex === submittedPartIndex) &&
      t.slotIndex === result.slotIndex &&
      (result.epochNumber === undefined || (t.epochNumber ?? 0) === result.epochNumber) &&
      sameProblem(t.problem, result.problem)
    const isExpectedItem =
      !!expected && isSubmittedTry({ ...expected, slotIndex: expected.originalSlotIndex })
    if (!isExpectedItem) {
      // The stored row's kind, round and item position come from the
      // normalizer (`legacy-try-fields.ts`), so a row without the legacy try
      // fields (Phase 6b-1) reads the same (§10 P6b-6)
      const lastTry = [...plan.results].reverse().find((r) => tryKindOfRow(r) !== 'do_over')
      const lastTryPartNumber = lastTry?.partNumber
      if (
        result.tryId === undefined &&
        lastTry &&
        isSubmittedTry({
          partIndex: plan.parts.findIndex((p) => p.partNumber === lastTryPartNumber),
          slotIndex: itemSlotIndexOfRow(lastTry),
          epochNumber: retryRoundOfRow(lastTry),
          problem: lastTry.problem,
        }) &&
        lastTry.studentAnswer === result.studentAnswer
      ) {
        console.log('[recordSlotResult] duplicate submit ignored', {
          planId,
          slotId: result.slotId,
        })
        return noWrite(null)
      }
    }
    // A live session whose next step is a transition or a break takes no try,
    // whatever item it names: the client applies the plan sent back (Phase 3c).
    // Resubmits of a recorded try were answered above, so a resend of a part's
    // final try stays a no-op.
    if (plan.status === 'in_progress' && (plan.flowState ?? 'practicing') !== 'practicing') {
      throw new NotPracticingError(plan)
    }
    if (!expected || !isExpectedItem) {
      throw new SlotResultMismatchError(result.slotId, expected?.slotId ?? null)
    }
    if (result.slotId !== expected.slotId) {
      console.log(
        '[recordSlotResult] submitted slotId lags the answered problem; storing its own',
        {
          planId,
          submittedSlotId: result.slotId,
          slotId: expected.slotId,
        }
      )
    }

    if (plan.currentPartIndex < 0 || plan.currentPartIndex >= plan.parts.length) {
      throw new Error(
        `Plan ${planId} has invalid currentPartIndex: ${plan.currentPartIndex} (parts.length: ${plan.parts.length})`
      )
    }

    const currentPart = plan.parts[plan.currentPartIndex]
    if (!currentPart) throw new Error(`Invalid part index: ${plan.currentPartIndex}`)

    console.log('[GBTRACE][server]', 'record-slot-result-start', {
      ts: new Date().toISOString(),
      planId,
      playerId: plan.playerId,
      currentPartIndex: plan.currentPartIndex,
      currentSlotIndex: arithmeticCursorSlotIndex(plan),
      currentPartNumber: currentPart.partNumber,
      currentPartType: currentPart.type,
      submittedSlotIndex: result.slotIndex,
      isCorrect: result.isCorrect,
    })

    // Defensive check: ensure slots array exists
    if (!currentPart.slots || !Array.isArray(currentPart.slots)) {
      throw new Error(
        `Plan ${planId} part ${plan.currentPartIndex} has invalid slots: ${typeof currentPart.slots}`
      )
    }

    const partIndex = plan.currentPartIndex
    const inRetryEpoch = expected.retryIndex !== null
    const epochNumber = expected.epochNumber
    const originalSlotIndex = expected.originalSlotIndex
    const kind = inRetryEpoch ? ('retry' as const) : ('first' as const)

    // The row carries the try record only: the legacy try fields (`isRetry`,
    // `epochNumber`, `isManualRedo`, `originalSlotIndex`) are not written
    // since Phase 6b-1; every reader takes kind, round and item position
    // through the normalizer (`legacy-try-fields.ts`, §10 P6b1-4)
    const {
      row: newResult,
      evidence,
      disagreement,
    } = withTryEnvelope(currentPart, partKindOf(currentPart), expected.slotId, {
      ...withoutLegacyTryFields(result),
      tryId: result.tryId ?? mintTryId(),
      kind,
      round: epochNumber,
      practiceOnly: false,
      partIndex,
      slotId: expected.slotId,
      slotIndex: originalSlotIndex,
      partNumber: currentPart.partNumber,
      timestamp: new Date(),
      masteryWeight: weightOfTry({
        kind,
        round: epochNumber,
        isCorrect: result.isCorrect,
        practiceOnly: false,
      }),
    })

    return {
      write: tryWrite(plan, newResult, {
        partIndex,
        itemId: expected.slotId,
        kind,
        round: epochNumber,
        practiceOnly: false,
        isCorrect: result.isCorrect,
      }),
      value: {
        previousPartIndex: plan.currentPartIndex,
        previousSlotIndex: arithmeticCursorSlotIndex(plan),
        inRetryEpoch,
        evidence,
        disagreement,
      },
    }
  })

  if (!committed || !outcome) return updated

  // Update global skill mastery timestamps with help tracking. Once per
  // recorded try: only the request whose write committed gets here.
  // Note: masteryWeight is applied by BKT when it reads SlotResults (not here)
  logJudgeDisagreement('recordSlotResult', planId, outcome.disagreement)
  const { evidence } = outcome
  if (evidence && evidence.skills.length > 0) {
    const skillResults = evidence.skills.map((skillId) => ({
      skillId,
      isCorrect: result.isCorrect,
    }))
    try {
      await recordSkillAttemptsWithHelp(
        updated.playerId,
        skillResults,
        result.hadHelp,
        result.responseTimeMs
      )
    } catch (skillError) {
      console.error(`[recordSlotResult] recordSkillAttemptsWithHelp FAILED:`, skillError)
      throw skillError
    }
  }

  const isComplete = updated.status === 'completed'
  await revokeSharesIfComplete(planId, isComplete, 'recordSlotResult')

  console.log('[GBTRACE][server]', 'record-slot-result-finish', {
    ts: new Date().toISOString(),
    planId,
    playerId: updated.playerId,
    durationMs: Date.now() - traceStart,
    previousPartIndex: outcome.previousPartIndex,
    previousSlotIndex: outcome.previousSlotIndex,
    nextPartIndex: updated.currentPartIndex,
    nextSlotIndex: arithmeticCursorSlotIndex(updated),
    partTransitioned: updated.currentPartIndex > outcome.previousPartIndex,
    flowState: updated.flowState,
    inRetryEpoch: outcome.inRetryEpoch,
    isComplete,
    status: updated.status,
  })

  return updated
}

/** What a committed do-over write reports back to its recorder, for side effects. */
interface RecordedDoOver {
  practiceOnly: boolean
  /** The stamped evidence: what the skill-attempt bump reads after commit */
  evidence: TryEvidence | null
  /** Logged after commit, once per recorded try */
  disagreement: JudgeDisagreement | null
}

/**
 * Context for a manual redo operation
 */
export interface RedoContext {
  /**
   * The item being redone (its slot id), sent by clients from Phase 5 on. When
   * present it names the item; the indices, which those clients keep sending
   * for servers from before it, must name the same slot.
   */
  itemId?: string
  /** Part index of the problem being redone */
  originalPartIndex: number
  /** Slot index of the problem being redone */
  originalSlotIndex: number
  /**
   * Whether the original answer was correct, as the client saw it. Sent for
   * servers from before Phase 1; this server derives it from the item's tries.
   */
  originalWasCorrect?: boolean
}

/**
 * Where the do-over's item is: the slot whose id is `itemId` when sent (null
 * when no slot has it; MalformedDoOverError when indices sent beside it name
 * another slot), else the slot the indices name.
 */
function doOverItemOf(
  parts: readonly SessionPart[],
  context: RedoContext
): { partIndex: number; slotIndex: number } | null {
  if (context.itemId === undefined) {
    return { partIndex: context.originalPartIndex, slotIndex: context.originalSlotIndex }
  }
  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    const slots = parts[partIndex].slots
    const slotIndex = Array.isArray(slots)
      ? slots.findIndex((slot) => slot.slotId === context.itemId)
      : -1
    if (slotIndex < 0) continue
    const disagrees =
      (typeof context.originalPartIndex === 'number' && context.originalPartIndex !== partIndex) ||
      (typeof context.originalSlotIndex === 'number' && context.originalSlotIndex !== slotIndex)
    if (disagrees) {
      throw new MalformedDoOverError(
        context.itemId,
        context.originalPartIndex,
        context.originalSlotIndex
      )
    }
    return { partIndex, slotIndex }
  }
  return null
}

/**
 * Record a do-over (the student tapped a finished problem to do it again).
 * Every do-over is recorded (Phase 1), as a try of kind `do_over`, through the
 * same CAS write and flow machine as `recordSlotResult`.
 *
 * - Idempotent by `tryId`, like recordSlotResult.
 * - `round` = the item's earlier tries that are not practice-only.
 * - A do-over of an item whose latest such try was correct is `practiceOnly`:
 *   weight 0, no skill-attempt bump, no redemption, skipped by every mastery,
 *   readiness, gate, health and verdict reader.
 * - Otherwise it weighs weightOfTry: 1/2^round, right or wrong (Phase 1w), and a
 *   correct one redeems the item from the retry queue. If that leaves the current retry
 *   round with nothing to show, the cursor settles exactly as after a try: next
 *   round, next part, or completion. Only in the part being practiced while
 *   practicing; anywhere else the kind records it aside.
 * - Never steps the session position past an item.
 *
 * The item is the slot `redoContext` names: by `itemId` when sent (indices sent
 * beside it must agree, else MalformedDoOverError, a 400), else by its
 * indices. A do-over of an unknown item, of a slot with no try yet, or whose
 * problem is not the submitted one, throws SlotResultMismatchError.
 */
export async function recordRedoResult(
  planId: string,
  submission: Omit<SlotResult, 'timestamp' | 'partNumber'>,
  redoContext: RedoContext
): Promise<SessionPlan> {
  const unstamped = withoutServerStamps(submission)
  // Server-side timing backstop (#156): symmetric with recordSlotResult — cap
  // any value above the absolute ceiling before storing or feeding BKT.
  const result = { ...unstamped, ...sanitizeResultTiming(unstamped) }

  const {
    plan: updated,
    value: recorded,
    committed,
  } = await withRowCas<RecordedDoOver | null>(planId, (plan) => {
    if (isRecordedTry(plan, result.tryId)) {
      console.log('[recordRedoResult] duplicate tryId ignored', { planId, tryId: result.tryId })
      return noWrite(null)
    }

    const located = doOverItemOf(plan.parts, redoContext)
    if (!located) throw new SlotResultMismatchError(result.slotId, null)
    const { partIndex, slotIndex } = located

    // Validate part index
    if (partIndex < 0 || partIndex >= plan.parts.length) {
      throw new Error(`Invalid part index: ${partIndex}`)
    }

    const part = plan.parts[partIndex]
    const kind = partKindOf(part)
    const slot = part.slots?.[slotIndex]
    const tries = normalizeTries(plan.id, plan.parts, plan.results || [])
    if (
      !slot ||
      !kind.acceptsDoOver(kind.contentOf(part), partStateOf(plan, partIndex), tries, slot.slotId) ||
      !sameProblem(slot.problem, result.problem)
    ) {
      throw new SlotResultMismatchError(result.slotId, null)
    }
    const priorTries = tries.filter((t) => t.itemId === slot.slotId)

    // Reject redo if the answer was already divulged (student exhausted all
    // retries wrong). Rows read through the normalizer (§10 P6b-6).
    const answerWasDivulged = (plan.results || []).some(
      (r) =>
        r.partNumber === part.partNumber &&
        itemSlotIndexOfRow(r) === slotIndex &&
        !r.isCorrect &&
        // a wrong try of the last retry round (a do-over is never a retry);
        // the dots' copy reads the same (`SessionProgressIndicator`)
        tryKindOfRow(r) === 'retry' &&
        tryRoundOfRow(r) >= MAX_RETRY_EPOCHS
    )
    if (answerWasDivulged) {
      throw new Error(
        `Cannot redo slot ${slotIndex} in part ${partIndex}: answer was already revealed after exhausting retries`
      )
    }

    const { round, practiceOnly } = doOverStamp(priorTries)
    // No legacy try fields since Phase 6b-1 (§10 P6b1-4): `kind` says do-over
    const {
      row: newResult,
      evidence,
      disagreement,
    } = withTryEnvelope(part, kind, slot.slotId, {
      ...withoutLegacyTryFields(result),
      tryId: result.tryId ?? mintTryId(),
      kind: 'do_over',
      round,
      practiceOnly,
      partIndex,
      slotId: slot.slotId,
      slotIndex,
      partNumber: part.partNumber,
      timestamp: new Date(),
      masteryWeight: weightOfTry({
        kind: 'do_over',
        round,
        isCorrect: result.isCorrect,
        practiceOnly,
      }),
    })

    return {
      write: tryWrite(plan, newResult, {
        partIndex,
        itemId: slot.slotId,
        kind: 'do_over',
        round,
        practiceOnly,
        isCorrect: result.isCorrect,
      }),
      value: { practiceOnly, evidence, disagreement },
    }
  })

  if (!committed || recorded === null) return updated

  // Update global skill mastery timestamps (not for practice-only: no pedagogical effect)
  logJudgeDisagreement('recordRedoResult', planId, recorded.disagreement)
  const { practiceOnly, evidence } = recorded
  if (!practiceOnly && evidence && evidence.skills.length > 0) {
    const skillResults = evidence.skills.map((skillId) => ({
      skillId,
      isCorrect: result.isCorrect,
    }))
    try {
      await recordSkillAttemptsWithHelp(
        updated.playerId,
        skillResults,
        result.hadHelp ?? false,
        result.responseTimeMs
      )
    } catch (skillError) {
      console.error(`[recordRedoResult] recordSkillAttemptsWithHelp FAILED:`, skillError)
      // Don't throw - redo result was already recorded
    }
  }

  await revokeSharesIfComplete(planId, updated.status === 'completed', 'recordRedoResult')

  return updated
}

export class StaleFlowVersionError extends Error {
  constructor(
    public readonly expectedFlowVersion: number,
    public readonly actualFlowVersion: number
  ) {
    super(
      `Stale flow event: expected flowVersion ${expectedFlowVersion}, actual ${actualFlowVersion}`
    )
    this.name = 'StaleFlowVersionError'
  }
}

/** Apply a machine event chosen from the row as read, in one CAS write. */
async function applyMachineEvent(
  planId: string,
  eventOf: (plan: SessionPlan) => SessionFlowEvent
): Promise<SessionPlan> {
  const { plan } = await withRowCas(planId, (current) => {
    const applied = applyFlowEvent(current, eventOf(current))
    return applied.changed ? { write: applied.patch, value: undefined } : noWrite(undefined)
  })
  return plan
}

/**
 * Apply a client flow event (transition, break). `expectedFlowVersion` is the
 * client's optimistic token: a stale one is a no-op when the event changes
 * nothing from the fresh state, else StaleFlowVersionError. Server-only events
 * (a recorded try, ending, worksheets) are refused here.
 */
export async function applySessionFlowEvent(
  planId: string,
  event: ClientFlowEvent,
  expectedFlowVersion?: number
): Promise<SessionPlan> {
  const { plan } = await withRowCas(planId, (current) => {
    if (!CLIENT_FLOW_EVENT_TYPES.has(event?.type)) {
      throw new InvalidFlowTransitionError(
        `${String(event?.type).slice(0, 40)} is not a client flow event`,
        current.flowState ?? 'practicing',
        event?.type
      )
    }
    if (
      expectedFlowVersion !== undefined &&
      expectedFlowVersion !== null &&
      expectedFlowVersion !== (current.flowVersion ?? 0)
    ) {
      if (!applyFlowEvent(current, event).changed) return noWrite(undefined)
      throw new StaleFlowVersionError(expectedFlowVersion, current.flowVersion ?? 0)
    }
    const applied = applyFlowEvent(current, event)
    return applied.changed ? { write: applied.patch, value: undefined } : noWrite(undefined)
  })
  return plan
}

/**
 * Complete a session early (teacher ends it): one machine event, so `status`,
 * `flowState`, `completedAt` and the adjustment land in one write.
 */
export async function completeSessionPlanEarly(
  planId: string,
  reason?: string
): Promise<SessionPlan> {
  const updated = await applyMachineEvent(planId, (plan) => ({
    type: 'SESSION_ENDED_EARLY',
    adjustment: {
      timestamp: new Date(),
      type: 'ended_early',
      reason,
      previousHealth: plan.sessionHealth || {
        overall: 'good',
        accuracy: 1,
        pacePercent: 100,
        currentStreak: 0,
        avgResponseTimeMs: 0,
      },
    },
  }))

  // Revoke any active share links
  try {
    await revokeSharesForSession(planId)
  } catch (shareError) {
    console.error(`[completeSessionPlanEarly] revokeSharesForSession FAILED:`, shareError)
  }

  return updated
}

/**
 * Abandon a session (user navigates away, closes browser, etc.): one machine
 * event, one write.
 */
export async function abandonSessionPlan(planId: string): Promise<SessionPlan> {
  const updated = await applyMachineEvent(planId, () => ({ type: 'SESSION_ABANDONED' }))

  // Revoke any active share links
  try {
    await revokeSharesForSession(planId)
  } catch (shareError) {
    console.error(`[abandonSessionPlan] revokeSharesForSession FAILED:`, shareError)
  }

  return updated
}

/** Worksheet approval: append its tries, complete the session (one write). */
export async function approveWorksheetTries(
  planId: string,
  triesOf: (plan: SessionPlan) => SlotResult[]
): Promise<SessionPlan> {
  return applyMachineEvent(planId, (plan) => ({
    type: 'WORKSHEET_APPROVED',
    tries: triesOf(plan),
  }))
}

/** Worksheet unapproval: void its tries (never remove them), status follows (one write). */
export async function unapproveWorksheetTries(
  planId: string,
  tryIdsOf: (plan: SessionPlan) => string[]
): Promise<SessionPlan> {
  return applyMachineEvent(planId, (plan) => ({
    type: 'WORKSHEET_UNAPPROVED',
    tryIds: tryIdsOf(plan),
  }))
}

export async function completePartTransition(planId: string): Promise<SessionPlan> {
  // The server decides whether a break runs (gameBreakSettings); see session-flow.ts
  return applySessionFlowEvent(planId, { type: 'PART_TRANSITION_COMPLETED' })
}

export async function finishGameBreak(
  planId: string,
  reason: 'timeout' | 'gameFinished' | 'skipped',
  results?: GameResultsReport | null
): Promise<SessionPlan> {
  return applySessionFlowEvent(planId, {
    type: 'BREAK_FINISHED',
    reason,
    results,
  })
}

export async function acknowledgeGameBreakResults(planId: string): Promise<SessionPlan> {
  return applySessionFlowEvent(planId, { type: 'BREAK_RESULTS_ACKED' })
}

/**
 * Update session plan results directly.
 * Used for teacher/parent edits (mark correct, exclude, etc.). Pass a function
 * of the row to have the edit re-applied to a newer row if another write
 * lands first (CAS on `rowVersion`; not a flow change).
 */
export async function updateSessionPlanResults(
  planId: string,
  results: SlotResult[] | ((plan: SessionPlan) => SlotResult[])
): Promise<SessionPlan> {
  return setPlanFields(planId, (plan) => {
    const nextResults = typeof results === 'function' ? results(plan) : results

    // Calculate elapsed time since session started. For a finished session being
    // edited (the review/repair path), measure against completedAt — using
    // Date.now() would report a nonsense (days-long) elapsed for an old session.
    const startedAt =
      plan.startedAt instanceof Date ? plan.startedAt : new Date(plan.startedAt ?? 0)
    const endAt =
      plan.completedAt instanceof Date
        ? plan.completedAt
        : plan.completedAt != null
          ? new Date(plan.completedAt)
          : new Date()
    const elapsedTimeMs = endAt.getTime() - startedAt.getTime()

    return {
      results: nextResults,
      sessionHealth: calculateSessionHealth({ ...plan, results: nextResults }, elapsedTimeMs),
    }
  })
}

/**
 * Update the remote camera session ID for a session plan.
 * Used when setting up phone camera for vision-based practice.
 */
export async function updateSessionPlanRemoteCamera(
  planId: string,
  remoteCameraSessionId: string | null
): Promise<SessionPlan> {
  return setPlanFields(planId, { remoteCameraSessionId })
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Identify weak skills from BKT estimates.
 *
 * A skill is considered "weak" when BKT confidently estimates a low P(known).
 * These skills should be prioritized in practice to help the student improve.
 *
 * @param bktResults - BKT results keyed by skillId
 * @returns Array of skillIds that are weak and should be prioritized
 */
function identifyWeakSkills(bktResults: Map<string, SkillBktResult> | undefined): string[] {
  if (!bktResults) return []

  const weakSkills: string[] = []
  const { confidenceThreshold, pKnownThreshold } = WEAK_SKILL_THRESHOLDS

  for (const [skillId, result] of bktResults) {
    // Weak = confident that P(known) is low
    if (result.confidence >= confidenceThreshold && result.pKnown < pKnownThreshold) {
      weakSkills.push(skillId)
    }
  }

  return weakSkills
}

/**
 * Get term count constraints based on part type, comfort level, and config overrides.
 *
 * Uses dynamic comfort-based scaling, with config overrides acting as ceiling.
 *
 * @param partType - The session part type
 * @param config - Plan generation config (contains parent/teacher overrides)
 * @param comfortLevel - Student comfort level (0-1)
 * @param comfortFactors - Individual factors that produced the comfort level
 * @returns The final range and an explanation for UI display
 */
function getTermCountForPartType(
  partType: SessionPartType,
  config: PlanGenerationConfig,
  comfortLevel: number,
  comfortFactors?: TermCountExplanation['factors'],
  comfortAdjustment?: number,
  rawComfortLevel?: number,
  termCountScalingConfig?: TermCountScalingConfig
): { range: { min: number; max: number }; explanation: TermCountExplanation } {
  const dynamicRange = computeTermCountRange(partType, comfortLevel, termCountScalingConfig)

  // Get config override for this part type (parent/teacher setting)
  const override =
    partType === 'abacus'
      ? config.abacusTermCount
      : partType === 'visualization'
        ? config.visualizationTermCount
        : config.linearTermCount

  const finalRange = applyTermCountOverride(dynamicRange, override)

  const factors = comfortFactors ?? {
    avgMastery: null,
    sessionMode: 'maintenance',
    modeMultiplier: 1.0,
    skillCountBonus: 0,
  }

  return {
    range: finalRange,
    explanation: {
      comfortLevel,
      factors,
      dynamicRange,
      override: override ?? null,
      finalRange,
      ...(comfortAdjustment !== undefined && comfortAdjustment !== 0
        ? { comfortAdjustment, rawComfortLevel }
        : {}),
    },
  }
}

/**
 * Get complexity bounds (min/max) for a specific purpose and part type.
 *
 * For visualization mode, the max budget is dynamically calculated to ensure
 * the student's current learning skills can appear. This prevents the static
 * max from blocking skills the student is supposed to be practicing.
 *
 * @param purpose - The slot purpose (focus, reinforce, review, challenge)
 * @param partType - The part type (abacus, visualization, linear)
 * @param config - Plan generation config with default bounds
 * @param studentMaxSkillCost - The max effective cost for any skill the student has
 *                              (includes mastery multiplier). Used to set dynamic
 *                              visualization budget.
 */
function getComplexityBoundsForSlot(
  purpose: ProblemSlot['purpose'],
  partType: SessionPartType,
  config: PlanGenerationConfig,
  studentMaxSkillCost?: number
): { min?: number; max?: number } {
  const purposeBounds = config.purposeComplexityBounds?.[purpose]
  if (!purposeBounds) {
    return {}
  }

  const partBounds = purposeBounds[partType]
  if (!partBounds) {
    return {}
  }

  let maxBudget = partBounds.max ?? undefined

  // For visualization mode with non-challenge purposes, use dynamic max budget
  // This ensures skills the student is learning can appear in visualization
  if (
    partType === 'visualization' &&
    purpose !== 'challenge' &&
    studentMaxSkillCost !== undefined
  ) {
    // Use the higher of: static config max, or student's max skill cost
    // This allows learning skills to surface while still respecting config if higher
    if (maxBudget === undefined || studentMaxSkillCost > maxBudget) {
      maxBudget = studentMaxSkillCost
    }
  }

  return {
    min: partBounds.min ?? undefined,
    max: maxBudget,
  }
}

function createSlot(
  index: number,
  purpose: ProblemSlot['purpose'],
  baseConstraints: ReturnType<typeof getPhaseSkillConstraints>,
  partType: SessionPartType,
  config: PlanGenerationConfig,
  costCalculator?: SkillCostCalculator,
  studentMaxSkillCost?: number,
  comfortLevel = 0.3,
  comfortFactors?: TermCountExplanation['factors'],
  comfortAdjustment?: number,
  rawComfortLevel?: number,
  termCountScalingConfig?: TermCountScalingConfig
): ProblemSlot {
  // Get complexity bounds for this purpose + part type combination
  // Pass studentMaxSkillCost for dynamic visualization budget
  const complexityBounds = getComplexityBoundsForSlot(
    purpose,
    partType,
    config,
    studentMaxSkillCost
  )

  // Get dynamic term count range based on comfort level
  const { range: termCount, explanation: termCountExplanation } = getTermCountForPartType(
    partType,
    config,
    comfortLevel,
    comfortFactors,
    comfortAdjustment,
    rawComfortLevel,
    termCountScalingConfig
  )

  const constraints = {
    allowedSkills: baseConstraints.allowedSkills,
    targetSkills: baseConstraints.targetSkills,
    forbiddenSkills: baseConstraints.forbiddenSkills,
    termCount,
    digitRange: { min: 1, max: 2 },
    // Add complexity budget constraints based on purpose
    ...(complexityBounds.min !== undefined && {
      minComplexityBudgetPerTerm: complexityBounds.min,
    }),
    ...(complexityBounds.max !== undefined && {
      maxComplexityBudgetPerTerm: complexityBounds.max,
    }),
  }

  // Problem is generated later in buildSessionPart after shuffling
  return {
    slotId: crypto.randomUUID(),
    index,
    purpose,
    constraints,
    problem: undefined,
    complexityBounds,
    termCountExplanation,
  }
}

function findSkillsNeedingReview(
  mastery: PlayerSkillMastery[],
  intervals: { mastered: number; practicing: number }
): PlayerSkillMastery[] {
  const now = Date.now()
  return mastery.filter((s) => {
    // Only consider skills that are being practiced
    if (!isActive(s.practiceLevel)) return false
    if (!s.lastPracticedAt) return false

    const daysSinceLastPractice =
      (now - new Date(s.lastPracticedAt).getTime()) / (1000 * 60 * 60 * 24)

    // Use the mastered interval for practicing skills (they're all "practicing" now)
    return daysSinceLastPractice > intervals.mastered
  })
}

/**
 * Build skill constraints from the student's actual mastered skills
 *
 * This creates constraints where:
 * - allowedSkills: all practicing skills (problems may ONLY use these skills)
 * - targetSkills: EMPTY (no targeting preference by default)
 * - forbiddenSkills: empty (don't exclude anything explicitly)
 *
 * IMPORTANT: targetSkills is empty by default, NOT all practicing skills.
 * This allows the differentiation between classic and adaptive modes:
 * - Classic: Uses these constraints directly → even skill distribution
 * - Adaptive: addWeakSkillsToTargets() adds only weak skills → focused practice
 */
function buildConstraintsFromPracticingSkills(
  practicingSkills: PlayerSkillMastery[]
): ReturnType<typeof getPhaseSkillConstraints> {
  const skills: Record<string, Record<string, boolean>> = {}

  for (const skill of practicingSkills) {
    // Parse skill ID format: "category.skillKey" like "fiveComplements.4=5-1" or "basic.+3"
    const [category, skillKey] = skill.skillId.split('.')

    if (category && skillKey) {
      if (!skills[category]) {
        skills[category] = {}
      }
      skills[category][skillKey] = true
    }
  }

  // allowedSkills: problems can ONLY use these skills (whitelist)
  // targetSkills: EMPTY by default - no targeting preference
  //
  // IMPORTANT: targetSkills MUST be empty here, not all skills!
  // When targetSkills = all skills, the problem generator accepts ANY problem
  // that uses allowed skills (since all allowed skills are also targets).
  // When targetSkills = empty, the problem generator generates an even
  // distribution across allowed skills.
  // When targetSkills = specific weak skills, the problem generator
  // ONLY accepts problems using those weak skills (100% hit rate).
  //
  // The differentiation between adaptive and classic modes happens because:
  // - Classic: Uses phaseConstraints (empty targetSkills) → even distribution
  // - Adaptive: addWeakSkillsToTargets() adds only weak skills → focused practice
  return {
    allowedSkills: skills,
    targetSkills: {}, // Empty by default - targeting added by addWeakSkillsToTargets()
    forbiddenSkills: {},
  } as ReturnType<typeof getPhaseSkillConstraints>
}

/**
 * Build constraints for targeting a specific skill.
 *
 * IMPORTANT: Uses the full baseConstraints.allowedSkills as the allowed skill set,
 * but sets only the target skill as targetSkills. This is critical because:
 *
 * - allowedSkills acts as a WHITELIST (problems can ONLY use these skills)
 * - Some skills have prerequisites (e.g., heavenBeadSubtraction needs heavenBead
 *   to first reach a state with ones digit >= 5)
 * - If we only allow the target skill, we can't use prerequisite skills to reach
 *   the state needed to use the target skill
 *
 * @param skill - The specific skill to target
 * @param baseConstraints - The student's full practicing skill constraints (used as whitelist)
 */
function buildConstraintsForSkill(
  skill: PlayerSkillMastery,
  baseConstraints: ReturnType<typeof getPhaseSkillConstraints>
): ReturnType<typeof getPhaseSkillConstraints> {
  // Parse skill ID to determine target
  // Format: "category.skillKey" like "fiveComplements.4=5-1"
  const [category, skillKey] = skill.skillId.split('.')

  const constraints = {
    // Use ALL practicing skills as the allowed set (whitelist)
    allowedSkills: baseConstraints.allowedSkills,
    // Target just the specific skill we want to reinforce/review
    targetSkills: {} as Record<string, Record<string, boolean>>,
    forbiddenSkills: baseConstraints.forbiddenSkills,
  }

  if (category && skillKey) {
    constraints.targetSkills[category] = { [skillKey]: true }
  }

  return constraints as ReturnType<typeof getPhaseSkillConstraints>
}

/**
 * Add weak skills to targetSkills in constraints.
 *
 * This modifies the constraints to ONLY target weak skills (identified by BKT),
 * replacing any existing targetSkills. The problem generator will specifically
 * prefer problems that exercise these weak skills, rather than spreading
 * attention across all allowed skills.
 *
 * IMPORTANT: We start with an EMPTY targetSkills, not a copy of existing ones.
 * This ensures weak skills get priority attention. If we copied all existing
 * targetSkills, weak skills would just be mixed in with everything else and
 * the problem generator wouldn't differentiate.
 *
 * @param baseConstraints - Base constraints with all practicing skills
 * @param weakSkillIds - Skill IDs identified as weak by BKT
 */
function addWeakSkillsToTargets(
  baseConstraints: ReturnType<typeof getPhaseSkillConstraints>,
  weakSkillIds: string[]
): ReturnType<typeof getPhaseSkillConstraints> {
  // Start with EMPTY targetSkills - we ONLY want to target weak skills
  // This makes the problem generator specifically prefer weak skill problems
  const targetSkills: Record<string, Record<string, boolean>> = {}

  // Add ONLY weak skills as targets
  for (const skillId of weakSkillIds) {
    const [category, skillKey] = skillId.split('.')
    if (category && skillKey) {
      if (!targetSkills[category]) {
        targetSkills[category] = {}
      }
      targetSkills[category][skillKey] = true
    }
  }

  return {
    allowedSkills: baseConstraints.allowedSkills,
    targetSkills,
    forbiddenSkills: baseConstraints.forbiddenSkills,
  } as ReturnType<typeof getPhaseSkillConstraints>
}

/**
 * Shuffle slots while keeping some focus problems clustered
 * This prevents too much context switching while still providing variety
 */
function intelligentShuffle(slots: ProblemSlot[]): ProblemSlot[] {
  // Group slots by purpose
  const focus = slots.filter((s) => s.purpose === 'focus')
  const reinforce = slots.filter((s) => s.purpose === 'reinforce')
  const review = slots.filter((s) => s.purpose === 'review')
  const challenge = slots.filter((s) => s.purpose === 'challenge')

  // Shuffle within each group
  const shuffledFocus = shuffleArray(focus)
  const shuffledReinforce = shuffleArray(reinforce)
  const shuffledReview = shuffleArray(review)
  const shuffledChallenge = shuffleArray(challenge)

  // Interleave: start with focus, mix in others throughout
  const result: ProblemSlot[] = []

  // Strategy: 3 focus, then 1 other, repeat
  let focusIdx = 0
  let reinforceIdx = 0
  let reviewIdx = 0
  let challengeIdx = 0

  while (
    focusIdx < shuffledFocus.length ||
    reinforceIdx < shuffledReinforce.length ||
    reviewIdx < shuffledReview.length ||
    challengeIdx < shuffledChallenge.length
  ) {
    // Add up to 3 focus problems
    for (let i = 0; i < 3 && focusIdx < shuffledFocus.length; i++) {
      result.push(shuffledFocus[focusIdx++])
    }

    // Add one from each other category
    if (reinforceIdx < shuffledReinforce.length) {
      result.push(shuffledReinforce[reinforceIdx++])
    }
    if (reviewIdx < shuffledReview.length) {
      result.push(shuffledReview[reviewIdx++])
    }
    if (challengeIdx < shuffledChallenge.length) {
      result.push(shuffledChallenge[challengeIdx++])
    }
  }

  // Re-index
  return result.map((slot, i) => ({ ...slot, index: i }))
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Get user-friendly description for a session part type
 */
function getPartDescription(type: SessionPartType): string {
  switch (type) {
    case 'abacus':
      return 'Use Abacus'
    case 'visualization':
      return 'Mental Math (Visualization)'
    case 'linear':
      return 'Linear Math'
  }
}

function buildSummary(
  parts: SessionPart[],
  phase: CurriculumPhase | undefined,
  durationMinutes: number,
  skippedParts: SkippedPart[] = []
): SessionSummary {
  const phaseInfo = phase ? getPhaseDisplayInfo(phase.id) : null

  const partSummaries: PartSummary[] = parts.map((part) => ({
    partNumber: part.partNumber,
    type: part.type,
    description: getPartDescription(part.type),
    problemCount: part.slots.length,
    estimatedMinutes: part.estimatedMinutes,
  }))

  const totalProblemCount = parts.reduce((sum, part) => sum + part.slots.length, 0)

  return {
    focusDescription: phaseInfo?.phaseName || 'General practice',
    totalProblemCount,
    estimatedMinutes: durationMinutes,
    parts: partSummaries,
    ...(skippedParts.length > 0 ? { skippedParts } : {}),
  }
}
