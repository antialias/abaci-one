'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  GeneratedProblem,
  HelpLevel,
  ProblemConstraints,
  ProblemSlot,
  SessionHealth,
  SessionPart,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'
import type { StudentHelpSettings } from '@/db/schema/players'
import { usePracticeHelp, type TermContext } from '@/hooks/usePracticeHelp'
import { createBasicSkillSet, type SkillSet } from '@/types/tutorial'
import {
  analyzeRequiredSkills,
  type ProblemConstraints as GeneratorConstraints,
  generateSingleProblem,
} from '@/utils/problemGenerator'
import { css } from '../../../styled-system/css'
import { useHasPhysicalKeyboard } from './hooks/useDeviceDetection'
import { NumericKeypad } from './NumericKeypad'
import { PracticeHelpPanel } from './PracticeHelpPanel'
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
  /** Student's help settings (optional, uses defaults if not provided) */
  helpSettings?: StudentHelpSettings
  /** Whether this student is in beginner mode (free help without penalty) */
  isBeginnerMode?: boolean
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
 * Get part type colors
 */
function getPartTypeColors(type: SessionPart['type']): {
  bg: string
  border: string
  text: string
} {
  switch (type) {
    case 'abacus':
      return { bg: 'blue.50', border: 'blue.200', text: 'blue.700' }
    case 'visualization':
      return { bg: 'purple.50', border: 'purple.200', text: 'purple.700' }
    case 'linear':
      return { bg: 'orange.50', border: 'orange.200', text: 'orange.700' }
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
}: {
  terms: number[]
  userAnswer: string
  isFocused: boolean
  isCompleted: boolean
  correctAnswer: number
}) {
  // Build the equation string
  const equation = terms
    .map((term, i) => {
      if (i === 0) return String(term)
      return term < 0 ? ` - ${Math.abs(term)}` : ` + ${term}`
    })
    .join('')

  return (
    <div
      data-component="linear-problem"
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
      <span className={css({ color: 'gray.800' })}>{equation} =</span>
      <span
        className={css({
          minWidth: '80px',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          textAlign: 'center',
          backgroundColor: isCompleted
            ? userAnswer === String(correctAnswer)
              ? 'green.100'
              : 'red.100'
            : 'gray.100',
          color: isCompleted
            ? userAnswer === String(correctAnswer)
              ? 'green.700'
              : 'red.700'
            : 'gray.800',
          border: '2px solid',
          borderColor: isFocused ? 'blue.400' : 'gray.300',
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
  helpSettings,
  isBeginnerMode = false,
}: ActiveSessionProps) {
  const [currentProblem, setCurrentProblem] = useState<CurrentProblem | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [showAbacus, setShowAbacus] = useState(false)
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'incorrect'>('none')
  const [currentTermIndex, setCurrentTermIndex] = useState(0)
  const [incorrectAttempts, setIncorrectAttempts] = useState(0)

  const hasPhysicalKeyboard = useHasPhysicalKeyboard()

  // Calculate running total and target for help context
  const runningTotal = useMemo(() => {
    if (!currentProblem) return 0
    const terms = currentProblem.problem.terms
    let total = 0
    for (let i = 0; i < currentTermIndex; i++) {
      total += terms[i]
    }
    return total
  }, [currentProblem, currentTermIndex])

  const currentTermTarget = useMemo(() => {
    if (!currentProblem) return 0
    const terms = currentProblem.problem.terms
    if (currentTermIndex >= terms.length) return currentProblem.problem.answer
    return runningTotal + terms[currentTermIndex]
  }, [currentProblem, currentTermIndex, runningTotal])

  const currentTerm = useMemo(() => {
    if (!currentProblem || currentTermIndex >= currentProblem.problem.terms.length) return 0
    return currentProblem.problem.terms[currentTermIndex]
  }, [currentProblem, currentTermIndex])

  // Initialize help system
  const [helpState, helpActions] = usePracticeHelp({
    settings: helpSettings || {
      helpMode: 'auto',
      autoEscalationTimingMs: { level1: 30000, level2: 60000, level3: 90000 },
      beginnerFreeHelp: true,
      advancedRequiresApproval: false,
    },
    isBeginnerMode,
    onHelpLevelChange: (level, trigger) => {
      // Could add analytics tracking here
      console.log(`Help level changed to ${level} via ${trigger}`)
    },
  })

  // Update help context when problem or term changes
  useEffect(() => {
    if (currentProblem && currentTermIndex < currentProblem.problem.terms.length) {
      helpActions.resetForNewTerm({
        currentValue: runningTotal,
        targetValue: currentTermTarget,
        term: currentTerm,
        termIndex: currentTermIndex,
      })
    }
  }, [
    currentProblem?.problem.terms.join(','),
    currentTermIndex,
    runningTotal,
    currentTermTarget,
    currentTerm,
  ])

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

  // Handle keyboard input
  useEffect(() => {
    if (!hasPhysicalKeyboard || isPaused || !currentProblem || isSubmitting) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        setUserAnswer((prev) => prev.slice(0, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      } else if (/^[0-9]$/.test(e.key)) {
        setUserAnswer((prev) => prev + e.key)
      } else if (e.key === '-' && userAnswer.length === 0) {
        // Allow negative sign at start
        setUserAnswer('-')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [hasPhysicalKeyboard, isPaused, currentProblem, isSubmitting, userAnswer])

  const handleDigit = useCallback((digit: string) => {
    setUserAnswer((prev) => prev + digit)
  }, [])

  const handleBackspace = useCallback(() => {
    setUserAnswer((prev) => prev.slice(0, -1))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!currentProblem || isSubmitting || !userAnswer) return

    const answerNum = parseInt(userAnswer, 10)
    if (Number.isNaN(answerNum)) return

    setIsSubmitting(true)
    const responseTimeMs = Date.now() - currentProblem.startTime
    const isCorrect = answerNum === currentProblem.problem.answer

    // Show feedback
    setFeedback(isCorrect ? 'correct' : 'incorrect')

    // Track incorrect attempts for help escalation
    if (!isCorrect) {
      setIncorrectAttempts((prev) => prev + 1)
      helpActions.recordError()
    }

    // Record the result with help tracking data
    const result: Omit<SlotResult, 'timestamp' | 'partNumber'> = {
      slotIndex: currentProblem.slotIndex,
      problem: currentProblem.problem,
      studentAnswer: answerNum,
      isCorrect,
      responseTimeMs,
      skillsExercised: currentProblem.problem.skillsRequired,
      usedOnScreenAbacus: showAbacus,
      // Help tracking fields
      helpLevelUsed: helpState.maxLevelUsed,
      incorrectAttempts,
      helpTrigger: helpState.trigger,
    }

    await onAnswer(result)

    // Wait for feedback display then advance
    setTimeout(
      () => {
        setCurrentProblem(null)
        setCurrentTermIndex(0)
        setIncorrectAttempts(0)
        setIsSubmitting(false)
      },
      isCorrect ? 500 : 1500
    )
  }, [
    currentProblem,
    isSubmitting,
    userAnswer,
    showAbacus,
    onAnswer,
    helpState.maxLevelUsed,
    helpState.trigger,
    incorrectAttempts,
    helpActions,
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
            color: 'gray.500',
          })}
        >
          Loading next problem...
        </div>
      </div>
    )
  }

  const partColors = getPartTypeColors(currentPart.type)

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
      {/* Header with progress and health */}
      <div
        data-section="session-header"
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: 'sm',
        })}
      >
        <div>
          <div
            className={css({
              fontSize: '0.875rem',
              color: 'gray.500',
            })}
          >
            {studentName}'s Practice
          </div>
          <div
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: 'gray.800',
            })}
          >
            Problem {completedProblems + 1} of {totalProblems}
          </div>
        </div>

        {sessionHealth && (
          <div
            data-element="session-health"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              backgroundColor: 'gray.50',
            })}
          >
            <span>{getHealthEmoji(sessionHealth.overall)}</span>
            <span
              className={css({
                fontSize: '0.875rem',
                fontWeight: 'bold',
                color: getHealthColor(sessionHealth.overall),
              })}
            >
              {Math.round(sessionHealth.accuracy * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Part indicator */}
      <div
        data-element="part-indicator"
        className={css({
          padding: '1rem',
          backgroundColor: partColors.bg,
          borderRadius: '12px',
          border: '2px solid',
          borderColor: partColors.border,
          textAlign: 'center',
        })}
      >
        <div
          className={css({
            fontSize: '1.5rem',
            marginBottom: '0.25rem',
          })}
        >
          {getPartTypeEmoji(currentPart.type)}
        </div>
        <div
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: partColors.text,
            marginBottom: '0.25rem',
          })}
        >
          Part {currentPart.partNumber}: {getPartTypeLabel(currentPart.type)}
        </div>
        <div
          className={css({
            fontSize: '0.875rem',
            color: partColors.text,
          })}
        >
          {currentPart.type === 'abacus' && 'Use your physical abacus to solve these problems'}
          {currentPart.type === 'visualization' && 'Picture the beads moving in your mind'}
          {currentPart.type === 'linear' && 'Calculate the answer mentally'}
        </div>
        <div
          className={css({
            fontSize: '0.75rem',
            color: partColors.text,
            marginTop: '0.5rem',
          })}
        >
          Problem {currentSlotIndex + 1} of {currentPart.slots.length} in this part
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
          backgroundColor: 'white',
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
                ? 'blue.100'
                : currentSlot?.purpose === 'reinforce'
                  ? 'orange.100'
                  : currentSlot?.purpose === 'review'
                    ? 'green.100'
                    : 'purple.100',
            color:
              currentSlot?.purpose === 'focus'
                ? 'blue.700'
                : currentSlot?.purpose === 'reinforce'
                  ? 'orange.700'
                  : currentSlot?.purpose === 'review'
                    ? 'green.700'
                    : 'purple.700',
          })}
        >
          {currentSlot?.purpose}
        </div>

        {/* Problem display - vertical or linear based on part type */}
        {currentPart.format === 'vertical' ? (
          <VerticalProblem
            terms={currentProblem.problem.terms}
            userAnswer={userAnswer}
            isFocused={!isPaused && !isSubmitting}
            isCompleted={feedback !== 'none'}
            correctAnswer={currentProblem.problem.answer}
            size="large"
          />
        ) : (
          <LinearProblem
            terms={currentProblem.problem.terms}
            userAnswer={userAnswer}
            isFocused={!isPaused && !isSubmitting}
            isCompleted={feedback !== 'none'}
            correctAnswer={currentProblem.problem.answer}
          />
        )}

        {/* Feedback message */}
        {feedback !== 'none' && (
          <div
            data-element="feedback"
            className={css({
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              backgroundColor: feedback === 'correct' ? 'green.100' : 'red.100',
              color: feedback === 'correct' ? 'green.700' : 'red.700',
            })}
          >
            {feedback === 'correct'
              ? 'Correct!'
              : `The answer was ${currentProblem.problem.answer}`}
          </div>
        )}

        {/* Help panel - show when not submitting and feedback hasn't been shown yet */}
        {!isSubmitting && feedback === 'none' && (
          <div data-section="help-area" className={css({ width: '100%' })}>
            <PracticeHelpPanel
              helpState={helpState}
              onRequestHelp={helpActions.requestHelp}
              onDismissHelp={helpActions.dismissHelp}
              isAbacusPart={currentPart.type === 'abacus'}
            />
          </div>
        )}
      </div>

      {/* Input area */}
      {!isPaused && feedback === 'none' && (
        <div data-section="input-area">
          {/* Physical keyboard hint */}
          {hasPhysicalKeyboard && (
            <div
              className={css({
                textAlign: 'center',
                color: 'gray.500',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              })}
            >
              Type your answer and press Enter
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

      {/* Abacus toggle (only for abacus part) */}
      {currentPart.type === 'abacus' && (
        <div data-section="abacus-tools">
          <button
            type="button"
            data-action="toggle-abacus"
            onClick={() => setShowAbacus(!showAbacus)}
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.875rem',
              color: showAbacus ? 'blue.700' : 'gray.600',
              backgroundColor: showAbacus ? 'blue.50' : 'gray.100',
              border: '1px solid',
              borderColor: showAbacus ? 'blue.200' : 'gray.200',
              borderRadius: '8px',
              cursor: 'pointer',
              _hover: {
                backgroundColor: showAbacus ? 'blue.100' : 'gray.200',
              },
            })}
          >
            {showAbacus ? 'Hide On-Screen Abacus' : 'Need Help? Show Abacus'}
          </button>

          {showAbacus && (
            <div
              data-element="abacus-reminder"
              className={css({
                marginTop: '0.5rem',
                padding: '0.75rem',
                backgroundColor: 'yellow.50',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'yellow.200',
                fontSize: '0.875rem',
                color: 'yellow.700',
                textAlign: 'center',
              })}
            >
              Try using your physical abacus first! The on-screen version is for checking only.
            </div>
          )}

          {/* TODO: Add AbacusReact component here when showAbacus is true */}
        </div>
      )}

      {/* Teacher controls */}
      <div
        data-section="teacher-controls"
        className={css({
          display: 'flex',
          gap: '0.75rem',
          marginTop: 'auto',
          paddingTop: '1rem',
          borderTop: '1px solid',
          borderColor: 'gray.200',
        })}
      >
        {isPaused ? (
          <button
            type="button"
            data-action="resume"
            onClick={handleResume}
            className={css({
              flex: 1,
              padding: '0.75rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: 'green.500',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              _hover: {
                backgroundColor: 'green.600',
              },
            })}
          >
            Resume Practice
          </button>
        ) : (
          <button
            type="button"
            data-action="pause"
            onClick={handlePause}
            className={css({
              flex: 1,
              padding: '0.75rem',
              fontSize: '0.875rem',
              color: 'gray.600',
              backgroundColor: 'gray.100',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: 'gray.200',
              cursor: 'pointer',
              _hover: {
                backgroundColor: 'gray.200',
              },
            })}
          >
            Pause
          </button>
        )}

        <button
          type="button"
          data-action="end-early"
          onClick={() => onEndEarly('Teacher ended session')}
          className={css({
            padding: '0.75rem 1.5rem',
            fontSize: '0.875rem',
            color: 'red.600',
            backgroundColor: 'red.50',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: 'red.200',
            cursor: 'pointer',
            _hover: {
              backgroundColor: 'red.100',
            },
          })}
        >
          End Session
        </button>
      </div>

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
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          })}
        >
          <div
            className={css({
              padding: '2rem',
              backgroundColor: 'white',
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
                color: 'gray.800',
                marginBottom: '0.5rem',
              })}
            >
              Session Paused
            </div>
            <div
              className={css({
                fontSize: '1rem',
                color: 'gray.600',
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
