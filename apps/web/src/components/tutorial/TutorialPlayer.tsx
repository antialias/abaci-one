'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import {
  type AbacusOverlay,
  AbacusReact,
  type StepBeadHighlight,
  useAbacusDisplay,
  calculateBeadDiffFromValues,
} from '@soroban/abacus-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'
import { hstack, stack, vstack } from '../../../styled-system/patterns'
import type {
  NavigationState,
  Tutorial,
  TutorialEvent,
  TutorialStep,
  UIState,
} from '../../types/tutorial'
import { generateUnifiedInstructionSequence } from '../../utils/unifiedStepGenerator'
import { CoachBar } from './CoachBar/CoachBar'
import { DecompositionWithReasons } from './DecompositionWithReasons'
import { PedagogicalDecompositionDisplay } from './PedagogicalDecompositionDisplay'
import { TutorialProvider, useTutorialContext } from './TutorialContext'
import { TutorialUIProvider } from './TutorialUIContext'
import './CoachBar/coachbar.css'

// Helper function to find the topmost bead with arrows
function findTopmostBeadWithArrows(
  stepBeadHighlights: StepBeadHighlight[] | undefined
): StepBeadHighlight | null {
  if (!stepBeadHighlights || stepBeadHighlights.length === 0) return null

  // Filter only beads that have direction arrows (should have highlights)
  const beadsWithArrows = stepBeadHighlights.filter(
    (bead) => bead.direction && bead.direction !== 'none'
  )

  if (beadsWithArrows.length === 0) {
    console.warn('No beads with arrows found in step highlights:', stepBeadHighlights)
    return null
  }

  // Sort by place value (highest first, since place value 4 = leftmost = highest value)
  // Then by bead type (heaven beads are higher than earth beads)
  // Then by position for earth beads (lower position = higher on abacus)
  const sortedBeads = [...beadsWithArrows].sort((a, b) => {
    // First sort by place value (higher place value = more significant = topmost priority)
    if (a.placeValue !== b.placeValue) {
      return b.placeValue - a.placeValue
    }

    // If same place value, heaven beads come before earth beads
    if (a.beadType !== b.beadType) {
      return a.beadType === 'heaven' ? -1 : 1
    }

    // If both earth beads in same column, lower position number = higher on abacus
    if (a.beadType === 'earth' && b.beadType === 'earth') {
      return (a.position || 0) - (b.position || 0)
    }

    return 0
  })

  return sortedBeads[0] || null
}

// Reducer state and actions
interface TutorialPlayerState {
  currentStepIndex: number
  currentValue: number
  isStepCompleted: boolean
  error: string | null
  events: TutorialEvent[]
  stepStartTime: number
  multiStepStartTime: number // Track when current multi-step started
  uiState: UIState
  currentMultiStep: number // Current step within multi-step instructions (0-based)
}

interface ExpectedStep {
  index: number
  stepIndex: number
  targetValue: number
  startValue: number
  description: string
  mathematicalTerm?: string // Pedagogical term like "10", "(5 - 1)", "-6"
  termPosition?: { startIndex: number; endIndex: number } // Position in full decomposition
}

type TutorialPlayerAction =
  | {
      type: 'INITIALIZE_STEP'
      stepIndex: number
      startValue: number
      stepId: string
    }
  | {
      type: 'USER_VALUE_CHANGE'
      oldValue: number
      newValue: number
      stepId: string
    }
  | { type: 'COMPLETE_STEP'; stepId: string }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'ADD_EVENT'; event: TutorialEvent }
  | { type: 'UPDATE_UI_STATE'; updates: Partial<UIState> }
  | { type: 'ADVANCE_MULTI_STEP' }
  | { type: 'PREVIOUS_MULTI_STEP' }
  | { type: 'RESET_MULTI_STEP' }

function _tutorialPlayerReducer(
  state: TutorialPlayerState,
  action: TutorialPlayerAction
): TutorialPlayerState {
  switch (action.type) {
    case 'INITIALIZE_STEP':
      return {
        ...state,
        currentStepIndex: action.stepIndex,
        currentValue: action.startValue,
        isStepCompleted: false,
        error: null,
        stepStartTime: Date.now(),
        multiStepStartTime: Date.now(), // Start timing for first multi-step
        currentMultiStep: 0, // Reset to first multi-step
        events: [
          ...state.events,
          {
            type: 'STEP_STARTED',
            stepId: action.stepId,
            timestamp: new Date(),
          },
        ],
      }

    case 'USER_VALUE_CHANGE':
      return {
        ...state,
        currentValue: action.newValue,
        events: [
          ...state.events,
          {
            type: 'VALUE_CHANGED',
            stepId: action.stepId,
            oldValue: action.oldValue,
            newValue: action.newValue,
            timestamp: new Date(),
          },
        ],
      }

    case 'COMPLETE_STEP':
      return {
        ...state,
        isStepCompleted: true,
        error: null,
        events: [
          ...state.events,
          {
            type: 'STEP_COMPLETED',
            stepId: action.stepId,
            success: true,
            timestamp: new Date(),
          },
        ],
      }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
      }

    case 'ADD_EVENT':
      return {
        ...state,
        events: [...state.events, action.event],
      }

    case 'UPDATE_UI_STATE':
      return {
        ...state,
        uiState: { ...state.uiState, ...action.updates },
      }

    case 'ADVANCE_MULTI_STEP':
      return {
        ...state,
        currentMultiStep: state.currentMultiStep + 1,
        multiStepStartTime: Date.now(), // Reset timer for new multi-step
      }

    case 'PREVIOUS_MULTI_STEP':
      return {
        ...state,
        currentMultiStep: Math.max(0, state.currentMultiStep - 1),
      }

    case 'RESET_MULTI_STEP':
      return {
        ...state,
        currentMultiStep: 0,
      }

    default:
      return state
  }
}

interface TutorialPlayerProps {
  tutorial: Tutorial
  initialStepIndex?: number
  isDebugMode?: boolean
  showDebugPanel?: boolean
  hideNavigation?: boolean
  hideTooltip?: boolean
  silentErrors?: boolean
  abacusColumns?: number
  theme?: 'light' | 'dark'
  onStepChange?: (stepIndex: number, step: TutorialStep) => void
  onStepComplete?: (stepIndex: number, step: TutorialStep, success: boolean) => void
  onTutorialComplete?: (score: number, timeSpent: number) => void
  onEvent?: (event: TutorialEvent) => void
  className?: string
}

