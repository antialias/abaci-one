'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AbacusReact } from '@soroban/abacus-react'
import { css } from '../../styled-system/css'
import { stack, hstack, vstack } from '../../styled-system/patterns'
import { Tutorial, TutorialStep, TutorialEvent, NavigationState, UIState } from '../../types/tutorial'

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
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex)
  const [currentValue, setCurrentValue] = useState(0)
  const [isStepCompleted, setIsStepCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<TutorialEvent[]>([])
  const [startTime] = useState(Date.now())
  const [stepStartTime, setStepStartTime] = useState(Date.now())
  const isProgrammaticChange = useRef(false)
  const [uiState, setUIState] = useState<UIState>({
    isPlaying: true,
    isPaused: false,
    isEditing: false,
    showDebugPanel,
    showStepList: false,
    autoAdvance: false,
    playbackSpeed: 1
  })

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

  // Event logging
  const logEvent = useCallback((event: TutorialEvent) => {
    setEvents(prev => [...prev, event])
    onEvent?.(event)
  }, [onEvent])

  // Initialize step
  useEffect(() => {
    if (currentStep) {
      // Mark this as a programmatic change to prevent feedback loop
      isProgrammaticChange.current = true
      setCurrentValue(currentStep.startValue)
      setIsStepCompleted(false)
      setError(null)
      setStepStartTime(Date.now())

      logEvent({
        type: 'STEP_STARTED',
        stepId: currentStep.id,
        timestamp: new Date()
      })

      onStepChange?.(currentStepIndex, currentStep)
    }
  }, [currentStepIndex, currentStep, onStepChange, logEvent])

  // Check if step is completed
  useEffect(() => {
    if (currentStep && currentValue === currentStep.targetValue && !isStepCompleted) {
      setIsStepCompleted(true)
      setError(null)

      logEvent({
        type: 'STEP_COMPLETED',
        stepId: currentStep.id,
        success: true,
        timestamp: new Date()
      })

      onStepComplete?.(currentStepIndex, currentStep, true)

      // Auto-advance if enabled
      if (uiState.autoAdvance && navigationState.canGoNext) {
        setTimeout(() => goToNextStep(), 1500)
      }
    }
  }, [currentValue, currentStep, isStepCompleted, uiState.autoAdvance, navigationState.canGoNext, logEvent, onStepComplete, currentStepIndex])

  // Navigation functions
  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < tutorial.steps.length) {
      setCurrentStepIndex(stepIndex)
    }
  }, [tutorial.steps.length])

  const goToNextStep = useCallback(() => {
    if (navigationState.canGoNext) {
      goToStep(currentStepIndex + 1)
    } else if (currentStepIndex === tutorial.steps.length - 1) {
      // Tutorial completed
      const timeSpent = (Date.now() - startTime) / 1000
      const score = events.filter(e => e.type === 'STEP_COMPLETED' && e.success).length / tutorial.steps.length * 100

      logEvent({
        type: 'TUTORIAL_COMPLETED',
        tutorialId: tutorial.id,
        score,
        timestamp: new Date()
      })

      onTutorialComplete?.(score, timeSpent)
    }
  }, [navigationState.canGoNext, currentStepIndex, tutorial.steps.length, tutorial.id, startTime, events, logEvent, onTutorialComplete, goToStep])

  const goToPreviousStep = useCallback(() => {
    if (navigationState.canGoPrevious) {
      goToStep(currentStepIndex - 1)
    }
  }, [navigationState.canGoPrevious, currentStepIndex, goToStep])

  // Abacus event handlers
  const handleValueChange = useCallback((newValue: number) => {
    // Ignore programmatic changes to prevent feedback loops
    if (isProgrammaticChange.current) {
      isProgrammaticChange.current = false
      return
    }

    const oldValue = currentValue
    setCurrentValue(newValue)

    logEvent({
      type: 'VALUE_CHANGED',
      stepId: currentStep.id,
      oldValue,
      newValue,
      timestamp: new Date()
    })
  }, [currentValue, currentStep, logEvent])

  const handleBeadClick = useCallback((beadInfo: any) => {
    logEvent({
      type: 'BEAD_CLICKED',
      stepId: currentStep.id,
      beadInfo,
      timestamp: new Date()
    })

    // Check if this is the correct action
    if (currentStep.highlightBeads && Array.isArray(currentStep.highlightBeads)) {
      const isCorrectBead = currentStep.highlightBeads.some(highlight =>
        highlight.columnIndex === beadInfo.columnIndex &&
        highlight.beadType === beadInfo.beadType &&
        (highlight.position === undefined || highlight.position === beadInfo.position)
      )

      if (!isCorrectBead) {
        setError(currentStep.errorMessages.wrongBead)

        logEvent({
          type: 'ERROR_OCCURRED',
          stepId: currentStep.id,
          error: currentStep.errorMessages.wrongBead,
          timestamp: new Date()
        })
      } else {
        setError(null)
      }
    }
  }, [currentStep, logEvent])

  const handleBeadRef = useCallback((bead: any, element: SVGElement | null) => {
    const key = `${bead.columnIndex}-${bead.type}-${bead.position}`
    if (element) {
      beadRefs.current.set(key, element)
    } else {
      beadRefs.current.delete(key)
    }
  }, [])

  // UI state updaters
  const toggleDebugPanel = useCallback(() => {
    setUIState(prev => ({ ...prev, showDebugPanel: !prev.showDebugPanel }))
  }, [])

  const toggleStepList = useCallback(() => {
    setUIState(prev => ({ ...prev, showStepList: !prev.showStepList }))
  }, [])

  const toggleAutoAdvance = useCallback(() => {
    setUIState(prev => ({ ...prev, autoAdvance: !prev.autoAdvance }))
  }, [])

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
                  customStyles={currentStep.highlightBeads && Array.isArray(currentStep.highlightBeads) ? {
                    beads: currentStep.highlightBeads.reduce((acc, highlight) => ({
                      ...acc,
                      [highlight.columnIndex]: {
                        [highlight.beadType]: highlight.beadType === 'earth' && highlight.position !== undefined
                          ? { [highlight.position]: { fill: '#fbbf24', stroke: '#f59e0b', strokeWidth: 3 } }
                          : { fill: '#fbbf24', stroke: '#f59e0b', strokeWidth: 3 }
                      }
                    }), {})
                  } : undefined}
                  onValueChange={handleValueChange}
                  callbacks={{
                    onBeadClick: handleBeadClick,
                    onBeadRef: handleBeadRef
                  }}
                />
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