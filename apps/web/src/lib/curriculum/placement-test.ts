import type { SkillSet } from '@/types/tutorial'
import { createBasicSkillSet } from '@/types/tutorial'
import { generateSingleProblem, type ProblemConstraints } from '@/utils/problemGenerator'

/**
 * Configurable thresholds for placement test
 */
export interface PlacementThresholds {
  /** Consecutive correct answers to mark skill as "practicing" */
  practicingConsecutive: number
  /** Total correct answers needed for "mastered" */
  masteredTotal: number
  /** Minimum accuracy (0-1) for "mastered" */
  masteredAccuracy: number
  /** Consecutive wrong answers to stop testing a skill */
  stopOnWrong: number
}

/**
 * Preset threshold configurations
 */
export const THRESHOLD_PRESETS = {
  quick: {
    name: 'Quick Assessment',
    description: 'Fewer problems, faster results',
    thresholds: {
      practicingConsecutive: 2,
      masteredTotal: 3,
      masteredAccuracy: 0.8,
      stopOnWrong: 2,
    } as PlacementThresholds,
  },
  standard: {
    name: 'Standard',
    description: 'Balanced assessment',
    thresholds: {
      practicingConsecutive: 3,
      masteredTotal: 5,
      masteredAccuracy: 0.85,
      stopOnWrong: 2,
    } as PlacementThresholds,
  },
  thorough: {
    name: 'Thorough',
    description: 'More confidence, more problems',
    thresholds: {
      practicingConsecutive: 4,
      masteredTotal: 7,
      masteredAccuracy: 0.9,
      stopOnWrong: 3,
    } as PlacementThresholds,
  },
} as const

export type PresetKey = keyof typeof THRESHOLD_PRESETS

export const DEFAULT_THRESHOLDS = THRESHOLD_PRESETS.standard.thresholds

/**
 * Order of skills to test (follows curriculum progression)
 */
export const SKILL_ORDER = [
  // Basic addition
  'basic.directAddition',
  'basic.heavenBead',
  'basic.simpleCombinations',
  // Basic subtraction
  'basic.directSubtraction',
  'basic.heavenBeadSubtraction',
  'basic.simpleCombinationsSub',
  // Five complements addition
  'fiveComplements.4=5-1',
  'fiveComplements.3=5-2',
  'fiveComplements.2=5-3',
  'fiveComplements.1=5-4',
  // Five complements subtraction
  'fiveComplementsSub.-4=-5+1',
  'fiveComplementsSub.-3=-5+2',
  'fiveComplementsSub.-2=-5+3',
  'fiveComplementsSub.-1=-5+4',
  // Ten complements addition
  'tenComplements.9=10-1',
  'tenComplements.8=10-2',
  'tenComplements.7=10-3',
  'tenComplements.6=10-4',
  'tenComplements.5=10-5',
  'tenComplements.4=10-6',
  'tenComplements.3=10-7',
  'tenComplements.2=10-8',
  'tenComplements.1=10-9',
  // Ten complements subtraction
  'tenComplementsSub.-9=+1-10',
  'tenComplementsSub.-8=+2-10',
  'tenComplementsSub.-7=+3-10',
  'tenComplementsSub.-6=+4-10',
  'tenComplementsSub.-5=+5-10',
  'tenComplementsSub.-4=+6-10',
  'tenComplementsSub.-3=+7-10',
  'tenComplementsSub.-2=+8-10',
  'tenComplementsSub.-1=+9-10',
] as const

/**
 * Human-readable skill names
 */
export const SKILL_NAMES: Record<string, string> = {
  'basic.directAddition': 'Direct Addition (1-4)',
  'basic.heavenBead': 'Heaven Bead (5)',
  'basic.simpleCombinations': 'Simple Combinations (6-9)',
  'basic.directSubtraction': 'Direct Subtraction (1-4)',
  'basic.heavenBeadSubtraction': 'Heaven Bead Subtraction (5)',
  'basic.simpleCombinationsSub': 'Simple Combinations Subtraction (6-9)',
  'fiveComplements.4=5-1': '+4 = +5 - 1',
  'fiveComplements.3=5-2': '+3 = +5 - 2',
  'fiveComplements.2=5-3': '+2 = +5 - 3',
  'fiveComplements.1=5-4': '+1 = +5 - 4',
  'fiveComplementsSub.-4=-5+1': '-4 = -5 + 1',
  'fiveComplementsSub.-3=-5+2': '-3 = -5 + 2',
  'fiveComplementsSub.-2=-5+3': '-2 = -5 + 3',
  'fiveComplementsSub.-1=-5+4': '-1 = -5 + 4',
  'tenComplements.9=10-1': '+9 = +10 - 1',
  'tenComplements.8=10-2': '+8 = +10 - 2',
  'tenComplements.7=10-3': '+7 = +10 - 3',
  'tenComplements.6=10-4': '+6 = +10 - 4',
  'tenComplements.5=10-5': '+5 = +10 - 5',
  'tenComplements.4=10-6': '+4 = +10 - 6',
  'tenComplements.3=10-7': '+3 = +10 - 7',
  'tenComplements.2=10-8': '+2 = +10 - 8',
  'tenComplements.1=10-9': '+1 = +10 - 9',
  'tenComplementsSub.-9=+1-10': '-9 = +1 - 10',
  'tenComplementsSub.-8=+2-10': '-8 = +2 - 10',
  'tenComplementsSub.-7=+3-10': '-7 = +3 - 10',
  'tenComplementsSub.-6=+4-10': '-6 = +4 - 10',
  'tenComplementsSub.-5=+5-10': '-5 = +5 - 10',
  'tenComplementsSub.-4=+6-10': '-4 = +6 - 10',
  'tenComplementsSub.-3=+7-10': '-3 = +7 - 10',
  'tenComplementsSub.-2=+8-10': '-2 = +8 - 10',
  'tenComplementsSub.-1=+9-10': '-1 = +9 - 10',
}

