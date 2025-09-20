'use client'

import { useState, useCallback, useRef } from 'react'
import { css } from '../../styled-system/css'
import { stack, hstack } from '../../styled-system/patterns'
import { AbacusReact } from '@soroban/abacus-react'

interface TutorialStep {
  id: string
  title: string
  problem: string
  description: string
  startValue: number
  targetValue: number
  highlightBeads?: Array<{
    columnIndex: number
    beadType: 'heaven' | 'earth'
    position?: number // for earth beads, 0-3
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

const tutorialSteps: TutorialStep[] = [
  // Phase 1: Basic Addition (1-4)
  {
    id: 'basic-1',
    title: 'Basic Addition: 0 + 1',
    problem: '0 + 1',
    description: 'Start by adding your first earth bead',
    startValue: 0,
    targetValue: 1,
    highlightBeads: [{ columnIndex: 0, beadType: 'earth', position: 0 }],
    expectedAction: 'add',
    actionDescription: 'Click the first earth bead to move it up',
    tooltip: {
      content: 'Adding earth beads',
      explanation: 'Earth beads (bottom) are worth 1 each. Push them UP to activate them.'
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead at the bottom',
      wrongAction: 'Move the bead UP to add it',
      hint: 'Earth beads move up when adding numbers 1-4'
    }
  },
  {
    id: 'basic-2',
    title: 'Basic Addition: 1 + 1',
    problem: '1 + 1',
    description: 'Add the second earth bead to make 2',
    startValue: 1,
    targetValue: 2,
    highlightBeads: [{ columnIndex: 0, beadType: 'earth', position: 1 }],
    expectedAction: 'add',
    actionDescription: 'Click the second earth bead to move it up',
    tooltip: {
      content: 'Building up earth beads',
      explanation: 'Continue adding earth beads one by one for numbers 2, 3, and 4'
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead',
      wrongAction: 'Move the bead UP to add it',
      hint: 'You need 2 earth beads for the number 2'
    }
  },
  {
    id: 'basic-3',
    title: 'Basic Addition: 2 + 1',
    problem: '2 + 1',
    description: 'Add the third earth bead to make 3',
    startValue: 2,
    targetValue: 3,
    highlightBeads: [{ columnIndex: 0, beadType: 'earth', position: 2 }],
    expectedAction: 'add',
    actionDescription: 'Click the third earth bead to move it up',
    tooltip: {
      content: 'Adding earth beads in sequence',
      explanation: 'Continue adding earth beads one by one until you reach 4'
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead',
      wrongAction: 'Move the bead UP to add it',
      hint: 'You need 3 earth beads for the number 3'
    }
  },
  {
    id: 'basic-4',
    title: 'Basic Addition: 3 + 1',
    problem: '3 + 1',
    description: 'Add the fourth earth bead to make 4',
    startValue: 3,
    targetValue: 4,
    highlightBeads: [{ columnIndex: 0, beadType: 'earth', position: 3 }],
    expectedAction: 'add',
    actionDescription: 'Click the fourth earth bead to complete 4',
    tooltip: {
      content: 'Maximum earth beads',
      explanation: 'Four earth beads is the maximum - next we need a different approach'
    },
    errorMessages: {
      wrongBead: 'Click the highlighted earth bead',
      wrongAction: 'Move the bead UP to add it',
      hint: 'Four earth beads represent the number 4'
    }
  },

  // Phase 2: Introduction to Heaven Bead
  {
    id: 'heaven-intro',
    title: 'Heaven Bead: 0 + 5',
    problem: '0 + 5',
    description: 'Use the heaven bead to represent 5',
    startValue: 0,
    targetValue: 5,
    highlightBeads: [{ columnIndex: 0, beadType: 'heaven' }],
    expectedAction: 'add',
    actionDescription: 'Click the heaven bead to activate it',
    tooltip: {
      content: 'Heaven bead = 5',
      explanation: 'The single bead above the bar represents 5'
    },
    errorMessages: {
      wrongBead: 'Click the heaven bead at the top',
      wrongAction: 'Move the heaven bead DOWN to activate it',
      hint: 'The heaven bead is worth 5 points'
    }
  },
  {
    id: 'heaven-plus-earth',
    title: 'Combining: 5 + 1',
    problem: '5 + 1',
    description: 'Add 1 to 5 by activating one earth bead',
    startValue: 5,
    targetValue: 6,
    highlightBeads: [{ columnIndex: 0, beadType: 'earth', position: 0 }],
    expectedAction: 'add',
    actionDescription: 'Click the first earth bead to make 6',
    tooltip: {
      content: 'Heaven + Earth = 6',
      explanation: 'When you have room in the earth section, simply add directly'
    },
    errorMessages: {
      wrongBead: 'Click the first earth bead',
      wrongAction: 'Move the earth bead UP to add it',
      hint: 'With the heaven bead active, add earth beads for 6, 7, 8, 9'
    }
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
      { columnIndex: 0, beadType: 'heaven' },
      { columnIndex: 0, beadType: 'earth', position: 0 }
    ],
    expectedAction: 'multi-step',
    actionDescription: 'First add heaven bead (5), then remove 1 earth bead',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click the first earth bead to remove 1'
    ],
    tooltip: {
      content: 'Five Complement: 4 = 5 - 1',
      explanation: 'When you need to add 4 but only have 1 space, use: add 5, remove 1'
    },
    errorMessages: {
      wrongBead: 'Follow the two-step process: heaven bead first, then remove earth bead',
      wrongAction: 'Add heaven bead, then remove earth bead',
      hint: 'Complement thinking: 4 = 5 - 1, so add 5 and take away 1'
    }
  },
  {
    id: 'complement-2',
    title: 'Five Complement: 2 + 4',
    problem: '2 + 4',
    description: 'Add 4 when you have 2 spaces. Use complement: 4 = 5 - 1',
    startValue: 2,
    targetValue: 6,
    highlightBeads: [
      { columnIndex: 0, beadType: 'heaven' },
      { columnIndex: 0, beadType: 'earth', position: 0 }
    ],
    expectedAction: 'multi-step',
    actionDescription: 'Add heaven bead (5), then remove 1 earth bead',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click the first earth bead to remove 1'
    ],
    tooltip: {
      content: 'Same complement: 4 = 5 - 1',
      explanation: 'Even with space for 2, using complement for 4 is more efficient'
    },
    errorMessages: {
      wrongBead: 'Use the complement method: heaven bead, then remove earth bead',
      wrongAction: 'Add 5, then subtract 1',
      hint: 'Practice the complement: 4 = 5 - 1'
    }
  },
  {
    id: 'complement-3',
    title: 'Five Complement: 1 + 3',
    problem: '1 + 3',
    description: 'Add 3 when you have 3 spaces. Use complement: 3 = 5 - 2',
    startValue: 1,
    targetValue: 4,
    highlightBeads: [
      { columnIndex: 0, beadType: 'heaven' },
      { columnIndex: 0, beadType: 'earth', position: 0 },
      { columnIndex: 0, beadType: 'earth', position: 1 }
    ],
    expectedAction: 'multi-step',
    actionDescription: 'Add heaven bead (5), then remove 2 earth beads',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click the first earth bead to remove it',
      'Click the second earth bead to remove it'
    ],
    tooltip: {
      content: 'Five Complement: 3 = 5 - 2',
      explanation: 'To add 3: add 5 (heaven bead), then subtract 2 (remove 2 earth beads)'
    },
    errorMessages: {
      wrongBead: 'Use complement method: add heaven, remove 2 earth beads',
      wrongAction: 'Add 5, then subtract 2',
      hint: 'Complement: 3 = 5 - 2, so add 5 and take away 2'
    }
  },
  {
    id: 'complement-4',
    title: 'Five Complement: 4 + 2',
    problem: '4 + 2',
    description: 'Add 2 when you have no earth space. Use complement: 2 = 5 - 3',
    startValue: 4,
    targetValue: 6,
    highlightBeads: [
      { columnIndex: 0, beadType: 'heaven' },
      { columnIndex: 0, beadType: 'earth', position: 0 },
      { columnIndex: 0, beadType: 'earth', position: 1 },
      { columnIndex: 0, beadType: 'earth', position: 2 }
    ],
    expectedAction: 'multi-step',
    actionDescription: 'Add heaven bead (5), then remove 3 earth beads',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click the first earth bead to remove it',
      'Click the second earth bead to remove it',
      'Click the third earth bead to remove it'
    ],
    tooltip: {
      content: 'Five Complement: 2 = 5 - 3',
      explanation: 'To add 2 when earth section is full: add 5, then subtract 3'
    },
    errorMessages: {
      wrongBead: 'Use complement: add heaven, remove 3 earth beads',
      wrongAction: 'Add 5, then subtract 3',
      hint: 'Complement: 2 = 5 - 3'
    }
  },
  {
    id: 'complement-5',
    title: 'Five Complement: 4 + 1',
    problem: '4 + 1',
    description: 'Add 1 when earth section is full. Use complement: 1 = 5 - 4',
    startValue: 4,
    targetValue: 5,
    highlightBeads: [
      { columnIndex: 0, beadType: 'heaven' },
      { columnIndex: 0, beadType: 'earth', position: 0 },
      { columnIndex: 0, beadType: 'earth', position: 1 },
      { columnIndex: 0, beadType: 'earth', position: 2 },
      { columnIndex: 0, beadType: 'earth', position: 3 }
    ],
    expectedAction: 'multi-step',
    actionDescription: 'Add heaven bead (5), then remove all 4 earth beads',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click all 4 earth beads to remove them (they should all go down)'
    ],
    tooltip: {
      content: 'Five Complement: 1 = 5 - 4',
      explanation: 'To add 1 when no space: add 5, then subtract 4 (remove all earth beads)'
    },
    errorMessages: {
      wrongBead: 'Add heaven bead, then remove all 4 earth beads',
      wrongAction: 'Add 5, then subtract 4',
      hint: 'Complement: 1 = 5 - 4, so add heaven and remove all earth'
    }
  },

  // Phase 4: Practice mixed problems
  {
    id: 'mixed-1',
    title: 'Practice: 2 + 3',
    problem: '2 + 3',
    description: 'Add 3 to 2. You can add directly or use complement (3 = 5 - 2)',
    startValue: 2,
    targetValue: 5,
    highlightBeads: [{ columnIndex: 0, beadType: 'earth', position: 2 }],
    expectedAction: 'add',
    actionDescription: 'Add the third earth bead directly, or use complement method',
    tooltip: {
      content: 'Choice: Direct or Complement',
      explanation: 'You have space to add directly, but complement (3 = 5 - 2) is also valid'
    },
    errorMessages: {
      wrongBead: 'Either add the third earth bead or use complement method',
      wrongAction: 'Add the earth bead UP or use heaven bead + remove 2',
      hint: 'For 3: add earth bead OR use complement 3 = 5 - 2'
    }
  },
  {
    id: 'mixed-2',
    title: 'Practice: 1 + 4',
    problem: '1 + 4',
    description: 'Add 4 to 1. Must use complement: 4 = 5 - 1',
    startValue: 1,
    targetValue: 5,
    highlightBeads: [
      { columnIndex: 0, beadType: 'heaven' },
      { columnIndex: 0, beadType: 'earth', position: 0 }
    ],
    expectedAction: 'multi-step',
    actionDescription: 'Add heaven bead (5), then remove 1 earth bead',
    multiStepInstructions: [
      'Click the heaven bead to add 5',
      'Click the first earth bead to remove 1'
    ],
    tooltip: {
      content: 'Must use complement',
      explanation: 'No space for 4 earth beads, so use 4 = 5 - 1'
    },
    errorMessages: {
      wrongBead: 'Use complement: heaven bead then remove earth bead',
      wrongAction: 'Add 5, subtract 1',
      hint: 'Only way to add 4: use complement 4 = 5 - 1'
    }
  }
]

