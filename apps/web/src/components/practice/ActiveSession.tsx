'use client'

import { animated, useSpring } from '@react-spring/web'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTheme } from '@/contexts/ThemeContext'
import type {
  ProblemSlot,
  SessionHealth,
  SessionPart,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { DecompositionProvider, DecompositionSection } from '../decomposition'
import { generateCoachHint } from './coachHintGenerator'
import { useHasPhysicalKeyboard } from './hooks/useDeviceDetection'
import { useInteractionPhase } from './hooks/useInteractionPhase'
import { usePracticeSoundEffects } from './hooks/usePracticeSoundEffects'
import { NumericKeypad } from './NumericKeypad'
import { PracticeHelpOverlay } from './PracticeHelpOverlay'
import { ProblemDebugPanel } from './ProblemDebugPanel'
import { VerticalProblem } from './VerticalProblem'

interface ActiveSessionProps {
  plan: SessionPlan
  studentName: string
  /** Called when a problem is answered */
  onAnswer: (result: Omit<SlotResult, 'timestamp' | 'partNumber'>) => Promise<void>
  /** Called when session is ended early */
  onEndEarly: (reason?: string) => void
  /** Called when session is paused */
  onPause?: () => void
  /** Called when session is resumed */
  onResume?: () => void
  /** Called when session completes */
  onComplete: () => void
  /** Hide the built-in HUD (when using external HUD in PracticeSubNav) */
  hideHud?: boolean
}

/**
 * Get the part type description for display
 */
function getPartTypeLabel(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return 'Use Abacus'
    case 'visualization':
      return 'Mental Math (Visualization)'
    case 'linear':
      return 'Mental Math (Linear)'
  }
}

/**
 * Get part type emoji
 */
function getPartTypeEmoji(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return '🧮'
    case 'visualization':
      return '🧠'
    case 'linear':
      return '💭'
  }
}

/**
 * Linear problem display component for Part 3
 */
function LinearProblem({
  terms,
  userAnswer,
  isFocused,
  isCompleted,
  correctAnswer,
  isDark,
  detectedPrefixIndex,
}: {
  terms: number[]
  userAnswer: string
  isFocused: boolean
  isCompleted: boolean
  correctAnswer: number
  isDark: boolean
  /** Detected prefix index - shows "..." instead of "=" for partial sums */
  detectedPrefixIndex?: number
}) {
  // Build the equation string
  const equation = terms
    .map((term, i) => {
      if (i === 0) return String(term)
      return term < 0 ? ` - ${Math.abs(term)}` : ` + ${term}`
    })
    .join('')

  // Use "..." for prefix sums (mathematically incomplete), "=" for final answer
  const isPrefixSum = detectedPrefixIndex !== undefined
  const operator = isPrefixSum ? '…' : '='

  return (
    <div
      data-component="linear-problem"
      data-prefix-mode={isPrefixSum ? 'true' : undefined}
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        fontFamily: 'monospace',
        fontSize: '2rem',
        fontWeight: 'bold',
      })}
    >
      <span className={css({ color: isDark ? 'gray.200' : 'gray.800' })}>
        {equation}{' '}
        <span
          className={css({
            color: isPrefixSum
              ? isDark
                ? 'yellow.400'
                : 'yellow.600'
              : isDark
                ? 'gray.200'
                : 'gray.800',
          })}
        >
          {operator}
        </span>
      </span>
      <span
        className={css({
          minWidth: '80px',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          textAlign: 'center',
          backgroundColor: isCompleted
            ? userAnswer === String(correctAnswer)
              ? isDark
                ? 'green.900'
                : 'green.100'
              : isDark
                ? 'red.900'
                : 'red.100'
            : isDark
              ? 'gray.800'
              : 'gray.100',
          color: isCompleted
            ? userAnswer === String(correctAnswer)
              ? isDark
                ? 'green.200'
                : 'green.700'
              : isDark
                ? 'red.200'
                : 'red.700'
            : isDark
              ? 'gray.200'
              : 'gray.800',
          border: '2px solid',
          borderColor: isFocused ? 'blue.400' : isDark ? 'gray.600' : 'gray.300',
        })}
      >
        {userAnswer || (isFocused ? '?' : '')}
      </span>
    </div>
  )
}

