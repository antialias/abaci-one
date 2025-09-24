'use client'

import React, { useState, useCallback, useEffect, useRef, useReducer, useMemo } from 'react'
import { AbacusReact, StepBeadHighlight, AbacusOverlay } from '@soroban/abacus-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { css } from '../../../styled-system/css'
import { stack, hstack, vstack } from '../../../styled-system/patterns'
import { Tutorial, TutorialStep, PracticeStep, TutorialEvent, NavigationState, UIState } from '../../types/tutorial'
import { PracticeProblemPlayer, PracticeResults } from './PracticeProblemPlayer'
import { generateAbacusInstructions } from '../../utils/abacusInstructionGenerator'
import { calculateBeadDiffFromValues } from '../../utils/beadDiff'
import { generateUnifiedInstructionSequence } from '../../utils/unifiedStepGenerator'
import { TutorialProvider, useTutorialContext } from './TutorialContext'
import { PedagogicalDecompositionDisplay } from './PedagogicalDecompositionDisplay'
import { useAbacusDisplay } from '@/contexts/AbacusDisplayContext'

// Helper function to find the topmost bead with arrows
function findTopmostBeadWithArrows(stepBeadHighlights: StepBeadHighlight[] | undefined): StepBeadHighlight | null {
  if (!stepBeadHighlights || stepBeadHighlights.length === 0) return null

  // Filter only beads that have direction arrows (should have highlights)
  const beadsWithArrows = stepBeadHighlights.filter(bead => bead.direction && bead.direction !== 'none')

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
  | { type: 'INITIALIZE_STEP'; stepIndex: number; startValue: number; stepId: string }
  | { type: 'USER_VALUE_CHANGE'; oldValue: number; newValue: number; stepId: string }
  | { type: 'COMPLETE_STEP'; stepId: string }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'ADD_EVENT'; event: TutorialEvent }
  | { type: 'UPDATE_UI_STATE'; updates: Partial<UIState> }
  | { type: 'ADVANCE_MULTI_STEP' }
  | { type: 'PREVIOUS_MULTI_STEP' }
  | { type: 'RESET_MULTI_STEP' }

