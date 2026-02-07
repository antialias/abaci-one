/**
 * Comfort Level Computation
 *
 * Computes a 0-1 "comfort level" from existing BKT mastery data and session mode.
 * This drives dynamic term count scaling - higher comfort → more terms per problem.
 *
 * Algorithm:
 * 1. Base: Confidence-weighted average of pKnown across practicing skills
 * 2. Mode multiplier: remediation × 0.6, progression × 0.85, maintenance × 1.0
 * 3. Skill count bonus: min(0.15, log(skillCount + 1) / 20)
 * 4. Clamp to [0, 1]; no BKT data → conservative default 0.3
 */

import type { SkillBktResult } from './bkt'
import type { SessionMode } from './session-mode'
import type { TermCountExplanation } from './config/term-count-scaling'

// =============================================================================
// Types
// =============================================================================

export interface ComfortLevelResult {
  comfortLevel: number
  factors: TermCountExplanation['factors']
}

// =============================================================================
// Mode Multipliers
// =============================================================================

const MODE_MULTIPLIERS: Record<string, number> = {
  remediation: 0.6,
  progression: 0.85,
  maintenance: 1.0,
}

/** Conservative default when no BKT data is available */
const NO_DATA_DEFAULT = 0.3

// =============================================================================
// Computation
// =============================================================================

/**
 * Compute the comfort level for a student based on their mastery data and session mode.
 *
 * @param bktResults - BKT results keyed by skillId (undefined = no BKT data available)
 * @param practicingSkillIds - Skills currently in the student's practice rotation
 * @param sessionMode - Current session mode (remediation/progression/maintenance)
 * @returns ComfortLevelResult with the comfort value and individual factors
 */
export function computeComfortLevel(
  bktResults: Map<string, SkillBktResult> | undefined,
  practicingSkillIds: string[],
  sessionMode: SessionMode
): ComfortLevelResult {
  const modeType = sessionMode.type
  const modeMultiplier = MODE_MULTIPLIERS[modeType] ?? 1.0

  // Skill count bonus: breadth of experience
  const skillCountBonus = Math.min(0.15, Math.log(practicingSkillIds.length + 1) / 20)

  // Base: confidence-weighted average of pKnown
  let avgMastery: number | null = null

  if (bktResults && bktResults.size > 0) {
    let totalWeight = 0
    let weightedSum = 0

    for (const skillId of practicingSkillIds) {
      const bkt = bktResults.get(skillId)
      if (bkt) {
        const weight = bkt.confidence
        weightedSum += bkt.pKnown * weight
        totalWeight += weight
      }
    }

    if (totalWeight > 0) {
      avgMastery = weightedSum / totalWeight
    }
  }

  let comfortLevel: number
  if (avgMastery !== null) {
    comfortLevel = avgMastery * modeMultiplier + skillCountBonus
  } else {
    // No BKT data → conservative default
    comfortLevel = NO_DATA_DEFAULT
  }

  // Clamp to [0, 1]
  comfortLevel = Math.max(0, Math.min(1, comfortLevel))

  return {
    comfortLevel,
    factors: {
      avgMastery,
      sessionMode: modeType,
      modeMultiplier,
      skillCountBonus,
    },
  }
}

// =============================================================================
// Override Helper
// =============================================================================

/**
 * Apply a parent/teacher term count override as a ceiling.
 *
 * The override doesn't raise the computed range — it only caps it.
 * If no override is provided, the computed range is returned as-is.
 *
 * @param computed - The dynamically computed term count range
 * @param override - Parent/teacher cap (null/undefined = no cap)
 * @returns The final range, capped by the override if applicable
 */
export function applyTermCountOverride(
  computed: { min: number; max: number },
  override: { min: number; max: number } | null | undefined
): { min: number; max: number } {
  if (!override) {
    return computed
  }

  // Override acts as ceiling — caps the computed range but doesn't raise it
  const finalMax = Math.min(computed.max, override.max)
  const finalMin = Math.min(computed.min, override.max) // min can't exceed override.max either

  return {
    min: Math.max(2, Math.min(finalMin, finalMax)),
    max: Math.max(2, finalMax),
  }
}
