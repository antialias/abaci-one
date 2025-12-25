'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'
import type { Tutorial, TutorialEvent, TutorialStep } from '../../types/tutorial'
import {
  type SkillTutorialConfig,
  getSkillTutorialConfig,
} from '../../lib/curriculum/skill-tutorial-config'
import { TutorialPlayer } from './TutorialPlayer'
import type { SkillTutorialControlAction } from '@/lib/classroom/socket-events'

// ============================================================================
// Types
// ============================================================================

type LauncherState = 'intro' | 'tutorial' | 'complete'

/**
 * Broadcast state for skill tutorial observation
 */
export interface SkillTutorialBroadcastState {
  /** Current launcher state */
  launcherState: 'intro' | 'tutorial' | 'complete'
  /** Skill being learned */
  skillId: string
  /** Skill display title */
  skillTitle: string
  /** Tutorial state details (only when in 'tutorial' state) */
  tutorialState?: {
    currentStepIndex: number
    totalSteps: number
    currentMultiStep: number
    totalMultiSteps: number
    currentValue: number
    targetValue: number
    startValue: number
    isStepCompleted: boolean
    problem: string
    description: string
    currentInstruction: string
  }
}

interface SkillTutorialLauncherProps {
  /** The skill ID to launch the tutorial for */
  skillId: string
  /** Player ID for tracking completion */
  playerId: string
  /** Callback when tutorial is completed successfully */
  onComplete?: () => void
  /** Callback when user skips the tutorial */
  onSkip?: () => void
  /** Callback when user cancels/exits */
  onCancel?: () => void
  /** Optional theme */
  theme?: 'light' | 'dark'
  /** Number of columns on the abacus */
  abacusColumns?: number
  /** Callback when broadcast state changes (for teacher observation) */
  onBroadcastStateChange?: (state: SkillTutorialBroadcastState) => void
  /** Control action from teacher (optional, for remote control) */
  controlAction?: SkillTutorialControlAction | null
  /** Callback when control action has been processed */
  onControlActionProcessed?: () => void
  /**
   * Observed state from WebSocket (for teacher observation mode).
   * When provided, the component becomes read-only and displays this state
   * instead of managing its own internal state.
   */
  observedState?: SkillTutorialBroadcastState
  /**
   * Callback for sending control actions (used in observation mode).
   * When provided, button clicks send control actions instead of changing local state.
   */
  onControl?: (action: SkillTutorialControlAction) => void
}

// ============================================================================
// Tutorial Generation
// ============================================================================

/**
 * Generate a Tutorial object from a skill's config.
 * Creates steps from the example problems that demonstrate the technique.
 */
function generateTutorialFromConfig(config: SkillTutorialConfig): Tutorial {
  const steps: TutorialStep[] = config.exampleProblems.map((problem, index) => {
    const delta = problem.target - problem.start
    const isAddition = delta > 0
    const operation = isAddition ? '+' : ''
    const problemString = `${problem.start} ${operation}${delta} = ${problem.target}`

    return {
      id: `${config.skillId}-step-${index}`,
      title: `Practice ${index + 1}`,
      problem: problemString,
      description: config.description,
      startValue: problem.start,
      targetValue: problem.target,
      expectedAction: 'multi-step' as const,
      actionDescription: `Move the beads to show ${problem.target}`,
      tooltip: {
        content: config.title,
        explanation: config.description,
      },
      multiStepInstructions: [], // TutorialPlayer will generate these dynamically
    }
  })

  return {
    id: `skill-tutorial-${config.skillId}`,
    title: config.title,
    description: config.description,
    category: 'skill-introduction',
    difficulty: 'beginner',
    estimatedDuration: 5, // 5 minutes
    steps,
    tags: ['skill-tutorial', config.skillId],
    author: 'system',
    version: '1.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    isPublished: true,
  }
}

// ============================================================================
// Component
// ============================================================================

