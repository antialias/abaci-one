/**
 * Linear readiness state for a player — the single contract behind the
 * start-practice modal's locked segment, the dashboard's "Number sentences"
 * panel and the graduation banner.
 *
 * Server-only (reads the DB and feature flags). The client reads it through
 * `GET /api/curriculum/[playerId]/linear-veto` and `useLinearReadiness`.
 */

import { getCategoryDisplayName, type SkillCategoryKey } from '@/constants/skillCategories'
import { isEnabled } from '@/lib/feature-flags'
import { getSkillDisplayName } from '@/utils/skillDisplay'
import { computeBktFromHistory } from './bkt'
import { BKT_INTEGRATION_CONFIG } from './config'
import {
  explainLinearReadiness,
  groupLinearReadyByCategory,
  type LinearReadinessFrontier,
} from './linear-readiness'
import { getAllSkillMastery, getLinearReadinessVetoes } from './progress-manager'
import { getRecentSessionResults } from './session-planner'
import type { SkillReadinessResult } from './skill-readiness'

export type { LinearReadinessFrontier }

/**
 * - `ready`  — graduated past the frontier and not vetoed; feeds number sentences.
 * - `vetoed` — graduated, but the teacher said "not yet" for this category.
 * - `locked` — the frontier stage itself: still being consolidated.
 */
export type LinearCategoryStatus = 'ready' | 'vetoed' | 'locked'

export interface LinearReadyCategory {
  category: SkillCategoryKey
  /** Display name, e.g. "Basic Skills" */
  name: string
  skillIds: string[]
  /** Kept for existing consumers; equals `status === 'vetoed'` for graduated categories. */
  vetoed: boolean
  status: LinearCategoryStatus
}

/** Per-skill readiness for the frontier stage — what the student is working toward. */
export interface LinearReadinessSkillState {
  skillId: string
  /** Human-readable skill name */
  name: string
  /** Stage rank in the linear-readiness ladder */
  stage: number
  readiness: SkillReadinessResult
}

export interface LinearReadinessState {
  /** Whether the derived-readiness flag is on */
  enabled: boolean
  /** The stage holding number sentences back; `null` when the flag is off or every stage is solid. */
  frontier: LinearReadinessFrontier | null
  /** Graduated categories (ready / vetoed) plus the frontier category (locked). */
  categories: LinearReadyCategory[]
  /** Readiness detail for each skill in the frontier stage. */
  skills: LinearReadinessSkillState[]
}

function flagOffState(): LinearReadinessState {
  return {
    enabled: false,
    frontier: null,
    categories: [],
    skills: [],
  }
}

export async function getLinearReadinessState(playerId: string): Promise<LinearReadinessState> {
  const enabled = await isEnabled('linear_readiness.enabled', false)
  if (!enabled) return flagOffState()

  const [skillMastery, problemHistory, vetoes] = await Promise.all([
    getAllSkillMastery(playerId),
    getRecentSessionResults(playerId, BKT_INTEGRATION_CONFIG.sessionHistoryDepth),
    getLinearReadinessVetoes(playerId),
  ])

  const bktResults =
    problemHistory.length > 0
      ? new Map(computeBktFromHistory(problemHistory).skills.map((s) => [s.skillId, s]))
      : undefined

  const explanation = explainLinearReadiness({
    skillMastery,
    problemHistory,
    bktResults,
    vetoedCategories: vetoes,
  })

  const categories: LinearReadyCategory[] = [
    ...groupLinearReadyByCategory(explanation.readyBeforeVetoSkillIds).entries(),
  ].map(([category, skillIds]) => {
    const vetoed = vetoes.has(category)
    return {
      category,
      name: getCategoryDisplayName(category),
      skillIds,
      vetoed,
      status: vetoed ? 'vetoed' : 'ready',
    }
  })

  const { frontier } = explanation
  if (frontier && !categories.some((c) => c.category === frontier.category)) {
    categories.push({
      category: frontier.category,
      name: frontier.name,
      skillIds: frontier.skillIds,
      // A veto is the teacher's explicit call and re-suppresses the category the
      // moment it re-graduates, so it must stay visible (and liftable) even while
      // the category is also the frontier.
      vetoed: vetoes.has(frontier.category),
      status: vetoes.has(frontier.category) ? 'vetoed' : 'locked',
    })
  }

  const skills: LinearReadinessSkillState[] = explanation.frontierSkills.map((detail) => ({
    skillId: detail.skillId,
    name: getSkillDisplayName(detail.skillId),
    stage: detail.stageRank,
    readiness: detail.readiness,
  }))

  return { enabled: true, frontier, categories, skills }
}
