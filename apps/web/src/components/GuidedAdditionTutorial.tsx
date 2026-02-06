'use client'

import { AbacusReact, type ValidPlaceValues } from '@soroban/abacus-react'

type EarthBeadPosition = 0 | 1 | 2 | 3
import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../styled-system/css'
import { hstack, stack } from '../../styled-system/patterns'

// Type-safe tutorial bead helper functions
const _TutorialBeads = {
  ones: {
    earth: (position: EarthBeadPosition) => ({
      placeValue: 0,
      beadType: 'earth' as const,
      position,
    }),
    heaven: () => ({
      placeValue: 0,
      beadType: 'heaven' as const,
    }),
  },
  tens: {
    earth: (position: EarthBeadPosition) => ({
      placeValue: 1,
      beadType: 'earth' as const,
      position,
    }),
    heaven: () => ({
      placeValue: 1,
      beadType: 'heaven' as const,
    }),
  },
} as const

interface TutorialStep {
  id: string
  title: string
  problem: string
  description: string
  startValue: number
  targetValue: number
  highlightBeads?: Array<{
    placeValue: ValidPlaceValues // Type-safe place values (0=ones, 1=tens, etc.)
    beadType: 'heaven' | 'earth'
    position?: EarthBeadPosition // Type-safe earth bead positions (0-3)
  }>
  expectedAction: 'add' | 'remove' | 'multi-step'
  actionDescription: string
  tooltip: {
    content: string
    explanation: string
  }
  errorMessages: {
    wrongBead: string
    wrongAction: string
    hint: string
  }
  multiStepInstructions?: string[]
}

interface PracticeStep {
  id: string
  title: string
  description: string
  skillLevel: 'basic' | 'heaven' | 'five-complements' | 'mixed'
  problemCount: number
  maxTerms: number // max numbers to add in a single problem
}

interface Problem {
  id: string
  terms: number[]
  userAnswer?: number
  isCorrect?: boolean
}

