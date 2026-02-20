/**
 * Term Count Scaling Configuration
 *
 * Dynamic term-count ranges based on student mastery (comfort level).
 * Replaces static term-count ranges with mastery-derived computation.
 *
 * When comfortable → more terms (harder problems)
 * When struggling → fewer terms (focus on the skill itself)
 * Parent/teacher override acts as a ceiling, not the primary source.
 */

import type { SessionPartType } from '@/db/schema/session-plans'

// =============================================================================
// Types
// =============================================================================

/** Per-mode floor/ceiling configuration for term count ranges */
export interface ModeScalingConfig {
  floor: { min: number; max: number }
  ceiling: { min: number; max: number }
}

/** Full term count scaling configuration across all modes */
export type TermCountScalingConfig = Record<SessionPartType, ModeScalingConfig>

// =============================================================================
// Scaling Configuration
// =============================================================================

/**
 * Per-part-type floor/ceiling for term count ranges.
 *
 * - floor: what a struggling student (comfort = 0) gets
 * - ceiling: what a fully mastered student (comfort = 1) gets
 *
 * The actual range is linearly interpolated between floor and ceiling
 * based on the student's comfort level.
 */
export const DEFAULT_TERM_COUNT_SCALING: TermCountScalingConfig = {
  abacus: { floor: { min: 2, max: 3 }, ceiling: { min: 4, max: 8 } },
  visualization: { floor: { min: 2, max: 2 }, ceiling: { min: 4, max: 8 } },
  linear: { floor: { min: 2, max: 2 }, ceiling: { min: 4, max: 8 } },
}

/** @deprecated Use DEFAULT_TERM_COUNT_SCALING instead */
export const TERM_COUNT_SCALING = DEFAULT_TERM_COUNT_SCALING

// =============================================================================
// Explanation Data (for UI tooltips)
// =============================================================================

/**
 * Explanation data attached to each slot so tooltips can show reasoning.
 *
 * This captures the full computation chain from BKT data → comfort level →
 * dynamic range → final range (after override), allowing the UI to explain
 * exactly why a student got a particular term count range.
 */
export interface TermCountExplanation {
  /** Comfort level (0-1) used for interpolation (after adjustment) */
  comfortLevel: number
  /** Individual factors that produced the comfort level */
  factors: {
    /** Weighted pKnown average across practicing skills (null = no BKT data) */
    avgMastery: number | null
    /** Session mode name */
    sessionMode: string
    /** Mode-based multiplier: remediation=0.6, progression=0.85, maintenance=1.0 */
    modeMultiplier: number
    /** Bonus for breadth of skill experience (0-0.15) */
    skillCountBonus: number
  }
  /** Dynamic range before any override is applied */
  dynamicRange: { min: number; max: number }
  /** Parent/teacher cap, if any was applied */
  override: { min: number; max: number } | null
  /** Final range after override applied */
  finalRange: { min: number; max: number }
  /** Comfort adjustment from problem length preference (shorter=-0.3, recommended=0, longer=+0.2) */
  comfortAdjustment?: number
  /** Raw comfort level before adjustment was applied */
  rawComfortLevel?: number
}

// =============================================================================
// Parsing / Validation
// =============================================================================

/**
 * Parse and validate a JSON string into a TermCountScalingConfig.
 *
 * Returns the parsed config if valid, or falls back to DEFAULT_TERM_COUNT_SCALING
 * if the input is null or invalid.
 *
 * Validation rules:
 * - All 3 modes (abacus, visualization, linear) must be present
 * - All values must be integers >= 2
 * - floor.min <= floor.max, ceiling.min <= ceiling.max
 * - floor.min <= ceiling.min, floor.max <= ceiling.max
 */
export function parseTermCountScaling(json: string | null): TermCountScalingConfig {
  if (json === null) return DEFAULT_TERM_COUNT_SCALING

  try {
    const parsed = JSON.parse(json)
    if (!isValidTermCountScaling(parsed)) {
      return DEFAULT_TERM_COUNT_SCALING
    }
    return parsed as TermCountScalingConfig
  } catch {
    return DEFAULT_TERM_COUNT_SCALING
  }
}

/**
 * Validate that a value is a valid TermCountScalingConfig.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateTermCountScaling(config: unknown): string | null {
  if (!config || typeof config !== 'object') return 'Config must be an object'

  const modes: SessionPartType[] = ['abacus', 'visualization', 'linear']
  const obj = config as Record<string, unknown>

  for (const mode of modes) {
    if (!(mode in obj)) return `Missing mode: ${mode}`

    const modeConfig = obj[mode] as Record<string, unknown>
    if (!modeConfig || typeof modeConfig !== 'object') return `${mode} must be an object`

    for (const level of ['floor', 'ceiling'] as const) {
      if (!(level in modeConfig)) return `${mode}.${level} is missing`

      const range = modeConfig[level] as Record<string, unknown>
      if (!range || typeof range !== 'object') return `${mode}.${level} must be an object`

      for (const bound of ['min', 'max'] as const) {
        if (!(bound in range)) return `${mode}.${level}.${bound} is missing`
        const val = range[bound]
        if (typeof val !== 'number' || !Number.isInteger(val)) {
          return `${mode}.${level}.${bound} must be an integer`
        }
        if (val < 2) return `${mode}.${level}.${bound} must be >= 2`
      }

      const r = range as { min: number; max: number }
      if (r.min > r.max) return `${mode}.${level}.min must be <= ${mode}.${level}.max`
    }

    const mc = modeConfig as {
      floor: { min: number; max: number }
      ceiling: { min: number; max: number }
    }
    if (mc.floor.min > mc.ceiling.min) return `${mode}: floor.min must be <= ceiling.min`
    if (mc.floor.max > mc.ceiling.max) return `${mode}: floor.max must be <= ceiling.max`
  }

  return null
}

function isValidTermCountScaling(value: unknown): boolean {
  return validateTermCountScaling(value) === null
}

// =============================================================================
// Computation
// =============================================================================

/**
 * Compute the term count range for a part type based on comfort level.
 *
 * Uses linear interpolation between the floor and ceiling for the given
 * part type. Result is clamped and rounded to integers.
 *
 * @param partType - The session part type (abacus, visualization, linear)
 * @param comfortLevel - Student comfort level (0-1), from computeComfortLevel()
 * @param config - Optional custom scaling config (defaults to DEFAULT_TERM_COUNT_SCALING)
 * @returns { min, max } term count range
 */
export function computeTermCountRange(
  partType: SessionPartType,
  comfortLevel: number,
  config?: TermCountScalingConfig
): { min: number; max: number } {
  const scaling = (config ?? DEFAULT_TERM_COUNT_SCALING)[partType]
  const clamped = Math.max(0, Math.min(1, comfortLevel))

  const min = Math.round(scaling.floor.min + (scaling.ceiling.min - scaling.floor.min) * clamped)
  const max = Math.round(scaling.floor.max + (scaling.ceiling.max - scaling.floor.max) * clamped)

  // Ensure min <= max and both >= 2
  return {
    min: Math.max(2, min),
    max: Math.max(Math.max(2, min), max),
  }
}
