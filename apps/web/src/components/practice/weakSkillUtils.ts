/**
 * Weak Skill Detection Utilities
 *
 * Identifies which skills are weak based on BKT mastery data.
 * Used in ProblemToReview to surface likely causes of errors.
 */

import type {
  MasteryClassification,
  SkillBktResult,
} from "@/lib/curriculum/bkt";

/**
 * A skill that was exercised in a problem, with mastery info
 */
export interface WeakSkillInfo {
  /** The skill ID (e.g., "fiveComplements.4=5-1") */
  skillId: string;
  /** P(known) from BKT - probability student has mastered this [0, 1] */
  pKnown: number;
  /** Mastery classification: 'weak', 'developing', or 'strong' */
  classification: MasteryClassification;
  /** Formatted display label (e.g., "5's: 4=5-1") */
  displayLabel: string;
  /** Mastery percentage for display (e.g., 23 for 23%) */
  masteryPercent: number;
}

/**
 * Result of weak skill analysis for a problem
 */
export interface WeakSkillsForProblem {
  /** All weak/developing skills for this problem, ordered by severity (lowest pKnown first) */
  weakSkills: WeakSkillInfo[];
  /** Number of additional skills not shown in display (for "+N more" indicator) */
  hiddenCount: number;
  /** Skills to display (limited to maxDisplay) */
  displaySkills: WeakSkillInfo[];
}

/**
 * Format a skill ID into a human-readable label
 *
 * Examples:
 * - "fiveComplements.4=5-1" → "5's: 4=5-1"
 * - "tenComplements.8=10-2" → "10's: 8=10-2"
 * - "basic.directAddition" → "direct addition"
 */
export function formatSkillLabel(skillId: string): string {
  const parts = skillId.split(".");
  if (parts.length === 2) {
    const [category, specific] = parts;
    if (category === "fiveComplements" || category === "fiveComplementsSub") {
      return `5's: ${specific}`;
    }
    if (category === "tenComplements" || category === "tenComplementsSub") {
      return `10's: ${specific}`;
    }
    if (category === "basic") {
      // Convert camelCase to space-separated lowercase
      return specific
        .replace(/([A-Z])/g, " $1")
        .toLowerCase()
        .trim();
    }
    return specific;
  }
  return skillId;
}

/**
 * Get weak skills for a problem based on BKT data
 *
 * @param skillsExercised - Skill IDs that were used in this problem
 * @param skillMasteries - Map of skillId → SkillBktResult from BKT computation
 * @param maxDisplay - Maximum number of skills to return in displaySkills (default: 3)
 * @returns WeakSkillsForProblem with skills ordered by severity
 */
export function getWeakSkillsForProblem(
  skillsExercised: string[],
  skillMasteries: Map<string, SkillBktResult> | Record<string, SkillBktResult>,
  maxDisplay = 3,
): WeakSkillsForProblem {
  // Convert Record to Map if needed
  const masteryMap =
    skillMasteries instanceof Map
      ? skillMasteries
      : new Map(Object.entries(skillMasteries));

  // Get BKT info for each exercised skill
  const skillsWithMastery: WeakSkillInfo[] = skillsExercised
    .map((skillId) => {
      const bkt = masteryMap.get(skillId);
      if (!bkt) {
        // No BKT data - treat as unknown/weak
        return {
          skillId,
          pKnown: 0.5, // Assume developing if no data
          classification: "developing" as MasteryClassification,
          displayLabel: formatSkillLabel(skillId),
          masteryPercent: 50,
        };
      }
      return {
        skillId,
        pKnown: bkt.pKnown,
        classification: bkt.masteryClassification,
        displayLabel: formatSkillLabel(skillId),
        masteryPercent: Math.round(bkt.pKnown * 100),
      };
    })
    // Filter to only weak and developing skills (exclude strong)
    .filter((skill) => skill.classification !== "strong")
    // Sort by pKnown ascending (weakest first)
    .sort((a, b) => a.pKnown - b.pKnown);

  // Calculate display subset
  const displaySkills = skillsWithMastery.slice(0, maxDisplay);
  const hiddenCount = Math.max(0, skillsWithMastery.length - maxDisplay);

  return {
    weakSkills: skillsWithMastery,
    displaySkills,
    hiddenCount,
  };
}

/**
 * Check if a skill is a "likely cause" of an error
 *
 * A skill is considered a likely cause if:
 * - It has classification 'weak'
 * - OR it has pKnown below 0.5
 */
export function isLikelyCause(skill: WeakSkillInfo): boolean {
  return skill.classification === "weak" || skill.pKnown < 0.5;
}

/**
 * Format a compact weak skills summary for collapsed view
 *
 * Example: "5's: 4=5-1, 10's: 8=10-2  (+1 more)"
 */
export function formatWeakSkillsSummary(result: WeakSkillsForProblem): string {
  if (result.displaySkills.length === 0) {
    return "";
  }

  const labels = result.displaySkills.map((s) => s.displayLabel).join(", ");
  const moreIndicator =
    result.hiddenCount > 0 ? `  (+${result.hiddenCount} more)` : "";

  return `${labels}${moreIndicator}`;
}

/**
 * Get the weakest skill from a problem (the most likely cause of error)
 */
export function getWeakestSkill(
  result: WeakSkillsForProblem,
): WeakSkillInfo | null {
  return result.weakSkills[0] ?? null;
}
