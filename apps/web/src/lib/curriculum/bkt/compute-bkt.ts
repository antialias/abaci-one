/**
 * Main BKT Computation Function
 *
 * This is the entry point for computing BKT state from problem history.
 * It replays all SlotResults in chronological order to build up
 * the current P(known) estimate for each skill.
 */

import { BKT_THRESHOLDS } from '../config/bkt-integration'
import type { ProblemResultWithContext } from '../session-planner'
import { calculateConfidence, getUncertaintyRange } from './confidence'
import { type BlameMethod, updateOnCorrect, updateOnIncorrectWithMethod } from './conjunctive-bkt'
import { helpLevelWeight, responseTimeWeight } from './evidence-quality'
import { getDefaultParams } from './skill-priors'
import type {
  BktComputeOptions,
  BktComputeResult,
  BktSkillState,
  MasteryClassification,
  SkillBktResult,
} from './types'

/** Extended options including blame method (not part of base BktComputeOptions to avoid breaking changes) */
export interface BktComputeExtendedOptions extends BktComputeOptions {
  /** Which blame attribution method to use for incorrect multi-skill problems */
  blameMethod?: BlameMethod
}

/**
 * Default computation options.
 */
export const DEFAULT_BKT_OPTIONS: BktComputeExtendedOptions = {
  confidenceThreshold: 0.5,
  useCrossStudentPriors: false,
  applyDecay: false,
  decayHalfLifeDays: 30,
  blameMethod: 'heuristic',
}

/**
 * Apply time-based decay to P(known).
 * Uses exponential decay toward the prior (pInit).
 *
 * @param pKnown - Current P(known) estimate
 * @param daysSinceLastPractice - Days since the skill was practiced
 * @param halfLifeDays - Half-life of decay in days
 * @param pInit - Prior probability to decay toward
 * @returns Decayed P(known)
 */
function applyTimeDecay(
  pKnown: number,
  daysSinceLastPractice: number,
  halfLifeDays: number,
  pInit: number
): number {
  if (daysSinceLastPractice <= 0) return pKnown

  // Exponential decay: after halfLifeDays, the "learned" portion decays by 50%
  // pKnown decays toward pInit (prior), not toward 0
  const decayFactor = 0.5 ** (daysSinceLastPractice / halfLifeDays)
  const learnedPortion = pKnown - pInit
  return pInit + learnedPortion * decayFactor
}

/**
 * Compute BKT state for all skills from problem history.
 *
 * This is the main entry point - call it when displaying the Skills Dashboard.
 * It replays all SlotResults in chronological order to compute the current
 * P(known) estimate for each skill encountered.
 *
 * @param results - Problem results from session history
 * @param options - Computation options (confidence threshold, blame method, etc.)
 * @returns BKT results for all skills, sorted by need for intervention
 */
