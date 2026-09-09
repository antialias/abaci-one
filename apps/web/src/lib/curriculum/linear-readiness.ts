/**
 * Linear-Readiness Derivation (L3)
 * =================================
 *
 * "Linear" practice parts present mastered skills as horizontal number sentences
 * ("45 + 27 = ?") instead of abacus/visualization work. A skill becomes
 * *linear-ready* — is "aged out" onto pure number sentences — when the child has
 * demonstrably mastered it AND their learning frontier has moved a stage past it.
 *
 * This is DERIVED-WITH-VETO, computed fresh at plan time and NEVER persisted:
 *   - readiness is a pure function of practice evidence + the frontier (this module)
 *   - the ONLY persisted state is a per-category teacher veto (`linear_readiness_veto`)
 *
 * It is intentionally decoupled from the manual `none → abacus → visual` ladder
 * (`PracticeLevel`), which teachers still control by hand. Linear used to piggyback
 * on the `visual` gate; L3 gives it its own gate driven by this derivation.
 *
 * ── The frontier ──────────────────────────────────────────────────────────────
 * Curriculum stages, in forward teaching order (advanced is split by operation, so
 * cascading-carry sits with addition and cascading-borrow with subtraction):
 *
 *   0 basic            1 fiveComplements   2 tenComplements   3 cascadingCarry
 *   4 fiveComplementsSub   5 tenComplementsSub   6 cascadingBorrow
 *
 * The frontier is the contiguous fully-mastered *prefix* of stages. A stage counts
 * as mastered only when EVERY non-cascading skill in it has REAL EVIDENCE
 * (opportunities > 0) and is solid — a never-practiced skill does NOT count as
 * "mastered by default" for the frontier, so a child mid-category cannot vault a
 * whole stage. Cascading skills (which have no tutorial and are rarely drilled) are
 * exempt: they never block the frontier, but they still need their own evidence to
 * enter the linear pool (see membership below).
 *
 * ── Membership ────────────────────────────────────────────────────────────────
 * A skill is linear-ready iff it is solid, has real evidence, sits at a stage the
 * frontier has already crossed, its category isn't vetoed, AND it is still active
 * on the manual ladder (a teacher's `none` removes it — "off means off").
 */

import {
  getCategoryDisplayName,
  getCategorySkillIds,
  getFullSkillId,
  getSkillCategory,
  type SkillCategoryKey,
} from '@/constants/skillCategories'
import type { PlayerSkillMastery } from '@/db/schema/player-skill-mastery'
import { isActive } from '@/db/schema/player-skill-mastery'
import type { SkillBktResult } from '@/lib/curriculum/bkt/types'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { assessSkillReadiness, type SkillReadinessResult } from '@/lib/curriculum/skill-readiness'

// =============================================================================
// Stage model
// =============================================================================

interface StageDef {
  rank: number
  /** Category the stage is drawn from (display name + veto key). */
  category: SkillCategoryKey
  skillIds: string[]
  /**
   * Cascading stages never block the frontier (no tutorial, rarely drilled), but
   * their skills still need their own evidence to enter the linear pool.
   */
  exempt?: boolean
}

/**
 * Curriculum stages in forward order. `advanced` is deliberately split: cascading
 * carry rides with addition (rank 3), cascading borrow with subtraction (rank 6).
 */
const STAGE_DEFS: StageDef[] = [
  { rank: 0, category: 'basic', skillIds: getCategorySkillIds('basic') },
  { rank: 1, category: 'fiveComplements', skillIds: getCategorySkillIds('fiveComplements') },
  { rank: 2, category: 'tenComplements', skillIds: getCategorySkillIds('tenComplements') },
  {
    rank: 3,
    category: 'advanced',
    skillIds: [getFullSkillId('advanced', 'cascadingCarry')],
    exempt: true,
  },
  { rank: 4, category: 'fiveComplementsSub', skillIds: getCategorySkillIds('fiveComplementsSub') },
  { rank: 5, category: 'tenComplementsSub', skillIds: getCategorySkillIds('tenComplementsSub') },
  {
    rank: 6,
    category: 'advanced',
    skillIds: [getFullSkillId('advanced', 'cascadingBorrow')],
    exempt: true,
  },
]

/** One past the last stage rank — the frontier value when everything is mastered. */
const FRONTIER_ALL_MASTERED = STAGE_DEFS[STAGE_DEFS.length - 1].rank + 1

/** Every skill id that participates in a curriculum stage. */
export const ALL_STAGED_SKILL_IDS: string[] = STAGE_DEFS.flatMap((s) => s.skillIds)

const STAGE_RANK_BY_SKILL: ReadonlyMap<string, number> = new Map(
  STAGE_DEFS.flatMap((stage) => stage.skillIds.map((id) => [id, stage.rank] as const))
)