function tutorialPlayerReducer(state: TutorialPlayerState, action: TutorialPlayerAction): TutorialPlayerState {
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
        events: [...state.events, {
          type: 'STEP_STARTED',
          stepId: action.stepId,
          timestamp: new Date()
        }]
      }

    case 'USER_VALUE_CHANGE':
      return {
        ...state,
        currentValue: action.newValue,
        events: [...state.events, {
          type: 'VALUE_CHANGED',
          stepId: action.stepId,
          oldValue: action.oldValue,
          newValue: action.newValue,
          timestamp: new Date()
        }]
      }

    case 'COMPLETE_STEP':
      return {
        ...state,
        isStepCompleted: true,
        error: null,
        events: [...state.events, {
          type: 'STEP_COMPLETED',
          stepId: action.stepId,
          success: true,
          timestamp: new Date()
        }]
      }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error
      }

    case 'ADD_EVENT':
      return {
        ...state,
        events: [...state.events, action.event]
      }

    case 'UPDATE_UI_STATE':
      return {
        ...state,
        uiState: { ...state.uiState, ...action.updates }
      }

    case 'ADVANCE_MULTI_STEP':
      return {
        ...state,
        currentMultiStep: state.currentMultiStep + 1,
        multiStepStartTime: Date.now() // Reset timer for new multi-step
      }

    case 'PREVIOUS_MULTI_STEP':
      return {
        ...state,
        currentMultiStep: Math.max(0, state.currentMultiStep - 1)
      }

    case 'RESET_MULTI_STEP':
      return {
        ...state,
        currentMultiStep: 0
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
  onStepChange,
  onStepComplete,
  onTutorialComplete,
  onEvent,
  className
}: TutorialPlayerProps) {
  const [startTime] = useState(Date.now())
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
    resetMultiStep
  } = useTutorialContext()

  const { currentStepIndex, currentValue, isStepCompleted, error, events, stepStartTime, multiStepStartTime, uiState, currentMultiStep } = state

  // Use universal abacus display configuration
  const { config: abacusConfig } = useAbacusDisplay()
  const [isSuccessPopupDismissed, setIsSuccessPopupDismissed] = useState(false)

  // Reset success popup when moving to new step
  useEffect(() => {
    setIsSuccessPopupDismissed(false)
  }, [currentStepIndex])

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
    completionPercentage: (currentStepIndex / tutorial.steps.length) * 100
  }

  // Define the static expected steps using our unified step generator
  const { expectedSteps, fullDecomposition } = useMemo(() => {
    try {
      const unifiedSequence = generateUnifiedInstructionSequence(currentStep.startValue, currentStep.targetValue)

      // Convert unified sequence to expected steps format
      const steps = unifiedSequence.steps.map((step, index) => ({
        index: index,
        stepIndex: index,
        targetValue: step.expectedValue,
        startValue: index === 0 ? currentStep.startValue : unifiedSequence.steps[index - 1].expectedValue,
        description: step.englishInstruction,
        mathematicalTerm: step.mathematicalTerm,  // Add the pedagogical term
        termPosition: step.termPosition  // Add the precise position information
      }))

      return {
        expectedSteps: steps,
        fullDecomposition: unifiedSequence.fullDecomposition
      }
    } catch (error) {
      return {
        expectedSteps: [],
        fullDecomposition: ''
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
      const stepBeadHighlights: StepBeadHighlight[] = beadDiff.changes.map((change, index) => ({
        placeValue: change.placeValue,
        beadType: change.beadType,
        position: change.position,
        direction: change.direction,
        stepIndex: currentMultiStep, // Use current multi-step index to match AbacusReact filtering
        order: change.order
      }))


      return stepBeadHighlights
    } catch (error) {
      console.error('Error generating step beads with bead diff:', error)
      return undefined
    }
  }, [currentValue, currentStep.targetValue, expectedSteps, currentMultiStep])

  // Get the current step's bead diff summary for real-time user feedback
  const getCurrentStepSummary = useCallback(() => {
    if (expectedSteps.length === 0) return null

    const currentExpectedStep = expectedSteps[currentMultiStep]
    if (!currentExpectedStep) return null

    try {
      const beadDiff = calculateBeadDiffFromValues(currentValue, currentExpectedStep.targetValue)
      return beadDiff.hasChanges ? beadDiff.summary : null
    } catch (error) {
      return null
    }
  }, [currentValue, expectedSteps, currentMultiStep])

  // Get current step beads (dynamic arrows for static expected steps)
  const currentStepBeads = getCurrentStepBeads()


  // Get current step summary for real-time user feedback
  const currentStepSummary = getCurrentStepSummary()

  // Helper function to highlight the current mathematical term in the full decomposition
  const renderHighlightedDecomposition = useCallback(() => {
    if (!fullDecomposition || expectedSteps.length === 0) return null

    const currentStep = expectedSteps[currentMultiStep]
    if (!currentStep?.termPosition) return null

    const { startIndex, endIndex } = currentStep.termPosition
    const before = fullDecomposition.substring(0, startIndex)
    const highlighted = fullDecomposition.substring(startIndex, endIndex)
    const after = fullDecomposition.substring(endIndex)

    return { before, highlighted, after }
  }, [fullDecomposition, expectedSteps, currentMultiStep])

  // Create overlay for tooltip positioned precisely at topmost bead using smart collision detection
  const tooltipOverlay = useMemo(() => {
    if (!currentStepSummary || !currentStepBeads?.length) {
      return null
    }

    // Find the topmost bead with arrows
    const topmostBead = findTopmostBeadWithArrows(currentStepBeads)
    if (!topmostBead) {
      return null
    }

    // Smart positioning logic: avoid covering active beads
    const targetColumnIndex = 4 - topmostBead.placeValue // Convert placeValue to columnIndex (5 columns: 0-4)

    // Check if there are any active beads (against reckoning bar OR with arrows) in columns to the left
    const hasActiveBeadsToLeft = (() => {
      // Get current abacus state - we need to check which beads are against the reckoning bar
      const abacusDigits = currentValue.toString().padStart(5, '0').split('').map(Number)

      for (let col = 0; col < targetColumnIndex; col++) {
        const placeValue = 4 - col // Convert columnIndex back to placeValue
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
        const hasArrowsInColumn = currentStepBeads.some(bead => {
          const beadColumnIndex = 4 - bead.placeValue
          return beadColumnIndex === col && bead.direction && bead.direction !== 'none'
        })
        if (hasArrowsInColumn) {
          return true
        }
      }

      return false
    })()

    // Determine tooltip position and target
    const shouldPositionAbove = hasActiveBeadsToLeft
    const tooltipSide = shouldPositionAbove ? 'top' : 'left'
    const tooltipTarget = shouldPositionAbove ? {
      // Target the heaven bead position for the column
      type: 'bead' as const,
      columnIndex: targetColumnIndex,
      beadType: 'heaven' as const,
      beadPosition: 0 // Heaven beads are always at position 0
    } : {
      // Target the actual bead
      type: 'bead' as const,
      columnIndex: targetColumnIndex,
      beadType: topmostBead.beadType,
      beadPosition: topmostBead.position
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
                  background: isStepCompleted
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(21, 128, 61, 0.95) 100%)'
                    : '#1e40af',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '700',
                  boxShadow: isStepCompleted
                    ? '0 8px 25px rgba(34, 197, 94, 0.4), 0 0 0 2px rgba(255, 255, 255, 0.2)'
                    : '0 4px 12px rgba(0,0,0,0.3)',
                  whiteSpace: 'normal',
                  maxWidth: '200px',
                  minWidth: '150px',
                  wordBreak: 'break-word',
                  zIndex: 1000,
                  opacity: 0.95,
                  transition: 'all 0.3s ease',
                  transform: isStepCompleted ? 'scale(1.05)' : 'scale(1)',
                  animation: isStepCompleted ? 'celebrationPulse 0.6s ease-out' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.85'
                }}
              >
                <div style={{ fontSize: '12px', opacity: 0.9 }}>
                  {isStepCompleted ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}>
                      <span style={{ fontSize: '18px' }}>🎉</span>
                      <span>Excellent work!</span>
                    </div>
                  ) : (
                    <>
                      <PedagogicalDecompositionDisplay
                        variant="tooltip"
                        showLabel={true}
                        decomposition={renderHighlightedDecomposition()}
                      />
                      <span style={{ fontSize: '18px' }}>💡</span> {currentStepSummary}
                    </>
                  )}
                </div>
                <Tooltip.Arrow
                  style={{
                    fill: isStepCompleted ? '#15803d' : '#1e40af'
                  }}
                />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ),
      offset: { x: 0, y: 0 },
      visible: true
    }

    return overlay
  }, [currentStepSummary, currentStepBeads])

  // Timer for smart help detection
  useEffect(() => {
    setShowHelpForCurrentStep(false) // Reset help when step changes

    const timer = setTimeout(() => {
      setShowHelpForCurrentStep(true)
    }, 8000) // 8 seconds

    return () => clearTimeout(timer)
  }, [currentMultiStep, multiStepStartTime]) // Reset when step changes or timer resets

  // Event logging - now just notifies parent, state is managed by reducer
  const notifyEvent = useCallback((event: TutorialEvent) => {
    onEvent?.(event)
  }, [onEvent])

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
        stepId: currentStep.id
      })

      // Notify parent of step change
      onStepChange?.(currentStepIndex, currentStep)
    }
  }, []) // Only run on mount

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
  }, [currentValue, currentStep, isStepCompleted, expectedSteps, currentMultiStep, uiState.autoAdvance, navigationState.canGoNext, onStepComplete, currentStepIndex, goToNextStep])

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
      expectedStepReached: currentExpectedStep ? currentValue === currentExpectedStep.targetValue : false,
      totalExpectedSteps: expectedSteps.length,
      finalTargetReached: currentValue === currentStep?.targetValue
    })

    // Only advance if user interacted and we have expected steps
    if (valueChanged && userHasInteracted.current && expectedSteps.length > 0 && currentExpectedStep) {
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
  }, [currentValue, currentStep, currentMultiStep, expectedSteps, showDebugPanel])

  // Update the reference when the step changes (not just value changes)
  useEffect(() => {
    lastValueForStepAdvancement.current = currentValue
    // Reset user interaction flag when step changes
    userHasInteracted.current = false
  }, [currentStepIndex, currentMultiStep])

  // Notify parent of events when they're added to state
  useEffect(() => {
    if (events.length > 0) {
      const lastEvent = events[events.length - 1]
      notifyEvent(lastEvent)
    }
  }, [events, notifyEvent])

  // Keep refs needed for step advancement logic
  const lastValueForStepAdvancement = useRef<number>(currentValue)
  const userHasInteracted = useRef<boolean>(false)

  // Wrap context handleValueChange to track user interaction
  const handleValueChange = useCallback((newValue: number) => {
    // Mark that user has interacted
    userHasInteracted.current = true

    // Call the context's handleValueChange
    contextHandleValueChange(newValue)
  }, [contextHandleValueChange, currentValue])

  // Cleanup handled by context

  // Value tracking handled by context

  const handleBeadClick = useCallback((beadInfo: any) => {
    dispatch({
      type: 'ADD_EVENT',
      event: {
        type: 'BEAD_CLICKED',
        stepId: currentStep.id,
        beadInfo,
        timestamp: new Date()
      }
    })

    // Check if this is the correct action
    if (currentStep.highlightBeads && Array.isArray(currentStep.highlightBeads)) {
      const isCorrectBead = currentStep.highlightBeads.some(highlight => {
        // Get place value from highlight (convert columnIndex to placeValue if needed)
        const highlightPlaceValue = highlight.placeValue ?? (4 - highlight.columnIndex);
        // Get place value from bead click event
        const beadPlaceValue = beadInfo.bead ? beadInfo.bead.placeValue : (4 - beadInfo.columnIndex);

        return highlightPlaceValue === beadPlaceValue &&
               highlight.beadType === beadInfo.beadType &&
               (highlight.position === undefined || highlight.position === beadInfo.position);
      });

      if (!isCorrectBead) {
        dispatch({ type: 'SET_ERROR', error: currentStep.errorMessages.wrongBead })

        dispatch({
          type: 'ADD_EVENT',
          event: {
            type: 'ERROR_OCCURRED',
            stepId: currentStep.id,
            error: currentStep.errorMessages.wrongBead,
            timestamp: new Date()
          }
        })
      } else {
        dispatch({ type: 'SET_ERROR', error: null })
      }
    }
  }, [currentStep])

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
      updates: { showDebugPanel: !uiState.showDebugPanel }
    })
  }, [uiState.showDebugPanel])

  const toggleStepList = useCallback(() => {
    dispatch({
      type: 'UPDATE_UI_STATE',
      updates: { showStepList: !uiState.showStepList }
    })
  }, [uiState.showStepList])

  const toggleAutoAdvance = useCallback(() => {
    dispatch({
      type: 'UPDATE_UI_STATE',
      updates: { autoAdvance: !uiState.autoAdvance }
    })
  }, [uiState.autoAdvance])

  // Memoize custom styles calculation to avoid expensive recalculation on every render
  const customStyles = useMemo(() => {
    if (!currentStep.highlightBeads || !Array.isArray(currentStep.highlightBeads)) {
      return undefined;
    }

    return {
      beads: currentStep.highlightBeads.reduce((acc, highlight) => {
        // Convert placeValue to columnIndex for AbacusReact compatibility
        const columnIndex = highlight.placeValue !== undefined ? (4 - highlight.placeValue) : highlight.columnIndex;

        // Initialize column if it doesn't exist
        if (!acc[columnIndex]) {
          acc[columnIndex] = {};
        }

        // Add the bead style to the appropriate type
        if (highlight.beadType === 'earth' && highlight.position !== undefined) {
          if (!acc[columnIndex].earth) {
            acc[columnIndex].earth = {};
          }
          acc[columnIndex].earth[highlight.position] = {
            fill: '#fbbf24',
            stroke: '#f59e0b',
            strokeWidth: 3
          };
        } else {
          acc[columnIndex][highlight.beadType] = {
            fill: '#fbbf24',
            stroke: '#f59e0b',
            strokeWidth: 3
          };
        }

        return acc;
      }, {} as any)
    };
  }, [currentStep.highlightBeads]);

  if (!currentStep) {
    return <div>No steps available</div>
  }

  return (
    <div className={`${css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '600px'
    })} ${className || ''}`}>
      {/* Header */}
      <div className={css({
        borderBottom: '1px solid',
        borderColor: 'gray.200',
        p: 4,
        bg: 'white'
      })}>
        <div className={hstack({ justifyContent: 'space-between', alignItems: 'center' })}>
          <div>
            <h1 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>
              {tutorial.title}
            </h1>
            <p className={css({ fontSize: 'sm', color: 'gray.600' })}>
              Step {currentStepIndex + 1} of {tutorial.steps.length}: {currentStep.title}
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
                    _hover: { bg: 'blue.50' }
                  })}
                >
                  Debug
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
                    _hover: { bg: 'gray.50' }
                  })}
                >
                  Steps
                </button>

                {/* Multi-step navigation controls */}
                {currentStep.multiStepInstructions && currentStep.multiStepInstructions.length > 1 && (
                  <>
                    <div className={css({
                      fontSize: 'xs',
                      color: 'gray.600',
                      px: 2,
                      borderLeft: '1px solid',
                      borderColor: 'gray.300',
                      ml: 2,
                      pl: 3
                    })}>
                      Multi-Step: {currentMultiStep + 1} / {currentStep.multiStepInstructions.length}
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
                        _hover: currentMultiStep === 0 ? {} : { bg: 'orange.50' }
                      })}
                    >
                      ⏮ First
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
                        _hover: currentMultiStep === 0 ? {} : { bg: 'orange.50' }
                      })}
                    >
                      ⏪ Prev
                    </button>
                    <button
                      onClick={() => advanceMultiStep()}
                      disabled={currentMultiStep >= currentStep.multiStepInstructions.length - 1}
                      className={css({
                        px: 2,
                        py: 1,
                        fontSize: 'xs',
                        border: '1px solid',
                        borderColor: currentMultiStep >= currentStep.multiStepInstructions.length - 1 ? 'gray.200' : 'green.300',
                        borderRadius: 'md',
                        bg: currentMultiStep >= currentStep.multiStepInstructions.length - 1 ? 'gray.100' : 'white',
                        color: currentMultiStep >= currentStep.multiStepInstructions.length - 1 ? 'gray.400' : 'green.700',
                        cursor: currentMultiStep >= currentStep.multiStepInstructions.length - 1 ? 'not-allowed' : 'pointer',
                        _hover: currentMultiStep >= currentStep.multiStepInstructions.length - 1 ? {} : { bg: 'green.50' }
                      })}
                    >
                      Next ⏩
                    </button>
                  </>
                )}
                <label className={hstack({ gap: 2, fontSize: 'sm' })}>
                  <input
                    type="checkbox"
                    checked={uiState.autoAdvance}
                    onChange={toggleAutoAdvance}
                  />
                  Auto-advance
                </label>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className={css({ mt: 2, bg: 'gray.200', borderRadius: 'full', h: 2 })}>
          <div
            className={css({
              bg: 'blue.500',
              h: 'full',
              borderRadius: 'full',
              transition: 'width 0.3s ease'
            })}
            style={{ width: `${navigationState.completionPercentage}%` }}
          />
        </div>
      </div>

      <div className={hstack({ flex: 1, gap: 0 })}>
        {/* Step list sidebar */}
        {uiState.showStepList && (
          <div className={css({
            w: '300px',
            borderRight: '1px solid',
            borderColor: 'gray.200',
            bg: 'gray.50',
            p: 4,
            overflowY: 'auto'
          })}>
            <h3 className={css({ fontWeight: 'bold', mb: 3 })}>Tutorial Steps</h3>
            <div className={stack({ gap: 2 })}>
              {tutorial.steps && Array.isArray(tutorial.steps) ? tutorial.steps.map((step, index) => (
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
                    _hover: { bg: index === currentStepIndex ? 'blue.100' : 'gray.50' }
                  })}
                >
                  <div className={css({ fontSize: 'sm', fontWeight: 'medium' })}>
                    {index + 1}. {step.title}
                  </div>
                  <div className={css({ fontSize: 'xs', color: 'gray.600', mt: 1 })}>
                    {step.problem}
                  </div>
                </button>
              )) : (
                <div className={css({ color: 'gray.500', textAlign: 'center', py: 4 })}>
                  No tutorial steps available
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
                <h2 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 2 })}>
                  {currentStep.problem}
                </h2>
                <p className={css({ fontSize: 'lg', color: 'gray.700', mb: 4 })}>
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
              {currentStep.multiStepInstructions && currentStep.multiStepInstructions.length > 0 && (
                <div className={css({
                  p: 5,
                  background: 'linear-gradient(135deg, rgba(255,248,225,0.95) 0%, rgba(254,252,232,0.95) 50%, rgba(255,245,157,0.15) 100%)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  borderRadius: 'xl',
                  boxShadow: '0 8px 32px rgba(251,191,36,0.1), 0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)',
                  position: 'relative',
                  maxW: '600px',
                  w: 'full',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: '0',
                    borderRadius: 'xl',
                    background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(168,85,247,0.05) 100%)',
                    zIndex: -1
                  }
                })}>
                  <p className={css({
                    fontSize: 'base',
                    fontWeight: '600',
                    color: 'amber.900',
                    mb: 4,
                    letterSpacing: 'wide',
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  })}>
                    Guidance
                  </p>

                  {/* Pedagogical decomposition with current term highlighted */}
                  {fullDecomposition && (
                    <div className={css({
                      mb: 4,
                      p: 3,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(248,250,252,0.9) 100%)',
                      border: '1px solid rgba(203,213,225,0.4)',
                      borderRadius: 'lg',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)',
                      backdropFilter: 'blur(4px)'
                    })}>
                      <p className={css({
                        fontSize: 'base',
                        color: 'slate.800',
                        fontFamily: 'mono',
                        fontWeight: '500',
                        letterSpacing: 'tight',
                        lineHeight: '1.5'
                      })}>
                        <PedagogicalDecompositionDisplay
                          variant="guidance"
                          decomposition={renderHighlightedDecomposition()}
                        />
                      </p>
                    </div>
                  )}

                  <div className={css({
                    fontSize: 'sm',
                    color: 'amber.800',
                    fontWeight: '500',
                    lineHeight: '1.6'
                  })}>
                    {(() => {
                      // Only show the current step instruction
                      const currentInstruction = currentStep.multiStepInstructions[currentMultiStep]
                      const mathTerm = expectedSteps[currentMultiStep]?.mathematicalTerm

                      if (!currentInstruction) return null

                      // Hide "Next Action" when at the expected starting state for this step
                      const isAtExpectedStartingState = (() => {
                        if (currentMultiStep === 0) {
                          // First step: check if current value matches tutorial step start value
                          return currentValue === currentStep.startValue
                        } else {
                          // Subsequent steps: check if current value matches previous step's target
                          const previousStepTarget = expectedSteps[currentMultiStep - 1]?.targetValue
                          return currentValue === previousStepTarget
                        }
                      })()

                      const hasMeaningfulSummary = currentStepSummary && !currentStepSummary.includes('No changes needed')

                      // Only show help if:
                      // 1. Not at expected starting state (user needs to do something)
                      // 2. Has meaningful summary to show
                      // 3. Timer has expired (user appears stuck for 8+ seconds)
                      const needsAction = !isAtExpectedStartingState && hasMeaningfulSummary && showHelpForCurrentStep

                      return (
                        <div>
                          <div className={css({
                            mb: 1,
                            fontWeight: 'bold',
                            color: 'yellow.900'
                          })}>
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
                <div className={css({
                  p: 4,
                  bg: 'red.50',
                  border: '1px solid',
                  borderColor: 'red.200',
                  borderRadius: 'md',
                  color: 'red.700',
                  maxW: '600px'
                })}>
                  {error}
                </div>
              )}

              {/* Success message removed from inline layout - now positioned as overlay */}

              {/* Abacus */}
              <div className={css({
                bg: 'white',
                border: '2px solid',
                borderColor: 'gray.200',
                borderRadius: 'lg',
                p: 6,
                shadow: 'lg'
              })}>
                <AbacusReact
                  value={currentValue}
                  columns={5}
                  interactive={true}
                  animated={true}
                  scaleFactor={2.5}
                  colorScheme={abacusConfig.colorScheme}
                  beadShape={abacusConfig.beadShape}
                  hideInactiveBeads={abacusConfig.hideInactiveBeads}
                  highlightBeads={currentStep.highlightBeads}
                  stepBeadHighlights={currentStepBeads}
                  currentStep={currentMultiStep}
                  showDirectionIndicators={true}
                  customStyles={customStyles}
                  overlays={tooltipOverlay ? [tooltipOverlay] : []}
                  onValueChange={handleValueChange}
                  callbacks={{
                    onBeadClick: handleBeadClick,
                    onBeadRef: handleBeadRef
                  }}
                />

                {/* Debug info */}
                {isDebugMode && (
                  <div className={css({
                    mt: 4,
                    p: 3,
                    bg: 'purple.50',
                    border: '1px solid',
                    borderColor: 'purple.200',
                    borderRadius: 'md',
                    fontSize: 'xs',
                    fontFamily: 'mono'
                  })}>
                    <div><strong>Step Debug Info:</strong></div>
                    <div>Current Multi-Step: {currentMultiStep}</div>
                    <div>Total Steps: {currentStep.totalSteps || 'undefined'}</div>
                    <div>Step Bead Highlights: {currentStepBeads ? currentStepBeads.length : 'undefined'}</div>
                    <div>Dynamic Recalc: {currentValue} → {currentStep.targetValue}</div>
                    <div>Show Direction Indicators: true</div>
                    <div>Multi-Step Instructions: {currentStep.multiStepInstructions?.length || 'undefined'}</div>
                    {currentStepBeads && (
                      <div className={css({ mt: 2 })}>
                        <div><strong>Current Step Beads ({currentMultiStep}):</strong></div>
                        {currentStepBeads
                          .filter(bead => bead.stepIndex === currentMultiStep)
                          .map((bead, i) => (
                            <div key={i}>
                              - Place {bead.placeValue} {bead.beadType} {bead.position !== undefined ? `pos ${bead.position}` : ''} → {bead.direction}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tooltip */}
              {currentStep.tooltip && (
                <div className={css({
                  maxW: '500px',
                  p: 4,
                  bg: 'yellow.50',
                  border: '1px solid',
                  borderColor: 'yellow.200',
                  borderRadius: 'md'
                })}>
                  <h4 className={css({ fontWeight: 'bold', color: 'yellow.800', mb: 1 })}>
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
          <div className={css({
            borderTop: '1px solid',
            borderColor: 'gray.200',
            p: 4,
            bg: 'gray.50'
          })}>
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
                  _hover: navigationState.canGoPrevious ? { bg: 'gray.50' } : {}
                })}
              >
                ← Previous
              </button>

              <div className={css({ fontSize: 'sm', color: 'gray.600' })}>
                Step {currentStepIndex + 1} of {navigationState.totalSteps}
              </div>

              <button
                onClick={goToNextStep}
                disabled={!navigationState.canGoNext && !isStepCompleted}
                className={css({
                  px: 4,
                  py: 2,
                  border: '1px solid',
                  borderColor: navigationState.canGoNext || isStepCompleted ? 'blue.300' : 'gray.300',
                  borderRadius: 'md',
                  bg: navigationState.canGoNext || isStepCompleted ? 'blue.500' : 'gray.200',
                  color: navigationState.canGoNext || isStepCompleted ? 'white' : 'gray.500',
                  cursor: navigationState.canGoNext || isStepCompleted ? 'pointer' : 'not-allowed',
                  _hover: navigationState.canGoNext || isStepCompleted ? { bg: 'blue.600' } : {}
                })}
              >
                {navigationState.canGoNext ? 'Next →' : 'Complete Tutorial'}
              </button>
            </div>
          </div>
        </div>

        {/* Debug panel */}
        {uiState.showDebugPanel && (
          <div className={css({
            w: '400px',
            borderLeft: '1px solid',
            borderColor: 'gray.200',
            bg: 'gray.50',
            p: 4,
            overflowY: 'auto'
          })}>
            <h3 className={css({ fontWeight: 'bold', mb: 3 })}>Debug Panel</h3>

            <div className={stack({ gap: 4 })}>
              {/* Current state */}
              <div>
                <h4 className={css({ fontWeight: 'medium', mb: 2 })}>Current State</h4>
                <div className={css({ fontSize: 'sm', fontFamily: 'mono', bg: 'white', p: 2, borderRadius: 'md' })}>
                  <div>Step: {currentStepIndex + 1}/{navigationState.totalSteps}</div>
                  <div>Value: {currentValue}</div>
                  <div>Target: {currentStep.targetValue}</div>
                  <div>Completed: {isStepCompleted ? 'Yes' : 'No'}</div>
                  <div>Time: {Math.round((Date.now() - stepStartTime) / 1000)}s</div>
                </div>
              </div>

              {/* Event log */}
              <div>
                <h4 className={css({ fontWeight: 'medium', mb: 2 })}>Event Log</h4>
                <div className={css({
                  maxH: '300px',
                  overflowY: 'auto',
                  fontSize: 'xs',
                  fontFamily: 'mono',
                  bg: 'white',
                  border: '1px solid',
                  borderColor: 'gray.200',
                  borderRadius: 'md'
                })}>
                  {events.slice(-20).reverse().map((event, index) => (
                    <div key={index} className={css({ p: 2, borderBottom: '1px solid', borderColor: 'gray.100' })}>
                      <div className={css({ fontWeight: 'bold', color: 'blue.600' })}>
                        {event.type}
                      </div>
                      <div className={css({ color: 'gray.600' })}>
                        {event.timestamp.toLocaleTimeString()}
                      </div>
                      {event.type === 'VALUE_CHANGED' && (
                        <div>{event.oldValue} → {event.newValue}</div>
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
    <TutorialProvider
      tutorial={props.tutorial}
      initialStepIndex={props.initialStepIndex}
      showDebugPanel={props.showDebugPanel}
      onStepChange={props.onStepChange}
      onStepComplete={props.onStepComplete}
      onTutorialComplete={props.onTutorialComplete}
      onEvent={props.onEvent}
    >
      <TutorialPlayerContent {...props} />
    </TutorialProvider>
  )
}