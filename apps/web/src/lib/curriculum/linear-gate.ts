/**
 * Linear "abacus-off" Gate — the ramp phase
 * =========================================
 *
 * When a category becomes linear-*eligible* (see `linear-readiness.ts`), the child
 * does NOT jump straight to pure mental math. They enter a scaffolded RAMP: the
 * horizontal number sentence is presented WITH the working abacus available, so the
 * two hard leaps — new notation (vertical → horizontal) and losing the abacus — are
 * taught one at a time.
 *
 * A category leaves the ramp (abacus comes off → pure mental linear) when the child
 * has demonstrated CORRECTNESS on that category's linear-with-abacus work: enough
 * first-attempt linear opportunities AND a high enough recent first-attempt accuracy.
 *
 * DERIVED, never persisted — computed fresh at plan time from the same
 * `session_plans.results` history everything else reads. Thresholds are TUNABLE via
 * the `linear_readiness.enabled` feature flag's `config` payload (see
 * `resolveLinearGateThresholds`), so they can be adjusted from /admin/feature-flags
 * without a redeploy as we work the data.
 *
 * Kids arrive at linear with rich abacus/visualization history but ZERO linear
 * history, so the gate cannot use pre-existing linear data — the ramp itself
 * generates the signal that eventually opens the gate.
 */

import { getSkillCategory, type SkillCategoryKey } from '@/constants/skillCategories'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { READINESS_THRESHOLDS } from '@/lib/curriculum/config/readiness-thresholds'

export interface LinearGateThresholds {
  /** Minimum first-attempt accuracy in the recent window to pass the gate (0..1). */
  minAccuracy: number
  /** Number of most-recent first-attempt linear results the accuracy is measured over. */
  accuracyWindowSize: number
  /** Minimum first-attempt linear opportunities in the category before the gate can pass. */
  minOpportunities: number
}

/**
 * Defaults mirror the shared readiness consistency/volume knobs so the gate stays
 * consistent with how "solid" is judged elsewhere. Overridable per-field via flag config.
 */
export const DEFAULT_LINEAR_GATE_THRESHOLDS: LinearGateThresholds = {
  minAccuracy: READINESS_THRESHOLDS.minAccuracy, // 0.85
  accuracyWindowSize: READINESS_THRESHOLDS.accuracyWindowSize, // 15
  minOpportunities: READINESS_THRESHOLDS.minOpportunities, // 20
}

export interface LinearCategoryGate {
  category: SkillCategoryKey
  /** First-attempt linear attempts exercising this category (the volume signal). */
  opportunities: number
  /** First-attempt accuracy over the most-recent window (the correctness signal). */
  recentAccuracy: number
  /** True once opportunities ≥ floor AND recentAccuracy ≥ minAccuracy over a full window. */
  passed: boolean
}

/**
 * Parse the (untrusted) feature-flag `config` payload into resolved gate thresholds,
 * falling back to the defaults per-field. Config shape: `{ "gate": { minAccuracy,
 * accuracyWindowSize, minOpportunities } }`. Anything missing/invalid uses the default.
 */
export function resolveLinearGateThresholds(config: unknown): LinearGateThresholds {
  const gateRaw =
    config && typeof config === 'object' && 'gate' in config
      ? (config as { gate?: unknown }).gate
      : undefined
  const g = gateRaw && typeof gateRaw === 'object' ? (gateRaw as Record<string, unknown>) : {}
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return {
    minAccuracy: num(g.minAccuracy, DEFAULT_LINEAR_GATE_THRESHOLDS.minAccuracy),
    accuracyWindowSize: num(
      g.accuracyWindowSize,
      DEFAULT_LINEAR_GATE_THRESHOLDS.accuracyWindowSize
    ),
    minOpportunities: num(g.minOpportunities, DEFAULT_LINEAR_GATE_THRESHOLDS.minOpportunities),
  }
}

/**
 * A result counts toward the gate only if it is a genuine first-attempt LINEAR result:
 * linear mode, not a retry, and not a sentinel/excluded record.
 */
function isGateEligible(r: ProblemResultWithContext): boolean {
  return (
    r.partType === 'linear' &&
    r.isRetry !== true &&
    (r.epochNumber ?? 0) === 0 &&
    r.source !== 'recency-refresh' &&
    r.source !== 'teacher-excluded'
  )
}

/**
 * Compute the ramp gate for each supplied category from linear practice history.
 *
 * An attempt counts toward a category if ANY of its `skillsExercised` falls in that
 * category (an attempt spanning categories counts toward each). Accuracy is measured
 * over the most-recent `accuracyWindowSize` first-attempt linear results in the category.
 */
export function deriveLinearGateState(params: {
  problemHistory: ProblemResultWithContext[]
  categories: Iterable<SkillCategoryKey>
  thresholds: LinearGateThresholds
}): Map<SkillCategoryKey, LinearCategoryGate> {
  const { problemHistory, categories, thresholds } = params
  const gateResults = problemHistory.filter(isGateEligible)
  const out = new Map<SkillCategoryKey, LinearCategoryGate>()

  for (const category of categories) {
    if (out.has(category)) continue
    const inCategory = gateResults.filter((r) =>
      r.skillsExercised.some((s) => getSkillCategory(s) === category)
    )
    const sorted = [...inCategory].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    const window = sorted.slice(0, thresholds.accuracyWindowSize)
    const correct = window.filter((r) => r.isCorrect).length
    const recentAccuracy = window.length > 0 ? correct / window.length : 0
    const opportunities = inCategory.length
    const passed =
      opportunities >= thresholds.minOpportunities &&
      window.length >= thresholds.accuracyWindowSize &&
      recentAccuracy >= thresholds.minAccuracy
    out.set(category, { category, opportunities, recentAccuracy, passed })
  }

  return out
}

/**
 * Whether the (single, homogeneous) linear part should keep the working abacus.
 *
 * Ramp = abacus ON. Because the session engine caps a plan at 3 parts (one per mode),
 * the linear part is homogeneous: the abacus stays on until EVERY linear-ready category
 * has passed the gate, then the whole linear part becomes pure mental math. (A future
 * enhancement — lifting the 3-part cap — would let a passed category get its own
 * abacus-off linear part while its siblings still ramp.)
 */
export function linearPartUsesAbacus(
  gateByCategory: ReadonlyMap<SkillCategoryKey, LinearCategoryGate>
): boolean {
  if (gateByCategory.size === 0) return false
  for (const gate of gateByCategory.values()) {
    if (!gate.passed) return true
  }
  return false
}
