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
  analyzeRequiredSkills,
  type ProblemConstraints as GeneratorConstraints,
  generateSingleProblem,
} from '@/utils/problemGenerator'

/**
 * Generate a problem from slot constraints using the skill-based algorithm.
 *
 * @param constraints - The constraints for problem generation (skills, digit range, term count)
 * @returns A generated problem with terms, answer, and skills required
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

  // Fallback: generate a simple random problem if skill-based generation fails
  const termCount = constraints.termCount?.min || 3
  const terms: number[] = []
  for (let i = 0; i < termCount; i++) {
    terms.push(Math.floor(Math.random() * Math.min(maxValue, 9)) + 1)
  }
  const answer = terms.reduce((sum, t) => sum + t, 0)
  const skillsRequired = analyzeRequiredSkills(terms, answer)

  return {
    terms,
    answer,
    skillsRequired,
  }
}