/**
 * State of testing for a single skill
 */
export interface SkillTestState {
  skillId: string
  attempts: number
  correct: number
  consecutive: number
  consecutiveWrong: number
  status: 'pending' | 'testing' | 'mastered' | 'practicing' | 'stopped'
}

/**
 * Overall placement test state
 */
export interface PlacementTestState {
  /** Current skill index in SKILL_ORDER */
  currentSkillIndex: number
  /** Test state for each skill */
  skillStates: Map<string, SkillTestState>
  /** Problems answered so far */
  problemsAnswered: number
  /** Total correct answers */
  totalCorrect: number
  /** Thresholds being used */
  thresholds: PlacementThresholds
  /** Whether the test is complete */
  isComplete: boolean
  /** Current problem (if testing) */
  currentProblem: { terms: number[]; answer: number } | null
}

/**
 * Initialize placement test state
 */
export function initializePlacementTest(
  thresholds: PlacementThresholds = DEFAULT_THRESHOLDS
): PlacementTestState {
  const skillStates = new Map<string, SkillTestState>()

  for (const skillId of SKILL_ORDER) {
    skillStates.set(skillId, {
      skillId,
      attempts: 0,
      correct: 0,
      consecutive: 0,
      consecutiveWrong: 0,
      status: 'pending',
    })
  }

  // Start testing the first skill
  const firstSkillState = skillStates.get(SKILL_ORDER[0])
  if (firstSkillState) {
    firstSkillState.status = 'testing'
  }

  return {
    currentSkillIndex: 0,
    skillStates,
    problemsAnswered: 0,
    totalCorrect: 0,
    thresholds,
    isComplete: false,
    currentProblem: null,
  }
}

/**
 * Get skill set that enables all skills up to and including the current skill
 */
function getSkillSetForTesting(currentSkillId: string): SkillSet {
  const skillSet = createBasicSkillSet()

  const currentIndex = SKILL_ORDER.indexOf(currentSkillId as (typeof SKILL_ORDER)[number])
  if (currentIndex === -1) return skillSet

  // Enable all skills up to and including current
  for (let i = 0; i <= currentIndex; i++) {
    const skillId = SKILL_ORDER[i]
    const [category, skill] = skillId.split('.')

    if (category === 'basic') {
      ;(skillSet.basic as Record<string, boolean>)[skill] = true
    } else if (category === 'fiveComplements') {
      ;(skillSet.fiveComplements as Record<string, boolean>)[skill] = true
    } else if (category === 'fiveComplementsSub') {
      ;(skillSet.fiveComplementsSub as Record<string, boolean>)[skill] = true
    } else if (category === 'tenComplements') {
      ;(skillSet.tenComplements as Record<string, boolean>)[skill] = true
    } else if (category === 'tenComplementsSub') {
      ;(skillSet.tenComplementsSub as Record<string, boolean>)[skill] = true
    }
  }

  return skillSet
}

/**
 * Generate a problem targeting the current skill
 */
export function generateProblemForSkill(
  skillId: string
): { terms: number[]; answer: number } | null {
  const skillSet = getSkillSetForTesting(skillId)

  // Determine if this is a ten complements skill (needs larger numbers)
  const isTenComplement = skillId.startsWith('tenComplements')

  const constraints: ProblemConstraints = {
    numberRange: { min: 1, max: isTenComplement ? 99 : 9 },
    maxTerms: 3,
    problemCount: 1,
  }

  // Target the specific skill we're testing
  const [category, skill] = skillId.split('.')
  const targetSkills: Partial<SkillSet> = {}

  if (category === 'basic') {
    targetSkills.basic = { [skill]: true } as SkillSet['basic']
  } else if (category === 'fiveComplements') {
    targetSkills.fiveComplements = {
      [skill]: true,
    } as SkillSet['fiveComplements']
  } else if (category === 'fiveComplementsSub') {
    targetSkills.fiveComplementsSub = {
      [skill]: true,
    } as SkillSet['fiveComplementsSub']
  } else if (category === 'tenComplements') {
    targetSkills.tenComplements = {
      [skill]: true,
    } as SkillSet['tenComplements']
  } else if (category === 'tenComplementsSub') {
    targetSkills.tenComplementsSub = {
      [skill]: true,
    } as SkillSet['tenComplementsSub']
  }

  const problem = generateSingleProblem(constraints, skillSet, targetSkills)

  if (problem) {
    return { terms: problem.terms, answer: problem.answer }
  }

  // Fallback if generation fails
  return null
}