const tutorialSteps: TutorialStep[] = [
  // Phase 1: Basic Addition (1-4)
  {
    id: 'basic-1',
    title: 'Basic Addition: 0 + 1',
    problem: '0 + 1',
    description: 'Start by adding your first earth bead',
    startValue: 0,
    targetValue: 1,
    highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
    expectedAction: 'add',
    actionDescription: 'Click the first earth bead to move it up',
    tooltip: {
      content: 'Adding earth beads',
      explanation: 'Earth beads (bottom) are worth 1 each. Push them UP to activate them.',
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead at the bottom',
      wrongAction: 'Move the bead UP to add it',
      hint: 'Earth beads move up when adding numbers 1-4',
    },
  },
  {
    id: 'basic-2',
    title: 'Basic Addition: 1 + 1',
    problem: '1 + 1',
    description: 'Add the second earth bead to make 2',
    startValue: 1,
    targetValue: 2,
    highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 1 }],
    expectedAction: 'add',
    actionDescription: 'Click the second earth bead to move it up',
    tooltip: {
      content: 'Building up earth beads',
      explanation: 'Continue adding earth beads one by one for numbers 2, 3, and 4',
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead',
      wrongAction: 'Move the bead UP to add it',
      hint: 'You need 2 earth beads for the number 2',
    },
  },
  {
    id: 'basic-3',
    title: 'Basic Addition: 2 + 1',
    problem: '2 + 1',
    description: 'Add the third earth bead to make 3',
    startValue: 2,
    targetValue: 3,
    highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 2 }],
    expectedAction: 'add',
    actionDescription: 'Click the third earth bead to move it up',
    tooltip: {
      content: 'Adding earth beads in sequence',
      explanation: 'Continue adding earth beads one by one until you reach 4',
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead',
      wrongAction: 'Move the bead UP to add it',
      hint: 'You need 3 earth beads for the number 3',
    },
  },
  {
    id: 'basic-4',
    title: 'Basic Addition: 3 + 1',
    problem: '3 + 1',
    description: 'Add the fourth earth bead to make 4',
    startValue: 3,
    targetValue: 4,
    highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 3 }],
    expectedAction: 'add',
    actionDescription: 'Click the fourth earth bead to complete 4',
    tooltip: {
      content: 'Maximum earth beads',
      explanation: 'Four earth beads is the maximum - next we need a different approach',
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead',
      wrongAction: 'Move the bead UP to add it',
      hint: 'Four earth beads represent the number 4',
    },
  },

  // Phase 2: Introduction to Heaven Bead
  {
    id: 'heaven-intro',
    title: 'Heaven Bead: 0 + 5',
    problem: '0 + 5',
    description: 'Use the heaven bead to represent 5',
    startValue: 0,
    targetValue: 5,
    highlightBeads: [{ placeValue: 0, beadType: 'heaven' }],
    expectedAction: 'add',
    actionDescription: 'Click the heaven bead to activate it',
    tooltip: {
      content: 'Heaven bead = 5',
      explanation: 'The single bead above the bar represents 5',
    },
    errorMessages: {
      wrongBead: 'Click the heaven bead at the top',
      wrongAction: 'Move the heaven bead DOWN to activate it',
      hint: 'The heaven bead is worth 5 points',
    },
  },
  {
    id: 'heaven-plus-earth',
    title: 'Combining: 5 + 1',
    problem: '5 + 1',
    description: 'Add 1 to 5 by activating one earth bead',
    startValue: 5,
    targetValue: 6,
    highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
    expectedAction: 'add',
    actionDescription: 'Click the first earth bead to make 6',
    tooltip: {
      content: 'Heaven + Earth = 6',
      explanation: 'When you have room in the earth section, simply add directly',
    },
    errorMessages: {
      wrongBead: 'Click the first earth bead',
      wrongAction: 'Move the earth bead UP to add it',
      hint: 'With the heaven bead active, add earth beads for 6, 7, 8, 9',
    },
  },

  // Phase 3: Five Complements (when earth section is full)
  {
    id: 'complement-intro',
    title: 'Five Complement: 3 + 4',
    problem: '3 + 4',
    description: 'Need to add 4, but only have 1 earth bead space. Use complement: 4 = 5 - 1',
    startValue: 3,
    targetValue: 7,
    highlightBeads: [
      { placeValue: 0, beadType: 'heaven' },
      { placeValue: 0, beadType: 'earth', position: 0 },
    ],
    expectedAction: 'multi-step',
    actionDescription: 'First add heaven bead (5), then remove 1 earth bead',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click the first earth bead to remove 1',
    ],
    tooltip: {
      content: 'Five Complement: 4 = 5 - 1',
      explanation: 'When you need to add 4 but only have 1 space, use: add 5, remove 1',
    },
    errorMessages: {
      wrongBead: 'Follow the two-step process: heaven bead first, then remove earth bead',
      wrongAction: 'Add heaven bead, then remove earth bead',
      hint: 'Complement thinking: 4 = 5 - 1, so add 5 and take away 1',
    },
  },
  {
    id: 'complement-2',
    title: 'Five Complement: 2 + 4',
    problem: '2 + 4',
    description: 'Add 4 when you have 2 spaces. Use complement: 4 = 5 - 1',
    startValue: 2,
    targetValue: 6,
    highlightBeads: [
      { placeValue: 0, beadType: 'heaven' },
      { placeValue: 0, beadType: 'earth', position: 0 },
    ],
    expectedAction: 'multi-step',
    actionDescription: 'Add heaven bead (5), then remove 1 earth bead',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click the first earth bead to remove 1',
    ],
    tooltip: {
      content: 'Same complement: 4 = 5 - 1',
      explanation: 'Even with space for 2, using complement for 4 is more efficient',
    },
    errorMessages: {
      wrongBead: 'Use the complement method: heaven bead, then remove earth bead',
      wrongAction: 'Add 5, then subtract 1',
      hint: 'Practice the complement: 4 = 5 - 1',
    },
  },
  {
    id: 'direct-addition-3',
    title: 'Direct Addition: 1 + 3',
    problem: '1 + 3',
    description: 'Add 3 to 1. You have space, so add directly.',
    startValue: 1,
    targetValue: 4,
    highlightBeads: [
      { placeValue: 0, beadType: 'earth', position: 1 },
      { placeValue: 0, beadType: 'earth', position: 2 },
      { placeValue: 0, beadType: 'earth', position: 3 },
    ],
    expectedAction: 'multi-step',
    actionDescription: 'Add 3 earth beads one by one',
    multiStepInstructions: [
      'Click the second earth bead to add it',
      'Click the third earth bead to add it',
      'Click the fourth earth bead to add it',
    ],
    tooltip: {
      content: 'Direct Addition - Check Your Space',
      explanation:
        'You have 1 earth bead up and need to add 3 more. Since there are 4 earth positions total, you have 3 spaces available - perfect!',
    },
    errorMessages: {
      wrongBead: 'Add the earth beads directly - you have space!',
      wrongAction: 'Move the earth beads UP to add them',
      hint: 'No complement needed! Just add the remaining 3 earth beads directly.',
    },
  },
  {
    id: 'complement-4',
    title: 'Five Complement: 4 + 2',
    problem: '4 + 2',
    description: 'Add 2 when you have no earth space. Use complement: 2 = 5 - 3',
    startValue: 4,
    targetValue: 6,
    highlightBeads: [
      { placeValue: 0, beadType: 'heaven' },
      { placeValue: 0, beadType: 'earth', position: 0 },
      { placeValue: 0, beadType: 'earth', position: 1 },
      { placeValue: 0, beadType: 'earth', position: 2 },
    ],
    expectedAction: 'multi-step',
    actionDescription: 'Add heaven bead (5), then remove 3 earth beads',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click the first earth bead to remove it',
      'Click the second earth bead to remove it',
      'Click the third earth bead to remove it',
    ],
    tooltip: {
      content: 'Five Complement: 2 = 5 - 3',
      explanation: 'To add 2 when earth section is full: add 5, then subtract 3',
    },
    errorMessages: {
      wrongBead: 'Use complement: add heaven, remove 3 earth beads',
      wrongAction: 'Add 5, then subtract 3',
      hint: 'Complement: 2 = 5 - 3',
    },
  },
  {
    id: 'complement-5',
    title: 'Five Complement: 4 + 1',
    problem: '4 + 1',
    description: 'Add 1 when earth section is full. Use complement: 1 = 5 - 4',
    startValue: 4,
    targetValue: 5,
    highlightBeads: [
      { placeValue: 0, beadType: 'heaven' },
      { placeValue: 0, beadType: 'earth', position: 0 },
      { placeValue: 0, beadType: 'earth', position: 1 },
      { placeValue: 0, beadType: 'earth', position: 2 },
      { placeValue: 0, beadType: 'earth', position: 3 },
    ],
    expectedAction: 'multi-step',
    actionDescription: 'Add heaven bead (5), then remove all 4 earth beads',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click all 4 earth beads to remove them (they should all go down)',
    ],
    tooltip: {
      content: 'Five Complement: 1 = 5 - 4',
      explanation: 'To add 1 when no space: add 5, then subtract 4 (remove all earth beads)',
    },
    errorMessages: {
      wrongBead: 'Add heaven bead, then remove all 4 earth beads',
      wrongAction: 'Add 5, then subtract 4',
      hint: 'Complement: 1 = 5 - 4, so add heaven and remove all earth',
    },
  },

  // Phase 4: Practice mixed problems
  {
    id: 'mixed-1',
    title: 'Practice: 2 + 3',
    problem: '2 + 3',
    description: 'Add 3 to 2. You have space, so add directly.',
    startValue: 2,
    targetValue: 5,
    highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 2 }],
    expectedAction: 'add',
    actionDescription: 'Add the third earth bead to complete 5',
    tooltip: {
      content: 'Direct Addition',
      explanation:
        'Since you have space (only 2 earth beads are up), simply add the third earth bead',
    },
    errorMessages: {
      wrongBead: 'Click the highlighted third earth bead',
      wrongAction: 'Move the earth bead UP to add it',
      hint: 'You have space for one more earth bead - no complement needed!',
    },
  },
  {
    id: 'mixed-2',
    title: 'Practice: 1 + 4',
    problem: '1 + 4',
    description: 'Add 4 to 1. Must use complement: 4 = 5 - 1',
    startValue: 1,
    targetValue: 5,
    highlightBeads: [
      { placeValue: 0, beadType: 'heaven' },
      { placeValue: 0, beadType: 'earth', position: 0 },
    ],
    expectedAction: 'multi-step',
    actionDescription: 'Add heaven bead (5), then remove 1 earth bead',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click the first earth bead to remove 1',
    ],
    tooltip: {
      content: 'Must use complement',
      explanation: 'No space for 4 earth beads, so use 4 = 5 - 1',
    },
    errorMessages: {
      wrongBead: 'Use complement: heaven bead then remove earth bead',
      wrongAction: 'Add 5, subtract 1',
      hint: 'Only way to add 4: use complement 4 = 5 - 1',
    },
  },
]

