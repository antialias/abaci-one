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
import { and, eq, inArray } from 'drizzle-orm'
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
  getPhaseSkillConstraints,
} from './definitions'
import { generateProblemFromConstraints } from './problem-generator'
import { getAllSkillMastery, getPlayerCurriculum, getRecentSessions } from './progress-manager'

// ============================================================================
// Plan Generation
// ============================================================================

export interface GenerateSessionPlanOptions {
  playerId: string
  durationMinutes: number
  config?: Partial<PlanGenerationConfig>
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
 * Generate a three-part session plan for a student
 *
 * @throws {ActiveSessionExistsError} If the player already has an active session that hasn't timed out
 */
export async function generateSessionPlan(
  options: GenerateSessionPlanOptions
): Promise<SessionPlan> {
  const { playerId, durationMinutes, config: configOverrides } = options

  const config = { ...DEFAULT_PLAN_CONFIG, ...configOverrides }

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

  // Get current phase
  const currentPhaseId = curriculum?.currentPhaseId || 'L1.add.+1.direct'
  const currentPhase = getPhase(currentPhaseId)

  // 2. Calculate personalized timing
  const avgTimeSeconds =
    calculateAvgTimePerProblem(recentSessions) || config.defaultSecondsPerProblem

  // 3. Categorize skills by need
  const phaseConstraints = getPhaseSkillConstraints(currentPhaseId)
  const struggling = findStrugglingSkills(skillMastery, phaseConstraints)
  const needsReview = findSkillsNeedingReview(skillMastery, config.reviewIntervalDays)

  // 4. Build three parts
  const parts: SessionPart[] = [
    buildSessionPart(
      1,
      'abacus',
      durationMinutes,
      avgTimeSeconds,
      config,
      phaseConstraints,
      struggling,
      needsReview,
      currentPhase
    ),
    buildSessionPart(
      2,
      'visualization',
      durationMinutes,
      avgTimeSeconds,
      config,
      phaseConstraints,
      struggling,
      needsReview,
      currentPhase
    ),
    buildSessionPart(
      3,
      'linear',
      durationMinutes,
      avgTimeSeconds,
      config,
      phaseConstraints,
      struggling,
      needsReview,
      currentPhase
    ),
  ]

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
  currentPhase: CurriculumPhase | undefined
): SessionPart {
  // Get time allocation for this part
  const partWeight = config.partTimeWeights[type]
  const partDurationMinutes = totalDurationMinutes * partWeight
  const partProblemCount = Math.max(2, Math.floor((partDurationMinutes * 60) / avgTimeSeconds))

  // Calculate slot distribution
  const focusCount = Math.round(partProblemCount * config.focusWeight)
  const reinforceCount = Math.round(partProblemCount * config.reinforceWeight)
  const reviewCount = Math.round(partProblemCount * config.reviewWeight)
  const challengeCount = Math.max(0, partProblemCount - focusCount - reinforceCount - reviewCount)

  // Build slots
  const slots: ProblemSlot[] = []

  // Focus slots: current phase, primary skill
  for (let i = 0; i < focusCount; i++) {
    slots.push(createSlot(slots.length, 'focus', phaseConstraints))
  }

  // Reinforce slots: struggling skills get extra practice
  for (let i = 0; i < reinforceCount; i++) {
    const skill = struggling[i % Math.max(1, struggling.length)]
    slots.push(
      createSlot(
        slots.length,
        'reinforce',
        skill ? buildConstraintsForSkill(skill) : phaseConstraints
      )
    )
  }

  // Review slots: spaced repetition of mastered skills
  for (let i = 0; i < reviewCount; i++) {
    const skill = needsReview[i % Math.max(1, needsReview.length)]
    slots.push(
      createSlot(slots.length, 'review', skill ? buildConstraintsForSkill(skill) : phaseConstraints)
    )
  }

  // Challenge slots: slightly harder or mixed
  for (let i = 0; i < challengeCount; i++) {
    slots.push(createSlot(slots.length, 'challenge', buildChallengeConstraints(currentPhase)))
  }

  // Shuffle to interleave purposes
  const shuffledSlots = intelligentShuffle(slots)

  // Generate problems for each slot (persisted in DB for resume capability)
  const slotsWithProblems = shuffledSlots.map((slot) => ({
    ...slot,
    problem: generateProblemFromConstraints(slot.constraints),
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
  const result = await db.query.sessionPlans.findFirst({
    where: and(
      eq(schema.sessionPlans.playerId, playerId),
      inArray(schema.sessionPlans.status, ['draft', 'approved', 'in_progress'])
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
  const plan = await getSessionPlan(planId)
  if (!plan) throw new Error(`Plan not found: ${planId}`)

  const currentPart = plan.parts[plan.currentPartIndex]
  if (!currentPart) throw new Error(`Invalid part index: ${plan.currentPartIndex}`)

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

  const [updated] = await db
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

function createSlot(
  index: number,
  purpose: ProblemSlot['purpose'],
  baseConstraints: ReturnType<typeof getPhaseSkillConstraints>
): ProblemSlot {
  const constraints = {
    requiredSkills: baseConstraints.requiredSkills,
    targetSkills: baseConstraints.targetSkills,
    forbiddenSkills: baseConstraints.forbiddenSkills,
    termCount: { min: 3, max: 6 },
    digitRange: { min: 1, max: 2 },
  }

  // Pre-generate the problem so it's persisted with the plan
  // This ensures page reloads show the same problem
  const problem = generateProblemFromConstraints(constraints)

  return {
    index,
    purpose,
    constraints,
    problem,
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

function findStrugglingSkills(
  mastery: PlayerSkillMastery[],
  _phaseConstraints: ReturnType<typeof getPhaseSkillConstraints>
): PlayerSkillMastery[] {
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
    if (!s.lastPracticedAt) return false

    const daysSinceLastPractice =
      (now - new Date(s.lastPracticedAt).getTime()) / (1000 * 60 * 60 * 24)

    if (s.masteryLevel === 'mastered') {
      return daysSinceLastPractice > intervals.mastered
    }
    if (s.masteryLevel === 'practicing') {
      return daysSinceLastPractice > intervals.practicing
    }
    return false
  })
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

function buildChallengeConstraints(
  phase: CurriculumPhase | undefined
): ReturnType<typeof getPhaseSkillConstraints> {
  if (!phase) {
    return {
      requiredSkills: {},
      targetSkills: {},
      forbiddenSkills: {},
    } as ReturnType<typeof getPhaseSkillConstraints>
  }

  // For challenge, we use the same phase but with potentially harder settings
  const constraints = getPhaseSkillConstraints(phase.id)
  return constraints
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
