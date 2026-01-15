// Problem complexity levels for mastery progression
// Complexity = how hard the problems are (digit count, regrouping frequency)
// NOT the technique being practiced

import type { DisplayRules } from "./displayRules";

/**
 * Problem complexity configuration
 * Defines how difficult the problems are (separate from what technique is being practiced)
 */
export interface ComplexityLevel {
  id: string;
  name: string;
  description: string;

  // Problem generation parameters
  digitRange: { min: number; max: number };
  regroupingConfig: {
    pAnyStart: number; // Probability any place value regroups
    pAllStart: number; // Probability all place values regroup
  };

  // Optional scaffolding adjustments for this complexity level
  // These override/merge with the technique's base scaffolding
  scaffoldingAdjustments?: Partial<DisplayRules>;

  // Recommended problem count for practice
  recommendedProblemCount?: number;
}

/**
 * Standard complexity progression
 * These can be combined with any technique
 */
export const COMPLEXITY_LEVELS: Record<string, ComplexityLevel> = {
  // ============================================================================
  // SINGLE-DIGIT COMPLEXITY
  // ============================================================================

  "sd-no-regroup": {
    id: "sd-no-regroup",
    name: "Single-digit (no regrouping)",
    description:
      "Single-digit problems that never require regrouping (e.g., 2+3, 4+1)",
    digitRange: { min: 1, max: 1 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    recommendedProblemCount: 20,
  },

  "sd-with-regroup": {
    id: "sd-with-regroup",
    name: "Single-digit (with regrouping)",
    description:
      "Single-digit problems that always require regrouping (e.g., 7+8, 9+6)",
    digitRange: { min: 1, max: 1 },
    regroupingConfig: { pAnyStart: 1.0, pAllStart: 0 },
    recommendedProblemCount: 20,
  },

  // ============================================================================
  // TWO-DIGIT COMPLEXITY
  // ============================================================================

  "td-no-regroup": {
    id: "td-no-regroup",
    name: "Two-digit (no regrouping)",
    description: "Two-digit problems without any carrying (e.g., 23+45, 31+28)",
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    scaffoldingAdjustments: {
      // Show carry boxes even when not carrying to teach columnar structure
      carryBoxes: "always",
    },
    recommendedProblemCount: 15,
  },

  "td-ones-regroup": {
    id: "td-ones-regroup",
    name: "Two-digit (ones place only)",
    description:
      "Two-digit problems with carrying only in ones place (e.g., 38+27, 49+15)",
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 1.0, pAllStart: 0 },
    recommendedProblemCount: 20,
  },

  "td-all-regroup": {
    id: "td-all-regroup",
    name: "Two-digit (all places)",
    description:
      "Two-digit problems with carrying in both ones and tens (e.g., 57+68, 89+74)",
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 1.0, pAllStart: 1.0 },
    recommendedProblemCount: 20,
  },

  "td-mixed-regroup": {
    id: "td-mixed-regroup",
    name: "Two-digit (mixed)",
    description: "Mix of two-digit problems, some with carrying",
    digitRange: { min: 2, max: 2 },
    regroupingConfig: { pAnyStart: 0.7, pAllStart: 0.3 },
    recommendedProblemCount: 20,
  },

  // ============================================================================
  // THREE-DIGIT COMPLEXITY
  // ============================================================================

  "xd-no-regroup": {
    id: "xd-no-regroup",
    name: "Three-digit (no regrouping)",
    description: "Three-digit problems without any carrying",
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 0, pAllStart: 0 },
    scaffoldingAdjustments: {
      carryBoxes: "always", // Show structure
    },
    recommendedProblemCount: 15,
  },

  "xd-ones-regroup": {
    id: "xd-ones-regroup",
    name: "Three-digit (ones only)",
    description: "Three-digit with carrying only in ones place",
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 1.0, pAllStart: 0 },
    recommendedProblemCount: 20,
  },

  "xd-multi-regroup": {
    id: "xd-multi-regroup",
    name: "Three-digit (multiple places)",
    description: "Three-digit with carrying in 2+ places",
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 1.0, pAllStart: 0.5 },
    recommendedProblemCount: 20,
  },

  "xd-all-regroup": {
    id: "xd-all-regroup",
    name: "Three-digit (all places)",
    description: "Three-digit with carrying in all three places",
    digitRange: { min: 3, max: 3 },
    regroupingConfig: { pAnyStart: 1.0, pAllStart: 1.0 },
    recommendedProblemCount: 20,
  },

  // ============================================================================
  // FOUR & FIVE DIGIT COMPLEXITY
  // ============================================================================

  "xxd-mixed": {
    id: "xxd-mixed",
    name: "Four-digit (mixed)",
    description: "Four-digit problems with varying regrouping",
    digitRange: { min: 4, max: 4 },
    regroupingConfig: { pAnyStart: 0.8, pAllStart: 0.4 },
    scaffoldingAdjustments: {
      tenFrames: "never", // Too complex for ten-frames
    },
    recommendedProblemCount: 15,
  },

  "xxxd-mixed": {
    id: "xxxd-mixed",
    name: "Five-digit (mixed)",
    description: "Five-digit problems with varying regrouping",
    digitRange: { min: 5, max: 5 },
    regroupingConfig: { pAnyStart: 0.8, pAllStart: 0.5 },
    scaffoldingAdjustments: {
      tenFrames: "never",
      carryBoxes: "whenMultipleRegroups", // Only show for complex cases
    },
    recommendedProblemCount: 15,
  },
};

/**
 * Get complexity level by ID
 */
export function getComplexityLevel(id: string): ComplexityLevel | undefined {
  return COMPLEXITY_LEVELS[id];
}

/**
 * Get all complexity levels sorted by difficulty
 */
export function getComplexityLevelsSorted(): ComplexityLevel[] {
  // Sort by digit count, then by regrouping frequency
  return Object.values(COMPLEXITY_LEVELS).sort((a, b) => {
    if (a.digitRange.min !== b.digitRange.min) {
      return a.digitRange.min - b.digitRange.min;
    }
    return a.regroupingConfig.pAnyStart - b.regroupingConfig.pAnyStart;
  });
}

/**
 * Get complexity levels suitable for a digit range
 */
export function getComplexityLevelsForDigits(
  min: number,
  max: number,
): ComplexityLevel[] {
  return Object.values(COMPLEXITY_LEVELS).filter(
    (level) => level.digitRange.min >= min && level.digitRange.max <= max,
  );
}