export function SkillTutorialLauncher({
  skillId,
  playerId,
  onComplete,
  onSkip,
  onCancel,
  theme = 'light',
  abacusColumns = 5,
  onBroadcastStateChange,
  controlAction,
  onControlActionProcessed,
  observedState,
  onControl,
}: SkillTutorialLauncherProps) {
  // Whether we're in observation mode (read-only, state comes from WebSocket)
  const isObservationMode = !!observedState

  const [localState, setLocalState] = useState<LauncherState>('intro')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // In observation mode, use observed state; otherwise use local state
  const state: LauncherState = isObservationMode ? observedState.launcherState : localState
  const setState = setLocalState // Only used in interactive mode

  // Track pending control action for TutorialPlayer
  const [playerControlAction, setPlayerControlAction] = useState<SkillTutorialControlAction | null>(null)

  // Track tutorial player state for broadcasting (only in interactive mode)
  const [tutorialPlayerState, setTutorialPlayerState] = useState<{
    currentStepIndex: number
    currentMultiStep: number
    currentValue: number
    isStepCompleted: boolean
  } | null>(null)

  // Get the tutorial config for this skill (use observed skillId in observation mode)
  const effectiveSkillId = isObservationMode ? observedState.skillId : skillId
  const config = useMemo(() => getSkillTutorialConfig(effectiveSkillId), [effectiveSkillId])

  // Generate the Tutorial object
  const tutorial = useMemo(() => {
    if (!config) return null
    return generateTutorialFromConfig(config)
  }, [config])

  // Broadcast state changes for teacher observation
  useEffect(() => {
    if (!onBroadcastStateChange || !config || !tutorial) return

    // Get current step info from tutorial
    const currentStep = tutorial.steps[tutorialPlayerState?.currentStepIndex ?? 0]

    const broadcastState: SkillTutorialBroadcastState = {
      launcherState: state,
      skillId,
      skillTitle: config.title,
      tutorialState:
        state === 'tutorial' && currentStep && tutorialPlayerState
          ? {
              currentStepIndex: tutorialPlayerState.currentStepIndex,
              totalSteps: tutorial.steps.length,
              currentMultiStep: tutorialPlayerState.currentMultiStep,
              totalMultiSteps: currentStep.multiStepInstructions?.length ?? 1,
              currentValue: tutorialPlayerState.currentValue,
              targetValue: currentStep.targetValue,
              startValue: currentStep.startValue,
              isStepCompleted: tutorialPlayerState.isStepCompleted,
              problem: currentStep.problem,
              description: currentStep.description,
              currentInstruction:
                currentStep.multiStepInstructions?.[tutorialPlayerState.currentMultiStep] ??
                currentStep.actionDescription,
            }
          : undefined,
    }

    onBroadcastStateChange(broadcastState)
  }, [
    onBroadcastStateChange,
    config,
    tutorial,
    state,
    skillId,
    tutorialPlayerState?.currentStepIndex,
    tutorialPlayerState?.currentMultiStep,
    tutorialPlayerState?.currentValue,
    tutorialPlayerState?.isStepCompleted,
  ])

  // Handle tutorial completion
  const handleTutorialComplete = useCallback(
    async (_score: number, _timeSpent: number) => {
      setState('complete')
      setIsSubmitting(true)

      try {
        // Mark tutorial as complete in database
        const response = await fetch(`/api/curriculum/${playerId}/tutorial`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skillId,
            action: 'complete',
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to mark tutorial complete')
        }

        onComplete?.()
      } catch (error) {
        console.error('Error marking tutorial complete:', error)
        // Still call onComplete to not block the user
        onComplete?.()
      } finally {
        setIsSubmitting(false)
      }
    },
    [playerId, skillId, onComplete]
  )

  // Handle skip
  const handleSkip = useCallback(async () => {
    setIsSubmitting(true)

    try {
      // Record skip in database
      const response = await fetch(`/api/curriculum/${playerId}/tutorial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          action: 'skip',
        }),
      })

      if (!response.ok) {
        console.error('Failed to record tutorial skip')
      }

      onSkip?.()
    } catch (error) {
      console.error('Error recording tutorial skip:', error)
      onSkip?.()
    } finally {
      setIsSubmitting(false)
    }
  }, [playerId, skillId, onSkip])

  // Handle step change from TutorialPlayer
  const handleStepChange = useCallback(
    (stepIndex: number, step: TutorialStep) => {
      setTutorialPlayerState({
        currentStepIndex: stepIndex,
        currentMultiStep: 0, // Reset on new step
        currentValue: step.startValue,
        isStepCompleted: false,
      })
    },
    []
  )

  // Handle tutorial events to track value changes
  const handleEvent = useCallback((event: TutorialEvent) => {
    if (event.type === 'VALUE_CHANGED') {
      setTutorialPlayerState((prev) =>
        prev ? { ...prev, currentValue: event.newValue } : prev
      )
    } else if (event.type === 'STEP_COMPLETED') {
      setTutorialPlayerState((prev) =>
        prev ? { ...prev, isStepCompleted: true } : prev
      )
    }
  }, [])

  // Handle step complete from TutorialPlayer
  const handleStepComplete = useCallback(
    (stepIndex: number, step: TutorialStep, success: boolean) => {
      setTutorialPlayerState((prev) =>
        prev
          ? {
              ...prev,
              isStepCompleted: success,
              // Ensure the final value is captured when step completes
              currentValue: success ? step.targetValue : prev.currentValue,
            }
          : prev
      )
    },
    []
  )

  // Handle multi-step change from TutorialPlayer (for broadcasting to observers)
  const handleMultiStepChange = useCallback((multiStep: number) => {
    setTutorialPlayerState((prev) =>
      prev ? { ...prev, currentMultiStep: multiStep } : prev
    )
  }, [])

  // Handle control actions from teacher
  useEffect(() => {
    if (!controlAction) return

    console.log('[SkillTutorialLauncher] Received control action:', controlAction)

    switch (controlAction.type) {
      case 'start-tutorial':
        // Only works from intro state
        if (state === 'intro') {
          setState('tutorial')
        }
        break

      case 'skip-tutorial':
        // Can skip from intro or tutorial state
        if (state === 'intro' || state === 'tutorial') {
          handleSkip()
        }
        break

      case 'next-step':
      case 'previous-step':
      case 'go-to-step':
      case 'set-abacus-value':
      case 'advance-multi-step':
      case 'previous-multi-step':
        // Pass to TutorialPlayer
        if (state === 'tutorial') {
          setPlayerControlAction(controlAction)
        }
        break
    }

    // Mark action as processed
    onControlActionProcessed?.()
  }, [controlAction, state, handleSkip, onControlActionProcessed])

  // Callback for TutorialPlayer when it processes a control action
  const handlePlayerControlProcessed = useCallback(() => {
    setPlayerControlAction(null)
  }, [])

  // No config found for this skill
  if (!config || !tutorial) {
    return (
      <div
        data-component="skill-tutorial-launcher"
        data-status="no-config"
        className={css({
          p: 6,
          textAlign: 'center',
          color: 'gray.600',
        })}
      >
        <p>No tutorial available for this skill.</p>
        <button
          data-action="continue-anyway"
          onClick={onCancel}
          className={css({
            mt: 4,
            px: 4,
            py: 2,
            bg: 'blue.500',
            color: 'white',
            borderRadius: 'md',
            cursor: 'pointer',
            _hover: { bg: 'blue.600' },
          })}
        >
          Continue
        </button>
      </div>
    )
  }

  // Intro screen
  if (state === 'intro') {
    return (
      <div
        data-component="skill-tutorial-launcher"
        data-status="intro"
        className={css({
          p: 8,
          maxW: '600px',
          mx: 'auto',
          bg: theme === 'dark' ? 'gray.800' : 'white',
          borderRadius: 'xl',
          shadow: 'lg',
        })}
      >
        <div className={vstack({ gap: 6, alignItems: 'center' })}>
          {/* Header */}
          <div className={css({ textAlign: 'center' })}>
            <h2
              data-element="skill-title"
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: theme === 'dark' ? 'white' : 'gray.900',
                mb: 2,
              })}
            >
              Learn: {config.title}
            </h2>
            <p
              data-element="skill-description"
              className={css({
                fontSize: 'lg',
                color: theme === 'dark' ? 'gray.300' : 'gray.600',
                lineHeight: '1.6',
              })}
            >
              {config.description}
            </p>
          </div>

          {/* Info box */}
          <div
            data-element="tutorial-info"
            className={css({
              p: 4,
              bg: theme === 'dark' ? 'blue.900' : 'blue.50',
              border: '1px solid',
              borderColor: theme === 'dark' ? 'blue.700' : 'blue.200',
              borderRadius: 'lg',
              w: 'full',
            })}
          >
            <div className={hstack({ gap: 3, alignItems: 'start' })}>
              <span className={css({ fontSize: '2xl' })}>📚</span>
              <div>
                <p
                  className={css({
                    fontWeight: 'medium',
                    color: theme === 'dark' ? 'blue.200' : 'blue.800',
                    mb: 1,
                  })}
                >
                  What you'll learn
                </p>
                <p
                  className={css({
                    fontSize: 'sm',
                    color: theme === 'dark' ? 'blue.300' : 'blue.700',
                  })}
                >
                  You'll practice {config.exampleProblems.length} example problems that show you
                  exactly how to use this technique on the abacus.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className={hstack({ gap: 4, w: 'full', justifyContent: 'center' })}>
            <button
              data-action="start-tutorial"
              onClick={() => {
                if (isObservationMode && onControl) {
                  onControl({ type: 'start-tutorial' })
                } else {
                  setState('tutorial')
                }
              }}
              disabled={isSubmitting}
              className={css({
                px: 6,
                py: 3,
                bg: 'green.500',
                color: 'white',
                fontSize: 'lg',
                fontWeight: 'semibold',
                borderRadius: 'lg',
                cursor: 'pointer',
                _hover: { bg: 'green.600' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Start Tutorial
            </button>

            <button
              data-action="skip-tutorial"
              onClick={() => {
                if (isObservationMode && onControl) {
                  onControl({ type: 'skip-tutorial' })
                } else {
                  handleSkip()
                }
              }}
              disabled={isSubmitting}
              className={css({
                px: 4,
                py: 3,
                bg: 'transparent',
                color: theme === 'dark' ? 'gray.400' : 'gray.500',
                fontSize: 'sm',
                borderRadius: 'lg',
                cursor: 'pointer',
                _hover: {
                  bg: theme === 'dark' ? 'gray.700' : 'gray.100',
                  color: theme === 'dark' ? 'gray.300' : 'gray.600',
                },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Skip for now
            </button>
          </div>

          {/* Cancel link */}
          {onCancel && (
            <button
              data-action="cancel"
              onClick={onCancel}
              className={css({
                color: theme === 'dark' ? 'gray.500' : 'gray.400',
                fontSize: 'sm',
                textDecoration: 'underline',
                cursor: 'pointer',
                _hover: { color: theme === 'dark' ? 'gray.400' : 'gray.500' },
              })}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  // Tutorial in progress
  if (state === 'tutorial') {
    // In observation mode, wait for tutorialState before rendering TutorialPlayer
    if (isObservationMode && !observedState.tutorialState) {
      return (
        <div
          data-component="skill-tutorial-launcher"
          data-status="tutorial-loading"
          className={css({
            height: '100%',
            minHeight: '600px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <p
            className={css({
              color: theme === 'dark' ? 'gray.400' : 'gray.500',
              fontSize: '0.9375rem',
            })}
          >
            Waiting for tutorial to load...
          </p>
        </div>
      )
    }

    // Convert observed state to TutorialPlayer's observed state format
    const tutorialObservedState =
      isObservationMode && observedState.tutorialState
        ? {
            currentStepIndex: observedState.tutorialState.currentStepIndex,
            currentMultiStep: observedState.tutorialState.currentMultiStep,
            currentValue: observedState.tutorialState.currentValue,
            isStepCompleted: observedState.tutorialState.isStepCompleted,
          }
        : undefined

    return (
      <div
        data-component="skill-tutorial-launcher"
        data-status="tutorial"
        data-observation-mode={isObservationMode ? 'true' : undefined}
        className={css({
          height: '100%',
          minHeight: '600px',
        })}
      >
        <TutorialPlayer
          tutorial={tutorial}
          theme={theme}
          abacusColumns={abacusColumns}
          onTutorialComplete={isObservationMode ? undefined : handleTutorialComplete}
          onStepChange={isObservationMode ? undefined : handleStepChange}
          onStepComplete={isObservationMode ? undefined : handleStepComplete}
          onEvent={isObservationMode ? undefined : handleEvent}
          onMultiStepChange={isObservationMode ? undefined : handleMultiStepChange}
          controlAction={playerControlAction}
          onControlActionProcessed={handlePlayerControlProcessed}
          observedState={tutorialObservedState}
          onControl={onControl}
        />
      </div>
    )
  }

  // Complete screen
  if (state === 'complete') {
    return (
      <div
        data-component="skill-tutorial-launcher"
        data-status="complete"
        className={css({
          p: 8,
          maxW: '600px',
          mx: 'auto',
          textAlign: 'center',
        })}
      >
        <div className={vstack({ gap: 6, alignItems: 'center' })}>
          <span className={css({ fontSize: '6xl' })}>🎉</span>

          <h2
            className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: theme === 'dark' ? 'white' : 'gray.900',
            })}
          >
            Great job!
          </h2>

          <p
            className={css({
              fontSize: 'lg',
              color: theme === 'dark' ? 'gray.300' : 'gray.600',
            })}
          >
            You've completed the tutorial for <strong>{config.title}</strong>. This skill is now
            ready to practice!
          </p>

          {isSubmitting && (
            <p className={css({ color: 'gray.500', fontSize: 'sm' })}>Saving progress...</p>
          )}
        </div>
      </div>
    )
  }

  return null
}
