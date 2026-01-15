/**
 * Skill Search Utilities
 *
 * Functions for searching and filtering skills by name.
 */

import {
  SKILL_CATEGORIES,
  getFullSkillId,
  type SkillCategoryKey,
} from "@/constants/skillCategories";

/**
 * Skill search result
 */
export interface SkillSearchResult {
  /** Full skill ID (e.g., "fiveComplements.4=5-1") */
  skillId: string;
  /** Display name (e.g., "+4 = +5 - 1") */
  displayName: string;
  /** Category key */
  category: SkillCategoryKey;
  /** Category display name */
  categoryName: string;
}

/**
 * Build a flat list of all skills with their display information.
 */
function buildSkillList(): SkillSearchResult[] {
  const results: SkillSearchResult[] = [];

  for (const [categoryKey, category] of Object.entries(SKILL_CATEGORIES)) {
    for (const [shortKey, displayName] of Object.entries(category.skills)) {
      results.push({
        skillId: getFullSkillId(categoryKey as SkillCategoryKey, shortKey),
        displayName,
        category: categoryKey as SkillCategoryKey,
        categoryName: category.name,
      });
    }
  }

  return results;
}

// Pre-built skill list for performance
const allSkills = buildSkillList();

/**
 * Search for skills matching a query string.
 *
 * Matches against:
 * - Skill display name (e.g., "+4 = +5 - 1")
 * - Category name (e.g., "Five Complements")
 *
 * @param query - Search query (case-insensitive)
 * @returns Matching skills, sorted by relevance
 */
export function searchSkills(query: string): SkillSearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const lowerQuery = query.toLowerCase();

  // Filter skills matching the query
  const matches = allSkills.filter((skill) => {
    const displayLower = skill.displayName.toLowerCase();
    const categoryLower = skill.categoryName.toLowerCase();

    return (
      displayLower.includes(lowerQuery) || categoryLower.includes(lowerQuery)
    );
  });

  // Sort by relevance:
  // 1. Exact display name match (starts with)
  // 2. Category name match
  // 3. Partial match
  matches.sort((a, b) => {
    const aDisplayLower = a.displayName.toLowerCase();
    const bDisplayLower = b.displayName.toLowerCase();

    const aStartsWith = aDisplayLower.startsWith(lowerQuery);
    const bStartsWith = bDisplayLower.startsWith(lowerQuery);

    if (aStartsWith && !bStartsWith) return -1;
    if (bStartsWith && !aStartsWith) return 1;

    // Then sort by category name
    return a.categoryName.localeCompare(b.categoryName);
  });

  return matches;
}

/**
 * Get all skills in a category.
 */
export function getSkillsInCategory(
  category: SkillCategoryKey,
): SkillSearchResult[] {
  return allSkills.filter((skill) => skill.category === category);
}

/**
 * Get all skills.
 */
export function getAllSkills(): SkillSearchResult[] {
  return [...allSkills];
}

/**
 * Get display name for a skill ID.
 *
 * @param skillId - Full skill ID (e.g., "fiveComplements.4=5-1")
 * @returns Display name or the skillId if not found
 */
export function getSkillDisplayName(skillId: string): string {
  const skill = allSkills.find((s) => s.skillId === skillId);
  return skill?.displayName ?? skillId;
}

/**
 * Get category display name for a skill ID.
 */
export function getSkillCategoryDisplayName(skillId: string): string {
  const skill = allSkills.find((s) => s.skillId === skillId);
  return skill?.categoryName ?? "Unknown";
}

/**
 * Format a skill for display in filter pills.
 *
 * Returns a short name suitable for a chip/pill.
 */
export function formatSkillChipName(skillId: string): string {
  const skill = allSkills.find((s) => s.skillId === skillId);
  if (!skill) {
    return skillId;
  }

  // Use a shortened category name for the chip
  const shortNames: Record<SkillCategoryKey, string> = {
    basic: "Basic",
    fiveComplements: "5's Add",
    fiveComplementsSub: "5's Sub",
    tenComplements: "10's Add",
    tenComplementsSub: "10's Sub",
    advanced: "Advanced",
  };

  const categoryShort = shortNames[skill.category];

  // Extract the operation from the display name (e.g., "+4" from "+4 = +5 - 1")
  const opMatch = skill.displayName.match(/^([+-]?\d+)/);
  const op = opMatch ? opMatch[1] : "";

  return op ? `${categoryShort}: ${op}` : categoryShort;
}
