/**
 * Domain-Informed Priors for BKT Parameters
 *
 * Different skill types have different learning characteristics.
 * These priors encode our domain knowledge about soroban skill difficulty.
 */

import type { BktParams } from "./types";

/**
 * Get default BKT parameters for a skill based on its type.
 *
 * Parameters are informed by soroban pedagogy:
 * - Basic skills (direct manipulation) are easier to learn
 * - Five complements require memorization and pattern recognition
 * - Ten complements are more complex and error-prone
 * - Mixed complements (combining techniques) are the hardest
 *
 * @param skillId - The skill identifier (e.g., "basic.directAddition")
 * @returns BKT parameters tuned for this skill type
 */
export function getDefaultParams(skillId: string): BktParams {
  // Basic skills - direct bead manipulation
  // High P(init) because these are intuitive
  // Moderate P(learn) - lowered to prevent P(known) exploding after few correct answers
  // Balanced pSlip/pGuess - the ratio pSlip/pGuess determines evidence strength
  // A correct answer provides evidence ratio of (1-pSlip)/pGuess = (1-0.15)/0.12 = 7.1x
  // (vs 45x with old values). This makes BKT updates more gradual.
  if (skillId.startsWith("basic.")) {
    return {
      pInit: 0.3,
      pLearn: 0.1, // Low learning rate - requires sustained practice
      pSlip: 0.15, // Higher slip - even known skills have errors
      pGuess: 0.12, // Higher guess - some problems can be guessed correctly
    };
  }

  // Five complements - using the "friends of 5"
  // Moderate difficulty, requires memorization
  if (skillId.startsWith("fiveComplements")) {
    return {
      pInit: 0.1,
      pLearn: 0.08, // Low learning rate
      pSlip: 0.18, // Moderate slip
      pGuess: 0.1, // Moderate guess
    };
  }

  // Five complement subtraction
  if (skillId.startsWith("fiveComplementsSub")) {
    return {
      pInit: 0.1,
      pLearn: 0.07,
      pSlip: 0.2,
      pGuess: 0.1,
    };
  }

  // Ten complements - using the "friends of 10"
  // More challenging, higher cognitive load
  if (skillId.startsWith("tenComplements")) {
    return {
      pInit: 0.05,
      pLearn: 0.06, // Very low learning rate for harder skills
      pSlip: 0.22, // Higher slip for complex skills
      pGuess: 0.08, // Lower guess for complex skills
    };
  }

  // Ten complement subtraction
  if (skillId.startsWith("tenComplementsSub")) {
    return {
      pInit: 0.05,
      pLearn: 0.05,
      pSlip: 0.25,
      pGuess: 0.08,
    };
  }

  // Mixed complements - combining techniques
  // Hardest category, requires fluency in multiple approaches
  if (skillId.startsWith("mixedComplements")) {
    return {
      pInit: 0.02,
      pLearn: 0.04, // Very slow learning
      pSlip: 0.28, // High slip even when known
      pGuess: 0.06, // Low guess - hard to luck into correct answer
    };
  }

  // Default for any unknown skill type
  return {
    pInit: 0.1,
    pLearn: 0.08,
    pSlip: 0.18,
    pGuess: 0.1,
  };
}

/**
 * Get a human-readable category name for a skill.
 */
export function getSkillCategory(skillId: string): string {
  if (skillId.startsWith("basic.")) return "Basic Skills";
  if (skillId.startsWith("fiveComplementsSub"))
    return "Five Complement Subtraction";
  if (skillId.startsWith("fiveComplements")) return "Five Complements";
  if (skillId.startsWith("tenComplementsSub"))
    return "Ten Complement Subtraction";
  if (skillId.startsWith("tenComplements")) return "Ten Complements";
  if (skillId.startsWith("mixedComplements")) return "Mixed Complements";
  return "Other";
}