/**
 * Record an answer and update test state
 */
export function recordAnswer(state: PlacementTestState, isCorrect: boolean): PlacementTestState {
  const currentSkillId = SKILL_ORDER[state.currentSkillIndex]
  const skillState = state.skillStates.get(currentSkillId)

  if (!skillState || skillState.status !== 'testing') {
    return state
  }

  // Update skill stats
  skillState.attempts++
  if (isCorrect) {
    skillState.correct++
    skillState.consecutive++
    skillState.consecutiveWrong = 0
  } else {
    skillState.consecutive = 0
    skillState.consecutiveWrong++
  }

  // Check if skill should transition to mastered, practicing, or stopped
  const { thresholds } = state
  const accuracy = skillState.attempts > 0 ? skillState.correct / skillState.attempts : 0

  if (skillState.correct >= thresholds.masteredTotal && accuracy >= thresholds.masteredAccuracy) {
    skillState.status = 'mastered'
  } else if (skillState.consecutive >= thresholds.practicingConsecutive) {
    skillState.status = 'practicing'
  } else if (skillState.consecutiveWrong >= thresholds.stopOnWrong) {
    skillState.status = 'stopped'
  }

  // Update overall stats
  const newState: PlacementTestState = {
    ...state,
    problemsAnswered: state.problemsAnswered + 1,
    totalCorrect: state.totalCorrect + (isCorrect ? 1 : 0),
  }

  // If current skill is done (mastered, practicing, or stopped), move to next
  if (skillState.status !== 'testing') {
    const nextSkillIndex = findNextTestableSkill(newState)

    if (nextSkillIndex === -1) {
      // All skills tested
      newState.isComplete = true
      newState.currentProblem = null
    } else {
      newState.currentSkillIndex = nextSkillIndex
      const nextSkillState = newState.skillStates.get(SKILL_ORDER[nextSkillIndex])
      if (nextSkillState) {
        nextSkillState.status = 'testing'
      }
    }
  }

  return newState
}

/**
 * Find the next skill that needs testing
 */
function findNextTestableSkill(state: PlacementTestState): number {
  // Check if any earlier skill was stopped - if so, skip skills that depend on it
  let lastStoppedCategory: string | null = null

  for (let i = 0; i < SKILL_ORDER.length; i++) {
    const skillId = SKILL_ORDER[i]
    const skillState = state.skillStates.get(skillId)

    if (skillState?.status === 'stopped') {
      // Mark the category as stopped
      const [category] = skillId.split('.')
      if (
        category === 'basic' ||
        category === 'fiveComplements' ||
        category === 'fiveComplementsSub'
      ) {
        lastStoppedCategory = category
      }
    }

    if (skillState?.status === 'pending') {
      // Check if this skill's prerequisites are met
      const [category] = skillId.split('.')

      // If basic skills are stopped, don't test higher skills
      if (lastStoppedCategory === 'basic') {
        continue
      }

      // If five complements are stopped, don't test ten complements in same operation type
      if (lastStoppedCategory === 'fiveComplements' && category === 'tenComplements') {
        continue
      }
      if (lastStoppedCategory === 'fiveComplementsSub' && category === 'tenComplementsSub') {
        continue
      }

      return i
    }
  }

  return -1
}

/**
 * Get placement test results summary
 */
export interface PlacementResults {
  masteredSkills: string[]
  practicingSkills: string[]
  totalProblems: number
  totalCorrect: number
  overallAccuracy: number
  /** Suggested level based on mastered skills */
  suggestedLevel: string
}

export function getPlacementResults(state: PlacementTestState): PlacementResults {
  const masteredSkills: string[] = []
  const practicingSkills: string[] = []

  for (const [skillId, skillState] of state.skillStates) {
    if (skillState.status === 'mastered') {
      masteredSkills.push(skillId)
    } else if (skillState.status === 'practicing') {
      practicingSkills.push(skillId)
    }
  }

  // Determine suggested level
  const hasTenComplements = masteredSkills.some((s) => s.startsWith('tenComplements'))
  const hasFiveComplements = masteredSkills.some((s) => s.startsWith('fiveComplements'))
  const hasBasics = masteredSkills.some((s) => s.startsWith('basic'))

  let suggestedLevel = 'Beginner'
  if (hasTenComplements) {
    suggestedLevel = 'Level 3 - Ten Complements'
  } else if (hasFiveComplements) {
    suggestedLevel = 'Level 2 - Five Complements'
  } else if (hasBasics) {
    suggestedLevel = 'Level 1 - Basic Operations'
  }

  return {
    masteredSkills,
    practicingSkills,
    totalProblems: state.problemsAnswered,
    totalCorrect: state.totalCorrect,
    overallAccuracy: state.problemsAnswered > 0 ? state.totalCorrect / state.problemsAnswered : 0,
    suggestedLevel,
  }
}
