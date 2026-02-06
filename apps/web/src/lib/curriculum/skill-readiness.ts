/**
 * Skill Readiness Assessment
 *
 * Pure functions to evaluate whether a student is truly ready to advance
 * past a skill, using four equal dimensions:
 *
 * 1. Mastery: BKT P(known) + confidence
 * 2. Volume: Practice depth (problems + sessions)
 * 3. Speed: Automaticity / muscle memory
 * 4. Consistency: Reliable execution (accuracy + no-help streak)
 *
 * All readiness criteria are computed from existing SlotResult fields
 * (responseTimeMs, isCorrect, hadHelp, skillsExercised, problem.terms).
 * No new metrics are tracked — just smarter analysis of what's already there.
 */

import type { SkillBktResult } from '@/lib/curriculum/bkt/types'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { READINESS_THRESHOLDS } from '@/lib/curriculum/config/readiness-thresholds'

// =============================================================================
// Types
// =============================================================================

export interface MasteryDimension {
  met: boolean
  pKnown: number
  confidence: number
}

export interface VolumeDimension {
  met: boolean
  opportunities: number
  sessionCount: number
}

export interface SpeedDimension {
  met: boolean
  /** Median seconds per term, or null if no data */
  medianSecondsPerTerm: number | null
}

export interface ConsistencyDimension {
  met: boolean
  recentAccuracy: number
  lastFiveAllCorrect: boolean
  recentHelpCount: number
}

export interface SkillReadinessDimensions {
  mastery: MasteryDimension
  volume: VolumeDimension
  speed: SpeedDimension
  consistency: ConsistencyDimension
}

export interface SkillReadinessResult {
  skillId: string
  /** True when all four dimensions are met */
  isSolid: boolean
  dimensions: SkillReadinessDimensions
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Filter results to those relevant for a skill's readiness assessment.
 * Excludes retries and sentinel records (recency-refresh).
 */
function filterResultsForSkill(
  allResults: ProblemResultWithContext[],
  skillId: string
): ProblemResultWithContext[] {
  return allResults.filter(
    (r) =>
      r.skillsExercised.includes(skillId) &&
      r.source !== 'recency-refresh' &&
      r.isRetry !== true
  )
}

/**
 * Compute median of a numeric array.
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Count distinct sessions in a set of results.
 */
function countDistinctSessions(results: ProblemResultWithContext[]): number {
  const sessionIds = new Set(results.map((r) => r.sessionId))
  return sessionIds.size
}

// =============================================================================
// Dimension Assessment
// =============================================================================

function assessMastery(bktResult: SkillBktResult | undefined): MasteryDimension {
  const pKnown = bktResult?.pKnown ?? 0
  const confidence = bktResult?.confidence ?? 0

  return {
    met:
      pKnown >= READINESS_THRESHOLDS.pKnownThreshold &&
      confidence >= READINESS_THRESHOLDS.confidenceThreshold,
    pKnown,
    confidence,
  }
}

function assessVolume(results: ProblemResultWithContext[]): VolumeDimension {
  const opportunities = results.length
  const sessionCount = countDistinctSessions(results)

  return {
    met:
      opportunities >= READINESS_THRESHOLDS.minOpportunities &&
      sessionCount >= READINESS_THRESHOLDS.minSessions,
    opportunities,
    sessionCount,
  }
}

function assessSpeed(results: ProblemResultWithContext[]): SpeedDimension {
  // Sort by timestamp descending, take the most recent N
  const sorted = [...results].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  const recent = sorted.slice(0, READINESS_THRESHOLDS.speedWindowSize)

  // Compute seconds per term for each problem
  const secondsPerTerm = recent
    .filter((r) => r.problem.terms.length > 0)
    .map((r) => r.responseTimeMs / (r.problem.terms.length * 1000))

  const medianSecondsPerTerm = median(secondsPerTerm)

  return {
    met:
      medianSecondsPerTerm !== null &&
      medianSecondsPerTerm <= READINESS_THRESHOLDS.maxMedianSecondsPerTerm,
    medianSecondsPerTerm,
  }
}

function assessConsistency(results: ProblemResultWithContext[]): ConsistencyDimension {
  // Sort by timestamp descending for recency-based checks
  const sorted = [...results].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  // Recent accuracy over the window
  const recentWindow = sorted.slice(0, READINESS_THRESHOLDS.accuracyWindowSize)
  const recentCorrect = recentWindow.filter((r) => r.isCorrect).length
  const recentAccuracy = recentWindow.length > 0 ? recentCorrect / recentWindow.length : 0

  // Last N all correct
  const lastN = sorted.slice(0, READINESS_THRESHOLDS.lastNAllCorrect)
  const lastFiveAllCorrect =
    lastN.length >= READINESS_THRESHOLDS.lastNAllCorrect && lastN.every((r) => r.isCorrect)

  // Help-free in last N
  const helpWindow = sorted.slice(0, READINESS_THRESHOLDS.noHelpInLastN)
  const recentHelpCount = helpWindow.filter((r) => r.hadHelp).length
  const helpFree =
    helpWindow.length >= READINESS_THRESHOLDS.noHelpInLastN && recentHelpCount === 0

  const accuracyMet =
    recentWindow.length >= READINESS_THRESHOLDS.accuracyWindowSize &&
    recentAccuracy >= READINESS_THRESHOLDS.minAccuracy

  return {
    met: accuracyMet && lastFiveAllCorrect && helpFree,
    recentAccuracy,
    lastFiveAllCorrect,
    recentHelpCount,
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Assess readiness for a single skill.
 *
 * Takes the full problem history (already loaded by getSessionMode) plus
 * BKT result for the skill. Returns per-dimension pass/fail with detail values.
 */
export function assessSkillReadiness(
  skillId: string,
  allResults: ProblemResultWithContext[],
  bktResult: SkillBktResult | undefined
): SkillReadinessResult {
  const filtered = filterResultsForSkill(allResults, skillId)

  const mastery = assessMastery(bktResult)
  const volume = assessVolume(filtered)
  const speed = assessSpeed(filtered)
  const consistency = assessConsistency(filtered)

  // A skill with 0 opportunities doesn't block (student hasn't encountered it yet)
  const isSolid =
    filtered.length === 0 ||
    (mastery.met && volume.met && speed.met && consistency.met)

  return {
    skillId,
    isSolid,
    dimensions: { mastery, volume, speed, consistency },
  }
}

/**
 * Assess readiness for all currently practicing skills.
 *
 * Returns a Map of skillId → SkillReadinessResult.
 */
export function assessAllSkillsReadiness(
  allResults: ProblemResultWithContext[],
  bktResults: SkillBktResult[],
  practicingIds: Set<string>
): Map<string, SkillReadinessResult> {
  const bktMap = new Map(bktResults.map((r) => [r.skillId, r]))
  const readiness = new Map<string, SkillReadinessResult>()

  for (const skillId of practicingIds) {
    readiness.set(
      skillId,
      assessSkillReadiness(skillId, allResults, bktMap.get(skillId))
    )
  }

  return readiness
}

/**
 * Convert a readiness map to a plain object (for JSON serialization).
 */
export function readinessMapToRecord(
  map: Map<string, SkillReadinessResult>
): Record<string, SkillReadinessResult> {
  return Object.fromEntries(map.entries())
}
