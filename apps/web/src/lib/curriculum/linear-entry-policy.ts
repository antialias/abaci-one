/**
 * Linear entry policy — WHICH readiness dimensions admit a skill to number
 * sentences, and with what thresholds.
 *
 * Why this exists separately from `assessSkillReadiness`: the generic "solid"
 * test (mastery + volume + speed + consistency, hardcoded in
 * `readiness-thresholds.ts`) also drives skill progression and the dashboard
 * badges, so it cannot be tuned for number sentences without moving everything
 * else. Number sentences enter through the linear-with-abacus ramp, where the
 * abacus stays docked until the child is accurate on sentences themselves, so
 * automaticity (speed) is not a sensible ENTRY precondition. The ramp gate
 * (`linear-gate.ts`) owns the abacus-off decision.
 *
 * Replayed against real prod histories (2026-09-09): the generic solid test
 * admits 0 of 34 practiced skills for a fluent-when-focused child because the
 * median-of-10 speed statistic is inflated by distracted attempts and the
 * last-5 clean streak fails on a single helped answer. Mastery + volume +
 * accuracy-over-15 admits 23 of 34.
 *
 * Tunable live through the `linear_readiness.enabled` flag's JSON config under
 * the `entry` key (sibling of the ramp's `gate` key), e.g.
 *   { "entry": { "minAccuracy": 0.8, "speedRule": "fastest-quartile", "maxSecondsPerTerm": 5 } }
 */

import { READINESS_THRESHOLDS } from '@/lib/curriculum/config/readiness-thresholds'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { filterResultsForSkill, type SkillReadinessResult } from '@/lib/curriculum/skill-readiness'
import { getEffectiveResponseTimeMs } from '@/lib/curriculum/timing/effective-time'

/**
 * Which speed statistic (over the last `speedWindowSize` eligible attempts) gates
 * entry. `median` is the generic solid test's statistic; `fastest-quartile` is
 * robust to a few distracted attempts and measures what the child can do when
 * focused; `off` leaves automaticity to the ramp.
 */
export type LinearEntrySpeedRule = 'off' | 'median' | 'fastest-quartile'

export interface LinearEntryPolicy {
  /** Accuracy over the last `accuracyWindowSize` eligible attempts must reach this. */
  minAccuracy: number
  /** The accuracy window must be full (this many attempts) before accuracy can pass. */
  accuracyWindowSize: number
  /** Also require the last five attempts correct and help-free (the generic solid streak). */
  requireCleanStreak: boolean
  speedRule: LinearEntrySpeedRule
  /** Seconds per term the chosen speed statistic must not exceed (ignored when `off`). */
  maxSecondsPerTerm: number
  speedWindowSize: number
  /**
   * The frontier (the contiguous prefix of stages the child has moved past)
   * advances on mastery + volume alone by default: "the curriculum has moved past
   * this stage". Set true to also demand accuracy of every skill in a stage before
   * the stage counts as passed — which makes one shaky skill lock a whole stage.
   */
  frontierRequiresAccuracy: boolean
}

export const DEFAULT_LINEAR_ENTRY_POLICY: LinearEntryPolicy = {
  minAccuracy: READINESS_THRESHOLDS.minAccuracy, // 0.85
  accuracyWindowSize: READINESS_THRESHOLDS.accuracyWindowSize, // 15
  requireCleanStreak: false,
  speedRule: 'off',
  maxSecondsPerTerm: 5,
  speedWindowSize: READINESS_THRESHOLDS.speedWindowSize, // 10
  frontierRequiresAccuracy: false,
}

const SPEED_RULES: readonly LinearEntrySpeedRule[] = ['off', 'median', 'fastest-quartile']

/** Read `config.entry.*` from the flag's JSON config, falling back per field. */
export function resolveLinearEntryPolicy(config: unknown): LinearEntryPolicy {
  const entryRaw =
    config && typeof config === 'object' && 'entry' in config
      ? (config as { entry?: unknown }).entry
      : undefined
  const e = entryRaw && typeof entryRaw === 'object' ? (entryRaw as Record<string, unknown>) : {}
  const d = DEFAULT_LINEAR_ENTRY_POLICY
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  const rule = (v: unknown, fallback: LinearEntrySpeedRule) =>
    typeof v === 'string' && (SPEED_RULES as readonly string[]).includes(v)
      ? (v as LinearEntrySpeedRule)
      : fallback
  return {
    minAccuracy: num(e.minAccuracy, d.minAccuracy),
    accuracyWindowSize: Math.max(1, Math.round(num(e.accuracyWindowSize, d.accuracyWindowSize))),
    requireCleanStreak: bool(e.requireCleanStreak, d.requireCleanStreak),
    speedRule: rule(e.speedRule, d.speedRule),
    maxSecondsPerTerm: num(e.maxSecondsPerTerm, d.maxSecondsPerTerm),
    speedWindowSize: Math.max(1, Math.round(num(e.speedWindowSize, d.speedWindowSize))),
    frontierRequiresAccuracy: bool(e.frontierRequiresAccuracy, d.frontierRequiresAccuracy),
  }
}

