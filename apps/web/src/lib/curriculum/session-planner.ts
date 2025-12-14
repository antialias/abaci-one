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
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { PlayerSkillMastery } from '@/db/schema/player-skill-mastery'
import {
  calculateSessionHealth,
  DEFAULT_PLAN_CONFIG,
  type NewSessionPlan,
  type PartSummary,
  type PlanGenerationConfig,
  type ProblemSlot,
  type SessionHealth,
  type SessionPart,
  type SessionPartType,
  type SessionPlan,
  type SessionSummary,
  type SlotResult,
} from '@/db/schema/session-plans'
import {
  type CurriculumPhase,
  getPhase,
  getPhaseDisplayInfo,
  type getPhaseSkillConstraints,
} from './definitions'
import { generateProblemFromConstraints } from './problem-generator'
import {
  getAllSkillMastery,
  getPlayerCurriculum,
  getRecentSessions,
  recordSkillAttemptsWithHelp,
} from './progress-manager'
import {
  buildStudentSkillHistoryFromRecords,
  calculateMaxSkillCost,
  createSkillCostCalculator,
  type SkillCostCalculator,
} from '@/utils/skillComplexity'
import { CHALLENGE_RATIO_BY_PART_TYPE } from './config'

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
  /** Which parts to include (default: all enabled) */
  enabledParts?: EnabledParts
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
 * Generate a three-part session plan for a student
 *
 * @throws {ActiveSessionExistsError} If the player already has an active session that hasn't timed out
 * @throws {NoSkillsEnabledError} If the player has no skills enabled for practice
 */
export async function generateSessionPlan(
  options: GenerateSessionPlanOptions
): Promise<SessionPlan> {
  const { playerId, durationMinutes, config: configOverrides, enabledParts } = options

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

  // 1. Load student state
  const curriculum = await getPlayerCurriculum(playerId)
  const skillMastery = await getAllSkillMastery(playerId)
  const recentSessions = await getRecentSessions(playerId, 10)

  // Build student-aware cost calculator for complexity budgeting
  const studentHistory = buildStudentSkillHistoryFromRecords(skillMastery)
  const costCalculator = createSkillCostCalculator(studentHistory)

  // Calculate max skill cost for dynamic visualization budget
  // This ensures the student's most expensive skill can appear in visualization
  const practicingSkillIds = skillMastery.filter((s) => s.isPracticing).map((s) => s.skillId)
  const studentMaxSkillCost = calculateMaxSkillCost(costCalculator, practicingSkillIds)

  // Get current phase
  const currentPhaseId = curriculum?.currentPhaseId || 'L1.add.+1.direct'
  const currentPhase = getPhase(currentPhaseId)

  // 2. Calculate personalized timing
  const avgTimeSeconds =
    calculateAvgTimePerProblem(recentSessions) || config.defaultSecondsPerProblem

  // 3. Build skill constraints from the student's ACTUAL practicing skills
  const practicingSkills = skillMastery.filter((s) => s.isPracticing)

  // Cannot generate a session without any skills enabled
  if (practicingSkills.length === 0) {
    throw new NoSkillsEnabledError()
  }

  const practicingSkillConstraints = buildConstraintsFromPracticingSkills(practicingSkills)

  // Categorize skills for review/reinforcement purposes
  const struggling = findStrugglingSkills(skillMastery)
  const needsReview = findSkillsNeedingReview(skillMastery, config.reviewIntervalDays)

  // 4. Build parts using STUDENT'S MASTERED SKILLS (only enabled parts)
  // Normalize part time weights based on which parts are enabled
  const enabledPartTypes = (['abacus', 'visualization', 'linear'] as const).filter(
    (type) => partsToInclude[type]
  )
  const totalEnabledWeight = enabledPartTypes.reduce(
    (sum, type) => sum + config.partTimeWeights[type],
    0
  )

  // Build only enabled parts with normalized time weights
  const parts: SessionPart[] = []
  let partNumber = 1 as 1 | 2 | 3

  for (const partType of enabledPartTypes) {
    const normalizedWeight = config.partTimeWeights[partType] / totalEnabledWeight
    parts.push(
      buildSessionPart(
        partNumber,
        partType,
        durationMinutes,
        avgTimeSeconds,
        { ...config, partTimeWeights: { ...config.partTimeWeights, [partType]: normalizedWeight } },
        practicingSkillConstraints,
        struggling,
        needsReview,
        currentPhase,
        normalizedWeight,
        costCalculator,
        studentMaxSkillCost
      )
    )
    partNumber = (partNumber + 1) as 1 | 2 | 3
  }

  // 5. Build summary
  const summary = buildSummary(parts, currentPhase, durationMinutes)

  // 6. Calculate total problems
  const totalProblemCount = parts.reduce((sum, part) => sum + part.slots.length, 0)

  // 7. Create and save the plan
  const plan: NewSessionPlan = {
    id: createId(),
    playerId,
    targetDurationMinutes: durationMinutes,
    estimatedProblemCount: totalProblemCount,
    avgTimePerProblemSeconds: avgTimeSeconds,
    parts,
    summary,
    masteredSkillIds: practicingSkills.map((s) => s.skillId),
    status: 'draft',
    currentPartIndex: 0,
    currentSlotIndex: 0,
    sessionHealth: null,
    adjustments: [],
    results: [],
    createdAt: new Date(),
  }

  const [savedPlan] = await db.insert(schema.sessionPlans).values(plan).returning()
  return savedPlan
}

