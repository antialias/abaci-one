/**
 * Linear-readiness state service (L3)
 *
 * DB-touching orchestration around the pure `linear-readiness` derivation: loads a
 * student's mastery, history, BKT and vetoes, and reports which skill categories are
 * (or would be) linear-ready plus their veto state — the data feed for the
 * graduation banner and the per-category veto chip.
 */

import { computeBktFromHistory } from './bkt'
import { BKT_INTEGRATION_CONFIG } from './config'
import { getRecentSessionResults } from './session-planner'
import { getAllSkillMastery, getLinearReadinessVetoes } from './progress-manager'
import { deriveLinearReadySkills, groupLinearReadyByCategory } from './linear-readiness'
import { getCategoryDisplayName, type SkillCategoryKey } from '@/constants/skillCategories'
import { isEnabled } from '@/lib/feature-flags'

export interface LinearReadyCategory {
  category: SkillCategoryKey
  /** Human-readable category name (e.g. "Ten Complements (Addition)"). */
  name: string
  /** The linear-ready skill ids in this category. */
  skillIds: string[]
  /** Whether the teacher has vetoed this category off number sentences. */
  vetoed: boolean
}

export interface LinearReadinessState {
  /** Whether the `linear_readiness` feature flag is on. */
  enabled: boolean
  /** Categories that are (or would be, ignoring veto) linear-ready. */
  categories: LinearReadyCategory[]
}

/**
 * Compute the linear-readiness state for a student. Returns an inert empty state
 * when the feature flag is off (no history/BKT work done).
 *
 * The derivation runs with an EMPTY veto set so the result includes vetoed
 * categories too (annotated with `vetoed: true`); the banner/chip need to show a
 * vetoed category so the teacher can lift the veto.
 */
export async function getLinearReadinessState(playerId: string): Promise<LinearReadinessState> {
  const enabled = await isEnabled('linear_readiness.enabled', false)
  if (!enabled) return { enabled: false, categories: [] }

  const [skillMastery, problemHistory, vetoes] = await Promise.all([
    getAllSkillMastery(playerId),
    getRecentSessionResults(playerId, BKT_INTEGRATION_CONFIG.sessionHistoryDepth),
    getLinearReadinessVetoes(playerId),
  ])

  const bktResults =
    problemHistory.length > 0
      ? new Map(computeBktFromHistory(problemHistory).skills.map((s) => [s.skillId, s]))
      : undefined

  const allReady = deriveLinearReadySkills({
    skillMastery,
    problemHistory,
    bktResults,
    vetoedCategories: new Set(), // ignore vetoes here; annotate below
  })

  const categories: LinearReadyCategory[] = [...groupLinearReadyByCategory(allReady).entries()].map(
    ([category, skillIds]) => ({
      category,
      name: getCategoryDisplayName(category),
      skillIds,
      vetoed: vetoes.has(category),
    })
  )

  return { enabled: true, categories }
}
