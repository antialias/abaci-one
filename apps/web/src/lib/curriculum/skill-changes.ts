/**
 * Skill Changes - Utility for computing skill state changes
 *
 * This module computes what has changed between when a session was created
 * and the current skill state, helping users decide whether to resume
 * an existing session or start fresh.
 */

import type { SkillBktResult } from "@/lib/curriculum/bkt";
import { BKT_THRESHOLDS } from "@/lib/curriculum/config/bkt-integration";
import { getSkillDisplayName } from "@/lib/curriculum/skill-tutorial-config";

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a skill for display purposes
 */
export interface SkillChangeInfo {
  skillId: string;
  displayName: string;
  /** P(known) from BKT, 0-1 */
  pKnown: number;
}

/**
 * Summary of skill changes since a session was created
 */
export interface SkillChanges {
  /** Skills now classified as weak (P(known) < 0.5) that need attention */
  newWeakSkills: SkillChangeInfo[];
  /** Skills added to practice since session created */
  newPracticingSkills: string[];
  /** Skills removed from practice since session created */
  removedSkills: string[];
  /** Skills now classified as strong (P(known) >= 0.8) */
  masteredSkills: string[];
  /** Whether there are any significant changes */
  hasChanges: boolean;
}

// ============================================================================
// Computation
// ============================================================================

/**
 * Compute skill changes between session creation and current state.
 *
 * @param sessionSkillIds - Skill IDs that were practicing when session was created
 * @param currentPracticingSkillIds - Skill IDs currently practicing
 * @param bktResults - Current BKT results for all skills
 * @returns Summary of skill changes
 */
export function computeSkillChanges(
  sessionSkillIds: string[],
  currentPracticingSkillIds: string[],
  bktResults: Map<string, SkillBktResult>,
): SkillChanges {
  const sessionSet = new Set(sessionSkillIds);
  const currentSet = new Set(currentPracticingSkillIds);

  // Skills added since session created
  const newPracticingSkills = currentPracticingSkillIds.filter(
    (id) => !sessionSet.has(id),
  );

  // Skills removed since session created
  const removedSkills = sessionSkillIds.filter((id) => !currentSet.has(id));

  // Find skills that are now weak (need attention)
  const newWeakSkills: SkillChangeInfo[] = [];
  const masteredSkills: string[] = [];

  for (const skillId of currentPracticingSkillIds) {
    const bkt = bktResults.get(skillId);
    if (!bkt || bkt.confidence < BKT_THRESHOLDS.confidence) {
      // Not enough data to classify
      continue;
    }

    if (bkt.pKnown < BKT_THRESHOLDS.weak) {
      newWeakSkills.push({
        skillId,
        displayName: getSkillDisplayName(skillId),
        pKnown: bkt.pKnown,
      });
    } else if (bkt.pKnown >= BKT_THRESHOLDS.strong) {
      masteredSkills.push(skillId);
    }
  }

  // Sort weak skills by pKnown ascending (weakest first)
  newWeakSkills.sort((a, b) => a.pKnown - b.pKnown);

  const hasChanges =
    newWeakSkills.length > 0 ||
    newPracticingSkills.length > 0 ||
    removedSkills.length > 0 ||
    masteredSkills.length > 0;

  return {
    newWeakSkills,
    newPracticingSkills,
    removedSkills,
    masteredSkills,
    hasChanges,
  };
}

/**
 * Format skill changes for display in the banner.
 *
 * @param changes - Computed skill changes
 * @returns Array of formatted change descriptions
 */
export function formatSkillChanges(changes: SkillChanges): string[] {
  const descriptions: string[] = [];

  if (changes.newWeakSkills.length > 0) {
    const skillNames = changes.newWeakSkills
      .map((s) => s.displayName)
      .join(", ");
    descriptions.push(
      `💪 ${changes.newWeakSkills.length} skill${changes.newWeakSkills.length > 1 ? "s" : ""} need attention: ${skillNames}`,
    );
  }

  if (changes.newPracticingSkills.length > 0) {
    const skillNames = changes.newPracticingSkills
      .map(getSkillDisplayName)
      .join(", ");
    descriptions.push(
      `➕ ${changes.newPracticingSkills.length} skill${changes.newPracticingSkills.length > 1 ? "s" : ""} added: ${skillNames}`,
    );
  }

  if (changes.removedSkills.length > 0) {
    const skillNames = changes.removedSkills
      .map(getSkillDisplayName)
      .join(", ");
    descriptions.push(
      `➖ ${changes.removedSkills.length} skill${changes.removedSkills.length > 1 ? "s" : ""} removed: ${skillNames}`,
    );
  }

  if (changes.masteredSkills.length > 0) {
    const skillNames = changes.masteredSkills
      .map(getSkillDisplayName)
      .join(", ");
    descriptions.push(
      `✨ ${changes.masteredSkills.length} skill${changes.masteredSkills.length > 1 ? "s" : ""} now strong: ${skillNames}`,
    );
  }

  return descriptions;
}
