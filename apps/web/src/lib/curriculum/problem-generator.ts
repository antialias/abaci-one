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
  type ProblemConstraints as GeneratorConstraints,
  generateSingleProblem,
} from '@/utils/problemGenerator'

/**
 * Error thrown when problem generation fails
 */
export class ProblemGenerationError extends Error {
  constructor(
    message: string,
    public readonly constraints: ProblemConstraints
  ) {
    super(message)
    this.name = 'ProblemGenerationError'
  }
}

/**
 * Generate a problem from slot constraints using the skill-based algorithm.
 *
 * @param constraints - The constraints for problem generation (skills, digit range, term count)
 * @returns A generated problem with terms, answer, and skills required
 * @throws {ProblemGenerationError} If the generator fails to produce a valid problem
 */
export function generateProblemFromConstraints(constraints: ProblemConstraints): GeneratedProblem {
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
  }

  const maxDigits = constraints.digitRange?.max || 1
  const maxValue = 10 ** maxDigits - 1

  const generatorConstraints: GeneratorConstraints = {
    numberRange: { min: 1, max: maxValue },
    minTerms: constraints.termCount?.min || 3,
    maxTerms: constraints.termCount?.max || 5,
    problemCount: 1,
  }

  const generatedProblem = generateSingleProblem(
    generatorConstraints,
    requiredSkills,
    constraints.targetSkills,
    constraints.forbiddenSkills
  )

  if (generatedProblem) {
    return {
      terms: generatedProblem.terms,
      answer: generatedProblem.answer,
      skillsRequired: generatedProblem.requiredSkills,
      generationTrace: generatedProblem.generationTrace,
    }
  }

  // No fallback - surface the error so it can be addressed
  throw new ProblemGenerationError(
    `Failed to generate problem with constraints: termCount=${constraints.termCount?.min}-${constraints.termCount?.max}, ` +
      `digitRange=${constraints.digitRange?.min}-${constraints.digitRange?.max}, ` +
      `requiredSkills=${Object.keys(constraints.requiredSkills || {}).length} categories`,
    constraints
  )
}