function TutorialPlayerContent({
  tutorial,
  initialStepIndex = 0,
  isDebugMode = false,
  showDebugPanel = false,
  hideNavigation = false,
  hideTooltip = false,
  silentErrors = false,
  abacusColumns = 5,
  theme = 'light',
  onStepChange,
  onStepComplete,
  onTutorialComplete,
  onEvent,
  className,
}: TutorialPlayerProps) {
  const t = useTranslations('tutorial.player')
  const [_startTime] = useState(Date.now())
  const isProgrammaticChange = useRef(false)
  const [showHelpForCurrentStep, setShowHelpForCurrentStep] = useState(false)

  // Use tutorial context instead of local state
  const {
    state,
    dispatch,
    currentStep,
    goToStep: contextGoToStep,
    goToNextStep: contextGoToNextStep,
    goToPreviousStep: contextGoToPreviousStep,
    handleValueChange: contextHandleValueChange,
    advanceMultiStep,
    previousMultiStep,
    resetMultiStep,
    activeTermIndices,
    activeIndividualTermIndex,
    getColumnFromTermIndex,
    getGroupTermIndicesFromTermIndex,
    handleAbacusColumnHover,
  } = useTutorialContext()

  const {
    currentStepIndex,
    currentValue,
    isStepCompleted,
    error,
    events,
    stepStartTime,
    multiStepStartTime,
    uiState,
    currentMultiStep,
  } = state

  // Use universal abacus display configuration
  const { config: abacusConfig } = useAbacusDisplay()
  const [isSuccessPopupDismissed, setIsSuccessPopupDismissed] = useState(false)

  // Keep refs needed for step advancement and bead tracking
  const lastValueForStepAdvancement = useRef<number>(currentValue)
  const userHasInteracted = useRef<boolean>(false)
  const lastMovedBead = useRef<StepBeadHighlight | null>(null)

  // Reset success popup when moving to new step
  useEffect(() => {
    setIsSuccessPopupDismissed(false)
  }, [])

  // Auto-dismiss success toast after 3 seconds
  useEffect(() => {
    if (isStepCompleted && !isSuccessPopupDismissed) {
      const timer = setTimeout(() => {
        setIsSuccessPopupDismissed(true)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isStepCompleted, isSuccessPopupDismissed])

  // Current step comes from context
  const beadRefs = useRef<Map<string, SVGElement>>(new Map())

  // Navigation state
  const navigationState: NavigationState = {
    currentStepIndex,
    canGoNext: currentStepIndex < tutorial.steps.length - 1,
    canGoPrevious: currentStepIndex > 0,
    totalSteps: tutorial.steps.length,
    completionPercentage: (currentStepIndex / tutorial.steps.length) * 100,
  }

  // Define the static expected steps using our unified step generator
  const {
    expectedSteps,
    fullDecomposition,
    isMeaningfulDecomposition,
    pedagogicalSegments,
    termPositions,
    unifiedSteps,
  } = useMemo(() => {
    try {
      const unifiedSequence = generateUnifiedInstructionSequence(
        currentStep.startValue,
        currentStep.targetValue
      )

      // Convert unified sequence to expected steps format
      const steps = unifiedSequence.steps.map((step, index) => ({
        index: index,
        stepIndex: index,
        targetValue: step.expectedValue,
        startValue:
          index === 0 ? currentStep.startValue : unifiedSequence.steps[index - 1].expectedValue,
        description: step.englishInstruction,
        mathematicalTerm: step.mathematicalTerm, // Add the pedagogical term
        termPosition: step.termPosition, // Add the precise position information
      }))

      // Extract term positions from steps for DecompositionWithReasons
      const positions = unifiedSequence.steps.map((step) => step.termPosition).filter(Boolean)

      return {
        expectedSteps: steps,
        fullDecomposition: unifiedSequence.fullDecomposition,
        isMeaningfulDecomposition: unifiedSequence.isMeaningfulDecomposition,
        pedagogicalSegments: unifiedSequence.segments,
        termPositions: positions,
        unifiedSteps: unifiedSequence.steps, // NEW: Include the raw unified steps with provenance
      }
    } catch (_error) {
      return {
        expectedSteps: [],
        fullDecomposition: '',
        isMeaningfulDecomposition: false,
        pedagogicalSegments: [],
        termPositions: [],
        unifiedSteps: [], // NEW: Also add empty array for error case
      }
    }
  }, [currentStep.startValue, currentStep.targetValue])

  // Get arrows for the immediate next action to reach current expected step
  const getCurrentStepBeads = useCallback(() => {
    // If no expected steps, fall back to original behavior
    if (expectedSteps.length === 0) return currentStep.stepBeadHighlights

    // Get the current expected step we're working toward
    const currentExpectedStep = expectedSteps[currentMultiStep]

    if (!currentExpectedStep) {
      // If we're past the last step, check if we've reached the final target
      if (currentValue === currentStep.targetValue) {
        return undefined
      }
      return undefined
    }

    // Use the new bead diff algorithm to get arrows for current step
    try {
      const beadDiff = calculateBeadDiffFromValues(currentValue, currentExpectedStep.targetValue)

      if (!beadDiff.hasChanges) {
        return undefined
      }

      // Convert bead diff results to StepBeadHighlight format expected by AbacusReact
      // Filter to only include beads from columns that exist
      const minValidPlaceValue = Math.max(0, 5 - abacusColumns)
      const stepBeadHighlights: StepBeadHighlight[] = beadDiff.changes
        .filter((change) => change.placeValue < abacusColumns)
        .map((change, _index) => ({
          placeValue: change.placeValue,
          beadType: change.beadType,
          position: change.position,
          direction: change.direction,
          stepIndex: currentMultiStep, // Use current multi-step index to match AbacusReact filtering
          order: change.order,
        }))

      return stepBeadHighlights.length > 0 ? stepBeadHighlights : undefined
    } catch (error) {
      console.error('Error generating step beads with bead diff:', error)
      return undefined
    }
  }, [
    currentValue,
    currentStep.targetValue,
    expectedSteps,
    currentMultiStep,
    currentStep.stepBeadHighlights,
    abacusColumns,
  ])

  // Get the current step's bead diff summary for real-time user feedback
  const getCurrentStepSummary = useCallback(() => {
    if (expectedSteps.length === 0) return null

    const currentExpectedStep = expectedSteps[currentMultiStep]
    if (!currentExpectedStep) return null

    try {
      const beadDiff = calculateBeadDiffFromValues(currentValue, currentExpectedStep.targetValue)
      return beadDiff.hasChanges ? beadDiff.summary : null
    } catch (_error) {
      return null
    }
  }, [currentValue, expectedSteps, currentMultiStep])

  // Get current step beads (dynamic arrows for static expected steps)
  const currentStepBeads = getCurrentStepBeads()

  // Get current step summary for real-time user feedback
  const currentStepSummary = getCurrentStepSummary()

  // Filter highlightBeads to only include valid columns
  const filteredHighlightBeads = useMemo(() => {
    if (!currentStep.highlightBeads) return undefined
    return currentStep.highlightBeads.filter((highlight) => {
      return highlight.placeValue < abacusColumns
    })
  }, [currentStep.highlightBeads, abacusColumns])

  // Helper function to highlight the current mathematical term in the full decomposition
  const renderHighlightedDecomposition = useCallback(() => {
    if (!fullDecomposition || expectedSteps.length === 0) return null

    const currentStep = expectedSteps[currentMultiStep]
    if (!currentStep?.mathematicalTerm) return null

    const mathTerm = currentStep.mathematicalTerm

    // Try to use precise position first
    if (currentStep.termPosition) {
      const { startIndex, endIndex } = currentStep.termPosition
      const highlighted = fullDecomposition.substring(startIndex, endIndex)

      // Validate that the highlighted text makes sense
      if (highlighted.includes(mathTerm.replace('-', '')) || highlighted === mathTerm) {
        return {
          before: fullDecomposition.substring(0, startIndex),
          highlighted,
          after: fullDecomposition.substring(endIndex),
        }
      }
    }

    // Fallback: search for the mathematical term in the decomposition
    const searchTerm = mathTerm.startsWith('-') ? mathTerm.substring(1) : mathTerm
    const searchIndex = fullDecomposition.indexOf(searchTerm)

    if (searchIndex !== -1) {
      const startIndex = mathTerm.startsWith('-')
        ? // For negative terms, try to include the preceding dash
          Math.max(0, searchIndex - 1)
        : searchIndex
      const endIndex = mathTerm.startsWith('-')
        ? searchIndex + searchTerm.length
        : searchIndex + mathTerm.length

      return {
        before: fullDecomposition.substring(0, startIndex),
        highlighted: fullDecomposition.substring(startIndex, endIndex),
        after: fullDecomposition.substring(endIndex),
      }
    }

    // Final fallback: highlight the first occurrence of just the number part
    const numberMatch = mathTerm.match(/\d+/)
    if (numberMatch) {
      const number = numberMatch[0]
      const numberIndex = fullDecomposition.indexOf(number)
      if (numberIndex !== -1) {
        return {
          before: fullDecomposition.substring(0, numberIndex),
          highlighted: fullDecomposition.substring(numberIndex, numberIndex + number.length),
          after: fullDecomposition.substring(numberIndex + number.length),
        }
      }
    }

    return null
  }, [fullDecomposition, expectedSteps, currentMultiStep])

  // Create overlay for tooltip positioned precisely at topmost bead using smart collision detection
  const tooltipOverlay = useMemo(() => {
    // Show tooltip if step is completed AND still at target value OR if we have step instructions
    const showCelebration = isStepCompleted && currentValue === currentStep.targetValue
    const showInstructions = !showCelebration && currentStepSummary && currentStepBeads?.length

    if (!showCelebration && !showInstructions) {
      return null
    }

    let topmostBead: StepBeadHighlight | null = null

    if (showCelebration) {
      // For celebration, use the last moved bead or fallback
      if (lastMovedBead.current) {
        topmostBead = lastMovedBead.current
      } else {
        // Use the ones place (rightmost column) heaven bead as fallback
        topmostBead = {
          placeValue: 0, // Ones place
          beadType: 'heaven' as const,
          position: 0,
          direction: 'none' as const,
          stepIndex: currentMultiStep,
          order: 0,
        }
      }
    } else if (showInstructions) {
      // For instructions, use the topmost bead with arrows
      topmostBead = findTopmostBeadWithArrows(currentStepBeads)
    }

    if (!topmostBead) {
      return null
    }

    // Validate that the bead is from a column that exists
    if (topmostBead.placeValue >= abacusColumns) {
      // Bead is from an invalid column, skip tooltip
      return null
    }

    // Smart positioning logic: avoid covering active beads
    // Convert placeValue to columnIndex based on actual number of columns
    const targetColumnIndex = abacusColumns - 1 - topmostBead.placeValue

    // Check if there are any active beads (against reckoning bar OR with arrows) in columns to the left
    const hasActiveBeadsToLeft = (() => {
      // Get current abacus state - we need to check which beads are against the reckoning bar
      const abacusDigits = currentValue
        .toString()
        .padStart(abacusColumns, '0')
        .split('')
        .map(Number)

      for (let col = 0; col < targetColumnIndex; col++) {
        const placeValue = abacusColumns - 1 - col // Convert columnIndex back to placeValue
        const digitValue = abacusDigits[col]

        // Check if any beads are active (against reckoning bar) in this column
        if (digitValue >= 5) {
          // Heaven bead is active
          return true
        }
        if (digitValue % 5 > 0) {
          // Earth beads are active
          return true
        }

        // Also check if this column has beads with direction arrows (from current step)
        const hasArrowsInColumn =
          currentStepBeads?.some((bead) => {
            const beadColumnIndex = abacusColumns - 1 - bead.placeValue
            return beadColumnIndex === col && bead.direction && bead.direction !== 'none'
          }) ?? false
        if (hasArrowsInColumn) {
          return true
        }
      }

      return false
    })()

    // Determine tooltip position and target
    const shouldPositionAbove = hasActiveBeadsToLeft
    const tooltipSide = shouldPositionAbove ? 'top' : 'left'
    const tooltipTarget = shouldPositionAbove
      ? {
          // Target the heaven bead position for the column
          type: 'bead' as const,
          columnIndex: targetColumnIndex,
          beadType: 'heaven' as const,
          beadPosition: 0, // Heaven beads are always at position 0
        }
      : {
          // Target the actual bead
          type: 'bead' as const,
          columnIndex: targetColumnIndex,
          beadType: topmostBead.beadType,
          beadPosition: topmostBead.position,
        }

    // Create an overlay that positions tooltip to avoid covering active beads
    const overlay: AbacusOverlay = {
      id: 'bead-tooltip',
      type: 'tooltip',
      target: tooltipTarget,
      content: (
        <Tooltip.Provider>
          <Tooltip.Root open={true}>
            <Tooltip.Trigger asChild>
              <div style={{ width: '1px', height: '1px', opacity: 0 }} />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side={tooltipSide}
                align="center"
                sideOffset={20}
                style={{
                  background: showCelebration
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(21, 128, 61, 0.95) 100%)'
                    : theme === 'dark'
                      ? '#1e40af'
                      : '#1e3a8a',
                  color: '#ffffff',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '700',
                  boxShadow: showCelebration
                    ? '0 8px 25px rgba(34, 197, 94, 0.4), 0 0 0 2px rgba(255, 255, 255, 0.2)'
                    : theme === 'dark'
                      ? '0 4px 12px rgba(0,0,0,0.3)'
                      : '0 4px 12px rgba(0,0,0,0.2)',
                  whiteSpace: 'normal',
                  maxWidth: '200px',
                  minWidth: '150px',
                  wordBreak: 'break-word',
                  zIndex: 50,
                  opacity: 0.95,
                  transition: 'all 0.3s ease',
                  transform: showCelebration ? 'scale(1.05)' : 'scale(1)',
                  animation: showCelebration ? 'celebrationPulse 0.6s ease-out' : 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.85'
                }}
              >
                <div style={{ fontSize: '12px', opacity: 0.9 }}>
                  {showCelebration ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>🎉</span>
                      <span>Excellent work!</span>
                    </div>
                  ) : (
                    <>
                      {isMeaningfulDecomposition && (
                        <PedagogicalDecompositionDisplay
                          variant="tooltip"
                          showLabel={true}
                          decomposition={renderHighlightedDecomposition()}
                        />
                      )}
                      <span style={{ fontSize: '18px' }}>💡</span> {currentStepSummary}
                    </>
                  )}
                </div>
                <Tooltip.Arrow
                  style={{
                    fill: showCelebration ? '#15803d' : '#1e40af',
                  }}
                />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ),
      offset: { x: 0, y: 0 },
      visible: true,
    }

    return overlay
  }, [
    currentStepSummary,
    currentStepBeads,
    isStepCompleted,
    currentMultiStep,
    renderHighlightedDecomposition,
    currentValue,
    currentStep,
    isMeaningfulDecomposition,
    abacusColumns,
  ])

  // Timer for smart help detection
  useEffect(() => {
    setShowHelpForCurrentStep(false) // Reset help when step changes

    const timer = setTimeout(() => {
      setShowHelpForCurrentStep(true)
    }, 8000) // 8 seconds

    return () => clearTimeout(timer)
  }, []) // Reset when step changes or timer resets

  // Event logging - now just notifies parent, state is managed by reducer
  const notifyEvent = useCallback(
    (event: TutorialEvent) => {
      onEvent?.(event)
    },
    [onEvent]
  )

  // Navigation functions - declare these first since they're used in useEffects
  // Use context goToStep function instead of local one
  const goToStep = contextGoToStep

  // Use context goToNextStep function instead of local one
  const goToNextStep = contextGoToNextStep

  // Use context goToPreviousStep function instead of local one
  const goToPreviousStep = contextGoToPreviousStep

  // Initialize step on mount only
  useEffect(() => {
    if (currentStep && currentStepIndex === initialStepIndex) {
      // Mark this as a programmatic change to prevent feedback loop
      isProgrammaticChange.current = true

      // Dispatch initialization action
      dispatch({
        type: 'INITIALIZE_STEP',
        stepIndex: currentStepIndex,
        startValue: currentStep.startValue,
        stepId: currentStep.id,
      })

      // Notify parent of step change
      onStepChange?.(currentStepIndex, currentStep)
    }
  }, [
    currentStep,
    currentStepIndex, // Dispatch initialization action
    dispatch,
    initialStepIndex, // Notify parent of step change
    onStepChange,
  ]) // Only run on mount

  // Check if step is completed - only complete when we've gone through all multi-steps AND reached target
  useEffect(() => {
    if (currentStep && currentValue === currentStep.targetValue && !isStepCompleted) {
      // For multi-step problems, only complete when we've finished all expected steps
      const isMultiStepProblem = expectedSteps.length > 0
      const hasFinishedAllMultiSteps = currentMultiStep >= expectedSteps.length - 1

      // Complete the step if:
      // 1. It's not a multi-step problem, OR
      // 2. It's a multi-step problem and we've finished all steps
      if (!isMultiStepProblem || hasFinishedAllMultiSteps) {
        dispatch({ type: 'COMPLETE_STEP', stepId: currentStep.id })
        onStepComplete?.(currentStepIndex, currentStep, true)

        // Auto-advance if enabled
        if (uiState.autoAdvance && navigationState.canGoNext) {
          setTimeout(() => goToNextStep(), 1500)
        }
      }
    }
  }, [
    currentValue,
    currentStep,
    isStepCompleted,
    expectedSteps,
    currentMultiStep,
    uiState.autoAdvance,
    navigationState.canGoNext,
    onStepComplete,
    currentStepIndex,
    goToNextStep,
    dispatch,
  ])

  // These refs are already defined above

  // Check if user completed the current expected step and advance to next expected step
  useEffect(() => {
    const valueChanged = currentValue !== lastValueForStepAdvancement.current

    // Get current expected step
    const currentExpectedStep = expectedSteps[currentMultiStep]

    console.log('🔍 Expected step advancement check:', {
      currentValue,
      lastValue: lastValueForStepAdvancement.current,
      valueChanged,
      userHasInteracted: userHasInteracted.current,
      expectedStepIndex: currentMultiStep,
      expectedStepTarget: currentExpectedStep?.targetValue,
      expectedStepReached: currentExpectedStep
        ? currentValue === currentExpectedStep.targetValue
        : false,
      totalExpectedSteps: expectedSteps.length,
      finalTargetReached: currentValue === currentStep?.targetValue,
    })

    // Only advance if user interacted and we have expected steps
    if (
      valueChanged &&
      userHasInteracted.current &&
      expectedSteps.length > 0 &&
      currentExpectedStep
    ) {
      // Check if user reached the current expected step's target
      if (currentValue === currentExpectedStep.targetValue) {
        const hasMoreExpectedSteps = currentMultiStep < expectedSteps.length - 1

        if (hasMoreExpectedSteps) {
          // Auto-advance to next expected step after a delay
          const timeoutId = setTimeout(() => {
            advanceMultiStep()
            lastValueForStepAdvancement.current = currentValue
          }, 1000)

          return () => clearTimeout(timeoutId)
        }
      }
    }
  }, [currentValue, currentStep, currentMultiStep, expectedSteps, advanceMultiStep])

  // Update the reference when the step changes (not just value changes)
  useEffect(() => {
    lastValueForStepAdvancement.current = currentValue
    // Reset user interaction flag when step changes
    userHasInteracted.current = false
    // Reset last moved bead when step changes
    lastMovedBead.current = null
  }, [currentValue])

  // Notify parent of events when they're added to state
  useEffect(() => {
    if (events.length > 0) {
      const lastEvent = events[events.length - 1]
      notifyEvent(lastEvent)
    }
  }, [events, notifyEvent])

  // Wrap context handleValueChange to track user interaction
  const handleValueChange = useCallback(
    (newValue: number) => {
      // Mark that user has interacted
      userHasInteracted.current = true

      // Try to determine which bead was moved by looking at current step beads
      if (currentStepBeads?.length) {
        // Find the first bead with direction arrows as the likely moved bead
        const likelyMovedBead = findTopmostBeadWithArrows(currentStepBeads)
        if (likelyMovedBead) {
          lastMovedBead.current = likelyMovedBead
        }
      }

      // Call the context's handleValueChange
      contextHandleValueChange(newValue)
    },
    [contextHandleValueChange, currentStepBeads]
  )

  // Cleanup handled by context

  // Value tracking handled by context

  const handleBeadClick = useCallback(
    (beadInfo: any) => {
      dispatch({
        type: 'ADD_EVENT',
        event: {
          type: 'BEAD_CLICKED',
          stepId: currentStep.id,
          beadInfo,
          timestamp: new Date(),
        },
      })

      // Check if this is the correct action
      if (currentStep.highlightBeads && Array.isArray(currentStep.highlightBeads)) {
        const isCorrectBead = currentStep.highlightBeads.some((highlight) => {
          // Get place value from highlight
          const highlightPlaceValue = highlight.placeValue
          // Get place value from bead click event
          const beadPlaceValue = beadInfo.bead ? beadInfo.bead.placeValue : 4 - beadInfo.columnIndex

          return (
            highlightPlaceValue === beadPlaceValue &&
            highlight.beadType === beadInfo.beadType &&
            (highlight.position === undefined || highlight.position === beadInfo.position)
          )
        })

        if (!isCorrectBead && !silentErrors) {
          const errorMessage = t('error.highlight')
          dispatch({
            type: 'SET_ERROR',
            error: errorMessage,
          })

          dispatch({
            type: 'ADD_EVENT',
            event: {
              type: 'ERROR_OCCURRED',
              stepId: currentStep.id,
              error: errorMessage,
              timestamp: new Date(),
            },
          })
        } else {
          dispatch({ type: 'SET_ERROR', error: null })
        }
      }
    },
    [currentStep, dispatch, silentErrors, t]
  )

  const handleBeadRef = useCallback((bead: any, element: SVGElement | null) => {
    const key = `${bead.placeValue}-${bead.type}-${bead.position}`
    if (element) {
      beadRefs.current.set(key, element)
    } else {
      beadRefs.current.delete(key)
    }
  }, [])

  // UI state updaters
  const toggleDebugPanel = useCallback(() => {
    dispatch({
      type: 'UPDATE_UI_STATE',
      updates: { showDebugPanel: !uiState.showDebugPanel },
    })
  }, [uiState.showDebugPanel, dispatch])

  const toggleStepList = useCallback(() => {
    dispatch({
      type: 'UPDATE_UI_STATE',
      updates: { showStepList: !uiState.showStepList },
    })
  }, [uiState.showStepList, dispatch])

  const toggleAutoAdvance = useCallback(() => {
    dispatch({
      type: 'UPDATE_UI_STATE',
      updates: { autoAdvance: !uiState.autoAdvance },
    })
  }, [uiState.autoAdvance, dispatch])

  // Two-level dynamic column highlights: group terms + individual term
  const dynamicColumnHighlights = useMemo(() => {
    const highlights: Record<number, any> = {}

    // Level 1: Group highlights (blue glow for all terms in activeTermIndices)
    activeTermIndices.forEach((termIndex) => {
      const columnIndex = getColumnFromTermIndex(termIndex, true) // Use group column (rhsPlace)
      if (columnIndex !== null) {
        highlights[columnIndex] = {
          // Group background glow effect (blue)
          backgroundGlow: {
            fill: 'rgba(59, 130, 246, 0.2)',
            blur: 4,
            spread: 16,
          },
          // Group numeral highlighting
          numerals: {
            color: '#1e40af',
            backgroundColor: 'rgba(219, 234, 254, 0.8)',
            fontWeight: 'bold',
            borderRadius: 4,
            borderWidth: 1,
            borderColor: '#3b82f6',
          },
        }
      }
    })

    // Level 2: Individual term highlight (orange glow, overrides group styling)
    if (activeIndividualTermIndex !== null) {
      const individualColumnIndex = getColumnFromTermIndex(activeIndividualTermIndex, false) // Use individual column (termPlace)
      if (individualColumnIndex !== null) {
        highlights[individualColumnIndex] = {
          // Individual background glow effect (orange) - overrides group glow
          backgroundGlow: {
            fill: 'rgba(249, 115, 22, 0.3)',
            blur: 6,
            spread: 20,
          },
          // Individual numeral highlighting (orange)
          numerals: {
            color: '#c2410c',
            backgroundColor: 'rgba(254, 215, 170, 0.9)',
            fontWeight: 'bold',
            borderRadius: 6,
            borderWidth: 2,
            borderColor: '#ea580c',
          },
        }
      }
    }

    return highlights
  }, [activeTermIndices, activeIndividualTermIndex, getColumnFromTermIndex])

  // Memoize custom styles calculation to avoid expensive recalculation on every render
  const customStyles = useMemo(() => {
    // Separate bead-level and column-level styles
    const beadLevelHighlights: Record<number, any> = {}
    const columnLevelHighlights: Record<number, any> = {}

    // Process static highlights from step configuration (bead-specific)
    if (currentStep.highlightBeads && Array.isArray(currentStep.highlightBeads)) {
      currentStep.highlightBeads.forEach((highlight) => {
        // Convert placeValue to columnIndex for AbacusReact compatibility
        const columnIndex = abacusColumns - 1 - highlight.placeValue

        // Skip highlights for columns that don't exist in the rendered abacus
        if (columnIndex < 0 || columnIndex >= abacusColumns) {
          return
        }

        // Initialize column if it doesn't exist
        if (!beadLevelHighlights[columnIndex]) {
          beadLevelHighlights[columnIndex] = {}
        }

        // Add the bead style to the appropriate type
        if (highlight.beadType === 'earth' && highlight.position !== undefined) {
          if (!beadLevelHighlights[columnIndex].earth) {
            beadLevelHighlights[columnIndex].earth = {}
          }
          beadLevelHighlights[columnIndex].earth[highlight.position] = {
            fill: '#fbbf24',
            stroke: '#f59e0b',
            strokeWidth: 3,
          }
        } else {
          beadLevelHighlights[columnIndex][highlight.beadType] = {
            fill: '#fbbf24',
            stroke: '#f59e0b',
            strokeWidth: 3,
          }
        }
      })
    }

    // Process dynamic column highlights (column-level: backgroundGlow, numerals)
    Object.keys(dynamicColumnHighlights).forEach((columnIndexStr) => {
      const columnIndex = parseInt(columnIndexStr, 10)

      // Skip highlights for columns that don't exist in the rendered abacus
      if (columnIndex < 0 || columnIndex >= abacusColumns) {
        return
      }

      // Dynamic highlights are column-level (backgroundGlow, numerals)
      columnLevelHighlights[columnIndex] = dynamicColumnHighlights[columnIndex]
    })

    // Build the custom styles object
    const styles: any = {}

    // Add bead-level highlights to styles.beads
    if (Object.keys(beadLevelHighlights).length > 0) {
      styles.beads = beadLevelHighlights
    }

    // Add column-level highlights to styles.columns
    if (Object.keys(columnLevelHighlights).length > 0) {
      styles.columns = columnLevelHighlights
    }

    // Add frame styling for dark mode
    if (theme === 'dark') {
      // Column dividers (global for all columns)
      styles.columnPosts = {
        fill: 'rgba(255, 255, 255, 0.3)', // High contrast fill for visibility
        stroke: 'rgba(255, 255, 255, 0.2)',
        strokeWidth: 2,
      }
      // Reckoning bar (horizontal middle bar)
      styles.reckoningBar = {
        fill: 'rgba(255, 255, 255, 0.4)', // High contrast fill for visibility
        stroke: 'rgba(255, 255, 255, 0.25)',
        strokeWidth: 3,
      }
    }

    // Debug logging for custom styles
    if (Object.keys(styles).length > 0) {
      console.log(
        '📋 TUTORIAL CUSTOM STYLES:',
        JSON.stringify(
          {
            beadLevelHighlights,
            columnLevelHighlights,
            finalStyles: styles,
            currentStepHighlightBeads: currentStep.highlightBeads,
            abacusColumns,
          },
          null,
          2
        )
      )
    }

    return Object.keys(styles).length > 0 ? styles : undefined
  }, [currentStep.highlightBeads, dynamicColumnHighlights, abacusColumns, theme])

  if (!currentStep) {
    return <div>{t('noSteps')}</div>
  }

  return (
    <div
      className={`${css({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: hideNavigation ? 'auto' : '600px',
      })} ${className || ''}`}
    >
      {/* Header */}
      {!hideNavigation && (
        <div
          className={css({
            borderBottom: '1px solid',
            borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'gray.200',
            p: 4,
            bg: theme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'white',
          })}
        >
          <div
            className={hstack({
              justifyContent: 'space-between',
              alignItems: 'center',
            })}
          >
            <div>
              <h1 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>{tutorial.title}</h1>
              <p className={css({ fontSize: 'sm', color: 'gray.600' })}>
                {t('header.step', {
                  current: currentStepIndex + 1,
                  total: tutorial.steps.length,
                  title: currentStep.title,
                })}
              </p>
            </div>

            <div className={hstack({ gap: 2 })}>
              {isDebugMode && (
                <>
                  <button
                    onClick={toggleDebugPanel}
                    className={css({
                      px: 3,
                      py: 1,
                      fontSize: 'sm',
                      border: '1px solid',
                      borderColor: 'blue.300',
                      borderRadius: 'md',
                      bg: uiState.showDebugPanel ? 'blue.100' : 'white',
                      color: 'blue.700',
                      cursor: 'pointer',
                      _hover: { bg: 'blue.50' },
                    })}
                  >
                    {t('controls.debug')}
                  </button>
                  <button
                    onClick={toggleStepList}
                    className={css({
                      px: 3,
                      py: 1,
                      fontSize: 'sm',
                      border: '1px solid',
                      borderColor: 'gray.300',
                      borderRadius: 'md',
                      bg: uiState.showStepList ? 'gray.100' : 'white',
                      cursor: 'pointer',
                      _hover: { bg: 'gray.50' },
                    })}
                  >
                    {t('controls.steps')}
                  </button>

                  {/* Multi-step navigation controls */}
                  {currentStep.multiStepInstructions &&
                    currentStep.multiStepInstructions.length > 1 && (
                      <>
                        <div
                          className={css({
                            fontSize: 'xs',
                            color: 'gray.600',
                            px: 2,
                            borderLeft: '1px solid',
                            borderColor: 'gray.300',
                            ml: 2,
                            pl: 3,
                          })}
                        >
                          {t('controls.multiStep.label', {
                            current: currentMultiStep + 1,
                            total: currentStep.multiStepInstructions.length,
                          })}
                        </div>
                        <button
                          onClick={() => dispatch({ type: 'RESET_MULTI_STEP' })}
                          disabled={currentMultiStep === 0}
                          className={css({
                            px: 2,
                            py: 1,
                            fontSize: 'xs',
                            border: '1px solid',
                            borderColor: currentMultiStep === 0 ? 'gray.200' : 'orange.300',
                            borderRadius: 'md',
                            bg: currentMultiStep === 0 ? 'gray.100' : 'white',
                            color: currentMultiStep === 0 ? 'gray.400' : 'orange.700',
                            cursor: currentMultiStep === 0 ? 'not-allowed' : 'pointer',
                            _hover: currentMultiStep === 0 ? {} : { bg: 'orange.50' },
                          })}
                        >
                          {t('controls.multiStep.first')}
                        </button>
                        <button
                          onClick={() => previousMultiStep()}
                          disabled={currentMultiStep === 0}
                          className={css({
                            px: 2,
                            py: 1,
                            fontSize: 'xs',
                            border: '1px solid',
                            borderColor: currentMultiStep === 0 ? 'gray.200' : 'orange.300',
                            borderRadius: 'md',
                            bg: currentMultiStep === 0 ? 'gray.100' : 'white',
                            color: currentMultiStep === 0 ? 'gray.400' : 'orange.700',
                            cursor: currentMultiStep === 0 ? 'not-allowed' : 'pointer',
                            _hover: currentMultiStep === 0 ? {} : { bg: 'orange.50' },
                          })}
                        >
                          {t('controls.multiStep.prev')}
                        </button>
                        <button
                          onClick={() => advanceMultiStep()}
                          disabled={
                            currentMultiStep >= currentStep.multiStepInstructions.length - 1
                          }
                          className={css({
                            px: 2,
                            py: 1,
                            fontSize: 'xs',
                            border: '1px solid',
                            borderColor:
                              currentMultiStep >= currentStep.multiStepInstructions.length - 1
                                ? 'gray.200'
                                : 'green.300',
                            borderRadius: 'md',
                            bg:
                              currentMultiStep >= currentStep.multiStepInstructions.length - 1
                                ? 'gray.100'
                                : 'white',
                            color:
                              currentMultiStep >= currentStep.multiStepInstructions.length - 1
                                ? 'gray.400'
                                : 'green.700',
                            cursor:
                              currentMultiStep >= currentStep.multiStepInstructions.length - 1
                                ? 'not-allowed'
                                : 'pointer',
                            _hover:
                              currentMultiStep >= currentStep.multiStepInstructions.length - 1
                                ? {}
                                : { bg: 'green.50' },
                          })}
                        >
                          {t('controls.multiStep.next')}
                        </button>
                      </>
                    )}
                  <label className={hstack({ gap: 2, fontSize: 'sm' })}>
                    <input
                      type="checkbox"
                      checked={uiState.autoAdvance}
                      onChange={toggleAutoAdvance}
                    />
                    {t('controls.autoAdvance')}
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div
            className={css({
              mt: 2,
              bg: 'gray.200',
              borderRadius: 'full',
              h: 2,
            })}
          >
            <div
              className={css({
                bg: 'blue.500',
                h: 'full',
                borderRadius: 'full',
                transition: 'width 0.3s ease',
              })}
              style={{ width: `${navigationState.completionPercentage}%` }}
            />
          </div>
        </div>
      )}

      <div className={hstack({ flex: 1, gap: 0 })}>
        {/* Step list sidebar */}
        {uiState.showStepList && (
          <div
            className={css({
              w: '300px',
              borderRight: '1px solid',
              borderColor: 'gray.200',
              bg: 'gray.50',
              p: 4,
              overflowY: 'auto',
            })}
          >
            <h3 className={css({ fontWeight: 'bold', mb: 3 })}>{t('sidebar.title')}</h3>
            <div className={stack({ gap: 2 })}>
              {tutorial.steps && Array.isArray(tutorial.steps) ? (
                tutorial.steps.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => goToStep(index)}
                    className={css({
                      p: 3,
                      textAlign: 'left',
                      border: '1px solid',
                      borderColor: index === currentStepIndex ? 'blue.300' : 'gray.200',
                      borderRadius: 'md',
                      bg: index === currentStepIndex ? 'blue.50' : 'white',
                      cursor: 'pointer',
                      _hover: {
                        bg: index === currentStepIndex ? 'blue.100' : 'gray.50',
                      },
                    })}
                  >
                    <div className={css({ fontSize: 'sm', fontWeight: 'medium' })}>
                      {index + 1}. {step.title}
                    </div>
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: 'gray.600',
                        mt: 1,
                      })}
                    >
                      {step.problem}
                    </div>
                  </button>
                ))
              ) : (
                <div
                  className={css({
                    color: 'gray.500',
                    textAlign: 'center',
                    py: 4,
                  })}
                >
                  {t('sidebar.empty')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main content */}
        <div className={css({ flex: 1, display: 'flex', flexDirection: 'column' })}>
          {/* Step content */}
          <div className={css({ flex: 1, p: 6 })}>
            <div className={vstack({ gap: 6, alignItems: 'center' })}>
              {/* Step instructions */}
              <div className={css({ textAlign: 'center', maxW: '600px' })}>
                <h2
                  className={css({
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    mb: 2,
                    color: theme === 'dark' ? 'gray.200' : 'gray.900',
                  })}
                >
                  {currentStep.problem}
                </h2>
                <p
                  className={css({
                    fontSize: 'lg',
                    color: theme === 'dark' ? 'gray.400' : 'gray.700',
                    mb: 4,
                  })}
                >
                  {currentStep.description}
                </p>
                {/* Hide action description for multi-step problems since it duplicates pedagogical decomposition */}
                {!currentStep.multiStepInstructions && (
                  <p className={css({ fontSize: 'md', color: 'blue.600' })}>
                    {currentStep.actionDescription}
                  </p>
                )}
              </div>

              {/* Multi-step instructions panel */}
              {!hideTooltip &&
                currentStep.multiStepInstructions &&
                currentStep.multiStepInstructions.length > 0 && (
                  <div
                    className={css({
                      p: 5,
                      background:
                        theme === 'dark'
                          ? 'linear-gradient(135deg, rgba(40,40,50,0.6) 0%, rgba(50,50,60,0.6) 50%, rgba(60,50,70,0.3) 100%)'
                          : 'linear-gradient(135deg, rgba(255,248,225,0.95) 0%, rgba(254,252,232,0.95) 50%, rgba(255,245,157,0.15) 100%)',
                      backdropFilter: 'blur(10px)',
                      border:
                        theme === 'dark'
                          ? '1px solid rgba(255,255,255,0.1)'
                          : '1px solid rgba(251,191,36,0.3)',
                      borderRadius: 'xl',
                      boxShadow:
                        theme === 'dark'
                          ? '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
                          : '0 8px 32px rgba(251,191,36,0.1), 0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)',
                      position: 'relative',
                      maxW: '600px',
                      w: 'full',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        inset: '0',
                        borderRadius: 'xl',
                        background:
                          theme === 'dark'
                            ? 'linear-gradient(135deg, rgba(100,100,120,0.1) 0%, rgba(80,60,100,0.05) 100%)'
                            : 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(168,85,247,0.05) 100%)',
                        zIndex: -1,
                      },
                    })}
                  >
                    <p
                      className={css({
                        fontSize: 'base',
                        fontWeight: '600',
                        color: theme === 'dark' ? 'gray.300' : 'amber.900',
                        mb: 4,
                        letterSpacing: 'wide',
                        textShadow: theme === 'dark' ? 'none' : '0 1px 2px rgba(0,0,0,0.1)',
                      })}
                    >
                      {t('guidance.title')}
                    </p>

                    {/* Pedagogical decomposition with interactive reasoning */}
                    {fullDecomposition && isMeaningfulDecomposition && (
                      <div
                        className={css({
                          mb: 4,
                          p: 3,
                          background:
                            theme === 'dark'
                              ? 'linear-gradient(135deg, rgba(50,50,60,0.4) 0%, rgba(40,40,50,0.5) 100%)'
                              : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(248,250,252,0.9) 100%)',
                          border:
                            theme === 'dark'
                              ? '1px solid rgba(255,255,255,0.1)'
                              : '1px solid rgba(203,213,225,0.4)',
                          borderRadius: 'lg',
                          boxShadow:
                            theme === 'dark'
                              ? '0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
                              : '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)',
                          backdropFilter: 'blur(4px)',
                        })}
                      >
                        <div
                          className={css({
                            fontSize: 'base',
                            color: theme === 'dark' ? 'gray.300' : 'slate.800',
                            fontFamily: 'mono',
                            fontWeight: '500',
                            letterSpacing: 'tight',
                            lineHeight: '1.5',
                          })}
                        >
                          <DecompositionWithReasons
                            fullDecomposition={fullDecomposition}
                            termPositions={termPositions}
                            segments={pedagogicalSegments}
                          />
                        </div>
                      </div>
                    )}

                    <div
                      className={css({
                        fontSize: 'sm',
                        color: theme === 'dark' ? 'gray.400' : 'amber.800',
                        fontWeight: '500',
                        lineHeight: '1.6',
                      })}
                    >
                      {(() => {
                        // Only show the current step instruction
                        const currentInstruction =
                          currentStep.multiStepInstructions[currentMultiStep]
                        const _mathTerm = expectedSteps[currentMultiStep]?.mathematicalTerm

                        if (!currentInstruction) return null

                        // Hide "Next Action" when at the expected starting state for this step
                        const isAtExpectedStartingState = (() => {
                          if (currentMultiStep === 0) {
                            // First step: check if current value matches tutorial step start value
                            return currentValue === currentStep.startValue
                          } else {
                            // Subsequent steps: check if current value matches previous step's target
                            const previousStepTarget =
                              expectedSteps[currentMultiStep - 1]?.targetValue
                            return currentValue === previousStepTarget
                          }
                        })()

                        const hasMeaningfulSummary =
                          currentStepSummary && !currentStepSummary.includes('No changes needed')

                        // Only show help if:
                        // 1. Not at expected starting state (user needs to do something)
                        // 2. Has meaningful summary to show
                        // 3. Timer has expired (user appears stuck for 8+ seconds)
                        const _needsAction =
                          !isAtExpectedStartingState &&
                          hasMeaningfulSummary &&
                          showHelpForCurrentStep

                        return (
                          <div>
                            <div
                              className={css({
                                mb: 1,
                                fontWeight: 'bold',
                                color: theme === 'dark' ? 'yellow.200' : 'yellow.900',
                                textShadow:
                                  theme === 'dark' ? '0 0 12px rgba(251, 191, 36, 0.4)' : 'none',
                                fontSize: theme === 'dark' ? 'lg' : 'base',
                              })}
                            >
                              {currentInstruction}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}

              {/* Error message */}
              {error && (
                <div
                  className={css({
                    p: 4,
                    bg: 'red.50',
                    border: '1px solid',
                    borderColor: 'red.200',
                    borderRadius: 'md',
                    color: 'red.700',
                    maxW: '600px',
                  })}
                >
                  {error}
                </div>
              )}

              {/* Success message removed from inline layout - now positioned as overlay */}

              {/* Abacus */}
              <div
                className={css({
                  bg: theme === 'dark' ? 'rgba(30, 30, 40, 0.4)' : 'white',
                  border: '2px solid',
                  borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'gray.200',
                  borderRadius: 'lg',
                  p: 6,
                  shadow: theme === 'dark' ? '0 4px 6px rgba(0, 0, 0, 0.3)' : 'lg',
                })}
              >
                <AbacusReact
                  value={currentValue}
                  columns={abacusColumns}
                  interactive={true}
                  animated={true}
                  scaleFactor={1.5}
                  colorScheme={abacusConfig.colorScheme}
                  beadShape={abacusConfig.beadShape}
                  hideInactiveBeads={abacusConfig.hideInactiveBeads}
                  soundEnabled={abacusConfig.soundEnabled}
                  soundVolume={abacusConfig.soundVolume}
                  highlightBeads={filteredHighlightBeads}
                  stepBeadHighlights={currentStepBeads}
                  currentStep={currentMultiStep}
                  showDirectionIndicators={true}
                  customStyles={customStyles}
                  overlays={tooltipOverlay ? [tooltipOverlay] : []}
                  onValueChange={handleValueChange}
                  callbacks={{
                    onBeadClick: handleBeadClick,
                    onBeadRef: handleBeadRef,
                  }}
                />

                {/* Debug info */}
                {isDebugMode && (
                  <div
                    className={css({
                      mt: 4,
                      p: 3,
                      bg: 'purple.50',
                      border: '1px solid',
                      borderColor: 'purple.200',
                      borderRadius: 'md',
                      fontSize: 'xs',
                      fontFamily: 'mono',
                    })}
                  >
                    <div>
                      <strong>Step Debug Info:</strong>
                    </div>
                    <div>Current Multi-Step: {currentMultiStep}</div>
                    <div>Total Steps: {currentStep.totalSteps || 'undefined'}</div>
                    <div>
                      Step Bead Highlights:{' '}
                      {currentStepBeads ? currentStepBeads.length : 'undefined'}
                    </div>
                    <div>
                      Dynamic Recalc: {currentValue} → {currentStep.targetValue}
                    </div>
                    <div>Show Direction Indicators: true</div>
                    <div>
                      Multi-Step Instructions:{' '}
                      {currentStep.multiStepInstructions?.length || 'undefined'}
                    </div>
                    {currentStepBeads && (
                      <div className={css({ mt: 2 })}>
                        <div>
                          <strong>Current Step Beads ({currentMultiStep}):</strong>
                        </div>
                        {currentStepBeads
                          .filter((bead) => bead.stepIndex === currentMultiStep)
                          .map((bead, i) => (
                            <div key={i}>
                              - Place {bead.placeValue} {bead.beadType}{' '}
                              {bead.position !== undefined ? `pos ${bead.position}` : ''} →{' '}
                              {bead.direction}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tooltip */}
              {!hideTooltip && currentStep.tooltip && (
                <div
                  className={css({
                    maxW: '500px',
                    p: 4,
                    bg: 'yellow.50',
                    border: '1px solid',
                    borderColor: 'yellow.200',
                    borderRadius: 'md',
                  })}
                >
                  <h4
                    className={css({
                      fontWeight: 'bold',
                      color: 'yellow.800',
                      mb: 1,
                    })}
                  >
                    {currentStep.tooltip.content}
                  </h4>
                  <p className={css({ fontSize: 'sm', color: 'yellow.700' })}>
                    {currentStep.tooltip.explanation}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation controls */}
          {!hideNavigation && (
            <div
              className={css({
                borderTop: '1px solid',
                borderColor: 'gray.200',
                p: 4,
                bg: 'gray.50',
              })}
            >
              <div className={hstack({ justifyContent: 'space-between' })}>
                <button
                  onClick={goToPreviousStep}
                  disabled={!navigationState.canGoPrevious}
                  className={css({
                    px: 4,
                    py: 2,
                    border: '1px solid',
                    borderColor: 'gray.300',
                    borderRadius: 'md',
                    bg: 'white',
                    cursor: navigationState.canGoPrevious ? 'pointer' : 'not-allowed',
                    opacity: navigationState.canGoPrevious ? 1 : 0.5,
                    _hover: navigationState.canGoPrevious ? { bg: 'gray.50' } : {},
                  })}
                >
                  {t('navigation.previous')}
                </button>

                <div className={css({ fontSize: 'sm', color: 'gray.600' })}>
                  {t('navigation.stepCounter', {
                    current: currentStepIndex + 1,
                    total: navigationState.totalSteps,
                  })}
                </div>

                <button
                  onClick={goToNextStep}
                  disabled={!navigationState.canGoNext && !isStepCompleted}
                  className={css({
                    px: 4,
                    py: 2,
                    border: '1px solid',
                    borderColor:
                      navigationState.canGoNext || isStepCompleted ? 'blue.300' : 'gray.300',
                    borderRadius: 'md',
                    bg: navigationState.canGoNext || isStepCompleted ? 'blue.500' : 'gray.200',
                    color: navigationState.canGoNext || isStepCompleted ? 'white' : 'gray.500',
                    cursor:
                      navigationState.canGoNext || isStepCompleted ? 'pointer' : 'not-allowed',
                    _hover: navigationState.canGoNext || isStepCompleted ? { bg: 'blue.600' } : {},
                  })}
                >
                  {navigationState.canGoNext ? t('navigation.next') : t('navigation.complete')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Debug panel */}
        {uiState.showDebugPanel && (
          <div
            className={css({
              w: '400px',
              borderLeft: '1px solid',
              borderColor: 'gray.200',
              bg: 'gray.50',
              p: 4,
              overflowY: 'auto',
            })}
          >
            <h3 className={css({ fontWeight: 'bold', mb: 3 })}>{t('debugPanel.title')}</h3>

            <div className={stack({ gap: 4 })}>
              {/* Current state */}
              <div>
                <h4 className={css({ fontWeight: 'medium', mb: 2 })}>
                  {t('debugPanel.currentState')}
                </h4>
                <div
                  className={css({
                    fontSize: 'sm',
                    fontFamily: 'mono',
                    bg: 'white',
                    p: 2,
                    borderRadius: 'md',
                  })}
                >
                  <div>
                    {t('debugPanel.step', {
                      current: currentStepIndex + 1,
                      total: navigationState.totalSteps,
                    })}
                  </div>
                  <div>{t('debugPanel.value', { value: currentValue })}</div>
                  <div>{t('debugPanel.target', { value: currentStep.targetValue })}</div>
                  <div>
                    {t('debugPanel.completed', {
                      status: t(`debugPanel.completedStatus.${isStepCompleted ? 'yes' : 'no'}`),
                    })}
                  </div>
                  <div>
                    {t('debugPanel.time', {
                      seconds: Math.round((Date.now() - stepStartTime) / 1000),
                    })}
                  </div>
                </div>
              </div>

              {/* Event log */}
              <div>
                <h4 className={css({ fontWeight: 'medium', mb: 2 })}>{t('debugPanel.eventLog')}</h4>
                <div
                  className={css({
                    maxH: '300px',
                    overflowY: 'auto',
                    fontSize: 'xs',
                    fontFamily: 'mono',
                    bg: 'white',
                    border: '1px solid',
                    borderColor: 'gray.200',
                    borderRadius: 'md',
                  })}
                >
                  {events
                    .slice(-20)
                    .reverse()
                    .map((event, index) => (
                      <div
                        key={index}
                        className={css({
                          p: 2,
                          borderBottom: '1px solid',
                          borderColor: 'gray.100',
                        })}
                      >
                        <div
                          className={css({
                            fontWeight: 'bold',
                            color: 'blue.600',
                          })}
                        >
                          {event.type}
                        </div>
                        <div className={css({ color: 'gray.600' })}>
                          {event.timestamp.toLocaleTimeString()}
                        </div>
                        {event.type === 'VALUE_CHANGED' && (
                          <div>
                            {event.oldValue} → {event.newValue}
                          </div>
                        )}
                        {event.type === 'ERROR_OCCURRED' && (
                          <div className={css({ color: 'red.600' })}>{event.error}</div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add CSS animations */}
      <style jsx>{`
        @keyframes celebrationPulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  )
}

// Export wrapper component with provider
export function TutorialPlayer(props: TutorialPlayerProps) {
  return (
    <TutorialUIProvider canHideCoachBar>
      <TutorialProvider
        tutorial={props.tutorial}
        initialStepIndex={props.initialStepIndex}
        showDebugPanel={props.showDebugPanel}
        onStepChange={props.onStepChange}
        onStepComplete={props.onStepComplete}
        onTutorialComplete={props.onTutorialComplete}
        onEvent={props.onEvent}
      >
        <CoachBar />
        <TutorialPlayerContent {...props} />
      </TutorialProvider>
    </TutorialUIProvider>
  )
}
