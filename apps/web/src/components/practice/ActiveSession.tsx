'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type {
  GeneratedProblem,
  ProblemConstraints,
  ProblemSlot,
  SessionHealth,
  SessionPart,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'
import { createBasicSkillSet, type SkillSet } from '@/types/tutorial'
import {
  analyzeRequiredSkills,
  type ProblemConstraints as GeneratorConstraints,
  generateSingleProblem,
} from '@/utils/problemGenerator'
import { css } from '../../../styled-system/css'
import { DecompositionDisplay, DecompositionProvider } from '../decomposition'
import { generateCoachHint } from './coachHintGenerator'
import { useHasPhysicalKeyboard } from './hooks/useDeviceDetection'
import { NumericKeypad } from './NumericKeypad'
import { PracticeHelpOverlay } from './PracticeHelpOverlay'
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
}

interface CurrentProblem {
  partIndex: number
  slotIndex: number
  problem: GeneratedProblem
  startTime: number
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
 */
export function ActiveSession({
  plan,
  studentName,
  onAnswer,
  onEndEarly,
  onPause,
  onResume,
  onComplete,
}: ActiveSessionProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [currentProblem, setCurrentProblem] = useState<CurrentProblem | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'incorrect'>('none')
  const [incorrectAttempts, setIncorrectAttempts] = useState(0)
  // Help mode: which terms have been confirmed correct so far
  const [confirmedTermCount, setConfirmedTermCount] = useState(0)
  // Which term we're currently showing help for (null = not showing help)
  const [helpTermIndex, setHelpTermIndex] = useState<number | null>(null)
  // Track corrections for auto-submit (allow 1 correction, then require manual submit)
  const [correctionCount, setCorrectionCount] = useState(0)
  // Track if auto-submit was triggered (for celebration animation)
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false)
  // Track rejected digit for red X animation (null = no rejection, string = the rejected digit)
  const [rejectedDigit, setRejectedDigit] = useState<string | null>(null)

  const hasPhysicalKeyboard = useHasPhysicalKeyboard()

  // Compute all prefix sums for the current problem
  // prefixSums[i] = sum of terms[0..i] (inclusive)
  // e.g., for [23, 45, 12]: prefixSums = [23, 68, 80]
  const prefixSums = useMemo(() => {
    if (!currentProblem) return []
    const terms = currentProblem.problem.terms
    const sums: number[] = []
    let total = 0
    for (const term of terms) {
      total += term
      sums.push(total)
    }
    return sums
  }, [currentProblem])

  // Check if user's input matches any prefix sum
  // Returns the index of the matched prefix, or -1 if no match
  const matchedPrefixIndex = useMemo(() => {
    const answerNum = parseInt(userAnswer, 10)
    if (Number.isNaN(answerNum)) return -1
    return prefixSums.indexOf(answerNum)
  }, [userAnswer, prefixSums])

  // Determine if submit button should be enabled
  const canSubmit = useMemo(() => {
    if (!userAnswer) return false
    const answerNum = parseInt(userAnswer, 10)
    return !Number.isNaN(answerNum)
  }, [userAnswer])

  // Compute context for help abacus when showing help
  const helpContext = useMemo(() => {
    if (helpTermIndex === null || !currentProblem) return null
    const terms = currentProblem.problem.terms
    // Current value is the prefix sum up to helpTermIndex (exclusive)
    const currentValue = helpTermIndex === 0 ? 0 : prefixSums[helpTermIndex - 1]
    // Target is the prefix sum including this term
    const targetValue = prefixSums[helpTermIndex]
    const term = terms[helpTermIndex]
    return { currentValue, targetValue, term }
  }, [helpTermIndex, currentProblem, prefixSums])

  // Auto-trigger help when prefix sum is detected
  useEffect(() => {
    // Only auto-trigger if:
    // 1. We detected a prefix sum match (but not the final answer)
    // 2. We're not already showing help for this term
    if (
      helpTermIndex === null &&
      matchedPrefixIndex >= 0 &&
      matchedPrefixIndex < prefixSums.length - 1
    ) {
      const newConfirmedCount = matchedPrefixIndex + 1
      setConfirmedTermCount(newConfirmedCount)

      if (newConfirmedCount < (currentProblem?.problem.terms.length || 0)) {
        setHelpTermIndex(newConfirmedCount)
        setUserAnswer('')
      }
    }
  }, [helpTermIndex, matchedPrefixIndex, prefixSums.length, currentProblem?.problem.terms.length])

  // Get current part and slot
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