export function GuidedAdditionTutorial() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [currentValue, setCurrentValue] = useState(tutorialSteps[0].startValue)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState(false)
  const [multiStepProgress, setMultiStepProgress] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastProcessedValueRef = useRef<number | null>(null)

  const currentStep = tutorialSteps[currentStepIndex]
  const isLastStep = currentStepIndex === tutorialSteps.length - 1

  const nextStep = useCallback(() => {
    if (isLastStep || isTransitioning) return

    setIsTransitioning(true)

    // Small delay to prevent UI flashing
    setTimeout(() => {
      const nextStepIndex = currentStepIndex + 1
      setCurrentStepIndex(nextStepIndex)
      setCurrentValue(tutorialSteps[nextStepIndex].startValue)
      setFeedback(null)
      setIsCorrect(false)
      setMultiStepProgress(0)
      setIsTransitioning(false)
      lastProcessedValueRef.current = null // Reset for new step
    }, 100)
  }, [currentStepIndex, isLastStep, isTransitioning])

  const checkStep = useCallback((newValue: number) => {
    // Prevent processing the same value multiple times
    if (lastProcessedValueRef.current === newValue) return
    lastProcessedValueRef.current = newValue

    // Prevent multiple rapid calls during transitions
    if (isTransitioning) return

    if (currentStep.expectedAction === 'multi-step') {
      // Handle multi-step validation
      const targetSteps = currentStep.multiStepInstructions?.length || 2
      const nextProgress = multiStepProgress + 1

      if (nextProgress < targetSteps) {
        setMultiStepProgress(nextProgress)
        setFeedback(`Step ${nextProgress + 1} of ${targetSteps}: ${currentStep.multiStepInstructions?.[nextProgress] || 'Continue'}`)
        return
      }
    }

    if (newValue === currentStep.targetValue) {
      setIsCorrect(true)
      setFeedback('Perfect! Well done.')
      setMultiStepProgress(0)

      // Clear any existing transition timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }

      // Auto-advance to next step after a brief delay
      transitionTimeoutRef.current = setTimeout(() => {
        if (currentStepIndex < tutorialSteps.length - 1) {
          nextStep()
        }
        transitionTimeoutRef.current = null
      }, 1500)
    } else {
      setFeedback(currentStep.errorMessages.hint)
    }
  }, [currentStep, multiStepProgress, currentStepIndex, nextStep, isTransitioning])

  const resetTutorial = useCallback(() => {
    // Clear any pending transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }

    setCurrentStepIndex(0)
    setCurrentValue(tutorialSteps[0].startValue)
    setFeedback(null)
    setIsCorrect(false)
    setMultiStepProgress(0)
    setIsTransitioning(false)
    lastProcessedValueRef.current = null // Reset for restart
  }, [])

  return (
    <div className={stack({ gap: '6' })}>
      {/* Progress indicator */}
      <div className={css({
        bg: 'gray.100',
        rounded: 'full',
        h: '2',
        overflow: 'hidden'
      })}>
        <div className={css({
          bg: 'blue.500',
          h: 'full',
          transition: 'width',
          width: `${((currentStepIndex + 1) / tutorialSteps.length) * 100}%`
        })} />
      </div>

      {/* Step info */}
      <div className={css({
        textAlign: 'center',
        p: '4',
        bg: 'blue.50',
        rounded: 'lg',
        border: '1px solid',
        borderColor: 'blue.200'
      })}>
        <h4 className={css({
          fontSize: 'lg',
          fontWeight: 'semibold',
          color: 'blue.800',
          mb: '2'
        })}>
          Step {currentStepIndex + 1} of {tutorialSteps.length}: {currentStep.title}
        </h4>
        <p className={css({
          fontSize: 'md',
          color: 'blue.700',
          mb: '2'
        })}>
          Problem: <strong>{currentStep.problem}</strong>
        </p>
        <p className={css({
          fontSize: 'sm',
          color: 'blue.600'
        })}>
          {currentStep.description}
        </p>
      </div>

      {/* Tooltip */}
      <div className={css({
        bg: 'yellow.50',
        border: '1px solid',
        borderColor: 'yellow.300',
        rounded: 'lg',
        p: '4'
      })}>
        <h5 className={css({
          fontWeight: 'semibold',
          color: 'yellow.800',
          mb: '2'
        })}>
          💡 {currentStep.tooltip.content}
        </h5>
        <p className={css({
          fontSize: 'sm',
          color: 'yellow.700'
        })}>
          {currentStep.tooltip.explanation}
        </p>
        {currentStep.multiStepInstructions && (
          <div className={css({ mt: '3' })}>
            <p className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'yellow.800', mb: '1' })}>
              Instructions:
            </p>
            <ol className={css({ fontSize: 'sm', color: 'yellow.700', pl: '4' })}>
              {currentStep.multiStepInstructions.map((instruction, index) => (
                <li key={index} className={css({
                  mb: '1',
                  opacity: index <= multiStepProgress ? '1' : '0.6',
                  fontWeight: index === multiStepProgress ? 'semibold' : 'normal'
                })}>
                  {index + 1}. {instruction}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Interactive Abacus */}
      <div className={css({
        bg: 'white',
        border: '2px solid',
        borderColor: 'blue.300',
        rounded: 'xl',
        p: '6',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '400px',
        alignItems: 'center'
      })}>
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
          customStyles={{
            beadHighlight: currentStep.highlightBeads?.reduce((acc, bead) => {
              const key = `${bead.columnIndex}-${bead.beadType}${bead.position !== undefined ? `-${bead.position}` : ''}`
              acc[key] = {
                stroke: '#3B82F6',
                strokeWidth: 3,
                filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))'
              }
              return acc
            }, {} as Record<string, any>)
          }}
        />
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={css({
          p: '4',
          rounded: 'lg',
          border: '1px solid',
          borderColor: isCorrect ? 'green.300' : 'orange.300',
          bg: isCorrect ? 'green.50' : 'orange.50',
          textAlign: 'center'
        })}>
          <p className={css({
            color: isCorrect ? 'green.800' : 'orange.800',
            fontWeight: 'medium'
          })}>
            {feedback}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className={hstack({ gap: '4', justifyContent: 'center' })}>
        {isLastStep && isCorrect && (
          <div className={css({ textAlign: 'center' })}>
            <p className={css({
              fontSize: 'lg',
              fontWeight: 'semibold',
              color: 'green.600',
              mb: '4'
            })}>
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
                _hover: { bg: 'green.600' }
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