/**
 * ActiveSession - The main practice session component
 *
 * Features:
 * - Three-part session structure (abacus, visualization, linear)
 * - Part-specific display and instructions
 * - Adaptive input (keyboard on desktop, on-screen keypad on mobile)
 * - Session health indicators
 * - On-screen abacus toggle (for abacus part only)
 * - Teacher controls (pause, end early)
 *
 * State Architecture:
 * - Uses useInteractionPhase hook for interaction state machine
 * - Single source of truth for all UI state
 * - Explicit phase transitions instead of boolean flags
 */
export function ActiveSession({
  plan,
  studentName,
  onAnswer,
  onEndEarly,
  onPause,
  onResume,
  onComplete,
  hideHud = false,
}: ActiveSessionProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Sound effects
  const { playSound } = usePracticeSoundEffects()

  // Compute initial problem from plan for SSR hydration (must be before useInteractionPhase)
  const initialProblem = useMemo(() => {
    const currentPart = plan.parts[plan.currentPartIndex]
    const currentSlot = currentPart?.slots[plan.currentSlotIndex]
    if (currentPart && currentSlot?.problem) {
      return {
        problem: currentSlot.problem,
        slotIndex: plan.currentSlotIndex,
        partIndex: plan.currentPartIndex,
      }
    }
    return undefined
  }, [plan.parts, plan.currentPartIndex, plan.currentSlotIndex])

  // Interaction state machine - single source of truth for UI state
  const {
    phase,
    attempt,
    helpContext,
    outgoingAttempt,
    canAcceptInput,
    showAsCompleted,
    showHelpOverlay,
    showInputArea,
    showFeedback,
    inputIsFocused,
    isTransitioning,
    isPaused,
    isSubmitting,
    prefixSums,
    matchedPrefixIndex,
    canSubmit,
    shouldAutoSubmit,
    ambiguousHelpTermIndex,
    loadProblem,
    handleDigit,
    handleBackspace,
    enterHelpMode,
    exitHelpMode,
    clearAnswer,
    setAnswer,
    startSubmit,
    completeSubmit,
    startTransition,
    completeTransition,
    clearToLoading,
    pause,
    resume,
  } = useInteractionPhase({
    initialProblem,
    onManualSubmitRequired: () => playSound('womp_womp'),
  })

  // Track which help elements have been individually dismissed
  // These reset when entering a new help session (helpContext changes)
  const [helpAbacusDismissed, setHelpAbacusDismissed] = useState(false)
  const [helpPanelDismissed, setHelpPanelDismissed] = useState(false)
  // Track when answer is fading out (for dream sequence)
  const [answerFadingOut, setAnswerFadingOut] = useState(false)

  // Reset dismissed states when help context changes (new help session)
  useEffect(() => {
    if (helpContext) {
      setHelpAbacusDismissed(false)
      setHelpPanelDismissed(false)
      setAnswerFadingOut(false)
    }
  }, [helpContext])

  // Refs for measuring problem widths during animation
  const outgoingRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Track if we need to apply centering offset (set true when transition starts)
  const needsCenteringOffsetRef = useRef(false)
  // Store the centering offset value for the animation end
  const centeringOffsetRef = useRef(0)

  // Spring for problem transition animation
  const [trackSpring, trackApi] = useSpring(() => ({
    x: 0,
    outgoingOpacity: 1,
    activeOpacity: 1,
    config: { tension: 200, friction: 26 },
  }))

  // Spring for submit button entrance animation
  const submitButtonSpring = useSpring({
    transform: attempt?.manualSubmitRequired ? 'translateY(0px)' : 'translateY(60px)',
    opacity: attempt?.manualSubmitRequired ? 1 : 0,
    scale: attempt?.manualSubmitRequired ? 1 : 0.8,
    config: { tension: 280, friction: 14 },
  })

  // Apply centering offset before paint to prevent jank
  useLayoutEffect(() => {
    if (needsCenteringOffsetRef.current && outgoingRef.current) {
      const outgoingWidth = outgoingRef.current.offsetWidth
      const gap = 32 // 2rem gap
      const centeringOffset = (outgoingWidth + gap) / 2
      centeringOffsetRef.current = centeringOffset

      // Set initial position to compensate for flexbox centering
      trackApi.set({
        x: centeringOffset,
        outgoingOpacity: 1,
        activeOpacity: 0,
      })

      needsCenteringOffsetRef.current = false

      // Start fade-in of new problem
      trackApi.start({
        activeOpacity: 1,
        config: { tension: 200, friction: 26 },
      })

      // Start slide after a brief moment (150ms)
      setTimeout(() => {
        trackApi.start({
          x: -centeringOffset,
          outgoingOpacity: 0,
          config: { tension: 170, friction: 22 },
          onRest: () => {
            // Outgoing is now invisible - complete the transition
            flushSync(() => {
              completeTransition()
            })
            trackApi.set({ x: 0, outgoingOpacity: 1, activeOpacity: 1 })
          },
        })
      }, 150)
    }
  }, [outgoingAttempt, trackApi, completeTransition])

  const hasPhysicalKeyboard = useHasPhysicalKeyboard()

  // Track if keypad was ever shown - once shown, keep it visible
  // This prevents the keypad from disappearing if user uses physical keyboard
  const keypadWasShownRef = useRef(false)
  if (hasPhysicalKeyboard === false) {
    keypadWasShownRef.current = true
  }
  const showOnScreenKeypad = hasPhysicalKeyboard === false || keypadWasShownRef.current

  // Get current part and slot from plan
  const parts = plan.parts
  const currentPartIndex = plan.currentPartIndex
  const currentSlotIndex = plan.currentSlotIndex
  const currentPart = parts[currentPartIndex] as SessionPart | undefined
  const currentSlot = currentPart?.slots[currentSlotIndex] as ProblemSlot | undefined
  const sessionHealth = plan.sessionHealth as SessionHealth | null

  // Calculate total progress across all parts
  const totalProblems = useMemo(() => {
    return parts.reduce((sum, part) => sum + part.slots.length, 0)
  }, [parts])

  const completedProblems = useMemo(() => {
    let count = 0
    for (let i = 0; i < currentPartIndex; i++) {
      count += parts[i].slots.length
    }
    count += currentSlotIndex
    return count
  }, [parts, currentPartIndex, currentSlotIndex])

  // Check for session completion
  useEffect(() => {
    if (currentPartIndex >= parts.length) {
      onComplete()
    }
  }, [currentPartIndex, parts.length, onComplete])

  // Initialize problem when slot changes and in loading phase
  useEffect(() => {
    if (currentPart && currentSlot && phase.phase === 'loading') {
      if (!currentSlot.problem) {
        throw new Error(
          `Problem not pre-generated for slot ${currentSlotIndex} in part ${currentPartIndex}. ` +
            'This indicates a bug in session planning - problems should be generated at plan creation time.'
        )
      }
      loadProblem(currentSlot.problem, currentSlotIndex, currentPartIndex)
    }
  }, [currentPart, currentSlot, currentPartIndex, currentSlotIndex, phase.phase, loadProblem])

  // Auto-trigger help when an unambiguous prefix sum is detected
  // The awaitingDisambiguation phase handles the timer and auto-transitions to helpMode when it expires
  // This effect only handles the inputting phase case for unambiguous matches
  useEffect(() => {
    // Only handle unambiguous prefix matches in inputting phase
    // Ambiguous cases are handled by awaitingDisambiguation phase, which auto-transitions to helpMode
    if (phase.phase !== 'inputting') return

    // For unambiguous matches, trigger immediately
    if (matchedPrefixIndex >= 0 && matchedPrefixIndex < prefixSums.length - 1) {
      const newConfirmedCount = matchedPrefixIndex + 1
      if (newConfirmedCount < phase.attempt.problem.terms.length) {
        enterHelpMode(newConfirmedCount)
      }
    }
  }, [phase, matchedPrefixIndex, prefixSums.length, enterHelpMode])

  // Handle when student reaches target value on help abacus
  // Sequence: show target value → dismiss abacus → show value in answer boxes → fade to empty → exit
  const handleTargetReached = useCallback(() => {
    if (phase.phase !== 'helpMode' || !helpContext) return

    // Step 1: Set the answer to the target value (shows in answer boxes behind abacus)
    setAnswer(String(helpContext.targetValue))

    // Step 2: After a brief moment, dismiss the help abacus to reveal the answer
    setTimeout(() => {
      setHelpAbacusDismissed(true)

      // Step 3: After abacus fades out (300ms), answer boxes are visible with target value
      // Wait 1 second to let user see the result
      setTimeout(() => {
        // Step 4: Start fading out the answer
        setAnswerFadingOut(true)

        // Step 5: After fade-out completes (300ms), clear and exit
        setTimeout(() => {
          clearAnswer()
          setAnswerFadingOut(false)
          exitHelpMode()
        }, 300) // Match fade-out duration
      }, 1000) // Show target value in answer boxes for 1 second
    }, 600) // Brief pause to see success state on abacus
  }, [phase.phase, helpContext, setAnswer, clearAnswer, exitHelpMode])

  // Handle submit
  const handleSubmit = useCallback(async () => {
    // Allow submitting from inputting, awaitingDisambiguation, or helpMode
    if (
      phase.phase !== 'inputting' &&
      phase.phase !== 'awaitingDisambiguation' &&
      phase.phase !== 'helpMode'
    ) {
      return
    }
    if (!phase.attempt.userAnswer) return

    const attemptData = phase.attempt
    const answerNum = parseInt(attemptData.userAnswer, 10)
    if (Number.isNaN(answerNum)) return

    // Transition to submitting phase
    startSubmit()

    const responseTimeMs = Date.now() - attemptData.startTime
    const isCorrect = answerNum === attemptData.problem.answer

    // Record the result
    const result: Omit<SlotResult, 'timestamp' | 'partNumber'> = {
      slotIndex: attemptData.slotIndex,
      problem: attemptData.problem,
      studentAnswer: answerNum,
      isCorrect,
      responseTimeMs,
      skillsExercised: attemptData.problem.skillsRequired,
      usedOnScreenAbacus: phase.phase === 'helpMode',
      incorrectAttempts: 0, // TODO: track this properly
      helpLevelUsed: phase.phase === 'helpMode' ? 1 : 0,
    }

    await onAnswer(result)

    // Complete submit with result
    completeSubmit(isCorrect ? 'correct' : 'incorrect')

    // Wait for feedback display then advance
    setTimeout(
      () => {
        const nextSlotIndex = currentSlotIndex + 1
        const nextSlot = currentPart?.slots[nextSlotIndex]

        if (nextSlot && currentPart && isCorrect) {
          // Has next problem - animate transition
          if (!nextSlot.problem) {
            throw new Error(
              `Problem not pre-generated for slot ${nextSlotIndex} in part ${currentPartIndex}. ` +
                'This indicates a bug in session planning - problems should be generated at plan creation time.'
            )
          }
          // Mark that we need to apply centering offset in useLayoutEffect
          needsCenteringOffsetRef.current = true

          startTransition(nextSlot.problem, nextSlotIndex)
        } else {
          // End of part or incorrect - clear to loading
          clearToLoading()
        }
      },
      isCorrect ? 500 : 1500
    )
  }, [
    phase,
    onAnswer,
    currentSlotIndex,
    currentPart,
    startSubmit,
    completeSubmit,
    startTransition,
    clearToLoading,
  ])

  // Auto-submit when correct answer is entered
  useEffect(() => {
    if (shouldAutoSubmit) {
      handleSubmit()
    }
  }, [shouldAutoSubmit, handleSubmit])

  // Handle keyboard input
  useEffect(() => {
    if (!hasPhysicalKeyboard || !canAcceptInput) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape or Delete/Backspace exits help mode when in help mode
      if (e.key === 'Escape') {
        e.preventDefault()
        if (showHelpOverlay) {
          exitHelpMode()
        }
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        if (showHelpOverlay) {
          exitHelpMode()
        } else {
          handleBackspace()
        }
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      } else if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    hasPhysicalKeyboard,
    canAcceptInput,
    handleSubmit,
    handleDigit,
    handleBackspace,
    showHelpOverlay,
    exitHelpMode,
  ])

  const handlePause = useCallback(() => {
    pause()
    onPause?.()
  }, [pause, onPause])

  const handleResume = useCallback(() => {
    resume()
    onResume?.()
  }, [resume, onResume])

  const getHealthColor = (health: SessionHealth['overall']) => {
    switch (health) {
      case 'good':
        return 'green.500'
      case 'warning':
        return 'yellow.500'
      case 'struggling':
        return 'red.500'
      default:
        return 'gray.500'
    }
  }

  const getHealthEmoji = (health: SessionHealth['overall']) => {
    switch (health) {
      case 'good':
        return '🟢'
      case 'warning':
        return '🟡'
      case 'struggling':
        return '🔴'
      default:
        return '⚪'
    }
  }

  if (!currentPart || !attempt) {
    return (
      <div
        data-component="active-session"
        data-status="loading"
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
        })}
      >
        <div
          className={css({
            fontSize: '1.25rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          Loading next problem...
        </div>
      </div>
    )
  }

  return (
    <div
      data-component="active-session"
      data-status={isPaused ? 'paused' : 'active'}
      data-phase={phase.phase}
      data-part-type={currentPart.type}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '1rem',
        maxWidth: '600px',
        margin: '0 auto',
      })}
    >
      {/* Practice Session HUD - Control bar with session info and tape-deck controls */}
      {/* Only render if hideHud is false (default) - when using external HUD in PracticeSubNav */}
      {!hideHud && (
        <div
          data-section="session-hud"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'gray.900',
            borderRadius: '12px',
            boxShadow: 'lg',
          })}
        >
          {/* Tape deck controls */}
          <div
            data-element="transport-controls"
            className={css({
              display: 'flex',
              gap: '0.5rem',
            })}
          >
            {/* Pause/Play button */}
            <button
              type="button"
              data-action={isPaused ? 'resume' : 'pause'}
              onClick={isPaused ? handleResume : handlePause}
              className={css({
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                color: 'white',
                backgroundColor: isPaused ? 'green.500' : 'gray.700',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: isPaused ? 'green.400' : 'gray.600',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                _hover: {
                  backgroundColor: isPaused ? 'green.400' : 'gray.600',
                  transform: 'scale(1.05)',
                },
                _active: {
                  transform: 'scale(0.95)',
                },
              })}
              aria-label={isPaused ? 'Resume session' : 'Pause session'}
            >
              {isPaused ? '▶' : '⏸'}
            </button>

            {/* Stop button */}
            <button
              type="button"
              data-action="end-early"
              onClick={() => onEndEarly('Session ended')}
              className={css({
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                color: 'red.300',
                backgroundColor: 'gray.700',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: 'gray.600',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                _hover: {
                  backgroundColor: 'red.900',
                  borderColor: 'red.700',
                  color: 'red.200',
                  transform: 'scale(1.05)',
                },
                _active: {
                  transform: 'scale(0.95)',
                },
              })}
              aria-label="End session"
            >
              ⏹
            </button>
          </div>

          {/* Session info display */}
          <div
            data-element="session-info"
            className={css({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.125rem',
            })}
          >
            {/* Part type with emoji */}
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              })}
            >
              <span
                className={css({
                  fontSize: '1rem',
                })}
              >
                {getPartTypeEmoji(currentPart.type)}
              </span>
              <span
                className={css({
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  color: 'white',
                })}
              >
                Part {currentPart.partNumber}: {getPartTypeLabel(currentPart.type)}
              </span>
            </div>

            {/* Progress within part */}
            <div
              className={css({
                fontSize: '0.75rem',
                color: 'gray.400',
              })}
            >
              Problem {currentSlotIndex + 1} of {currentPart.slots.length} in this part
            </div>
          </div>

          {/* Overall progress and health */}
          <div
            data-element="progress-display"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            })}
          >
            {/* Problem counter */}
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              })}
            >
              <div
                className={css({
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: 'white',
                  fontFamily: 'monospace',
                })}
              >
                {completedProblems + 1}/{totalProblems}
              </div>
              <div
                className={css({
                  fontSize: '0.625rem',
                  color: 'gray.500',
                  textTransform: 'uppercase',
                })}
              >
                Total
              </div>
            </div>

            {/* Health indicator */}
            {sessionHealth && (
              <div
                data-element="session-health"
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'gray.800',
                  borderRadius: '6px',
                })}
              >
                <span className={css({ fontSize: '1rem' })}>
                  {getHealthEmoji(sessionHealth.overall)}
                </span>
                <span
                  className={css({
                    fontSize: '0.625rem',
                    fontWeight: 'bold',
                    color: getHealthColor(sessionHealth.overall),
                  })}
                >
                  {Math.round(sessionHealth.accuracy * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Problem display */}
      <div
        data-section="problem-area"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          paddingTop: '4rem',
          paddingRight: '2rem',
          paddingBottom: '2rem',
          paddingLeft: '2rem',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '16px',
          boxShadow: 'md',
        })}
      >
        {/* Purpose badge */}
        <div
          data-element="problem-purpose"
          className={css({
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            backgroundColor:
              currentSlot?.purpose === 'focus'
                ? isDark
                  ? 'blue.900'
                  : 'blue.100'
                : currentSlot?.purpose === 'reinforce'
                  ? isDark
                    ? 'orange.900'
                    : 'orange.100'
                  : currentSlot?.purpose === 'review'
                    ? isDark
                      ? 'green.900'
                      : 'green.100'
                    : isDark
                      ? 'purple.900'
                      : 'purple.100',
            color:
              currentSlot?.purpose === 'focus'
                ? isDark
                  ? 'blue.200'
                  : 'blue.700'
                : currentSlot?.purpose === 'reinforce'
                  ? isDark
                    ? 'orange.200'
                    : 'orange.700'
                  : currentSlot?.purpose === 'review'
                    ? isDark
                      ? 'green.200'
                      : 'green.700'
                    : isDark
                      ? 'purple.200'
                      : 'purple.700',
          })}
        >
          {currentSlot?.purpose}
        </div>

        {/* Problem display - centered, with help panel positioned outside */}
        <div
          data-element="problem-with-help"
          className={css({
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
          })}
        >
          {/* Animated track for problem transitions */}
          <animated.div
            data-element="problem-track"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              transform: trackSpring.x.to((x) => `translateX(${x}px)`),
            }}
          >
            {/* Outgoing problem (slides left during transition) */}
            {outgoingAttempt && (
              <animated.div
                ref={outgoingRef}
                data-element="outgoing-problem"
                style={{
                  opacity: trackSpring.outgoingOpacity,
                  marginRight: '2rem',
                  position: 'relative' as const,
                }}
              >
                <VerticalProblem
                  terms={outgoingAttempt.problem.terms}
                  userAnswer={outgoingAttempt.userAnswer}
                  isCompleted={true}
                  correctAnswer={outgoingAttempt.problem.answer}
                  size="large"
                  generationTrace={outgoingAttempt.problem.generationTrace}
                />
                {/* Feedback stays with outgoing problem */}
                <div
                  data-element="outgoing-feedback"
                  className={css({
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '0.5rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    backgroundColor: isDark ? 'green.900' : 'green.100',
                    color: isDark ? 'green.200' : 'green.700',
                    whiteSpace: 'nowrap',
                  })}
                >
                  Correct!
                </div>
              </animated.div>
            )}

            {/* Current problem */}
            <animated.div
              ref={activeRef}
              data-element="problem-container"
              style={{
                opacity: trackSpring.activeOpacity,
                position: 'relative' as const,
              }}
            >
              {currentPart.format === 'vertical' ? (
                <VerticalProblem
                  terms={attempt.problem.terms}
                  userAnswer={attempt.userAnswer}
                  isFocused={inputIsFocused}
                  isCompleted={showAsCompleted}
                  correctAnswer={attempt.problem.answer}
                  size="large"
                  currentHelpTermIndex={helpContext?.termIndex}
                  needHelpTermIndex={
                    // Only show "need help?" prompt when not already in help mode
                    !showHelpOverlay && ambiguousHelpTermIndex >= 0
                      ? ambiguousHelpTermIndex
                      : undefined
                  }
                  rejectedDigit={attempt.rejectedDigit}
                  helpOverlay={
                    // Always render overlay when in help mode (for exit transition)
                    showHelpOverlay && helpContext ? (
                      <PracticeHelpOverlay
                        currentValue={helpContext.currentValue}
                        targetValue={helpContext.targetValue}
                        columns={Math.max(
                          1,
                          Math.max(helpContext.currentValue, helpContext.targetValue).toString()
                            .length
                        )}
                        onTargetReached={handleTargetReached}
                        onDismiss={() => {
                          setHelpAbacusDismissed(true)
                          clearAnswer()
                        }}
                        visible={!helpAbacusDismissed}
                      />
                    ) : undefined
                  }
                  helpOverlayVisible={showHelpOverlay && !helpAbacusDismissed}
                  helpOverlayTransitionMs={helpAbacusDismissed ? 300 : 1000}
                  onHelpOverlayTransitionEnd={clearAnswer}
                  answerFadingOut={answerFadingOut}
                  generationTrace={attempt.problem.generationTrace}
                  complexityBudget={currentSlot?.constraints?.maxComplexityBudgetPerTerm}
                />
              ) : (
                <LinearProblem
                  terms={attempt.problem.terms}
                  userAnswer={attempt.userAnswer}
                  isFocused={inputIsFocused}
                  isCompleted={showAsCompleted}
                  correctAnswer={attempt.problem.answer}
                  isDark={isDark}
                  detectedPrefixIndex={
                    matchedPrefixIndex >= 0 && matchedPrefixIndex < prefixSums.length - 1
                      ? matchedPrefixIndex
                      : undefined
                  }
                />
              )}

              {/* Help panel - absolutely positioned to the right of the problem */}
              {showHelpOverlay && helpContext && !helpPanelDismissed && (
                <div
                  data-element="help-panel"
                  className={css({
                    position: 'absolute',
                    left: '100%',
                    top: 0,
                    marginLeft: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    padding: '1rem',
                    backgroundColor: isDark ? 'blue.900' : 'blue.50',
                    borderRadius: '12px',
                    border: '2px solid',
                    borderColor: isDark ? 'blue.700' : 'blue.200',
                    minWidth: '200px',
                    maxWidth: '280px',
                  })}
                >
                  {/* Close button for help panel */}
                  <button
                    type="button"
                    data-action="close-help-panel"
                    onClick={() => setHelpPanelDismissed(true)}
                    className={css({
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      color: isDark ? 'gray.400' : 'gray.500',
                      backgroundColor: isDark ? 'gray.700' : 'gray.200',
                      border: '2px solid',
                      borderColor: isDark ? 'gray.600' : 'gray.300',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      zIndex: 10,
                      _hover: {
                        backgroundColor: isDark ? 'gray.600' : 'gray.300',
                        color: isDark ? 'gray.200' : 'gray.700',
                      },
                    })}
                    aria-label="Close help panel"
                  >
                    ×
                  </button>

                  {/* Coach hint */}
                  {(() => {
                    const hint = generateCoachHint(
                      helpContext.currentValue,
                      helpContext.targetValue
                    )
                    if (!hint) return null
                    return (
                      <div
                        data-element="coach-hint"
                        className={css({
                          padding: '0.5rem 0.75rem',
                          backgroundColor: isDark ? 'gray.800' : 'white',
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: isDark ? 'blue.800' : 'blue.100',
                        })}
                      >
                        <p
                          className={css({
                            fontSize: '0.875rem',
                            color: isDark ? 'gray.300' : 'gray.700',
                            lineHeight: '1.4',
                            margin: 0,
                          })}
                        >
                          {hint}
                        </p>
                      </div>
                    )
                  })()}

                  {/* Decomposition display */}
                  <DecompositionProvider
                    startValue={helpContext.currentValue}
                    targetValue={helpContext.targetValue}
                    currentStepIndex={0}
                    abacusColumns={Math.max(
                      1,
                      Math.max(helpContext.currentValue, helpContext.targetValue).toString().length
                    )}
                  >
                    <DecompositionSection
                      className={css({
                        padding: '0.5rem 0.75rem',
                        backgroundColor: isDark ? 'gray.800' : 'white',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: isDark ? 'blue.800' : 'blue.100',
                        whiteSpace: 'nowrap',
                      })}
                      labelClassName={css({
                        fontSize: '0.625rem',
                        fontWeight: 'bold',
                        color: isDark ? 'blue.300' : 'blue.600',
                        marginBottom: '0.25rem',
                        textTransform: 'uppercase',
                      })}
                      contentClassName={css({
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        color: isDark ? 'gray.100' : 'gray.800',
                      })}
                    />
                  </DecompositionProvider>
                </div>
              )}
            </animated.div>
          </animated.div>
        </div>

        {/* Feedback message - only show for incorrect */}
        {showFeedback && (
          <div
            data-element="feedback"
            className={css({
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              backgroundColor: isDark ? 'red.900' : 'red.100',
              color: isDark ? 'red.200' : 'red.700',
            })}
          >
            The answer was {attempt.problem.answer}
          </div>
        )}
      </div>

      {/* Input area */}
      {showInputArea && !isPaused && (
        <div data-section="input-area">
          {/* Submit button - only shown when auto-submit threshold exceeded */}
          <div
            className={css({
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '1rem',
              minHeight: '52px',
              overflow: 'hidden',
            })}
          >
            <animated.button
              type="button"
              data-action="submit"
              data-visible={attempt.manualSubmitRequired}
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting || !attempt.manualSubmitRequired}
              style={submitButtonSpring}
              className={css({
                padding: '0.75rem 2rem',
                fontSize: '1.125rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: !canSubmit || !attempt.manualSubmitRequired ? 'not-allowed' : 'pointer',
                backgroundColor: canSubmit ? 'blue.500' : isDark ? 'gray.700' : 'gray.300',
                color: !canSubmit ? (isDark ? 'gray.400' : 'gray.500') : 'white',
                _hover: {
                  backgroundColor:
                    canSubmit && attempt.manualSubmitRequired
                      ? 'blue.600'
                      : isDark
                        ? 'gray.600'
                        : 'gray.300',
                },
              })}
            >
              Submit
            </animated.button>
          </div>

          {/* On-screen keypad for mobile */}
          {showOnScreenKeypad && (
            <NumericKeypad
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              onSubmit={handleSubmit}
              disabled={isSubmitting}
              currentValue={attempt.userAnswer}
              showSubmitButton={attempt.manualSubmitRequired}
            />
          )}
        </div>
      )}

      {/* Debug panel - shows current problem details when visual debug mode is on */}
      {currentSlot?.problem && (
        <ProblemDebugPanel
          problem={currentSlot.problem}
          slot={currentSlot}
          part={currentPart}
          partIndex={currentPartIndex}
          slotIndex={currentSlotIndex}
          userInput={attempt.userAnswer}
          phaseName={phase.phase}
        />
      )}
    </div>
  )
}
export default ActiveSession
