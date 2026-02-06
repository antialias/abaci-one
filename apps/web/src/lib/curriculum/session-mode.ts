/**
 * Session Mode - Unified session state computation
 *
 * This module provides a single source of truth for determining what mode
 * a student's practice session should be in:
 *
 * - remediation: Student has weak skills that need strengthening
 * - progression: Student is ready to learn a new skill
 * - maintenance: All skills are strong, mixed practice
 *
 * The session mode drives:
 * - Dashboard banners
 * - StartPracticeModal CTA
 * - Session planner problem generation
 */

import { computeBktFromHistory, DEFAULT_BKT_OPTIONS } from '@/lib/curriculum/bkt'
import { BKT_THRESHOLDS } from '@/lib/curriculum/config/bkt-integration'
import { WEAK_SKILL_THRESHOLDS } from '@/lib/curriculum/config'
import { ALL_PHASES, type CurriculumPhase } from '@/lib/curriculum/definitions'
import {
  getPracticingSkills,
  getSkillTutorialProgress,
  isSkillTutorialSatisfied,
} from '@/lib/curriculum/progress-manager'
import { getRecentSessionResults } from '@/lib/curriculum/session-planner'
import {
  assessAllSkillsReadiness,
  readinessMapToRecord,
  type SkillReadinessResult,
} from '@/lib/curriculum/skill-readiness'
import { getActiveDeferral } from '@/lib/curriculum/progression-deferrals'
import { SKILL_TUTORIAL_CONFIGS, getSkillDisplayName } from './skill-tutorial-config'

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a skill for display purposes
 */
export interface SkillInfo {
  skillId: string
  displayName: string
  /** P(known) from BKT, 0-1 */
  pKnown: number
}

/**
 * Information about a blocked promotion (when remediation is needed)
 */
export interface BlockedPromotion {
  /** The skill the student would learn if not blocked */
  nextSkill: SkillInfo
  /** Human-readable reason for the block */
  reason: string
  /** The curriculum phase of the blocked skill */
  phase: CurriculumPhase
  /** Whether the tutorial is already satisfied */
  tutorialReady: boolean
}

/**
 * Remediation mode - student has weak skills that need work
 */
export interface RemediationMode {
  type: 'remediation'
  /** Skills that need strengthening (sorted by pKnown ascending) */
  weakSkills: SkillInfo[]
  /** Description for the session header */
  focusDescription: string
  /** What promotion is being blocked, if any */
  blockedPromotion?: BlockedPromotion
}

/**
 * Progression mode - student is ready to learn a new skill
 */
export interface ProgressionMode {
  type: 'progression'
  /** The skill to learn next */
  nextSkill: SkillInfo
  /** The curriculum phase */
  phase: CurriculumPhase
  /** Whether a tutorial is required before practicing */
  tutorialRequired: boolean
  /** Number of times the student has skipped this tutorial */
  skipCount: number
  /** Description for the session header */
  focusDescription: string
  /**
   * Whether the student can skip the tutorial and still practice.
   * False when this is their first skill (no other skills to practice).
   * When false, the tutorial is mandatory - skipping would result in no skills.
   */
  canSkipTutorial: boolean
}

/**
 * Maintenance mode - all skills are strong, mixed practice
 */
export interface MaintenanceMode {
  type: 'maintenance'
  /** Description for the session header */
  focusDescription: string
  /** Number of skills being maintained */
  skillCount: number
  /** Present when progression is available but not all dimensions are met or deferred */
  deferredProgression?: {
    nextSkill: SkillInfo
    readiness: Record<string, SkillReadinessResult>
    phase: CurriculumPhase
  }
}

/**
 * The unified session mode
 */
export type SessionMode = RemediationMode | ProgressionMode | MaintenanceMode

// ============================================================================
// Session Mode Computation
// ============================================================================

/**
 * Compute the session mode for a student.
 *
 * This is the single source of truth for what type of session should be run.
 * The result drives dashboard display, modal CTA, and problem generation.
 *
 * Logic:
 * 1. Compute BKT to identify weak and strong skills
 * 2. If weak skills exist → remediation mode
 * 3. Else, find next skill in curriculum:
 *    - If found → progression mode
 *    - If not found → maintenance mode
 *
 * @param playerId - The player to compute mode for
 * @returns The session mode
 */