const practiceSteps: PracticeStep[] = [
  {
    id: 'practice-basic',
    title: 'Practice: Basic Addition (1-4)',
    description: 'Practice adding numbers 1-4 using only earth beads',
    skillLevel: 'basic',
    problemCount: 12,
    maxTerms: 3,
  },
  {
    id: 'practice-heaven',
    title: 'Practice: Heaven Bead & Simple Combinations',
    description: 'Practice using the heaven bead (5) and combining it with earth beads',
    skillLevel: 'heaven',
    problemCount: 15,
    maxTerms: 3,
  },
  {
    id: 'practice-complements',
    title: 'Practice: Five Complements',
    description: 'Practice using five complements when you run out of space',
    skillLevel: 'five-complements',
    problemCount: 20,
    maxTerms: 4,
  },
  {
    id: 'practice-mixed',
    title: 'Practice: Mixed Problems',
    description: 'Practice all techniques together with varied problem types',
    skillLevel: 'mixed',
    problemCount: 18,
    maxTerms: 5,
  },
]

// Problem generation functions
function generateBasicProblems(count: number, maxTerms: number): Problem[] {
  const problems: Problem[] = []

  for (let i = 0; i < count; i++) {
    const termCount = Math.floor(Math.random() * (maxTerms - 1)) + 2 // 2-maxTerms terms
    const terms: number[] = []

    for (let j = 0; j < termCount; j++) {
      // Only use 1-4 for basic problems
      terms.push(Math.floor(Math.random() * 4) + 1)
    }

    // Ensure the sum doesn't exceed 9 (single digit)
    const sum = terms.reduce((a, b) => a + b, 0)
    if (sum <= 9) {
      problems.push({
        id: `basic-${i}`,
        terms,
      })
    } else {
      i-- // Try again if sum is too large
    }
  }

  return problems
}

