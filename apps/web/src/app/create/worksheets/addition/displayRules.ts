// Display rules for conditional per-problem scaffolding

import type { ProblemMeta, SubtractionProblemMeta } from "./problemAnalysis";

export type AnyProblemMeta = ProblemMeta | SubtractionProblemMeta;

export type RuleMode =
  | "always" // Always show this display option
  | "never" // Never show this display option
  | "whenRegrouping" // Show when problem requires any regrouping
  | "whenMultipleRegroups" // Show when 2+ place values regroup
  | "when3PlusDigits"; // Show when maxDigits >= 3

export interface DisplayRules {
  carryBoxes: RuleMode;
  answerBoxes: RuleMode;
  placeValueColors: RuleMode;
  tenFrames: RuleMode;
  problemNumbers: RuleMode;
  cellBorders: RuleMode;
  borrowNotation: RuleMode; // Subtraction: scratch boxes showing borrowed 10s
  borrowingHints: RuleMode; // Subtraction: arrows and visual hints
}

export interface ResolvedDisplayOptions {
  showCarryBoxes: boolean;
  showAnswerBoxes: boolean;
  showPlaceValueColors: boolean;
  showTenFrames: boolean;
  showProblemNumbers: boolean;
  showCellBorder: boolean;
  showBorrowNotation: boolean; // Subtraction: scratch work boxes in minuend
  showBorrowingHints: boolean; // Subtraction: hints with arrows
}

/**
 * Evaluate a single display rule against a problem's metadata
 * Works for both addition (regrouping = carrying) and subtraction (regrouping = borrowing)
 */
export function evaluateRule(mode: RuleMode, problem: AnyProblemMeta): boolean {
  switch (mode) {
    case "always":
      return true;

    case "never":
      return false;

    case "whenRegrouping":
      // Works for both: requiresRegrouping (addition) or requiresBorrowing (subtraction)
      return "requiresRegrouping" in problem
        ? problem.requiresRegrouping
        : problem.requiresBorrowing;

    case "whenMultipleRegroups":
      // Works for both: regroupCount (addition) or borrowCount (subtraction)
      return "regroupCount" in problem
        ? problem.regroupCount >= 2
        : problem.borrowCount >= 2;

    case "when3PlusDigits":
      return problem.maxDigits >= 3;
  }
}

/**
 * Resolve all display rules for a specific problem
 * Returns concrete boolean flags for rendering
 */
export function resolveDisplayForProblem(
  rules: DisplayRules,
  problem: AnyProblemMeta,
): ResolvedDisplayOptions {
  console.log("[resolveDisplayForProblem] Input rules:", rules);
  console.log("[resolveDisplayForProblem] Problem meta:", problem);

  const resolved = {
    showCarryBoxes: evaluateRule(rules.carryBoxes, problem),
    showAnswerBoxes: evaluateRule(rules.answerBoxes, problem),
    showPlaceValueColors: evaluateRule(rules.placeValueColors, problem),
    showTenFrames: evaluateRule(rules.tenFrames, problem),
    showProblemNumbers: evaluateRule(rules.problemNumbers, problem),
    showCellBorder: evaluateRule(rules.cellBorders, problem),
    showBorrowNotation: evaluateRule(rules.borrowNotation, problem),
    showBorrowingHints: evaluateRule(rules.borrowingHints, problem),
  };

  console.log("[resolveDisplayForProblem] Resolved display options:", resolved);
  console.log(
    "[resolveDisplayForProblem] Ten-frames rule:",
    rules.tenFrames,
    "-> showTenFrames:",
    resolved.showTenFrames,
  );

  return resolved;
}