export async function getSessionMode(playerId: string): Promise<SessionMode> {
  // 1. Get BKT results for all practiced skills
  const history = await getRecentSessionResults(playerId, 100)
  const bktResults = computeBktFromHistory(history, {
    ...DEFAULT_BKT_OPTIONS,
    confidenceThreshold: BKT_THRESHOLDS.confidence,
  })

  // 2. Identify weak skills (confident that P(known) is low)
  const { confidenceThreshold, pKnownThreshold } = WEAK_SKILL_THRESHOLDS
  const weakSkills: SkillInfo[] = bktResults.skills
    .filter((s) => s.confidence >= confidenceThreshold && s.pKnown < pKnownThreshold)
    .sort((a, b) => a.pKnown - b.pKnown) // Weakest first
    .map((s) => ({
      skillId: s.skillId,
      displayName: getSkillDisplayName(s.skillId),
      pKnown: s.pKnown,
    }))

  // 3. Find strong skills for maintenance mode counting
  const strongSkillIds = new Set(
    bktResults.skills.filter((s) => s.masteryClassification === 'strong').map((s) => s.skillId)
  )

  // 4. Get currently practicing skills
  const practicing = await getPracticingSkills(playerId)
  const practicingIds = new Set(practicing.map((s) => s.skillId))

  // 5. Find the next skill in curriculum (if any)
  let nextSkillInfo: {
    skillId: string
    phase: CurriculumPhase
    tutorialReady: boolean
    skipCount: number
  } | null = null

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

    // Currently practicing? They're working on it
    if (practicingIds.has(skillId)) {
      break // Stop looking, they're actively working on something
    }

    // Found first non-strong, unpracticed skill!
    const tutorialProgress = await getSkillTutorialProgress(playerId, skillId)
    const tutorialReady = await isSkillTutorialSatisfied(playerId, skillId)

    nextSkillInfo = {
      skillId,
      phase,
      tutorialReady,
      skipCount: tutorialProgress?.skipCount ?? 0,
    }
    break
  }

  // 6. Determine mode based on weak skills and next skill
  if (weakSkills.length > 0) {
    // REMEDIATION MODE
    const weakSkillNames = weakSkills.slice(0, 3).map((s) => s.displayName)
    const moreCount = weakSkills.length - 3
    const skillList =
      moreCount > 0
        ? `${weakSkillNames.join(', ')} +${moreCount} more`
        : weakSkillNames.join(weakSkills.length === 2 ? ' and ' : ', ')

    const focusDescription = `Strengthening: ${skillList}`

    // Check if there's a promotion being blocked
    let blockedPromotion: BlockedPromotion | undefined
    if (nextSkillInfo) {
      const nextSkillDisplay = getSkillDisplayName(nextSkillInfo.skillId)
      blockedPromotion = {
        nextSkill: {
          skillId: nextSkillInfo.skillId,
          displayName: nextSkillDisplay,
          pKnown: 0, // Not yet practiced
        },
        reason: `Strengthen ${weakSkillNames.slice(0, 2).join(' and ')} first`,
        phase: nextSkillInfo.phase,
        tutorialReady: nextSkillInfo.tutorialReady,
      }
    }

    return {
      type: 'remediation',
      weakSkills,
      focusDescription,
      blockedPromotion,
    }
  }

  if (nextSkillInfo) {
    const nextSkillDisplay = getSkillDisplayName(nextSkillInfo.skillId)
    const nextSkill: SkillInfo = {
      skillId: nextSkillInfo.skillId,
      displayName: nextSkillDisplay,
      pKnown: 0, // Not yet practiced
    }

    // Gate: only offer progression if ALL practicing skills are solid (all 4 dimensions met)
    // First skill ever (practicingIds.size === 0): skip readiness gate — tutorial is mandatory
    const readiness = assessAllSkillsReadiness(history, bktResults.skills, practicingIds)
    const allSolid =
      practicingIds.size === 0 ||
      [...practicingIds].every((id) => readiness.get(id)?.isSolid ?? false)

    if (allSolid) {
      // Check for active deferral
      const deferral = await getActiveDeferral(playerId, nextSkillInfo.skillId)

      if (!deferral) {
        // PROGRESSION MODE
        // Student can skip tutorial only if they have other skills to practice.
        // If this is their first skill (no practicing skills yet), skipping would
        // result in NoSkillsEnabledClientError - so we must prevent skip.
        const canSkipTutorial = practicingIds.size > 0

        return {
          type: 'progression',
          nextSkill,
          phase: nextSkillInfo.phase,
          tutorialRequired: !nextSkillInfo.tutorialReady,
          skipCount: nextSkillInfo.skipCount,
          focusDescription: `Learning: ${nextSkillDisplay}`,
          canSkipTutorial,
        }
      }
    }

    // MAINTENANCE MODE with deferred progression info
    return {
      type: 'maintenance',
      focusDescription: 'Mixed practice',
      skillCount: practicingIds.size,
      deferredProgression: {
        nextSkill,
        readiness: readinessMapToRecord(readiness),
        phase: nextSkillInfo.phase,
      },
    }
  }

  // MAINTENANCE MODE
  return {
    type: 'maintenance',
    focusDescription: 'Mixed practice',
    skillCount: practicingIds.size,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if session mode indicates remediation is needed
 */
export function isRemediationMode(mode: SessionMode): mode is RemediationMode {
  return mode.type === 'remediation'
}

/**
 * Check if session mode indicates progression is available
 */
export function isProgressionMode(mode: SessionMode): mode is ProgressionMode {
  return mode.type === 'progression'
}

/**
 * Check if session mode indicates maintenance
 */
export function isMaintenanceMode(mode: SessionMode): mode is MaintenanceMode {
  return mode.type === 'maintenance'
}

/**
 * Get the weak skill IDs from a session mode (for session planner)
 */
export function getWeakSkillIds(mode: SessionMode): string[] {
  if (mode.type === 'remediation') {
    return mode.weakSkills.map((s) => s.skillId)
  }
  return []
}