/**
 * Build a single session part with the appropriate slots
 */
function buildSessionPart(
  partNumber: 1 | 2 | 3,
  type: SessionPartType,
  totalDurationMinutes: number,
  avgTimeSeconds: number,
  config: PlanGenerationConfig,
  phaseConstraints: ReturnType<typeof getPhaseSkillConstraints>,
  struggling: PlayerSkillMastery[],
  needsReview: PlayerSkillMastery[],
  currentPhase: CurriculumPhase | undefined,
  normalizedWeight?: number,
  costCalculator?: SkillCostCalculator,
  studentMaxSkillCost?: number
): SessionPart {
  // Get time allocation for this part (use normalized weight if provided)
  const partWeight = normalizedWeight ?? config.partTimeWeights[type]
  const partDurationMinutes = totalDurationMinutes * partWeight
  const partProblemCount = Math.max(2, Math.floor((partDurationMinutes * 60) / avgTimeSeconds))

  // Calculate slot distribution with part-type-specific challenge ratios
  // (See config/slot-distribution.ts for rationale)
  //
  // IMPORTANT: Challenge slots require min complexity budget of 1.
  // Basic skills have cost 0, so students with ONLY basic skills can't generate challenge problems.
  // Skip challenge slots for these students and give them more focus/reinforce/review instead.
  const challengeMinBudget = config.purposeComplexityBounds.challenge[type].min ?? 0
  const canDoChallenge =
    studentMaxSkillCost !== undefined && studentMaxSkillCost >= challengeMinBudget

  const challengeRatio = canDoChallenge ? CHALLENGE_RATIO_BY_PART_TYPE[type] : 0
  const minChallengeCount = canDoChallenge
    ? Math.max(1, Math.round(partProblemCount * challengeRatio))
    : 0
  const availableForOthers = partProblemCount - minChallengeCount

  const focusCount = Math.round(availableForOthers * config.focusWeight)
  const reinforceCount = Math.round(availableForOthers * config.reinforceWeight)
  const reviewCount = Math.round(availableForOthers * config.reviewWeight)
  // Challenge gets the remainder, but at least minChallengeCount (or 0 if can't do challenge)
  const challengeCount = canDoChallenge
    ? Math.max(minChallengeCount, partProblemCount - focusCount - reinforceCount - reviewCount)
    : 0
  // If no challenge, distribute remainder to focus
  const adjustedFocusCount =
    focusCount + (canDoChallenge ? 0 : partProblemCount - focusCount - reinforceCount - reviewCount)

  // Build slots
  const slots: ProblemSlot[] = []

  // Focus slots: current phase, primary skill
  // Uses adjustedFocusCount which includes redistributed challenge slots for basic-skill-only students
  for (let i = 0; i < adjustedFocusCount; i++) {
    slots.push(
      createSlot(
        slots.length,
        'focus',
        phaseConstraints,
        type,
        config,
        costCalculator,
        studentMaxSkillCost
      )
    )
  }

  // Reinforce slots: struggling skills get extra practice
  for (let i = 0; i < reinforceCount; i++) {
    const skill = struggling[i % Math.max(1, struggling.length)]
    slots.push(
      createSlot(
        slots.length,
        'reinforce',
        skill ? buildConstraintsForSkill(skill) : phaseConstraints,
        type,
        config,
        costCalculator,
        studentMaxSkillCost
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
        skill ? buildConstraintsForSkill(skill) : phaseConstraints,
        type,
        config,
        costCalculator,
        studentMaxSkillCost
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
        studentMaxSkillCost
      )
    )
  }

  // Shuffle to interleave purposes
  const shuffledSlots = intelligentShuffle(slots)

  // Generate problems for each slot (persisted in DB for resume capability)
  const slotsWithProblems = shuffledSlots.map((slot) => ({
    ...slot,
    problem: generateProblemFromConstraints(slot.constraints, costCalculator),
  }))

  return {
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
 * Check if a session plan has pre-generated problems for all slots
 * Old sessions created before problem pre-generation was added will fail this check
 */
function sessionHasPreGeneratedProblems(plan: SessionPlan): boolean {
  for (const part of plan.parts) {
    for (const slot of part.slots) {
      if (!slot.problem) {
        return false
      }
    }
  }
  return true
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

  // Validate session has pre-generated problems
  // Old sessions may not have them - auto-abandon those
  if (!sessionHasPreGeneratedProblems(result)) {
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
 * Result from a problem with session context for traceability
 */
export interface ProblemResultWithContext extends SlotResult {
  /** Session ID this result came from */
  sessionId: string
  /** When the session was completed */
  sessionCompletedAt: Date
  /** Part type (abacus/visualization/linear) */
  partType: SessionPartType
}

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
  const sessions = await db.query.sessionPlans.findMany({
    where: and(
      eq(schema.sessionPlans.playerId, playerId),
      eq(schema.sessionPlans.status, 'completed')
    ),
    orderBy: (plans, { desc }) => [desc(plans.completedAt)],
    limit: sessionCount,
  })

  // Flatten results with session context
  const results: ProblemResultWithContext[] = []

  for (const session of sessions) {
    if (!session.completedAt) continue

    for (const result of session.results) {
      // Find the part type for this result
      const part = session.parts.find((p) => p.partNumber === result.partNumber)
      const partType = part?.type ?? 'linear'

      results.push({
        ...result,
        sessionId: session.id,
        sessionCompletedAt: session.completedAt,
        partType,
      })
    }
  }

  // Sort by timestamp descending (most recent first)
  results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return results
}

/**
 * Approve a plan (teacher says "Let's Go!")
 */
export async function approveSessionPlan(planId: string): Promise<SessionPlan> {
  const now = new Date()
  const [updated] = await db
    .update(schema.sessionPlans)
    .set({
      status: 'approved',
      approvedAt: now,
    })
    .where(eq(schema.sessionPlans.id, planId))
    .returning()
  return updated
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

  const [updated] = await db
    .update(schema.sessionPlans)
    .set({
      status: 'in_progress',
      startedAt: now,
      sessionHealth: initialHealth,
    })
    .where(eq(schema.sessionPlans.id, planId))
    .returning()
  return updated
}

/**
 * Record a result for a slot and advance to next
 */
export async function recordSlotResult(
  planId: string,
  result: Omit<SlotResult, 'timestamp' | 'partNumber'>
): Promise<SessionPlan> {
  let plan: SessionPlan | null
  try {
    plan = await getSessionPlan(planId)
  } catch (error) {
    console.error(`[recordSlotResult] Failed to get plan ${planId}:`, error)
    throw new Error(
      `Failed to retrieve plan ${planId}: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (!plan) throw new Error(`Plan not found: ${planId}`)

  // Defensive check: ensure parts array exists and is valid
  if (!plan.parts || !Array.isArray(plan.parts)) {
    throw new Error(
      `Plan ${planId} has invalid parts: ${typeof plan.parts} (status: ${plan.status}, partIndex: ${plan.currentPartIndex})`
    )
  }

  if (plan.parts.length === 0) {
    throw new Error(`Plan ${planId} has empty parts array`)
  }

  if (plan.currentPartIndex < 0 || plan.currentPartIndex >= plan.parts.length) {
    throw new Error(
      `Plan ${planId} has invalid currentPartIndex: ${plan.currentPartIndex} (parts.length: ${plan.parts.length})`
    )
  }

  const currentPart = plan.parts[plan.currentPartIndex]
  if (!currentPart) throw new Error(`Invalid part index: ${plan.currentPartIndex}`)

  // Defensive check: ensure slots array exists
  if (!currentPart.slots || !Array.isArray(currentPart.slots)) {
    throw new Error(
      `Plan ${planId} part ${plan.currentPartIndex} has invalid slots: ${typeof currentPart.slots}`
    )
  }

  // Defensive check: ensure results array exists
  if (!plan.results || !Array.isArray(plan.results)) {
    throw new Error(`Plan ${planId} has invalid results: ${typeof plan.results} (expected array)`)
  }

  const newResult: SlotResult = {
    ...result,
    partNumber: currentPart.partNumber,
    timestamp: new Date(),
  }

  const updatedResults = [...plan.results, newResult]

  // Advance to next slot, possibly moving to next part
  let nextPartIndex = plan.currentPartIndex
  let nextSlotIndex = plan.currentSlotIndex + 1

  // Check if we've finished the current part
  if (nextSlotIndex >= currentPart.slots.length) {
    nextPartIndex += 1
    nextSlotIndex = 0
  }

  // Check if the entire session is complete
  const isComplete = nextPartIndex >= plan.parts.length

  // Calculate elapsed time since start
  const elapsedMs = plan.startedAt ? Date.now() - plan.startedAt.getTime() : 0
  const updatedHealth = calculateSessionHealth({ ...plan, results: updatedResults }, elapsedMs)

  let dbResult
  try {
    dbResult = await db
      .update(schema.sessionPlans)
      .set({
        results: updatedResults,
        currentPartIndex: nextPartIndex,
        currentSlotIndex: nextSlotIndex,
        sessionHealth: updatedHealth,
        status: isComplete ? 'completed' : 'in_progress',
        completedAt: isComplete ? new Date() : null,
      })
      .where(eq(schema.sessionPlans.id, planId))
      .returning()
  } catch (dbError) {
    console.error(`[recordSlotResult] Drizzle update FAILED:`, dbError)
    throw dbError
  }

  const [updated] = dbResult

  // Defensive check: ensure update succeeded
  if (!updated) {
    throw new Error(
      `Failed to update plan ${planId}: no rows returned (may have been deleted during update)`
    )
  }

  // Update global skill mastery with response time data
  // This builds the per-kid stats for identifying strengths/weaknesses
  if (result.skillsExercised && result.skillsExercised.length > 0) {
    const skillResults = result.skillsExercised.map((skillId) => ({
      skillId,
      isCorrect: result.isCorrect,
    }))
    try {
      await recordSkillAttemptsWithHelp(
        plan.playerId,
        skillResults,
        result.helpLevelUsed,
        result.responseTimeMs
      )
    } catch (skillError) {
      console.error(`[recordSlotResult] recordSkillAttemptsWithHelp FAILED:`, skillError)
      throw skillError
    }
  }

  return updated
}

/**
 * Complete a session early (teacher ends it)
 */
export async function completeSessionPlanEarly(
  planId: string,
  reason?: string
): Promise<SessionPlan> {
  const plan = await getSessionPlan(planId)
  if (!plan) throw new Error(`Plan not found: ${planId}`)

  const adjustment = {
    timestamp: new Date(),
    type: 'ended_early' as const,
    reason,
    previousHealth: plan.sessionHealth || {
      overall: 'good' as const,
      accuracy: 1,
      pacePercent: 100,
      currentStreak: 0,
      avgResponseTimeMs: 0,
    },
  }

  const [updated] = await db
    .update(schema.sessionPlans)
    .set({
      status: 'completed',
      completedAt: new Date(),
      adjustments: [...plan.adjustments, adjustment],
    })
    .where(eq(schema.sessionPlans.id, planId))
    .returning()

  return updated
}

/**
 * Abandon a session (user navigates away, closes browser, etc.)
 */
export async function abandonSessionPlan(planId: string): Promise<SessionPlan> {
  const [updated] = await db
    .update(schema.sessionPlans)
    .set({
      status: 'abandoned',
      completedAt: new Date(),
    })
    .where(eq(schema.sessionPlans.id, planId))
    .returning()
  return updated
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get term count constraints based on part type and config
 *
 * - abacus: Uses config.abacusTermCount
 * - visualization: Uses config.visualizationTermCount, or 75% of abacus if null
 * - linear: Uses config.linearTermCount, or same as abacus if null
 */
function getTermCountForPartType(
  partType: SessionPartType,
  config: PlanGenerationConfig
): { min: number; max: number } {
  const abacusTerms = config.abacusTermCount

  if (partType === 'abacus') {
    return abacusTerms
  }

  if (partType === 'visualization') {
    // Use explicit config if set, otherwise 75% of abacus
    if (config.visualizationTermCount) {
      return config.visualizationTermCount
    }
    return {
      min: Math.max(2, Math.round(abacusTerms.min * 0.75)),
      max: Math.max(2, Math.round(abacusTerms.max * 0.75)),
    }
  }

  // linear: use explicit config if set, otherwise same as abacus
  if (config.linearTermCount) {
    return config.linearTermCount
  }
  return abacusTerms
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
  studentMaxSkillCost?: number
): ProblemSlot {
  // Get complexity bounds for this purpose + part type combination
  // Pass studentMaxSkillCost for dynamic visualization budget
  const complexityBounds = getComplexityBoundsForSlot(
    purpose,
    partType,
    config,
    studentMaxSkillCost
  )

  const constraints = {
    requiredSkills: baseConstraints.requiredSkills,
    targetSkills: baseConstraints.targetSkills,
    forbiddenSkills: baseConstraints.forbiddenSkills,
    termCount: getTermCountForPartType(partType, config),
    digitRange: { min: 1, max: 2 },
    // Add complexity budget constraints based on purpose
    ...(complexityBounds.min !== undefined && { minComplexityBudgetPerTerm: complexityBounds.min }),
    ...(complexityBounds.max !== undefined && { maxComplexityBudgetPerTerm: complexityBounds.max }),
  }

  // Pre-generate the problem so it's persisted with the plan
  // This ensures page reloads show the same problem
  const problem = generateProblemFromConstraints(constraints, costCalculator)

  return {
    index,
    purpose,
    constraints,
    problem,
    complexityBounds,
  }
}

function calculateAvgTimePerProblem(
  sessions: Array<{ averageTimeMs: number | null; problemsAttempted: number }>
): number | null {
  const validSessions = sessions.filter((s) => s.averageTimeMs !== null && s.problemsAttempted > 0)
  if (validSessions.length === 0) return null

  const totalProblems = validSessions.reduce((sum, s) => sum + s.problemsAttempted, 0)
  const weightedSum = validSessions.reduce(
    (sum, s) => sum + s.averageTimeMs! * s.problemsAttempted,
    0
  )

  return Math.round(weightedSum / totalProblems / 1000) // Convert ms to seconds
}

function findStrugglingSkills(mastery: PlayerSkillMastery[]): PlayerSkillMastery[] {
  return mastery.filter((s) => {
    if (s.attempts < 5) return false // Not enough data
    const accuracy = s.correct / s.attempts
    return accuracy < 0.7 // Less than 70% accuracy
  })
}

function findSkillsNeedingReview(
  mastery: PlayerSkillMastery[],
  intervals: { mastered: number; practicing: number }
): PlayerSkillMastery[] {
  const now = Date.now()
  return mastery.filter((s) => {
    // Only consider skills that are being practiced
    if (!s.isPracticing) return false
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
 * - requiredSkills: all practicing skills (problems may ONLY use these skills)
 * - targetSkills: all practicing skills (prefer to use these skills)
 * - forbiddenSkills: empty (don't exclude anything explicitly)
 *
 * The problem generator filters candidates to only allow requiredSkills,
 * then preferentially selects candidates that use targetSkills.
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

  // Both required and target use the same skills:
  // - requiredSkills: only these skills may be used (acts as filter)
  // - targetSkills: prefer to use these skills (acts as preference)
  return {
    requiredSkills: skills,
    targetSkills: skills,
    forbiddenSkills: {},
  } as ReturnType<typeof getPhaseSkillConstraints>
}

function buildConstraintsForSkill(
  skill: PlayerSkillMastery
): ReturnType<typeof getPhaseSkillConstraints> {
  // Parse skill ID to determine constraints
  // Format: "category.skillKey" like "fiveComplements.4=5-1"
  const [category, skillKey] = skill.skillId.split('.')

  const constraints = {
    requiredSkills: {} as Record<string, Record<string, boolean>>,
    targetSkills: {} as Record<string, Record<string, boolean>>,
    forbiddenSkills: {} as Record<string, Record<string, boolean>>,
  }

  if (category && skillKey) {
    constraints.targetSkills[category] = { [skillKey]: true }
    constraints.requiredSkills[category] = { [skillKey]: true }
  }

  return constraints as ReturnType<typeof getPhaseSkillConstraints>
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
      return 'Mental Math (Linear)'
  }
}

function buildSummary(
  parts: SessionPart[],
  phase: CurriculumPhase | undefined,
  durationMinutes: number
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
  }
}
