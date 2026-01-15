// Core mathematical techniques for mastery progression
// Techniques are actual skills (carrying, borrowing), not complexity levels

import type { DisplayRules } from "./displayRules";

/**
 * Technique IDs
 * These represent actual mathematical procedures/algorithms to learn
 */
export type TechniqueId =
  // Addition Techniques
  | "basic-addition" // No carrying required
  | "single-carry" // Carrying in one place value
  | "multi-carry" // Carrying across multiple place values

  // Subtraction Techniques
  | "basic-subtraction" // No borrowing required
  | "single-borrow" // Borrowing from one place value
  | "multi-borrow"; // Borrowing across multiple place values

/**
 * A mathematical technique that can be learned and mastered
 */
export interface Technique {
  id: TechniqueId;
  name: string;
  description: string;
  operator: "addition" | "subtraction";

  // What OTHER techniques must be mastered first?
  prerequisites: TechniqueId[];

  // Recommended scaffolding for this technique (baseline)
  // Complexity levels can adjust these
  recommendedScaffolding: Partial<DisplayRules>;

  // Which techniques should be reviewed when practicing this one?
  recommendedReview: TechniqueId[];
}

/**
 * All techniques in the learning progression
 */
export const TECHNIQUES: Record<TechniqueId, Technique> = {
  // ============================================================================
  // ADDITION TECHNIQUES
  // ============================================================================

  "basic-addition": {
    id: "basic-addition",
    name: "Basic Addition",
    description: "Simple addition without carrying (no regrouping)",
    operator: "addition",
    prerequisites: [],
    recommendedScaffolding: {
      carryBoxes: "never", // No carrying, so no carry boxes needed
      answerBoxes: "always",
      placeValueColors: "always",
      tenFrames: "never", // Ten-frames for regrouping visualization
      problemNumbers: "always",
      cellBorders: "always",
      borrowNotation: "never",
      borrowingHints: "never",
    },
    recommendedReview: [],
  },

  "single-carry": {
    id: "single-carry",
    name: "Single-place Carrying",
    description: "Addition with carrying (regrouping) in one place value",
    operator: "addition",
    prerequisites: ["basic-addition"],
    recommendedScaffolding: {
      carryBoxes: "whenRegrouping", // Show carry boxes when carrying happens
      answerBoxes: "always",
      placeValueColors: "always",
      tenFrames: "whenRegrouping", // Help visualize making ten
      problemNumbers: "always",
      cellBorders: "always",
      borrowNotation: "never",
      borrowingHints: "never",
    },
    recommendedReview: ["basic-addition"],
  },

  "multi-carry": {
    id: "multi-carry",
    name: "Multi-place Carrying",
    description: "Addition with carrying across multiple place values",
    operator: "addition",
    prerequisites: ["single-carry"],
    recommendedScaffolding: {
      carryBoxes: "whenRegrouping",
      answerBoxes: "always",
      placeValueColors: "always",
      tenFrames: "never", // Less scaffolding for advanced students
      problemNumbers: "always",
      cellBorders: "always",
      borrowNotation: "never",
      borrowingHints: "never",
    },
    recommendedReview: ["single-carry", "basic-addition"],
  },

  // ============================================================================
  // SUBTRACTION TECHNIQUES
  // ============================================================================

  "basic-subtraction": {
    id: "basic-subtraction",
    name: "Basic Subtraction",
    description: "Simple subtraction without borrowing (no regrouping)",
    operator: "subtraction",
    prerequisites: ["basic-addition"], // Addition first
    recommendedScaffolding: {
      carryBoxes: "never",
      answerBoxes: "always",
      placeValueColors: "always",
      tenFrames: "never",
      problemNumbers: "always",
      cellBorders: "always",
      borrowNotation: "never", // No borrowing, so no notation needed
      borrowingHints: "never",
    },
    recommendedReview: ["basic-addition"],
  },

  "single-borrow": {
    id: "single-borrow",
    name: "Single-place Borrowing",
    description: "Subtraction with borrowing (regrouping) from one place value",
    operator: "subtraction",
    prerequisites: ["basic-subtraction", "single-carry"], // Need to understand regrouping concept
    recommendedScaffolding: {
      carryBoxes: "never",
      answerBoxes: "always",
      placeValueColors: "always",
      tenFrames: "whenRegrouping", // Help visualize breaking apart ten
      problemNumbers: "always",
      cellBorders: "always",
      borrowNotation: "whenRegrouping", // Show scratch work for borrowing
      borrowingHints: "never", // Start without hints, can add later
    },
    recommendedReview: ["basic-subtraction", "single-carry"],
  },

  "multi-borrow": {
    id: "multi-borrow",
    name: "Multi-place Borrowing",
    description: "Subtraction with borrowing across multiple place values",
    operator: "subtraction",
    prerequisites: ["single-borrow"],
    recommendedScaffolding: {
      carryBoxes: "never",
      answerBoxes: "always",
      placeValueColors: "always",
      tenFrames: "never",
      problemNumbers: "always",
      cellBorders: "always",
      borrowNotation: "whenRegrouping",
      borrowingHints: "never",
    },
    recommendedReview: ["single-borrow", "basic-subtraction"],
  },
};

/**
 * Get technique by ID
 */
export function getTechnique(id: TechniqueId): Technique {
  return TECHNIQUES[id];
}

/**
 * Get all techniques for an operator
 */
export function getTechniquesByOperator(
  operator: "addition" | "subtraction",
): Technique[] {
  return Object.values(TECHNIQUES).filter((t) => t.operator === operator);
}

/**
 * Check if technique prerequisites are met
 */
export function arePrerequisitesMet(
  techniqueId: TechniqueId,
  masteredTechniques: Set<TechniqueId>,
): boolean {
  const technique = TECHNIQUES[techniqueId];
  return technique.prerequisites.every((prereq) =>
    masteredTechniques.has(prereq),
  );
}