function generateHeavenProblems(count: number, maxTerms: number): Problem[] {
  const problems: Problem[] = []

  for (let i = 0; i < count; i++) {
    const termCount = Math.floor(Math.random() * (maxTerms - 1)) + 2
    const terms: number[] = []

    for (let j = 0; j < termCount; j++) {
      // Use 1-9, but ensure at least one term needs heaven bead (5 or more)
      const num = Math.floor(Math.random() * 9) + 1
      terms.push(num)
    }

    // Ensure we have at least one 5+ or the sum involves 5+
    const hasLargeNum = terms.some((t) => t >= 5)
    const sum = terms.reduce((a, b) => a + b, 0)

    if ((hasLargeNum || sum >= 5) && sum <= 9) {
      problems.push({
        id: `heaven-${i}`,
        terms,
      })
    } else {
      i-- // Try again
    }
  }

  return problems
}

function generateComplementProblems(count: number, maxTerms: number): Problem[] {
  const problems: Problem[] = []

  for (let i = 0; i < count; i++) {
    const termCount = Math.floor(Math.random() * (maxTerms - 1)) + 2
    const terms: number[] = []

    // Generate problems that specifically require complements
    // This means having a situation where direct addition won't work
    const firstTerm = Math.floor(Math.random() * 4) + 1 // 1-4
    terms.push(firstTerm)

    // Add a term that forces complement usage
    const secondTerm = Math.floor(Math.random() * 3) + 3 // 3-5
    terms.push(secondTerm)

    // Maybe add more terms
    for (let j = 2; j < termCount; j++) {
      const num = Math.floor(Math.random() * 4) + 1 // 1-4
      terms.push(num)
    }

    const sum = terms.reduce((a, b) => a + b, 0)
    if (sum <= 9) {
      problems.push({
        id: `complement-${i}`,
        terms,
      })
    } else {
      i-- // Try again
    }
  }

  return problems
}