/** The curriculum stage rank of a skill, or null if it isn't a staged skill. */
export function stageRank(skillId: string): number | null {
  return STAGE_RANK_BY_SKILL.get(skillId) ?? null
}

// =============================================================================
// Pure core — operates on per-skill evidence, easy to unit-test
// =============================================================================

/** The two facts about a skill that drive the derivation, distilled from history. */
export interface SkillEvidence {
  /** Passed all four readiness dimensions (or has no history — see `opportunities`). */
  isSolid: boolean
  /** Real practice opportunities in the assessment window (0 = never practiced). */
  opportunities: number
}

/**
 * The contiguous fully-mastered prefix of stages.
 *
 * Returns the rank of the FIRST non-exempt stage that is not fully mastered (every
 * skill in it having real evidence AND being solid). Skills below the returned rank
 * are past the frontier. Cascading (exempt) stages never stop the frontier.
 *
 * MUST-FIX (critique Finding 1): a stage is mastered only with real evidence
 * (`opportunities > 0`), NOT the 0-opportunity "non-blocking" default that
 * `assessSkillReadiness` uses for progression — otherwise a child who has only met
 * a handful of a category's skills would vault the whole stage and graduate early.
 */
export function computeFrontierRank(evidenceBySkill: ReadonlyMap<string, SkillEvidence>): number {
  for (const stage of STAGE_DEFS) {
    if (stage.exempt) continue
    const mastered = stage.skillIds.every((id) => {
      const e = evidenceBySkill.get(id)
      return e != null && e.opportunities > 0 && e.isSolid
    })
    if (!mastered) return stage.rank
  }
  return FRONTIER_ALL_MASTERED
}

/**
 * Given per-skill evidence, the set of currently-active skill ids, and vetoed
 * categories, return the ids that are linear-ready.
 */
export function deriveLinearReadyFromEvidence(params: {
  /** Catalog skill id → evidence, derived from practice history. */
  evidenceBySkill: ReadonlyMap<string, SkillEvidence>
  /** Skill ids whose manual `practiceLevel` is active (not `none`). */
  activeSkillIds: ReadonlySet<string>
  /** Categories the teacher has vetoed (kept off number sentences). */
  vetoedCategories: ReadonlySet<string>
}): Set<string> {
  const { evidenceBySkill, activeSkillIds, vetoedCategories } = params
  const frontierRank = computeFrontierRank(evidenceBySkill)
  const linearReady = new Set<string>()

  for (const skillId of activeSkillIds) {
    const rank = stageRank(skillId)
    if (rank === null || rank >= frontierRank) continue

    const evidence = evidenceBySkill.get(skillId)
    // Real evidence, not the vacuous 0-opportunity "solid" — a skill enters the
    // hardest modality only when the child has actually demonstrated it.
    if (!evidence || !evidence.isSolid || evidence.opportunities <= 0) continue

    const category = getSkillCategory(skillId)
    if (category === null || vetoedCategories.has(category)) continue

    linearReady.add(skillId)
  }

  return linearReady
}

// =============================================================================
// Adapter — wires the planner's data (history + BKT + mastery) into the core
// =============================================================================

/** Per-skill readiness for every staged skill, plus the reduced evidence the frontier uses. */
export function buildStagedSkillEvidence(
  problemHistory: ProblemResultWithContext[],
  bktResults: Map<string, SkillBktResult> | undefined
): {
  evidenceBySkill: Map<string, SkillEvidence>
  readinessBySkill: Map<string, SkillReadinessResult>
} {
  const evidenceBySkill = new Map<string, SkillEvidence>()
  const readinessBySkill = new Map<string, SkillReadinessResult>()
  for (const skillId of ALL_STAGED_SKILL_IDS) {
    const readiness = assessSkillReadiness(skillId, problemHistory, bktResults?.get(skillId))
    readinessBySkill.set(skillId, readiness)
    evidenceBySkill.set(skillId, {
      isSolid: readiness.isSolid,
      opportunities: readiness.dimensions.volume.opportunities,
    })
  }
  return { evidenceBySkill, readinessBySkill }
}

/** The stage currently holding number sentences back, and how close it is to solid. */
export interface LinearReadinessFrontier {
  rank: number
  category: SkillCategoryKey
  /** Category display name, e.g. "Basic Skills". */
  name: string
  skillIds: string[]
  /** Skills in the stage that are practiced AND solid. */
  solidCount: number
  total: number
}

export interface LinearReadinessSkillDetail {
  skillId: string
  stageRank: number
  readiness: SkillReadinessResult
}