  // Initialize or advance to current problem
  useEffect(() => {
    if (currentPart && currentSlot && !currentProblem) {
      // Generate problem from slot constraints (simplified for now)
      const problem = currentSlot.problem || generateProblemFromConstraints(currentSlot.constraints)
      setCurrentProblem({
        partIndex: currentPartIndex,
        slotIndex: currentSlotIndex,
        problem,
        startTime: Date.now(),
      })
      setUserAnswer('')
      setFeedback('none')
    }
  }, [currentPart, currentSlot, currentPartIndex, currentSlotIndex, currentProblem])

  // Check if adding a digit would be consistent with any prefix sum
  const isDigitConsistent = useCallback(
    (currentAnswer: string, digit: string): boolean => {
      const newAnswer = currentAnswer + digit
      const newAnswerNum = parseInt(newAnswer, 10)
      if (Number.isNaN(newAnswerNum)) return false

      // Check if newAnswer is a prefix of any prefix sum's string representation
      // e.g., if prefix sums are [23, 68, 80], and newAnswer is "6", that's consistent with "68"
      // if newAnswer is "8", that's consistent with "80"
      // if newAnswer is "68", that's an exact match
      for (const sum of prefixSums) {
        const sumStr = sum.toString()
        if (sumStr.startsWith(newAnswer)) {
          return true
        }
      }
      return false
    },
    [prefixSums]
  )

  const handleDigit = useCallback(
    (digit: string) => {
      setUserAnswer((prev) => {
        if (isDigitConsistent(prev, digit)) {
          return prev + digit
        } else {
          // Reject the digit - show red X and count as correction
          setRejectedDigit(digit)
          setCorrectionCount((c) => c + 1)
          // Clear the rejection after a short delay
          setTimeout(() => setRejectedDigit(null), 300)
          return prev // Don't change the answer
        }
      })
    },
    [isDigitConsistent]
  )

  const handleBackspace = useCallback(() => {
    setUserAnswer((prev) => {
      if (prev.length > 0) {
        setCorrectionCount((c) => c + 1)
      }
      return prev.slice(0, -1)
    })
  }, [])

  // Handle when student reaches the target value on the help abacus
  // This exits help mode completely and resets the problem to normal state
  const handleTargetReached = useCallback(() => {
    if (helpTermIndex === null || !currentProblem) return

    // Brief delay so user sees the success feedback, then exit help mode completely
    setTimeout(() => {
      // Reset all help-related state - problem returns to as if they never entered a prefix
      setHelpTermIndex(null)
      setConfirmedTermCount(0)
      setUserAnswer('')
    }, 800) // 800ms delay to show "Perfect!" feedback
  }, [helpTermIndex, currentProblem])

  const handleSubmit = useCallback(async () => {
    if (!currentProblem || isSubmitting || !userAnswer) return

    const answerNum = parseInt(userAnswer, 10)
    if (Number.isNaN(answerNum)) return

    setIsSubmitting(true)
    const responseTimeMs = Date.now() - currentProblem.startTime
    const isCorrect = answerNum === currentProblem.problem.answer

    // Show feedback
    setFeedback(isCorrect ? 'correct' : 'incorrect')

    // Track incorrect attempts
    if (!isCorrect) {
      setIncorrectAttempts((prev) => prev + 1)
    }

    // Record the result
    const result: Omit<SlotResult, 'timestamp' | 'partNumber'> = {
      slotIndex: currentProblem.slotIndex,
      problem: currentProblem.problem,
      studentAnswer: answerNum,
      isCorrect,
      responseTimeMs,
      skillsExercised: currentProblem.problem.skillsRequired,
      usedOnScreenAbacus: confirmedTermCount > 0 || helpTermIndex !== null,
      incorrectAttempts,
    }

    await onAnswer(result)

    // Wait for feedback display then advance
    setTimeout(
      () => {
        setCurrentProblem(null)
        setIncorrectAttempts(0)
        setConfirmedTermCount(0)
        setHelpTermIndex(null)
        setIsSubmitting(false)
        setCorrectionCount(0)
        setAutoSubmitTriggered(false)
      },
      isCorrect ? 500 : 1500
    )
  }, [currentProblem, isSubmitting, userAnswer, confirmedTermCount, helpTermIndex, onAnswer, incorrectAttempts])

