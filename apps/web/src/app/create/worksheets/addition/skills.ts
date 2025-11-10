// Skill definitions for mastery mode
// Each skill represents a pedagogical milestone in learning addition/subtraction

import type { DisplayRules } from './displayRules'

/**
 * Skill IDs follow naming convention:
 * - Prefix: sd (single-digit), td (two-digit), 3d/4d/5d (multi-digit)
 * - Operation: addition skills have descriptive names, subtraction uses "sub" prefix, mixed uses "mixed" prefix
 * - Complexity: no-regroup, simple-regroup, ones-regroup, mixed-regroup, full-regroup
 */
export type SkillId =
  // Single-digit addition
  | 'sd-no-regroup'
  | 'sd-simple-regroup'
  // Two-digit addition
  | 'td-no-regroup'
  | 'td-ones-regroup'
  | 'td-mixed-regroup'
  | 'td-full-regroup'
  // Three-digit addition
  | '3d-no-regroup'
  | '3d-simple-regroup'
  | '3d-full-regroup'
  // Four/five-digit addition
  | '4d-mastery'
  | '5d-mastery'
  // Single-digit subtraction
  | 'sd-sub-no-borrow'
  | 'sd-sub-borrow'
  // Two-digit subtraction
  | 'td-sub-no-borrow'
  | 'td-sub-ones-borrow'
  | 'td-sub-mixed-borrow'
  | 'td-sub-full-borrow'
  // Three-digit subtraction
  | '3d-sub-simple'
  | '3d-sub-complex'
  // Four/five-digit subtraction
  | '4d-sub-mastery'
  | '5d-sub-mastery'

export interface SkillDefinition {
  id: SkillId
  name: string
  description: string
  operator: 'addition' | 'subtraction'

  // Problem generation constraints
  digitRange: { min: number; max: number }
  regroupingConfig: {
    pAnyStart: number
    pAllStart: number
  }

  // Pedagogical settings
  recommendedScaffolding: DisplayRules
  recommendedProblemCount: number

  // Mastery validation (for future grading)
  masteryThreshold: number // 0.0-1.0 (e.g., 0.85 = 85% accuracy)
  minimumAttempts: number // Min problems to qualify for mastery

  // Dependency graph
  prerequisites: SkillId[] // Skills that must be mastered first
  recommendedReview: SkillId[] // 1-2 skills to include in review mix
}

/**
 * All skill definitions (21 total: 11 addition, 10 subtraction)
 * Organized in pedagogical progression order
 */