export function computeBktFromHistory(
  results: ProblemResultWithContext[],
  options: Partial<BktComputeExtendedOptions> = {}
): BktComputeResult {
  // Merge with defaults so callers can override just what they need
  const opts: BktComputeExtendedOptions = { ...DEFAULT_BKT_OPTIONS, ...options }
  // Sort by timestamp to replay in chronological order
  // Note: timestamp may be a Date or a string (from JSON serialization)
  const sorted = [...results].sort((a, b) => {
    const timeA =
      a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime()
    const timeB =
      b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime()
    return timeA - timeB
  })

  // Track state for each skill
  const skillStates = new Map<string, BktSkillState>()

  // Process each problem result
  for (const result of sorted) {
    // Extract skill IDs from the result (skillsExercised tracks what was actually used)
    const skillIds = result.skillsExercised ?? []
    if (skillIds.length === 0) continue

    // Ensure all skills have state initialized
    for (const skillId of skillIds) {
      if (!skillStates.has(skillId)) {
        const params = getDefaultParams(skillId)
        skillStates.set(skillId, {
          pKnown: params.pInit,
          opportunities: 0,
          successCount: 0,
          lastPracticedAt: null,
          params,
        })
      }
    }

    // Build skill records for BKT update
    const skillRecords = skillIds.map((skillId: string) => {
      const state = skillStates.get(skillId)!
      return {
        skillId,
        pKnown: state.pKnown,
        params: state.params,
      }
    })

    // Calculate evidence weight based on help level and response time
    const helpWeight = helpLevelWeight(result.helpLevelUsed)
    const rtWeight = responseTimeWeight(result.responseTimeMs, result.isCorrect)
    const evidenceWeight = helpWeight * rtWeight

    // Compute BKT updates (conjunctive model)
    const blameMethod = opts.blameMethod ?? 'heuristic'
    const updates = result.isCorrect
      ? updateOnCorrect(skillRecords)
      : updateOnIncorrectWithMethod(skillRecords, blameMethod)

    // Apply updates with evidence weighting
    for (const update of updates) {
      const state = skillStates.get(update.skillId)!

      // Weighted blend between old and new pKnown based on evidence quality
      // When evidenceWeight = 1.0, use full update
      // When evidenceWeight < 1.0, stay closer to prior
      const newPKnown = state.pKnown * (1 - evidenceWeight) + update.updatedPKnown * evidenceWeight

      state.pKnown = newPKnown
      state.opportunities += 1
      if (result.isCorrect) state.successCount += 1
      state.lastPracticedAt =
        result.timestamp instanceof Date ? result.timestamp : new Date(result.timestamp)
    }
  }

  // Convert to results
  const skills: SkillBktResult[] = []
  const now = new Date()

  for (const [skillId, state] of skillStates) {
    const successRate = state.opportunities > 0 ? state.successCount / state.opportunities : 0.5
    const confidence = calculateConfidence(state.opportunities, successRate)

    // Apply decay if enabled
    let finalPKnown = state.pKnown
    if (opts.applyDecay && state.lastPracticedAt) {
      const daysSinceLastPractice =
        (now.getTime() - state.lastPracticedAt.getTime()) / (1000 * 60 * 60 * 24)
      finalPKnown = applyTimeDecay(
        state.pKnown,
        daysSinceLastPractice,
        opts.decayHalfLifeDays,
        state.params.pInit
      )
    }

    const uncertaintyRange = getUncertaintyRange(finalPKnown, confidence)

    // Classify mastery based on P(known) and confidence
    const masteryClassification = classifyMastery(finalPKnown, confidence, opts.confidenceThreshold)

    skills.push({
      skillId,
      pKnown: finalPKnown,
      confidence,
      uncertaintyRange,
      opportunities: state.opportunities,
      successCount: state.successCount,
      lastPracticedAt: state.lastPracticedAt,
      masteryClassification,
    })
  }

  // Sort by pKnown ascending (weak skills first)
  skills.sort((a, b) => a.pKnown - b.pKnown)

  // Identify intervention needed (low pKnown with sufficient confidence)
  const interventionNeeded = skills.filter((s) => s.masteryClassification === 'weak')

  // Identify strengths (high pKnown with sufficient confidence)
  const strengths = skills.filter((s) => s.masteryClassification === 'strong')

  return { skills, interventionNeeded, strengths }
}

/**
 * Classify a skill's mastery level based on P(known) and confidence.
 *
 * Uses unified thresholds from BKT_THRESHOLDS:
 * - strong: P(known) >= 0.8
 * - weak: P(known) < 0.5
 * - developing: everything in between (or insufficient confidence)
 */
function classifyMastery(
  pKnown: number,
  confidence: number,
  confidenceThreshold: number
): MasteryClassification {
  // Need sufficient confidence to make strong claims
  if (confidence < confidenceThreshold) {
    return 'developing' // Not enough data to be sure either way
  }

  if (pKnown >= BKT_THRESHOLDS.strong) {
    return 'strong'
  } else if (pKnown < BKT_THRESHOLDS.weak) {
    return 'weak'
  } else {
    return 'developing'
  }
}

/**
 * Recompute BKT with different options (e.g., different confidence threshold).
 * Useful for UI controls that let users adjust the threshold.
 */
export function recomputeWithOptions(
  bktResult: BktComputeResult,
  newOptions: BktComputeOptions
): BktComputeResult {
  // Re-classify all skills with new threshold
  const skills = bktResult.skills.map((skill) => ({
    ...skill,
    masteryClassification: classifyMastery(
      skill.pKnown,
      skill.confidence,
      newOptions.confidenceThreshold
    ),
  }))

  const interventionNeeded = skills.filter((s) => s.masteryClassification === 'weak')
  const strengths = skills.filter((s) => s.masteryClassification === 'strong')

  return { skills, interventionNeeded, strengths }
}
