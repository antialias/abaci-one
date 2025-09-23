'use client'

import React, { useState, useCallback, useEffect, useRef, useReducer, useMemo } from 'react'
import { AbacusReact, StepBeadHighlight } from '@soroban/abacus-react'
import { css } from '../../../styled-system/css'
import { stack, hstack, vstack } from '../../../styled-system/patterns'
import { Tutorial, TutorialStep, PracticeStep, TutorialEvent, NavigationState, UIState } from '../../types/tutorial'
import { PracticeProblemPlayer, PracticeResults } from './PracticeProblemPlayer'
import { generateAbacusInstructions } from '../../utils/abacusInstructionGenerator'
import { calculateBeadDiffFromValues } from '../../utils/beadDiff'
import { generateUnifiedInstructionSequence } from '../../utils/unifiedStepGenerator'

// Reducer state and actions
interface TutorialPlayerState {
  currentStepIndex: number
  currentValue: number
  isStepCompleted: boolean
  error: string | null
  events: TutorialEvent[]
  stepStartTime: number
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
        currentMultiStep: state.currentMultiStep + 1
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

export function TutorialPlayer({
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

  const [state, dispatch] = useReducer(tutorialPlayerReducer, {
    currentStepIndex: initialStepIndex,
    currentValue: 0,
    isStepCompleted: false,
    error: null,
    events: [],
    stepStartTime: Date.now(),
    currentMultiStep: 0,
    uiState: {
      isPlaying: true,
      isPaused: false,
      isEditing: false,
      showDebugPanel,
      showStepList: false,
      autoAdvance: false,
      playbackSpeed: 1
    }
  })

  const { currentStepIndex, currentValue, isStepCompleted, error, events, stepStartTime, uiState, currentMultiStep } = state

  const currentStep = tutorial.steps[currentStepIndex]
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
  const expectedSteps: ExpectedStep[] = useMemo(() => {
    try {
      const unifiedSequence = generateUnifiedInstructionSequence(currentStep.startValue, currentStep.targetValue)

      // Convert unified sequence to expected steps format
      const steps = unifiedSequence.steps.map((step, index) => ({
        index: index,
        stepIndex: index,
        targetValue: step.expectedValue,
        startValue: index === 0 ? currentStep.startValue : unifiedSequence.steps[index - 1].expectedValue,
        description: step.englishInstruction,
        mathematicalTerm: step.mathematicalTerm  // Add the pedagogical term
      }))

      return steps
    } catch (error) {
      return []
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

  // Event logging - now just notifies parent, state is managed by reducer
  const notifyEvent = useCallback((event: TutorialEvent) => {
    onEvent?.(event)
  }, [onEvent])

  // Navigation functions - declare these first since they're used in useEffects
  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < tutorial.steps.length) {
      const step = tutorial.steps[stepIndex]

      // Mark this as a programmatic change to prevent feedback loop
      isProgrammaticChange.current = true

      dispatch({
        type: 'INITIALIZE_STEP',
        stepIndex,
        startValue: step.startValue,
        stepId: step.id
      })

      // Notify parent of step change
      onStepChange?.(stepIndex, step)
    }
  }, [tutorial.steps, onStepChange])

  const goToNextStep = useCallback(() => {
    if (navigationState.canGoNext) {
      goToStep(currentStepIndex + 1)
    } else if (currentStepIndex === tutorial.steps.length - 1) {
      // Tutorial completed
      const timeSpent = (Date.now() - startTime) / 1000
      const score = events.filter(e => e.type === 'STEP_COMPLETED' && e.success).length / tutorial.steps.length * 100

      dispatch({
        type: 'ADD_EVENT',
        event: {
          type: 'TUTORIAL_COMPLETED',
          tutorialId: tutorial.id,
          score,
          timestamp: new Date()
        }
      })

      onTutorialComplete?.(score, timeSpent)
    }
  }, [navigationState.canGoNext, currentStepIndex, tutorial.steps.length, tutorial.id, startTime, events, onTutorialComplete, goToStep])

  const goToPreviousStep = useCallback(() => {
    if (navigationState.canGoPrevious) {
      goToStep(currentStepIndex - 1)
    }
  }, [navigationState.canGoPrevious, currentStepIndex, goToStep])

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

  // Check if step is completed - now using useEffect only for side effects
  useEffect(() => {
    if (currentStep && currentValue === currentStep.targetValue && !isStepCompleted) {
      dispatch({ type: 'COMPLETE_STEP', stepId: currentStep.id })
      onStepComplete?.(currentStepIndex, currentStep, true)

      // Auto-advance if enabled
      if (uiState.autoAdvance && navigationState.canGoNext) {
        setTimeout(() => goToNextStep(), 1500)
      }
    }
  }, [currentValue, currentStep, isStepCompleted, uiState.autoAdvance, navigationState.canGoNext, onStepComplete, currentStepIndex, goToNextStep])

  // Track the last value to detect when meaningful changes occur
  const lastValueForStepAdvancement = useRef<number>(currentValue)
  const userHasInteracted = useRef<boolean>(false)

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
            dispatch({ type: 'ADVANCE_MULTI_STEP' })
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

  // Debounced value change handling for smooth gesture performance
  const valueChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastValueRef = useRef<number>(currentValue)
  const pendingValueRef = useRef<number | null>(null)

  const handleValueChange = useCallback((newValue: number) => {
    // Ignore programmatic changes to prevent feedback loops
    if (isProgrammaticChange.current) {
      isProgrammaticChange.current = false
      return
    }

    // Mark that user has interacted
    userHasInteracted.current = true

    // Store the pending value for immediate abacus updates
    pendingValueRef.current = newValue

    // Clear any existing timeout
    if (valueChangeTimeoutRef.current) {
      clearTimeout(valueChangeTimeoutRef.current)
    }

    // Debounce the tutorial system notification
    valueChangeTimeoutRef.current = setTimeout(() => {
      const finalValue = pendingValueRef.current
      if (finalValue !== null && finalValue !== lastValueRef.current) {
        dispatch({
          type: 'USER_VALUE_CHANGE',
          oldValue: lastValueRef.current,
          newValue: finalValue,
          stepId: currentStep.id
        })
        lastValueRef.current = finalValue
      }
      pendingValueRef.current = null
    }, 150) // 150ms debounce - gestures settle quickly
  }, [currentStep])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (valueChangeTimeoutRef.current) {
        clearTimeout(valueChangeTimeoutRef.current)
      }
    }
  }, [])

  // Keep lastValueRef in sync with currentValue changes from external sources
  useEffect(() => {
    lastValueRef.current = currentValue
  }, [currentValue])

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
                      onClick={() => dispatch({ type: 'PREVIOUS_MULTI_STEP' })}
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
                      onClick={() => dispatch({ type: 'ADVANCE_MULTI_STEP' })}
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
                <p className={css({ fontSize: 'md', color: 'blue.600' })}>
                  {currentStep.actionDescription}
                </p>
              </div>

              {/* Multi-step instructions panel */}
              {currentStep.multiStepInstructions && currentStep.multiStepInstructions.length > 0 && (
                <div className={css({
                  p: 4,
                  bg: 'yellow.50',
                  border: '1px solid',
                  borderColor: 'yellow.200',
                  borderRadius: 'md',
                  maxW: '600px',
                  w: 'full'
                })}>
                  <p className={css({
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: 'yellow.800',
                    mb: 2
                  })}>
                    Step-by-Step Instructions:
                  </p>
                  <ol className={css({
                    fontSize: 'sm',
                    color: 'yellow.700',
                    pl: 4
                  })}>
                    {currentStep.multiStepInstructions.map((instruction, index) => {
                      // Get the mathematical term for this step
                      const mathTerm = expectedSteps[index]?.mathematicalTerm
                      const isCurrentStep = index === currentMultiStep

                      // Get the target value for this step to check if we need to show "Next Action"
                      const stepTargetValue = expectedSteps[index]?.targetValue
                      const needsAction = isCurrentStep && currentStepSummary && currentValue !== stepTargetValue

                      return (
                        <div key={index}>
                          <li className={css({
                            mb: 1,
                            opacity: index === currentMultiStep ? '1' : index < currentMultiStep ? '0.7' : '0.4',
                            fontWeight: index === currentMultiStep ? 'bold' : 'normal',
                            color: index === currentMultiStep ? 'yellow.900' : index < currentMultiStep ? 'yellow.600' : 'yellow.400'
                          })}>
                            {index + 1}. {instruction}
                            {isCurrentStep && mathTerm && (
                              <span className={css({
                                ml: 2,
                                px: 2,
                                py: 1,
                                bg: 'blue.100',
                                color: 'blue.800',
                                fontSize: 'xs',
                                fontWeight: 'semibold',
                                borderRadius: 'sm',
                                border: '1px solid',
                                borderColor: 'blue.200'
                              })}>
                                {mathTerm}
                              </span>
                            )}
                          </li>

                          {/* Show bead diff summary only when current value doesn't match step target */}
                          {needsAction && (
                            <div className={css({
                              ml: 6, // Align with step text (after number and dot)
                              mt: 1,
                              mb: 2,
                              p: 2,
                              bg: 'blue.50',
                              border: '1px solid',
                              borderColor: 'blue.200',
                              borderRadius: 'md',
                              fontSize: 'xs'
                            })}>
                              <p className={css({
                                fontSize: 'xs',
                                fontWeight: 'medium',
                                color: 'blue.800',
                                mb: 1
                              })}>
                                Next Action:
                              </p>
                              <p className={css({
                                fontSize: 'xs',
                                color: 'blue.700',
                                fontStyle: 'italic'
                              })}>
                                {currentStepSummary}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </ol>
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

              {/* Success message */}
              {isStepCompleted && (
                <div className={css({
                  p: 4,
                  bg: 'green.50',
                  border: '1px solid',
                  borderColor: 'green.200',
                  borderRadius: 'md',
                  color: 'green.700',
                  maxW: '600px'
                })}>
                  Great! You completed this step correctly.
                </div>
              )}

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
                  colorScheme="place-value"
                  highlightBeads={currentStep.highlightBeads}
                  stepBeadHighlights={currentStepBeads}
                  currentStep={currentMultiStep}
                  showDirectionIndicators={true}
                  customStyles={customStyles}
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
    </div>
  )
}