export const SKILL_DEFINITIONS: SkillDefinition[] = [
  // ============================================================================
  // ADDITION SKILLS (11 total)
  // ============================================================================

  // Single-Digit Addition (2 skills)
  {
    id: 'sd-no-regroup',
    name: 'Single-digit without regrouping',
    description: 'Simple single-digit addition like 3+5, 2+4',
    operator: 'addition',
    digitRange: { min: 1, max: 1 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    recommendedScaffolding: {
      carryBoxes: 'always',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'never', // Not needed for simple problems
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 20,
    masteryThreshold: 0.9,
    minimumAttempts: 20,
    prerequisites: [],
    recommendedReview: [],
  },

  {
    id: 'sd-simple-regroup',
    name: 'Single-digit with regrouping',
    description: 'Single-digit addition with carrying like 7+8, 9+6',
    operator: 'addition',
    digitRange: { min: 1, max: 1 },
    regroupingConfig: { pAnyStart: 1.0, pAllStart: 0 },
    recommendedScaffolding: {
      carryBoxes: 'whenRegrouping',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'whenRegrouping', // Help visualize making ten
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 20,
    masteryThreshold: 0.9,
    minimumAttempts: 20,
    prerequisites: ['sd-no-regroup'],
    recommendedReview: ['sd-no-regroup'],
  },

  // Two-Digit Addition (4 skills)
  {
    id: 'td-no-regroup',
    name: 'Two-digit without regrouping',
    description: 'Two-digit addition without carrying like 23+45, 31+28',
    operator: 'addition',
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    recommendedScaffolding: {
      carryBoxes: 'always', // Show structure even when not needed
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.85,
    minimumAttempts: 15,
    prerequisites: ['sd-simple-regroup'],
    recommendedReview: ['sd-simple-regroup'],
  },

  {
    id: 'td-ones-regroup',
    name: 'Two-digit with ones place regrouping',
    description: 'Two-digit addition with carrying in ones place like 38+27, 49+15',
    operator: 'addition',
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0.5, pAllStart: 0 },
    recommendedScaffolding: {
      carryBoxes: 'whenRegrouping',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'whenRegrouping',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.85,
    minimumAttempts: 15,
    prerequisites: ['td-no-regroup'],
    recommendedReview: ['td-no-regroup'],
  },

  {
    id: 'td-mixed-regroup',
    name: 'Two-digit with mixed regrouping',
    description: 'Two-digit addition with varied regrouping like 67+58, 84+73',
    operator: 'addition',
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0.7, pAllStart: 0.2 },
    recommendedScaffolding: {
      carryBoxes: 'whenRegrouping',
      answerBoxes: 'whenMultipleRegroups',
      placeValueColors: 'whenRegrouping',
      tenFrames: 'whenRegrouping',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.85,
    minimumAttempts: 15,
    prerequisites: ['td-ones-regroup'],
    recommendedReview: ['td-no-regroup', 'td-ones-regroup'],
  },

  {
    id: 'td-full-regroup',
    name: 'Two-digit with frequent regrouping',
    description: 'Two-digit addition with high regrouping frequency like 88+99, 76+67',
    operator: 'addition',
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0.9, pAllStart: 0.5 },
    recommendedScaffolding: {
      carryBoxes: 'whenMultipleRegroups',
      answerBoxes: 'whenMultipleRegroups',
      placeValueColors: 'whenMultipleRegroups',
      tenFrames: 'whenRegrouping',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.8,
    minimumAttempts: 15,
    prerequisites: ['td-mixed-regroup'],
    recommendedReview: ['td-ones-regroup', 'td-mixed-regroup'],
  },

  // Three-Digit Addition (3 skills)
  {
    id: '3d-no-regroup',
    name: 'Three-digit without regrouping',
    description: 'Three-digit addition without carrying like 234+451, 123+456',
    operator: 'addition',
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 12,
    masteryThreshold: 0.85,
    minimumAttempts: 12,
    prerequisites: ['td-full-regroup'],
    recommendedReview: ['td-mixed-regroup', 'td-full-regroup'],
  },

  {
    id: '3d-simple-regroup',
    name: 'Three-digit with occasional regrouping',
    description: 'Three-digit addition with some carrying like 367+258, 484+273',
    operator: 'addition',
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 0.5, pAllStart: 0.1 },
    recommendedScaffolding: {
      carryBoxes: 'whenRegrouping',
      answerBoxes: 'whenMultipleRegroups',
      placeValueColors: 'whenRegrouping',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 12,
    masteryThreshold: 0.8,
    minimumAttempts: 12,
    prerequisites: ['3d-no-regroup'],
    recommendedReview: ['td-full-regroup', '3d-no-regroup'],
  },

  {
    id: '3d-full-regroup',
    name: 'Three-digit with frequent regrouping',
    description: 'Three-digit addition with high regrouping like 888+999, 767+676',
    operator: 'addition',
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 0.9, pAllStart: 0.6 },
    recommendedScaffolding: {
      carryBoxes: 'whenMultipleRegroups',
      answerBoxes: 'never',
      placeValueColors: 'when3PlusDigits',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 12,
    masteryThreshold: 0.8,
    minimumAttempts: 12,
    prerequisites: ['3d-simple-regroup'],
    recommendedReview: ['3d-no-regroup', '3d-simple-regroup'],
  },

  // Four/Five-Digit Addition (2 skills)
  {
    id: '4d-mastery',
    name: 'Four-digit mastery',
    description: 'Four-digit addition with varied regrouping like 3847+2956',
    operator: 'addition',
    digitRange: { min: 4, max: 4 },
    regroupingConfig: { pAnyStart: 0.8, pAllStart: 0.4 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'never',
      placeValueColors: 'when3PlusDigits',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 10,
    masteryThreshold: 0.8,
    minimumAttempts: 10,
    prerequisites: ['3d-full-regroup'],
    recommendedReview: ['3d-simple-regroup', '3d-full-regroup'],
  },

  {
    id: '5d-mastery',
    name: 'Five-digit mastery',
    description: 'Five-digit addition with varied regrouping like 38472+29563',
    operator: 'addition',
    digitRange: { min: 5, max: 5 },
    regroupingConfig: { pAnyStart: 0.85, pAllStart: 0.5 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'never',
      placeValueColors: 'never',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 10,
    masteryThreshold: 0.75,
    minimumAttempts: 10,
    prerequisites: ['4d-mastery'],
    recommendedReview: ['3d-full-regroup', '4d-mastery'],
  },

  // ============================================================================
  // SUBTRACTION SKILLS (10 total)
  // ============================================================================

  // Single-Digit Subtraction (2 skills)
  {
    id: 'sd-sub-no-borrow',
    name: 'Single-digit without borrowing',
    description: 'Simple subtraction like 8-3, 9-4',
    operator: 'subtraction',
    digitRange: { min: 1, max: 1 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'always',
      borrowingHints: 'always',
    },
    recommendedProblemCount: 20,
    masteryThreshold: 0.9,
    minimumAttempts: 20,
    prerequisites: [],
    recommendedReview: [],
  },

  {
    id: 'sd-sub-borrow',
    name: 'Single-digit with borrowing',
    description: 'Subtraction with borrowing like 13-7, 15-8',
    operator: 'subtraction',
    digitRange: { min: 1, max: 1 },
    regroupingConfig: { pAnyStart: 1.0, pAllStart: 0 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'whenRegrouping',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'whenRegrouping',
      borrowingHints: 'whenRegrouping',
    },
    recommendedProblemCount: 20,
    masteryThreshold: 0.9,
    minimumAttempts: 20,
    prerequisites: ['sd-sub-no-borrow'],
    recommendedReview: ['sd-sub-no-borrow'],
  },

  // Two-Digit Subtraction (4 skills)
  {
    id: 'td-sub-no-borrow',
    name: 'Two-digit without borrowing',
    description: 'Two-digit subtraction without borrowing like 68-43',
    operator: 'subtraction',
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'always',
      borrowingHints: 'always',
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.85,
    minimumAttempts: 15,
    prerequisites: ['sd-sub-borrow'],
    recommendedReview: ['sd-sub-borrow'],
  },

  {
    id: 'td-sub-ones-borrow',
    name: 'Two-digit with ones place borrowing',
    description: 'Two-digit subtraction with borrowing in ones like 52-27',
    operator: 'subtraction',
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0.5, pAllStart: 0 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'whenRegrouping',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'whenRegrouping',
      borrowingHints: 'whenRegrouping',
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.85,
    minimumAttempts: 15,
    prerequisites: ['td-sub-no-borrow'],
    recommendedReview: ['td-sub-no-borrow'],
  },

  {
    id: 'td-sub-mixed-borrow',
    name: 'Two-digit with mixed borrowing',
    description: 'Two-digit subtraction with varied borrowing like 73-48',
    operator: 'subtraction',
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0.7, pAllStart: 0.2 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'whenMultipleRegroups',
      placeValueColors: 'whenRegrouping',
      tenFrames: 'whenRegrouping',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'whenRegrouping',
      borrowingHints: 'whenMultipleRegroups',
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.85,
    minimumAttempts: 15,
    prerequisites: ['td-sub-ones-borrow'],
    recommendedReview: ['td-sub-no-borrow', 'td-sub-ones-borrow'],
  },

  {
    id: 'td-sub-full-borrow',
    name: 'Two-digit with frequent borrowing',
    description: 'Two-digit subtraction with high borrowing frequency like 91-78',
    operator: 'subtraction',
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0.9, pAllStart: 0.5 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'whenMultipleRegroups',
      placeValueColors: 'whenMultipleRegroups',
      tenFrames: 'whenRegrouping',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'whenRegrouping',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 15,
    masteryThreshold: 0.8,
    minimumAttempts: 15,
    prerequisites: ['td-sub-mixed-borrow'],
    recommendedReview: ['td-sub-ones-borrow', 'td-sub-mixed-borrow'],
  },

  // Three-Digit Subtraction (2 skills - simplified from addition)
  {
    id: '3d-sub-simple',
    name: 'Three-digit with occasional borrowing',
    description: 'Three-digit subtraction with some borrowing like 567-238',
    operator: 'subtraction',
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 0.5, pAllStart: 0.1 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'whenMultipleRegroups',
      placeValueColors: 'whenRegrouping',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'whenRegrouping',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 12,
    masteryThreshold: 0.8,
    minimumAttempts: 12,
    prerequisites: ['td-sub-full-borrow'],
    recommendedReview: ['td-sub-mixed-borrow', 'td-sub-full-borrow'],
  },

  {
    id: '3d-sub-complex',
    name: 'Three-digit with frequent borrowing',
    description: 'Three-digit subtraction with high borrowing like 801-567',
    operator: 'subtraction',
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 0.9, pAllStart: 0.6 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'never',
      placeValueColors: 'when3PlusDigits',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'whenRegrouping',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 12,
    masteryThreshold: 0.8,
    minimumAttempts: 12,
    prerequisites: ['3d-sub-simple'],
    recommendedReview: ['td-sub-full-borrow', '3d-sub-simple'],
  },

  // Four/Five-Digit Subtraction (2 skills)
  {
    id: '4d-sub-mastery',
    name: 'Four-digit subtraction mastery',
    description: 'Four-digit subtraction with varied borrowing like 5847-2956',
    operator: 'subtraction',
    digitRange: { min: 4, max: 4 },
    regroupingConfig: { pAnyStart: 0.8, pAllStart: 0.4 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'never',
      placeValueColors: 'when3PlusDigits',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'whenRegrouping',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 10,
    masteryThreshold: 0.8,
    minimumAttempts: 10,
    prerequisites: ['3d-sub-complex'],
    recommendedReview: ['3d-sub-simple', '3d-sub-complex'],
  },

  {
    id: '5d-sub-mastery',
    name: 'Five-digit subtraction mastery',
    description: 'Five-digit subtraction with varied borrowing like 58472-29563',
    operator: 'subtraction',
    digitRange: { min: 5, max: 5 },
    regroupingConfig: { pAnyStart: 0.85, pAllStart: 0.5 },
    recommendedScaffolding: {
      carryBoxes: 'never',
      answerBoxes: 'never',
      placeValueColors: 'never',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'never',
      borrowingHints: 'never',
    },
    recommendedProblemCount: 10,
    masteryThreshold: 0.75,
    minimumAttempts: 10,
    prerequisites: ['4d-sub-mastery'],
    recommendedReview: ['3d-sub-complex', '4d-sub-mastery'],
  },
]

/**
 * Helper: Get skill definition by ID
 */
export function getSkillById(id: SkillId): SkillDefinition | undefined {
  return SKILL_DEFINITIONS.find((skill) => skill.id === id)
}

/**
 * Helper: Get all skills for a given operator
 */
export function getSkillsByOperator(operator: 'addition' | 'subtraction'): SkillDefinition[] {
  return SKILL_DEFINITIONS.filter((skill) => skill.operator === operator)
}

/**
 * Helper: Find next skill in progression (null if at end or prerequisites not met)
 */
export function findNextSkill(
  currentSkillId: SkillId,
  masteryStates: Map<SkillId, boolean>,
  operator: 'addition' | 'subtraction'
): SkillDefinition | null {
  const skills = getSkillsByOperator(operator)
  const currentIndex = skills.findIndex((s) => s.id === currentSkillId)

  if (currentIndex === -1 || currentIndex === skills.length - 1) {
    return null // Not found or at end
  }

  const nextSkill = skills[currentIndex + 1]

  // Check if prerequisites are met
  const prereqsMet = nextSkill.prerequisites.every(
    (prereqId) => masteryStates.get(prereqId) === true
  )

  return prereqsMet ? nextSkill : null
}

/**
 * Helper: Find previous skill in progression
 */
export function findPreviousSkill(
  currentSkillId: SkillId,
  operator: 'addition' | 'subtraction'
): SkillDefinition | null {
  const skills = getSkillsByOperator(operator)
  const currentIndex = skills.findIndex((s) => s.id === currentSkillId)

  if (currentIndex <= 0) {
    return null // Not found or at start
  }

  return skills[currentIndex - 1]
}

/**
 * Helper: Get the first unmastered skill with prerequisites met
 */
export function findCurrentSkill(
  masteryStates: Map<SkillId, boolean>,
  operator: 'addition' | 'subtraction'
): SkillDefinition {
  const skills = getSkillsByOperator(operator)

  for (const skill of skills) {
    // Check if already mastered
    if (masteryStates.get(skill.id) === true) continue

    // Check if prerequisites are met
    const prereqsMet = skill.prerequisites.every((prereqId) => masteryStates.get(prereqId) === true)

    if (prereqsMet) {
      return skill // First non-mastered skill with prerequisites met
    }
  }

  // All skills mastered! Return the last skill
  return skills[skills.length - 1]
}

/**
 * Helper: Extract digit complexity from a skill (1-5)
 */
export function getDigitComplexity(skill: SkillDefinition): number {
  return skill.digitRange.max
}