  // Auto-submit when correct answer is entered on first attempt (allow minor corrections)
  useEffect(() => {
    if (!currentProblem || isSubmitting || feedback !== 'none' || !userAnswer) return
    // Allow up to 2 backspaces (one typo fix), but no more
    if (correctionCount > 2) return

    const answerNum = parseInt(userAnswer, 10)
    if (Number.isNaN(answerNum)) return

    // Check if answer matches
    if (answerNum === currentProblem.problem.answer) {
      // Trigger auto-submit with celebration
      setAutoSubmitTriggered(true)
      // Small delay to show the celebration animation before submitting
      const timer = setTimeout(() => {
        handleSubmit()
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [userAnswer, currentProblem, isSubmitting, feedback, correctionCount, handleSubmit])

  // Handle keyboard input (placed after handleSubmit to avoid temporal dead zone)
  useEffect(() => {
    if (!hasPhysicalKeyboard || isPaused || !currentProblem || isSubmitting) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        handleBackspace()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      } else if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key)
      }
      // Note: removed negative sign handling since prefix sums are always positive
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    hasPhysicalKeyboard,
    isPaused,
    currentProblem,
    isSubmitting,
    handleSubmit,
    handleDigit,
    handleBackspace,
  ])

  const handlePause = useCallback(() => {
    setIsPaused(true)
    onPause?.()
  }, [onPause])

  const handleResume = useCallback(() => {
    setIsPaused(false)
    onResume?.()
  }, [onResume])

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

  if (!currentPart || !currentProblem) {
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
      data-part-type={currentPart.type}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '1rem',
        maxWidth: '600px',
        margin: '0 auto',
        minHeight: '100vh',
      })}
    >
      {/* Practice Session HUD - Control bar with session info and tape-deck controls */}
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

      {/* Problem display */}
      <div
        data-section="problem-area"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '2rem',
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

        {/* Problem display - horizontal layout with help panel on right when in help mode */}
        <div
          data-element="problem-with-help"
          className={css({
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: '1.5rem',
            width: '100%',
          })}
        >
          {/* Center: Problem display */}
          {currentPart.format === 'vertical' ? (
            <VerticalProblem
              terms={currentProblem.problem.terms}
              userAnswer={userAnswer}
              isFocused={!isPaused && !isSubmitting}
              isCompleted={feedback !== 'none'}
              correctAnswer={currentProblem.problem.answer}
              size="large"
              currentHelpTermIndex={helpTermIndex ?? undefined}
              autoSubmitPending={autoSubmitTriggered}
              rejectedDigit={rejectedDigit}
              helpOverlay={
                !isSubmitting && feedback === 'none' && helpTermIndex !== null && helpContext ? (
                  <PracticeHelpOverlay
                    currentValue={helpContext.currentValue}
                    targetValue={helpContext.targetValue}
                    columns={Math.max(
                      1,
                      Math.max(helpContext.currentValue, helpContext.targetValue).toString().length
                    )}
                    onTargetReached={handleTargetReached}
                  />
                ) : undefined
              }
            />
          ) : (
            <LinearProblem
              terms={currentProblem.problem.terms}
              userAnswer={userAnswer}
              isFocused={!isPaused && !isSubmitting}
              isCompleted={feedback !== 'none'}
              correctAnswer={currentProblem.problem.answer}
              isDark={isDark}
              detectedPrefixIndex={
                matchedPrefixIndex >= 0 && matchedPrefixIndex < prefixSums.length - 1
                  ? matchedPrefixIndex
                  : undefined
              }
            />
          )}

          {/* Right: Help panel with coach hint and decomposition (only in help mode) */}
          {!isSubmitting && feedback === 'none' && helpTermIndex !== null && helpContext && (
            <div
              data-element="help-panel"
              className={css({
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
              {/* Coach hint */}
              {(() => {
                const hint = generateCoachHint(helpContext.currentValue, helpContext.targetValue)
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
              <div
                data-element="decomposition-display"
                className={css({
                  padding: '0.5rem 0.75rem',
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: isDark ? 'blue.800' : 'blue.100',
                })}
              >
                <div
                  className={css({
                    fontSize: '0.625rem',
                    fontWeight: 'bold',
                    color: isDark ? 'blue.300' : 'blue.600',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase',
                  })}
                >
                  Step-by-Step
                </div>
                <div
                  className={css({
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.100' : 'gray.800',
                  })}
                >
                  <DecompositionProvider
                    startValue={helpContext.currentValue}
                    targetValue={helpContext.targetValue}
                    currentStepIndex={0}
                    abacusColumns={Math.max(
                      1,
                      Math.max(helpContext.currentValue, helpContext.targetValue).toString().length
                    )}
                  >
                    <DecompositionDisplay />
                  </DecompositionProvider>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feedback message */}
        {feedback !== 'none' && (
          <div
            data-element="feedback"
            className={css({
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              backgroundColor:
                feedback === 'correct'
                  ? isDark
                    ? 'green.900'
                    : 'green.100'
                  : isDark
                    ? 'red.900'
                    : 'red.100',
              color:
                feedback === 'correct'
                  ? isDark
                    ? 'green.200'
                    : 'green.700'
                  : isDark
                    ? 'red.200'
                    : 'red.700',
            })}
          >
            {feedback === 'correct'
              ? 'Correct!'
              : `The answer was ${currentProblem.problem.answer}`}
          </div>
        )}
      </div>

      {/* Input area */}
      {!isPaused && feedback === 'none' && (
        <div data-section="input-area">
          {/* Submit button */}
          <div
            className={css({
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '1rem',
            })}
          >
            <button
              type="button"
              data-action="submit"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className={css({
                padding: '0.75rem 2rem',
                fontSize: '1.125rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: !canSubmit ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: canSubmit ? 'blue.500' : isDark ? 'gray.700' : 'gray.300',
                color: !canSubmit ? (isDark ? 'gray.400' : 'gray.500') : 'white',
                opacity: !canSubmit ? 0.5 : 1,
                _hover: {
                  backgroundColor: canSubmit ? 'blue.600' : isDark ? 'gray.600' : 'gray.300',
                },
              })}
            >
              {canSubmit ? 'Submit' : 'Enter Total'}
            </button>
          </div>

          {/* Physical keyboard hint */}
          {hasPhysicalKeyboard && (
            <div
              className={css({
                textAlign: 'center',
                color: isDark ? 'gray.400' : 'gray.500',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              })}
            >
              Type your abacus total
            </div>
          )}

          {/* On-screen keypad for mobile */}
          {hasPhysicalKeyboard === false && (
            <NumericKeypad
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              onSubmit={handleSubmit}
              disabled={isSubmitting}
              currentValue={userAnswer}
            />
          )}
        </div>
      )}

      {/* Pause overlay */}
      {isPaused && (
        <div
          data-element="pause-overlay"
          className={css({
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          })}
        >
          <div
            className={css({
              padding: '2rem',
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '16px',
              textAlign: 'center',
            })}
          >
            <div
              className={css({
                fontSize: '3rem',
                marginBottom: '1rem',
              })}
            >
              ⏸️
            </div>
            <div
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.800',
                marginBottom: '0.5rem',
              })}
            >
              Session Paused
            </div>
            <div
              className={css({
                fontSize: '1rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Take a break! Tap Resume when ready.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Generate a problem from slot constraints using the actual skill-based algorithm.
 *
 * Converts session plan constraints to the format expected by the problem generator,
 * then generates a skill-appropriate problem.
 */
function generateProblemFromConstraints(constraints: ProblemConstraints): GeneratedProblem {
  // Build a complete SkillSet from the partial constraints
  const baseSkillSet = createBasicSkillSet()

  // Merge required skills if provided
  const requiredSkills: SkillSet = {
    basic: { ...baseSkillSet.basic, ...constraints.requiredSkills?.basic },
    fiveComplements: {
      ...baseSkillSet.fiveComplements,
      ...constraints.requiredSkills?.fiveComplements,
    },
    tenComplements: {
      ...baseSkillSet.tenComplements,
      ...constraints.requiredSkills?.tenComplements,
    },
    fiveComplementsSub: {
      ...baseSkillSet.fiveComplementsSub,
      ...constraints.requiredSkills?.fiveComplementsSub,
    },
    tenComplementsSub: {
      ...baseSkillSet.tenComplementsSub,
      ...constraints.requiredSkills?.tenComplementsSub,
    },
  }

  // Convert to generator constraints format
  const maxDigits = constraints.digitRange?.max || 1
  const maxValue = 10 ** maxDigits - 1

  const generatorConstraints: GeneratorConstraints = {
    numberRange: { min: 1, max: maxValue },
    maxTerms: constraints.termCount?.max || 5,
    problemCount: 1,
  }

  // Try to generate using the skill-based algorithm
  const generatedProblem = generateSingleProblem(
    generatorConstraints,
    requiredSkills,
    constraints.targetSkills,
    constraints.forbiddenSkills
  )

  if (generatedProblem) {
    // Convert from generator format to session format
    return {
      terms: generatedProblem.terms,
      answer: generatedProblem.answer,
      skillsRequired: generatedProblem.requiredSkills,
    }
  }

  // Fallback: generate a simple problem if skill-based generation fails
  const termCount = constraints.termCount?.min || 3
  const terms: number[] = []
  for (let i = 0; i < termCount; i++) {
    terms.push(Math.floor(Math.random() * Math.min(maxValue, 9)) + 1)
  }
  const answer = terms.reduce((sum, t) => sum + t, 0)
  const skillsRequired = analyzeRequiredSkills(terms, answer)

  return {
    terms,
    answer,
    skillsRequired,
  }
}

export default ActiveSession
