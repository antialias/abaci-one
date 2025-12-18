/**
 * Skill Unlock System (Server-Side)
 *
 * Determines the next skill a student should learn based on:
 * 1. Current strong skills (from BKT)
 * 2. Current practicing skills (from playerSkillMastery)
 * 3. Curriculum order (from definitions.ts)
 *
 * The algorithm walks through curriculum phases linearly:
 * - If skill is STRONG → skip (they know it)
 * - If skill is being PRACTICED → return null (they're working on it)
 * - Otherwise → this is the next skill to learn
 *
 * NOTE: Client-safe config and helpers are in skill-tutorial-config.ts
 */

import { computeBktFromHistory, DEFAULT_BKT_OPTIONS } from '@/lib/curriculum/bkt'
import { BKT_THRESHOLDS } from '@/lib/curriculum/config/bkt-integration'
import { ALL_PHASES, type CurriculumPhase } from '@/lib/curriculum/definitions'
import {
  getPracticingSkills,
  getSkillTutorialProgress,
  isSkillTutorialSatisfied,
} from '@/lib/curriculum/progress-manager'
import { getRecentSessionResults } from '@/lib/curriculum/session-planner'

// Import client-safe config for internal use
import { SKILL_TUTORIAL_CONFIGS, getSkillDisplayName } from './skill-tutorial-config'

// Re-export client-safe types and functions for external consumers
export {
  type SkillTutorialConfig,
  SKILL_TUTORIAL_CONFIGS,
  getSkillTutorialConfig,
  getSkillDisplayName,
} from './skill-tutorial-config'

// ============================================================================
// Types
// ============================================================================

export interface SkillSuggestion {
  /** The skill ID to learn next */
  skillId: string
  /** The curriculum phase this skill belongs to */
  phase: CurriculumPhase
  /** Whether the tutorial is already completed (or teacher override applied) */
  tutorialReady: boolean
  /** Number of times the student has skipped this tutorial */
  skipCount: number
}

export interface SkillAnomaly {
  skillId: string
  displayName: string
  type: 'mastered_not_practicing' | 'repeatedly_skipped'
  details: string
  /** For mastered_not_practicing: the BKT P(known) estimate */
  pKnown?: number
  /** For repeatedly_skipped: number of times the tutorial was skipped */
  skipCount?: number
  /** For mastered_not_practicing: the phase this skill belongs to */
  phase?: CurriculumPhase
}

// ============================================================================
// Next Skill Algorithm
// ============================================================================

/**
 * Find the next skill the student should learn.
 *
 * Algorithm: Walk through curriculum phases in order.
 * - If skill is STRONG → skip (they know it)
 * - If skill is PRACTICING → return null (they're working on it)
 * - Otherwise → this is the next skill to learn
 *
 * @param playerId - The player to check
 * @returns The next skill to learn, or null if all skills are being worked on
 */
export async function getNextSkillToLearn(playerId: string): Promise<SkillSuggestion | null> {
  // 1. Get strong skills from BKT
  const history = await getRecentSessionResults(playerId, 100)
  const bktResults = computeBktFromHistory(history, {
    ...DEFAULT_BKT_OPTIONS,
    confidenceThreshold: BKT_THRESHOLDS.confidence,
  })
  const strongSkillIds = new Set(
    bktResults.skills.filter((s) => s.masteryClassification === 'strong').map((s) => s.skillId)
  )

  // 2. Get currently practicing skills
  const practicing = await getPracticingSkills(playerId)
  const practicingIds = new Set(practicing.map((s) => s.skillId))

  // 3. Walk curriculum in order
  for (const phase of ALL_PHASES) {
    const skillId = phase.primarySkillId

    // Skip if no tutorial config (not a learnable skill)
    if (!SKILL_TUTORIAL_CONFIGS[skillId]) {
      continue
    }

    // Strong? Skip - they know it
    if (strongSkillIds.has(skillId)) {
      continue
    }

    // Currently practicing? They're working on it - no new suggestion
    if (practicingIds.has(skillId)) {
      return null
    }

    // Found first non-strong, unpracticed skill!
    const tutorialProgress = await getSkillTutorialProgress(playerId, skillId)
    const tutorialReady = await isSkillTutorialSatisfied(playerId, skillId)

    return {
      skillId,
      phase,
      tutorialReady,
      skipCount: tutorialProgress?.skipCount ?? 0,
    }
  }

  // All phases complete - curriculum finished!
  return null
}

/**
 * Get anomalies for teacher dashboard.
 * Returns skills that are in unusual states that may need attention.
 */
export async function getSkillAnomalies(playerId: string): Promise<SkillAnomaly[]> {
  const anomalies: SkillAnomaly[] = []

  // Get strong and practicing sets
  const history = await getRecentSessionResults(playerId, 100)
  const bktResults = computeBktFromHistory(history, {
    ...DEFAULT_BKT_OPTIONS,
    confidenceThreshold: BKT_THRESHOLDS.confidence,
  })
  const strongSkillIds = new Set(
    bktResults.skills.filter((s) => s.masteryClassification === 'strong').map((s) => s.skillId)
  )

  const practicing = await getPracticingSkills(playerId)
  const practicingIds = new Set(practicing.map((s) => s.skillId))

  // Build a map of BKT results for looking up pKnown
  const bktMap = new Map(bktResults.skills.map((s) => [s.skillId, s]))

  // Find strong but not practicing
  for (const skillId of strongSkillIds) {
    if (!practicingIds.has(skillId)) {
      const phase = ALL_PHASES.find((p) => p.primarySkillId === skillId)
      const bkt = bktMap.get(skillId)
      anomalies.push({
        skillId,
        displayName: getSkillDisplayName(skillId),
        type: 'mastered_not_practicing',
        details: 'Skill is strong according to BKT but not in practice rotation',
        pKnown: bkt?.pKnown,
        phase,
      })
    }
  }

  // Find repeatedly skipped tutorials
  const { getRepeatedlySkippedTutorials } = await import('./progress-manager')
  const skippedTutorials = await getRepeatedlySkippedTutorials(playerId, 3)
  for (const progress of skippedTutorials) {
    anomalies.push({
      skillId: progress.skillId,
      displayName: getSkillDisplayName(progress.skillId),
      type: 'repeatedly_skipped',
      details: `Tutorial has been skipped ${progress.skipCount} times`,
      skipCount: progress.skipCount,
    })
  }

  return anomalies
}
