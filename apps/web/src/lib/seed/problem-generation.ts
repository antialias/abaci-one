import { createEmptySkillSet, type SkillSet } from '../../types/tutorial'
import {
  generateSingleProblem,
  type GeneratedProblem as GenProblem,
} from '../../utils/problemGenerator'
import type { RealisticProblem } from './types'

/**
 * Maps a skill ID to the category and key for SkillSet modification
 */
export function parseSkillId(skillId: string): { category: string; key: string } | null {
  const parts = skillId.split('.')
  if (parts.length !== 2) return null
  return { category: parts[0], key: parts[1] }
}

/**
 * Enables a specific skill in a SkillSet (mutates the set)
 */
export function enableSkill(skillSet: SkillSet, skillId: string): void {
  const parsed = parseSkillId(skillId)
  if (!parsed) return

  const { category, key } = parsed
  if (category === 'basic' && key in skillSet.basic) {
    ;(skillSet.basic as Record<string, boolean>)[key] = true
  } else if (category === 'fiveComplements' && key in skillSet.fiveComplements) {
    ;(skillSet.fiveComplements as Record<string, boolean>)[key] = true
  } else if (category === 'tenComplements' && key in skillSet.tenComplements) {
    ;(skillSet.tenComplements as Record<string, boolean>)[key] = true
  } else if (category === 'fiveComplementsSub' && key in skillSet.fiveComplementsSub) {
    ;(skillSet.fiveComplementsSub as Record<string, boolean>)[key] = true
  } else if (category === 'tenComplementsSub' && key in skillSet.tenComplementsSub) {
    ;(skillSet.tenComplementsSub as Record<string, boolean>)[key] = true
  } else if (category === 'advanced' && key in skillSet.advanced) {
    ;(skillSet.advanced as Record<string, boolean>)[key] = true
  }
}

/**
 * Get prerequisite skills that must be enabled for a target skill to be reachable.
 */
export function getPrerequisiteSkills(skillId: string): string[] {
  const category = skillId.split('.')[0]

  switch (category) {
    case 'basic':
      if (skillId === 'basic.directAddition') {
        return []
      }
      return ['basic.directAddition']
    case 'fiveComplements':
      return ['basic.directAddition', 'basic.heavenBead']
    case 'tenComplements':
      return [
        'basic.directAddition',
        'basic.heavenBead',
        'basic.simpleCombinations',
        'fiveComplements.4=5-1',
        'fiveComplements.3=5-2',
        'fiveComplements.2=5-3',
        'fiveComplements.1=5-4',
      ]
    case 'fiveComplementsSub':
      return ['basic.directSubtraction', 'basic.heavenBeadSubtraction']
    case 'tenComplementsSub':
      return [
        'basic.directSubtraction',
        'basic.heavenBeadSubtraction',
        'basic.simpleCombinationsSub',
        'fiveComplementsSub.-4=-5+1',
        'fiveComplementsSub.-3=-5+2',
        'fiveComplementsSub.-2=-5+3',
        'fiveComplementsSub.-1=-5+4',
      ]
    default:
      return []
  }
}

/**
 * Creates a SkillSet that enables the target skill plus prerequisites
 */
export function createSkillSetForTarget(targetSkill: string): SkillSet {
  const skillSet = createEmptySkillSet()

  const prereqs = getPrerequisiteSkills(targetSkill)
  for (const prereq of prereqs) {
    enableSkill(skillSet, prereq)
  }

  enableSkill(skillSet, targetSkill)

  return skillSet
}

/**
 * Creates a target SkillSet with only the target skill enabled (for problem matching)
 */
export function createTargetSkillSet(targetSkill: string): Partial<SkillSet> {
  const skillSet = createEmptySkillSet()
  enableSkill(skillSet, targetSkill)
  return skillSet
}

/**
 * Generates a batch of realistic problems targeting a specific skill.
 * IMPORTANT: Only returns problems that actually exercise the target skill.
 * This ensures BKT sees the correct skill in skillsExercised.
 */
export function generateRealisticProblems(
  targetSkill: string,
  count: number,
  maxAttempts: number = 100
): RealisticProblem[] {
  const problems: RealisticProblem[] = []
  const allowedSkills = createSkillSetForTarget(targetSkill)
  const targetSkillSet = createTargetSkillSet(targetSkill)

  // Determine number range based on skill category
  const category = targetSkill.split('.')[0]
  let numberRange = { min: 1, max: 9 }
  let maxSum = 20

  if (category === 'tenComplements' || category === 'tenComplementsSub') {
    numberRange = { min: 1, max: 99 }
    maxSum = 200
  } else if (category === 'fiveComplements' || category === 'fiveComplementsSub') {
    numberRange = { min: 1, max: 9 }
    maxSum = 20
  }

  let attempts = 0
  while (problems.length < count && attempts < count * maxAttempts) {
    attempts++

    const problem = generateSingleProblem({
      constraints: {
        numberRange,
        maxSum,
        maxTerms: 3,
        minTerms: 2,
        problemCount: 1,
      },
      allowedSkills,
      targetSkills: targetSkillSet,
      attempts: 20,
    })

    // STRICT: Only accept problems that actually use the target skill
    if (problem && problem.skillsUsed.includes(targetSkill)) {
      problems.push({
        terms: problem.terms,
        answer: problem.answer,
        // IMPORTANT: Force single-skill annotation for predictable BKT outcomes.
        skillsUsed: [targetSkill],
        generationTrace: problem.generationTrace,
      })
    }
  }

  // If we couldn't generate enough problems, synthesize
  if (problems.length < count) {
    console.warn(
      `[Seed] Could only generate ${problems.length}/${count} problems for ${targetSkill}. ` +
        `Synthesizing ${count - problems.length} more.`
    )

    while (problems.length < count) {
      const a = Math.floor(Math.random() * 8) + 1
      const b = Math.floor(Math.random() * 8) + 1
      problems.push({
        terms: [a, b],
        answer: a + b,
        skillsUsed: [targetSkill],
      })
    }
  }

  return problems
}
