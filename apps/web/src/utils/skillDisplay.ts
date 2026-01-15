/**
 * Skill Display Utilities
 *
 * Converts internal skill IDs to human-readable display names.
 * Uses SKILL_CATEGORIES from constants as the single source of truth.
 *
 * @example
 * getSkillDisplayName("fiveComplements.4=5-1") // "+4 = +5 - 1"
 * getCategoryDisplayName("fiveComplements") // "Five Complements (Addition)"
 */

import {
  SKILL_CATEGORIES,
  type SkillCategoryKey,
} from "@/constants/skillCategories";

/**
 * Get human-readable display name for a full skill ID
 *
 * @param fullSkillId - e.g., "fiveComplements.4=5-1" or "basic.directAddition"
 * @returns Human-readable name, e.g., "+4 = +5 - 1" or "Direct Addition (1-4)"
 *
 * @example
 * getSkillDisplayName("fiveComplements.4=5-1") // "+4 = +5 - 1"
 * getSkillDisplayName("basic.directAddition")  // "Direct Addition (1-4)"
 * getSkillDisplayName("tenComplements.9=10-1") // "+9 = +10 - 1"
 * getSkillDisplayName("unknown.skill")         // "skill" (graceful fallback)
 */
export function getSkillDisplayName(fullSkillId: string): string {
  const dotIndex = fullSkillId.indexOf(".");
  if (dotIndex === -1) return fullSkillId;

  const category = fullSkillId.slice(0, dotIndex);
  const shortKey = fullSkillId.slice(dotIndex + 1);

  const categoryData = SKILL_CATEGORIES[category as SkillCategoryKey];
  if (!categoryData) return shortKey || fullSkillId;

  const skills = categoryData.skills as Record<string, string>;
  return skills[shortKey] || shortKey || fullSkillId;
}

/**
 * Get category display name from category ID
 *
 * @param categoryId - e.g., "fiveComplements" or "tenComplementsSub"
 * @returns Human-readable category name
 *
 * @example
 * getCategoryDisplayName("fiveComplements")    // "Five Complements (Addition)"
 * getCategoryDisplayName("tenComplementsSub")  // "Ten Complements (Subtraction)"
 * getCategoryDisplayName("basic")              // "Basic Skills"
 * getCategoryDisplayName("unknown")            // "unknown" (graceful fallback)
 */
export function getCategoryDisplayName(categoryId: string): string {
  const categoryData = SKILL_CATEGORIES[categoryId as SkillCategoryKey];
  return categoryData?.name || categoryId;
}

/**
 * Parse a full skill ID into category and short key
 *
 * @param fullSkillId - e.g., "fiveComplements.4=5-1"
 * @returns Object with category and shortKey
 *
 * @example
 * parseSkillId("fiveComplements.4=5-1") // { category: "fiveComplements", shortKey: "4=5-1" }
 * parseSkillId("noCategory")             // { category: "", shortKey: "noCategory" }
 */
export function parseSkillId(fullSkillId: string): {
  category: string;
  shortKey: string;
} {
  const dotIndex = fullSkillId.indexOf(".");
  if (dotIndex === -1) {
    return { category: "", shortKey: fullSkillId };
  }
  return {
    category: fullSkillId.slice(0, dotIndex),
    shortKey: fullSkillId.slice(dotIndex + 1),
  };
}

/**
 * Check if a category ID is valid
 */
export function isValidCategory(
  categoryId: string,
): categoryId is SkillCategoryKey {
  return categoryId in SKILL_CATEGORIES;
}

/**
 * Get all skill IDs in a category with their display names
 *
 * @param categoryId - e.g., "fiveComplements"
 * @returns Array of { id, displayName } objects, or empty array if invalid category
 */
export function getSkillsInCategory(
  categoryId: string,
): Array<{ id: string; displayName: string }> {
  const categoryData = SKILL_CATEGORIES[categoryId as SkillCategoryKey];
  if (!categoryData) return [];

  const skills = categoryData.skills as Record<string, string>;
  return Object.entries(skills).map(([shortKey, displayName]) => ({
    id: `${categoryId}.${shortKey}`,
    displayName,
  }));
}