function generateMixedProblems(count: number, maxTerms: number): Problem[] {
  const problems: Problem[] = []

  for (let i = 0; i < count; i++) {
    const termCount = Math.floor(Math.random() * (maxTerms - 1)) + 2
    const terms: number[] = []

    for (let j = 0; j < termCount; j++) {
      // Use full range 1-9
      terms.push(Math.floor(Math.random() * 9) + 1)
    }

    const sum = terms.reduce((a, b) => a + b, 0)
    if (sum <= 9) {
      problems.push({
        id: `mixed-${i}`,
        terms,
      })
    } else {
      i-- // Try again
    }
  }

  return problems
}

function generateProblems(step: PracticeStep): Problem[] {
  switch (step.skillLevel) {
    case 'basic':
      return generateBasicProblems(step.problemCount, step.maxTerms)
    case 'heaven':
      return generateHeavenProblems(step.problemCount, step.maxTerms)
    case 'five-complements':
      return generateComplementProblems(step.problemCount, step.maxTerms)
    case 'mixed':
      return generateMixedProblems(step.problemCount, step.maxTerms)
    default:
      return []
  }
}

// Combined tutorial flow with practice steps interspersed
const combinedSteps = [
  // Basic addition tutorial steps
  tutorialSteps[0], // basic-1
  tutorialSteps[1], // basic-2
  tutorialSteps[2], // basic-3
  tutorialSteps[3], // basic-4

  // Practice basic addition
  practiceSteps[0], // practice-basic

  // Heaven bead tutorial steps
  tutorialSteps[4], // heaven-intro
  tutorialSteps[5], // heaven-plus-earth

  // Practice heaven bead
  practiceSteps[1], // practice-heaven

  // Five complements tutorial steps
  tutorialSteps[6], // complement-intro
  tutorialSteps[7], // complement-2
  tutorialSteps[8], // complement-3
  tutorialSteps[9], // complement-4
  tutorialSteps[10], // complement-5

  // Practice five complements
  practiceSteps[2], // practice-complements

  // Final mixed tutorial steps
  tutorialSteps[11], // mixed-1
  tutorialSteps[12], // mixed-2

  // Final mixed practice
  practiceSteps[3], // practice-mixed
]

type StepType = TutorialStep | PracticeStep

function isTutorialStep(step: StepType): step is TutorialStep {
  return 'problem' in step && 'startValue' in step
}

function isPracticeStep(step: StepType): step is PracticeStep {
  return 'skillLevel' in step && 'problemCount' in step
}

