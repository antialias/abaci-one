/**
 * Problem Generator - Generates problems from slot constraints
 *
 * Extracted from ActiveSession.tsx to be shared between:
 * - Server-side plan generation (session-planner.ts)
 * - Client-side fallback (ActiveSession.tsx)
 *
 * This is a pure function with no side effects, so it works in both environments.
 */

import type { GeneratedProblem, ProblemConstraints } from '@/db/schema/session-plans'
import { createBasicSkillSet, type SkillSet } from '@/types/tutorial'
import {
  type GenerationDiagnostics,
  type ProblemConstraints as GeneratorConstraints,
  generateSingleProblemWithDiagnostics,
} from '@/utils/problemGenerator'
import type { SkillCostCalculator } from '@/utils/skillComplexity'

/**
 * Error thrown when problem generation fails
 */
export class ProblemGenerationError extends Error {
  constructor(
    message: string,
    public readonly constraints: ProblemConstraints,
    public readonly diagnostics?: GenerationDiagnostics
  ) {
    super(message)
    this.name = 'ProblemGenerationError'
  }
}

/**
 * Format diagnostics into an actionable error message
 */
function formatDiagnosticsMessage(diagnostics: GenerationDiagnostics): string {
  const lines: string[] = []

  // Identify the main failure mode
  if (diagnostics.sequenceFailures === diagnostics.totalAttempts) {
    lines.push('CAUSE: All attempts failed during sequence generation.')
    lines.push(
      'This means no valid sequence of terms could be built with the given skill/budget constraints.'
    )
    if (diagnostics.enabledRequiredSkills.length === 0) {
      lines.push('FIX: No required skills are enabled - enable at least some basic skills.')
    } else {
      lines.push(`Enabled skills: ${diagnostics.enabledRequiredSkills.slice(0, 5).join(', ')}...`)
    }
  } else if (diagnostics.skillMatchFailures > 0) {
    lines.push(
      `CAUSE: ${diagnostics.skillMatchFailures}/${diagnostics.totalAttempts} attempts generated problems but they didn't match skill requirements.`
    )
    if (diagnostics.lastGeneratedSkills) {
      lines.push(`Last problem used skills: ${diagnostics.lastGeneratedSkills.join(', ')}`)
    }
    if (diagnostics.enabledTargetSkills.length > 0) {
      lines.push(
        `Target skills required: ${diagnostics.enabledTargetSkills.slice(0, 5).join(', ')}`
      )
      lines.push('FIX: Generated problems may not naturally use the target skills.')
    }
  } else if (diagnostics.sumConstraintFailures > 0) {
    lines.push(`CAUSE: ${diagnostics.sumConstraintFailures} attempts failed sum constraints.`)
    lines.push('FIX: Adjust min/max sum constraints or number range.')
  }

  // Add stats
  lines.push('')
  lines.push(
    `Stats: ${diagnostics.totalAttempts} attempts = ${diagnostics.sequenceFailures} seq failures + ${diagnostics.sumConstraintFailures} sum failures + ${diagnostics.skillMatchFailures} skill failures`
  )

  return lines.join('\n')
}

/**
 * Generate a problem from slot constraints using the skill-based algorithm.
 *
 * @param constraints - The constraints for problem generation (skills, digit range, term count)
 * @param costCalculator - Optional student-aware calculator for complexity budget enforcement
 * @returns A generated problem with terms, answer, and skills required
 * @throws {ProblemGenerationError} If the generator fails to produce a valid problem
 */
export function generateProblemFromConstraints(
  constraints: ProblemConstraints,
  costCalculator?: SkillCostCalculator
): GeneratedProblem {
  const baseSkillSet = createBasicSkillSet()

  const requiredSkills: SkillSet = {
    basic: { ...baseSkillSet.basic, ...constraints.requiredSkills?.basic },
    fiveComplements: {
      ...baseSkillSet.fiveComplements,
      ...constraints.requiredSkills?.fiveComplements,
    },
    tenComplements: {
      ...baseSkillSet.tenComplements,
      ...constraints.requiredSkills?.tenComplements,
    },
    fiveComplementsSub: {
      ...baseSkillSet.fiveComplementsSub,
      ...constraints.requiredSkills?.fiveComplementsSub,
    },
    tenComplementsSub: {
      ...baseSkillSet.tenComplementsSub,
      ...constraints.requiredSkills?.tenComplementsSub,
    },
    advanced: {
      ...baseSkillSet.advanced,
      ...constraints.requiredSkills?.advanced,
    },
  }

  const maxDigits = constraints.digitRange?.max || 1
  const maxValue = 10 ** maxDigits - 1

  const generatorConstraints: GeneratorConstraints = {
    numberRange: { min: 1, max: maxValue },
    minTerms: constraints.termCount?.min || 3,
    maxTerms: constraints.termCount?.max || 5,
    problemCount: 1,
    minComplexityBudgetPerTerm: constraints.minComplexityBudgetPerTerm,
    maxComplexityBudgetPerTerm: constraints.maxComplexityBudgetPerTerm,
  }

  const { problem: generatedProblem, diagnostics } = generateSingleProblemWithDiagnostics({
    constraints: generatorConstraints,
    requiredSkills,
    targetSkills: constraints.targetSkills,
    forbiddenSkills: constraints.forbiddenSkills,
    costCalculator,
  })

  if (generatedProblem) {
    return {
      terms: generatedProblem.terms,
      answer: generatedProblem.answer,
      skillsRequired: generatedProblem.requiredSkills,
      generationTrace: generatedProblem.generationTrace,
    }
  }

  // Build actionable error message
  const basicInfo =
    `Failed to generate problem with constraints:\n` +
    `  termCount: ${constraints.termCount?.min}-${constraints.termCount?.max}\n` +
    `  digitRange: ${constraints.digitRange?.min}-${constraints.digitRange?.max}\n` +
    `  minComplexityBudget: ${constraints.minComplexityBudgetPerTerm ?? 'none'}\n` +
    `  maxComplexityBudget: ${constraints.maxComplexityBudgetPerTerm ?? 'none'}\n`

  const diagnosticsMessage = formatDiagnosticsMessage(diagnostics)

  throw new ProblemGenerationError(`${basicInfo}\n${diagnosticsMessage}`, constraints, diagnostics)
}
