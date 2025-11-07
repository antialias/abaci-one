// Display rules for conditional per-problem scaffolding

import type { ProblemMeta } from './problemAnalysis'

export type RuleMode =
  | 'always' // Always show this display option
  | 'never' // Never show this display option
  | 'whenRegrouping' // Show when problem requires any regrouping
  | 'whenMultipleRegroups' // Show when 2+ place values regroup
  | 'when3PlusDigits' // Show when maxDigits >= 3

export interface DisplayRules {
  carryBoxes: RuleMode
  answerBoxes: RuleMode
  placeValueColors: RuleMode
  tenFrames: RuleMode
  problemNumbers: RuleMode
  cellBorders: RuleMode
}

export interface ResolvedDisplayOptions {
  showCarryBoxes: boolean
  showAnswerBoxes: boolean
  showPlaceValueColors: boolean
  showTenFrames: boolean
  showProblemNumbers: boolean
  showCellBorder: boolean
}

/**
 * Evaluate a single display rule against a problem's metadata
 */
export function evaluateRule(mode: RuleMode, problem: ProblemMeta): boolean {
  switch (mode) {
    case 'always':
      return true

    case 'never':
      return false

    case 'whenRegrouping':
      return problem.requiresRegrouping

    case 'whenMultipleRegroups':
      return problem.regroupCount >= 2

    case 'when3PlusDigits':
      return problem.maxDigits >= 3
  }
}

/**
 * Resolve all display rules for a specific problem
 * Returns concrete boolean flags for rendering
 */
export function resolveDisplayForProblem(
  rules: DisplayRules,
  problem: ProblemMeta
): ResolvedDisplayOptions {
  return {
    showCarryBoxes: evaluateRule(rules.carryBoxes, problem),
    showAnswerBoxes: evaluateRule(rules.answerBoxes, problem),
    showPlaceValueColors: evaluateRule(rules.placeValueColors, problem),
    showTenFrames: evaluateRule(rules.tenFrames, problem),
    showProblemNumbers: evaluateRule(rules.problemNumbers, problem),
    showCellBorder: evaluateRule(rules.cellBorders, problem),
  }
}
