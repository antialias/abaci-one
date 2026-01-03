/**
 * Skill categories and their human-readable names
 *
 * This is the single source of truth for skill groupings used in:
 * - ManualSkillSelector (manage skills modal)
 * - StudentSelector (student grouping by skill category)
 * - Skill search and filtering
 *
 * Order determines priority for student grouping (first = highest level)
 */
export const SKILL_CATEGORIES = {
  advanced: {
    name: "Advanced Multi-Column Operations",
    skills: {
      cascadingCarry: "Cascading Carry (e.g., 999 + 1 = 1000)",
      cascadingBorrow: "Cascading Borrow (e.g., 1000 - 1 = 999)",
    },
  },
  tenComplementsSub: {
    name: "Ten Complements (Subtraction)",
    skills: {
      "-9=+1-10": "-9 = +1 - 10",
      "-8=+2-10": "-8 = +2 - 10",
      "-7=+3-10": "-7 = +3 - 10",
      "-6=+4-10": "-6 = +4 - 10",
      "-5=+5-10": "-5 = +5 - 10",
      "-4=+6-10": "-4 = +6 - 10",
      "-3=+7-10": "-3 = +7 - 10",
      "-2=+8-10": "-2 = +8 - 10",
      "-1=+9-10": "-1 = +9 - 10",
    },
  },
  tenComplements: {
    name: "Ten Complements (Addition)",
    skills: {
      "9=10-1": "+9 = +10 - 1",
      "8=10-2": "+8 = +10 - 2",
      "7=10-3": "+7 = +10 - 3",
      "6=10-4": "+6 = +10 - 4",
      "5=10-5": "+5 = +10 - 5",
      "4=10-6": "+4 = +10 - 6",
      "3=10-7": "+3 = +10 - 7",
      "2=10-8": "+2 = +10 - 8",
      "1=10-9": "+1 = +10 - 9",
    },
  },
  fiveComplementsSub: {
    name: "Five Complements (Subtraction)",
    skills: {
      "-4=-5+1": "-4 = -5 + 1",
      "-3=-5+2": "-3 = -5 + 2",
      "-2=-5+3": "-2 = -5 + 3",
      "-1=-5+4": "-1 = -5 + 4",
    },
  },
  fiveComplements: {
    name: "Five Complements (Addition)",
    skills: {
      "4=5-1": "+4 = +5 - 1",
      "3=5-2": "+3 = +5 - 2",
      "2=5-3": "+2 = +5 - 3",
      "1=5-4": "+1 = +5 - 4",
    },
  },
  basic: {
    name: "Basic Skills",
    skills: {
      directAddition: "Direct Addition (1-4)",
      heavenBead: "Heaven Bead (5)",
      simpleCombinations: "Simple Combinations (6-9)",
      directSubtraction: "Direct Subtraction (1-4)",
      heavenBeadSubtraction: "Heaven Bead Subtraction (5)",
      simpleCombinationsSub: "Simple Combinations Subtraction (6-9)",
    },
  },
} as const;

export type SkillCategoryKey = keyof typeof SKILL_CATEGORIES;

/**
 * Priority order for skill categories (highest level first)
 * This determines which category a student is grouped into
 */
export const CATEGORY_PRIORITY: SkillCategoryKey[] = [
  "advanced",
  "tenComplementsSub",
  "tenComplements",
  "fiveComplementsSub",
  "fiveComplements",
  "basic",
];

/**
 * Convert a short skill key (e.g., "4=5-1") to a full skill ID (e.g., "fiveComplements.4=5-1")
 */
export function getFullSkillId(
  category: SkillCategoryKey,
  shortKey: string,
): string {
  return `${category}.${shortKey}`;
}

/**
 * Build a map of full skill IDs to their categories for fast lookup
 */
export function buildSkillToCategoryMap(): Map<string, SkillCategoryKey> {
  const map = new Map<string, SkillCategoryKey>();
  for (const [categoryKey, category] of Object.entries(SKILL_CATEGORIES)) {
    for (const shortKey of Object.keys(category.skills)) {
      map.set(
        getFullSkillId(categoryKey as SkillCategoryKey, shortKey),
        categoryKey as SkillCategoryKey,
      );
    }
  }
  return map;
}

// Pre-built map for performance
const skillToCategoryMap = buildSkillToCategoryMap();

/**
 * Get the category for a full skill ID
 */
export function getSkillCategory(skillId: string): SkillCategoryKey | null {
  return skillToCategoryMap.get(skillId) ?? null;
}

/**
 * Get all skill IDs for a category
 */
export function getCategorySkillIds(category: SkillCategoryKey): string[] {
  return Object.keys(SKILL_CATEGORIES[category].skills).map((shortKey) =>
    getFullSkillId(category, shortKey),
  );
}

/**
 * Get the display name for a category
 */
export function getCategoryDisplayName(category: SkillCategoryKey): string {
  return SKILL_CATEGORIES[category].name;
}