export interface LinearEntryAssessment {
  skillId: string
  /** Passes everything the policy requires of a member (mastery, volume, accuracy, speed). */
  ready: boolean
  /** Passes what the frontier requires of every skill in a stage (mastery + volume [+ accuracy]). */
  advancesFrontier: boolean
  /** Eligible attempts on this skill (0 = never practiced). */
  opportunities: number
  mastery: { met: boolean; pKnown: number }
  volume: { met: boolean; opportunities: number; sessionCount: number; minOpportunities: number }
  accuracy: {
    met: boolean
    recentAccuracy: number
    /** Attempts actually in the window (< `windowSize` until the child has practiced enough). */
    windowFilled: number
    windowSize: number
    minAccuracy: number
    /** Last five attempts all correct and help-free. Informational unless `requireCleanStreak`. */
    cleanStreak: boolean
  }
  speed: {
    rule: LinearEntrySpeedRule
    /** Always true when the rule is `off`. */
    met: boolean
    secondsPerTerm: number | null
    maxSecondsPerTerm: number
  }
}

const CLEAN_STREAK_LENGTH = READINESS_THRESHOLDS.lastNAllCorrect // 5

function byTimestampDesc(a: ProblemResultWithContext, b: ProblemResultWithContext): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
}

function quantile(sortedAsc: number[], q: number): number | null {
  if (sortedAsc.length === 0) return null
  const pos = q * (sortedAsc.length - 1)
  const lo = Math.floor(pos)
  const hi = Math.min(lo + 1, sortedAsc.length - 1)
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo)
}

/**
 * Assess one skill against the entry policy. `readiness` is the generic
 * assessment for the same skill (mastery + volume are reused from it verbatim);
 * accuracy and speed are recomputed here under the policy's own windows.
 * Teacher-excluded attempts are ignored, as the ramp gate ignores them.
 */
export function assessLinearEntry(
  skillId: string,
  allResults: ProblemResultWithContext[],
  readiness: SkillReadinessResult,
  policy: LinearEntryPolicy = DEFAULT_LINEAR_ENTRY_POLICY
): LinearEntryAssessment {
  const recentFirst = filterResultsForSkill(allResults, skillId)
    .filter((r) => r.source !== 'teacher-excluded')
    .sort(byTimestampDesc)
  const opportunities = readiness.dimensions.volume.opportunities

  const window = recentFirst.slice(0, policy.accuracyWindowSize)
  const recentAccuracy =
    window.length > 0 ? window.filter((r) => r.isCorrect).length / window.length : 0
  const accuracyMet =
    window.length >= policy.accuracyWindowSize && recentAccuracy >= policy.minAccuracy
  const streak = recentFirst.slice(0, CLEAN_STREAK_LENGTH)
  const cleanStreak =
    streak.length >= CLEAN_STREAK_LENGTH && streak.every((r) => r.isCorrect && r.hadHelp === false)

  let secondsPerTerm: number | null = null
  if (policy.speedRule !== 'off') {
    const samples = recentFirst
      .slice(0, policy.speedWindowSize)
      .map((r) => {
        const ms = getEffectiveResponseTimeMs(r)
        const terms = r.problem.terms.length
        return ms === null || terms === 0 ? null : ms / (terms * 1000)
      })
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)
    secondsPerTerm = quantile(samples, policy.speedRule === 'median' ? 0.5 : 0.25)
  }
  const speedMet =
    policy.speedRule === 'off' ||
    (secondsPerTerm !== null && secondsPerTerm <= policy.maxSecondsPerTerm)

  const mastery = readiness.dimensions.mastery
  const volume = readiness.dimensions.volume
  const accuracyOk = accuracyMet && (!policy.requireCleanStreak || cleanStreak)
  const advancesFrontier =
    mastery.met && volume.met && (!policy.frontierRequiresAccuracy || accuracyOk)
  const ready = mastery.met && volume.met && accuracyOk && speedMet

  return {
    skillId,
    ready,
    advancesFrontier,
    opportunities,
    mastery: { met: mastery.met, pKnown: mastery.pKnown },
    volume: {
      met: volume.met,
      opportunities: volume.opportunities,
      sessionCount: volume.sessionCount,
      minOpportunities: READINESS_THRESHOLDS.minOpportunities,
    },
    accuracy: {
      met: accuracyOk,
      recentAccuracy,
      windowFilled: window.length,
      windowSize: policy.accuracyWindowSize,
      minAccuracy: policy.minAccuracy,
      cleanStreak,
    },
    speed: {
      rule: policy.speedRule,
      met: speedMet,
      secondsPerTerm,
      maxSecondsPerTerm: policy.maxSecondsPerTerm,
    },
  }
}