export function GuidedAdditionTutorial() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [currentValue, setCurrentValue] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState(false)
  const [multiStepProgress, setMultiStepProgress] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastProcessedValueRef = useRef<number | null>(null)

  // Practice-specific state
  const [currentProblems, setCurrentProblems] = useState<Problem[]>([])
  const [showPracticeResults, setShowPracticeResults] = useState(false)

  const currentStep = combinedSteps[currentStepIndex]
  const isLastStep = currentStepIndex === combinedSteps.length - 1

  const nextStep = useCallback(() => {
    if (isLastStep || isTransitioning) return

    setIsTransitioning(true)

    // Small delay to prevent UI flashing
    setTimeout(() => {
      const nextStepIndex = currentStepIndex + 1
      setCurrentStepIndex(nextStepIndex)

      const nextStep = combinedSteps[nextStepIndex]
      if (isTutorialStep(nextStep)) {
        setCurrentValue(nextStep.startValue)
      } else {
        // Practice step - generate problems
        const problems = generateProblems(nextStep)
        setCurrentProblems(problems)
        setCurrentValue(0)
        setShowPracticeResults(false)
      }

      setFeedback(null)
      setIsCorrect(false)
      setMultiStepProgress(0)
      setIsTransitioning(false)
      lastProcessedValueRef.current = null // Reset for new step
    }, 100)
  }, [currentStepIndex, isLastStep, isTransitioning])

  const checkStep = useCallback(
    (newValue: number | bigint) => {
      // Only check tutorial steps, not practice steps
      if (!isTutorialStep(currentStep)) return

      // Prevent processing the same value multiple times
      const numValue = Number(newValue)
      if (lastProcessedValueRef.current === numValue) return
      lastProcessedValueRef.current = numValue

      // Prevent multiple rapid calls during transitions
      if (isTransitioning) return

      if (currentStep.expectedAction === 'multi-step') {
        // Handle multi-step validation
        const targetSteps = currentStep.multiStepInstructions?.length || 2
        const nextProgress = multiStepProgress + 1

        if (nextProgress < targetSteps) {
          setMultiStepProgress(nextProgress)
          setFeedback(
            `Step ${nextProgress + 1} of ${targetSteps}: ${currentStep.multiStepInstructions?.[nextProgress] || 'Continue'}`
          )
          return
        }
      }

      if (numValue === currentStep.targetValue) {
        setIsCorrect(true)
        setFeedback('Perfect! Well done.')
        setMultiStepProgress(0)

        // Clear any existing transition timeout
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current)
        }

        // Auto-advance to next step after a brief delay
        transitionTimeoutRef.current = setTimeout(() => {
          if (currentStepIndex < combinedSteps.length - 1) {
            nextStep()
          }
          transitionTimeoutRef.current = null
        }, 1500)
      } else {
        setFeedback(currentStep.errorMessages.hint)
      }
    },
    [currentStep, multiStepProgress, currentStepIndex, nextStep, isTransitioning]
  )

  // Practice step functions
  const updateProblemAnswer = useCallback((problemId: string, answer: number) => {
    setCurrentProblems((prev) =>
      prev.map((p) => (p.id === problemId ? { ...p, userAnswer: answer } : p))
    )
  }, [])

  const checkPracticeWork = useCallback(() => {
    if (!isPracticeStep(currentStep)) return

    const updatedProblems = currentProblems.map((problem) => {
      const correctAnswer = problem.terms.reduce((sum, term) => sum + term, 0)
      return {
        ...problem,
        isCorrect: problem.userAnswer === correctAnswer,
      }
    })

    setCurrentProblems(updatedProblems)
    setShowPracticeResults(true)

    // Remove correct problems after a delay
    setTimeout(() => {
      const incorrectProblems = updatedProblems.filter((p) => !p.isCorrect)

      if (incorrectProblems.length === 0) {
        // All correct - advance to next step
        setFeedback('Perfect! All problems completed correctly.')
        setTimeout(() => {
          nextStep()
        }, 2000)
      } else {
        // Keep only incorrect problems
        setCurrentProblems(
          incorrectProblems.map((p) => ({
            ...p,
            userAnswer: undefined,
            isCorrect: undefined,
          }))
        )
        setShowPracticeResults(false)
        setFeedback(`${incorrectProblems.length} problem(s) need correction. Try again!`)

        setTimeout(() => {
          setFeedback(null)
        }, 3000)
      }
    }, 2000)
  }, [currentStep, currentProblems, nextStep])

  // Initialize practice problems when entering a practice step
  useEffect(() => {
    if (isPracticeStep(currentStep)) {
      const step = currentStep as PracticeStep
      let problems: Problem[] = []

      switch (step.skillLevel) {
        case 'basic':
          problems = generateBasicProblems(step.problemCount, step.maxTerms)
          break
        case 'heaven':
          problems = generateHeavenProblems(step.problemCount, step.maxTerms)
          break
        case 'five-complements':
          problems = generateComplementProblems(step.problemCount, step.maxTerms)
          break
        case 'mixed':
          problems = generateMixedProblems(step.problemCount, step.maxTerms)
          break
      }

      setCurrentProblems(problems)
      setShowPracticeResults(false)
    } else {
      // Reset practice state for tutorial steps
      setCurrentProblems([])
      setShowPracticeResults(false)
    }
  }, [currentStep])

  const resetTutorial = useCallback(() => {
    // Clear any pending transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }

    setCurrentStepIndex(0)
    setCurrentValue(
      combinedSteps[0] && isTutorialStep(combinedSteps[0]) ? combinedSteps[0].startValue : 0
    )
    setFeedback(null)
    setIsCorrect(false)
    setMultiStepProgress(0)
    setIsTransitioning(false)
    setCurrentProblems([])
    setShowPracticeResults(false)
    lastProcessedValueRef.current = null // Reset for restart
  }, [])

  return (
    <div className={stack({ gap: '6' })}>
      {/* Progress indicator */}
      <div
        className={css({
          bg: 'gray.100',
          rounded: 'full',
          h: '2',
          overflow: 'hidden',
        })}
      >
        <div
          className={css({
            bg: 'blue.500',
            h: 'full',
            transition: 'width',
            width: `${((currentStepIndex + 1) / combinedSteps.length) * 100}%`,
          })}
        />
      </div>

      {/* Step info */}
      <div
        className={css({
          textAlign: 'center',
          p: '4',
          bg: isPracticeStep(currentStep) ? 'purple.50' : 'blue.50',
          rounded: 'lg',
          border: '1px solid',
          borderColor: isPracticeStep(currentStep) ? 'purple.200' : 'blue.200',
        })}
      >
        <h4
          className={css({
            fontSize: 'lg',
            fontWeight: 'semibold',
            color: isPracticeStep(currentStep) ? 'purple.800' : 'blue.800',
            mb: '2',
          })}
        >
          Step {currentStepIndex + 1} of {combinedSteps.length}:{' '}
          {isPracticeStep(currentStep) ? currentStep.title : currentStep.title}
        </h4>
        {isPracticeStep(currentStep) ? (
          <p
            className={css({
              fontSize: 'md',
              color: 'purple.700',
              mb: '2',
            })}
          >
            Complete all problems using the techniques you've learned
          </p>
        ) : (
          <>
            <p
              className={css({
                fontSize: 'md',
                color: 'blue.700',
                mb: '2',
              })}
            >
              Problem: <strong>{currentStep.problem}</strong>
            </p>
            <p
              className={css({
                fontSize: 'sm',
                color: 'blue.600',
              })}
            >
              {currentStep.description}
            </p>
          </>
        )}
      </div>

      {/* Tutorial tooltip or Practice problems */}
      {isPracticeStep(currentStep) ? (
        <div
          className={css({
            bg: 'purple.50',
            border: '1px solid',
            borderColor: 'purple.300',
            rounded: 'lg',
            p: '4',
          })}
        >
          <h5
            className={css({
              fontWeight: 'semibold',
              color: 'purple.800',
              mb: '4',
              textAlign: 'center',
            })}
          >
            Practice Problems
          </h5>

          {/* Problem grid */}
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '3',
              mb: '4',
            })}
          >
            {currentProblems.map((problem, index) => (
              <div
                key={problem.id}
                className={css({
                  p: '3',
                  bg: 'white',
                  border: '1px solid',
                  borderColor:
                    problem.isCorrect === true
                      ? 'green.300'
                      : problem.isCorrect === false
                        ? 'red.300'
                        : 'gray.300',
                  rounded: 'md',
                  textAlign: 'center',
                })}
              >
                <div
                  className={css({
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: 'gray.600',
                    mb: '2',
                  })}
                >
                  #{index + 1}
                </div>
                <div
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'semibold',
                    mb: '2',
                  })}
                >
                  {problem.terms.join(' + ')} = ?
                </div>
                <input
                  type="number"
                  value={problem.userAnswer || ''}
                  onChange={(e) =>
                    updateProblemAnswer(problem.id, parseInt(e.target.value, 10) || 0)
                  }
                  className={css({
                    w: 'full',
                    p: '2',
                    border: '1px solid',
                    borderColor: 'gray.300',
                    rounded: 'md',
                    textAlign: 'center',
                    fontSize: 'md',
                  })}
                  placeholder="Answer"
                />
                {showPracticeResults && problem.isCorrect === false && (
                  <div
                    className={css({
                      mt: '2',
                      fontSize: 'sm',
                      color: 'red.600',
                    })}
                  >
                    Incorrect. Try again!
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Check work button */}
          {!showPracticeResults && currentProblems.length > 0 && (
            <div className={css({ textAlign: 'center' })}>
              <button
                onClick={checkPracticeWork}
                className={css({
                  px: '6',
                  py: '3',
                  bg: 'purple.500',
                  color: 'white',
                  rounded: 'lg',
                  fontWeight: 'semibold',
                  cursor: 'pointer',
                  _hover: { bg: 'purple.600' },
                })}
              >
                Check Work
              </button>
            </div>
          )}

          {/* Continue button after all problems correct */}
          {showPracticeResults && currentProblems.every((p) => p.isCorrect) && (
            <div className={css({ textAlign: 'center' })}>
              <p
                className={css({
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  color: 'green.600',
                  mb: '3',
                })}
              >
                🎉 All problems correct! Great job!
              </p>
              <button
                onClick={nextStep}
                className={css({
                  px: '6',
                  py: '3',
                  bg: 'green.500',
                  color: 'white',
                  rounded: 'lg',
                  fontWeight: 'semibold',
                  cursor: 'pointer',
                  _hover: { bg: 'green.600' },
                })}
              >
                Continue Tutorial
              </button>
            </div>
          )}

          {/* Practice Abacus */}
          <div
            className={css({
              bg: 'white',
              border: '2px solid',
              borderColor: 'purple.300',
              rounded: 'xl',
              p: '4',
              display: 'flex',
              justifyContent: 'center',
              minHeight: '350px',
              alignItems: 'center',
              overflow: 'visible',
            })}
          >
            <div style={{ width: 'fit-content', height: 'fit-content' }}>
              <AbacusReact
                value={0}
                columns={3}
                beadShape="diamond"
                colorScheme="place-value"
                hideInactiveBeads={false}
                scaleFactor={2.0}
                interactive={true}
                showNumbers={false}
                animated={true}
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          className={css({
            bg: 'yellow.50',
            border: '1px solid',
            borderColor: 'yellow.300',
            rounded: 'lg',
            p: '4',
          })}
        >
          <h5
            className={css({
              fontWeight: 'semibold',
              color: 'yellow.800',
              mb: '2',
            })}
          >
            💡 {currentStep.tooltip.content}
          </h5>
          <p
            className={css({
              fontSize: 'sm',
              color: 'yellow.700',
            })}
          >
            {currentStep.tooltip.explanation}
          </p>
          {currentStep.multiStepInstructions && (
            <div className={css({ mt: '3' })}>
              <p
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: 'yellow.800',
                  mb: '1',
                })}
              >
                Instructions:
              </p>
              <ol
                className={css({
                  fontSize: 'sm',
                  color: 'yellow.700',
                  pl: '4',
                })}
              >
                {currentStep.multiStepInstructions.map((instruction, index) => (
                  <li
                    key={index}
                    className={css({
                      mb: '1',
                      opacity: index <= multiStepProgress ? '1' : '0.6',
                      fontWeight: index === multiStepProgress ? 'semibold' : 'normal',
                    })}
                  >
                    {index + 1}. {instruction}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Interactive Abacus - only show for tutorial steps */}
      {!isPracticeStep(currentStep) && (
        <div
          className={css({
            bg: 'white',
            border: '2px solid',
            borderColor: 'blue.300',
            rounded: 'xl',
            p: '6',
            display: 'flex',
            justifyContent: 'center',
            minHeight: '400px',
            alignItems: 'center',
          })}
        >
          <AbacusReact
            value={currentValue}
            columns={1}
            beadShape="diamond"
            colorScheme="place-value"
            hideInactiveBeads={false}
            scaleFactor={2.0}
            interactive={true}
            showNumbers={true}
            animated={true}
            onValueChange={checkStep}
            highlightBeads={currentStep.highlightBeads}
          />
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className={css({
            p: '4',
            rounded: 'lg',
            border: '1px solid',
            borderColor: isCorrect ? 'green.300' : 'orange.300',
            bg: isCorrect ? 'green.50' : 'orange.50',
            textAlign: 'center',
          })}
        >
          <p
            className={css({
              color: isCorrect ? 'green.800' : 'orange.800',
              fontWeight: 'medium',
            })}
          >
            {feedback}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className={hstack({ gap: '4', justifyContent: 'center' })}>
        {isLastStep && isCorrect && (
          <div className={css({ textAlign: 'center' })}>
            <p
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: 'green.600',
                mb: '4',
              })}
            >
              🎉 Congratulations! You've completed the guided addition tutorial!
            </p>
            <button
              onClick={resetTutorial}
              className={css({
                px: '6',
                py: '3',
                bg: 'green.500',
                color: 'white',
                rounded: 'lg',
                fontWeight: 'semibold',
                cursor: 'pointer',
                _hover: { bg: 'green.600' },
              })}
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