export interface LinearReadinessExplanation {
  /** `null` once every non-exempt stage is solid (nothing left to unlock). */
  frontier: LinearReadinessFrontier | null
  /** Linear-ready skill ids after the teacher's category vetoes. */
  readySkillIds: Set<string>
  /** Linear-ready skill ids ignoring vetoes — lets callers tell "vetoed" from "not ready". */
  readyBeforeVetoSkillIds: Set<string>
  /** Readiness detail for each skill in the frontier stage (empty when `frontier` is null). */
  frontierSkills: LinearReadinessSkillDetail[]
}

function describeFrontier(
  frontierRank: number,
  evidenceBySkill: ReadonlyMap<string, SkillEvidence>
): LinearReadinessFrontier | null {
  const stage = STAGE_DEFS.find((s) => s.rank === frontierRank)
  if (!stage) return null
  const solidCount = stage.skillIds.filter((id) => {
    const e = evidenceBySkill.get(id)
    return e != null && e.opportunities > 0 && e.isSolid
  }).length
  return {
    rank: stage.rank,
    category: stage.category,
    name: getCategoryDisplayName(stage.category),
    skillIds: [...stage.skillIds],
    solidCount,
    total: stage.skillIds.length,
  }
}

/**
 * Pure explanation over pre-computed evidence: the frontier, the ready set with and
 * without vetoes, and the frontier stage's per-skill readiness (when supplied).
 */
export function explainLinearReadinessFromEvidence(params: {
  evidenceBySkill: ReadonlyMap<string, SkillEvidence>
  activeSkillIds: ReadonlySet<string>
  vetoedCategories: ReadonlySet<string>
  readinessBySkill?: ReadonlyMap<string, SkillReadinessResult>
}): LinearReadinessExplanation {
  const { evidenceBySkill, activeSkillIds, vetoedCategories, readinessBySkill } = params
  const readyBeforeVetoSkillIds = deriveLinearReadyFromEvidence({
    evidenceBySkill,
    activeSkillIds,
    vetoedCategories: new Set(),
  })
  const readySkillIds = new Set(
    [...readyBeforeVetoSkillIds].filter((id) => {
      const category = getSkillCategory(id)
      return category !== null && !vetoedCategories.has(category)
    })
  )
  const frontier = describeFrontier(computeFrontierRank(evidenceBySkill), evidenceBySkill)
  const frontierSkills: LinearReadinessSkillDetail[] = []
  if (frontier && readinessBySkill) {
    for (const skillId of frontier.skillIds) {
      const readiness = readinessBySkill.get(skillId)
      if (readiness) frontierSkills.push({ skillId, stageRank: frontier.rank, readiness })
    }
  }
  return { frontier, readySkillIds, readyBeforeVetoSkillIds, frontierSkills }
}

/**
 * Single-source readiness contract: everything the planner, the modal and the
 * dashboard need to agree on WHY number sentences are or aren't available.
 */
export function explainLinearReadiness(params: {
  skillMastery: Pick<PlayerSkillMastery, 'skillId' | 'practiceLevel'>[]
  problemHistory: ProblemResultWithContext[]
  bktResults: Map<string, SkillBktResult> | undefined
  vetoedCategories: ReadonlySet<string>
}): LinearReadinessExplanation {
  const { skillMastery, problemHistory, bktResults, vetoedCategories } = params
  const { evidenceBySkill, readinessBySkill } = buildStagedSkillEvidence(problemHistory, bktResults)
  const activeSkillIds = new Set(
    skillMastery.filter((s) => isActive(s.practiceLevel)).map((s) => s.skillId)
  )
  return explainLinearReadinessFromEvidence({
    evidenceBySkill,
    activeSkillIds,
    vetoedCategories,
    readinessBySkill,
  })
}

/**
 * Adapter used by the session planner: derive evidence from the student's
 * mastery rows, practice history and BKT results, then reduce to the
 * linear-ready ids. Requires nothing but the real catalog.
 */
export function deriveLinearReadySkills(params: {
  skillMastery: Pick<PlayerSkillMastery, 'skillId' | 'practiceLevel'>[]
  problemHistory: ProblemResultWithContext[]
  bktResults: Map<string, SkillBktResult> | undefined
  vetoedCategories: ReadonlySet<string>
}): Set<string> {
  return explainLinearReadiness(params).readySkillIds
}

/** Group a set of linear-ready skill ids by category (for the graduation banner). */
export function groupLinearReadyByCategory(
  skillIds: Iterable<string>
): Map<SkillCategoryKey, string[]> {
  const byCategory = new Map<SkillCategoryKey, string[]>()
  for (const skillId of skillIds) {
    const category = getSkillCategory(skillId)
    if (category === null) continue
    const list = byCategory.get(category)
    if (list) list.push(skillId)
    else byCategory.set(category, [skillId])
  }
  return byCategory
}
