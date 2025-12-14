/**
 * Practice Preview Component
 *
 * A sandbox practice interface for debugging any problem without
 * affecting the actual session state. Shows the full practice UI
 * (problem, abacus, input) and lets you submit answers to see feedback.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { ProblemSlot, SessionPart } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { AbacusDock } from '../AbacusDock'
import { useHasPhysicalKeyboard } from './hooks/useDeviceDetection'
import { NumericKeypad } from './NumericKeypad'
import { VerticalProblem } from './VerticalProblem'

export interface PracticePreviewProps {
  /** The problem slot to practice */
  slot: ProblemSlot
  /** The part this problem belongs to */
  part: SessionPart
  /** Problem number for display */
  problemNumber: number
  /** Called when user wants to exit practice preview */
  onBack: () => void
  /** If true, renders in a more compact inline style without header */
  inline?: boolean
}

export function PracticePreview({
  slot,
  part,
  problemNumber,
  onBack,
  inline = false,
}: PracticePreviewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // User's answer (as string for input)
  const [userAnswer, setUserAnswer] = useState<string>('')
  // Whether the answer has been submitted
  const [isSubmitted, setIsSubmitted] = useState(false)
  // Track if answer was correct
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)

  const problem = slot.problem
  const correctAnswer = problem?.answer

  // Handle digit input
  const handleDigit = useCallback(
    (digit: string) => {
      if (isSubmitted || correctAnswer === undefined) return
      setUserAnswer((prev) => {
        // Max digits based on correct answer length + 1
        const maxDigits = String(correctAnswer).length + 1
        if (prev.length >= maxDigits) return prev
        return prev + digit
      })
    },
    [isSubmitted, correctAnswer]
  )

  // Handle backspace
  const handleBackspace = useCallback(() => {
    if (isSubmitted) return
    setUserAnswer((prev) => prev.slice(0, -1))
  }, [isSubmitted])

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!userAnswer || isSubmitted || correctAnswer === undefined) return
    const numericAnswer = parseInt(userAnswer, 10)
    const correct = numericAnswer === correctAnswer
    setWasCorrect(correct)
    setIsSubmitted(true)
  }, [userAnswer, isSubmitted, correctAnswer])

  // Handle retry (reset state)
  const handleRetry = useCallback(() => {
    setUserAnswer('')
    setIsSubmitted(false)
    setWasCorrect(null)
  }, [])

  // Physical keyboard support
  const hasPhysicalKeyboard = useHasPhysicalKeyboard()
  const canAcceptInput = !isSubmitted && correctAnswer !== undefined

  useEffect(() => {
    if (!hasPhysicalKeyboard || !canAcceptInput) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle digit keys (0-9)
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        handleDigit(e.key)
        return
      }

      // Handle backspace
      if (e.key === 'Backspace') {
        e.preventDefault()
        handleBackspace()
        return
      }

      // Handle enter for submit
      if (e.key === 'Enter' && userAnswer) {
        e.preventDefault()
        handleSubmit()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [hasPhysicalKeyboard, canAcceptInput, handleDigit, handleBackspace, handleSubmit, userAnswer])

  // If no problem generated yet, show a message
  if (!problem) {
    return (
      <div
        data-component="practice-preview"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '1rem',
          maxWidth: '600px',
          margin: '0 auto',
        })}
      >
        <div
          data-element="preview-header"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.5rem',
            backgroundColor: isDark ? 'blue.900' : 'blue.50',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'blue.700' : 'blue.200',
          })}
        >
          <button
            type="button"
            data-action="back-to-browse"
            onClick={onBack}
            className={css({
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isDark ? 'gray.600' : 'gray.300',
              color: isDark ? 'white' : 'gray.800',
            })}
          >
            ← Back
          </button>
          <div
            className={css({
              flex: 1,
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: isDark ? 'blue.200' : 'blue.700',
            })}
          >
            Practice Preview - Problem #{problemNumber}
          </div>
        </div>
        <div
          className={css({
            padding: '2rem',
            textAlign: 'center',
            color: isDark ? 'gray.400' : 'gray.600',
            backgroundColor: isDark ? 'gray.800' : 'gray.100',
            borderRadius: '8px',
          })}
        >
          This problem hasn't been generated yet.
          <br />
          Problems are generated when reached in the session.
        </div>
      </div>
    )
  }

  return (
    <div
      data-component="practice-preview"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1rem',
        maxWidth: '600px',
        margin: '0 auto',
      })}
    >
      {/* Header with back button - hidden in inline mode */}
      {!inline && (
        <div
          data-element="preview-header"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.5rem',
            backgroundColor: isDark ? 'blue.900' : 'blue.50',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'blue.700' : 'blue.200',
          })}
        >
          <button
            type="button"
            data-action="back-to-browse"
            onClick={onBack}
            className={css({
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isDark ? 'gray.600' : 'gray.300',
              color: isDark ? 'white' : 'gray.800',
              transition: 'all 0.15s ease',
              _hover: {
                backgroundColor: isDark ? 'gray.500' : 'gray.400',
              },
            })}
          >
            ← Back
          </button>
          <div
            className={css({
              flex: 1,
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: isDark ? 'blue.200' : 'blue.700',
            })}
          >
            Practice Preview - Problem #{problemNumber}
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'blue.300' : 'blue.600',
              padding: '0.25rem 0.5rem',
              backgroundColor: isDark ? 'blue.800' : 'blue.100',
              borderRadius: '4px',
            })}
          >
            {part.type}
          </div>
        </div>
      )}

      {/* Debug info - hidden in inline mode */}
      {!inline && (
        <div
          data-element="debug-info"
          className={css({
            fontSize: '0.75rem',
            color: isDark ? 'gray.400' : 'gray.500',
            padding: '0.5rem',
            backgroundColor: isDark ? 'gray.800' : 'gray.100',
            borderRadius: '4px',
            fontFamily: 'monospace',
          })}
        >
          Answer: {correctAnswer} | Format: {part.format} | Purpose: {slot.purpose}
        </div>
      )}

      {/* Problem display */}
      <div
        data-element="problem-area"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '2rem',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '12px',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <VerticalProblem
          terms={problem.terms}
          userAnswer={userAnswer}
          isCompleted={isSubmitted}
          correctAnswer={correctAnswer}
          size="large"
          generationTrace={problem.generationTrace}
        />

        {/* Feedback */}
        {isSubmitted && (
          <div
            data-element="feedback"
            className={css({
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              backgroundColor: wasCorrect
                ? isDark
                  ? 'green.900'
                  : 'green.100'
                : isDark
                  ? 'red.900'
                  : 'red.100',
              color: wasCorrect
                ? isDark
                  ? 'green.200'
                  : 'green.700'
                : isDark
                  ? 'red.200'
                  : 'red.700',
              border: '2px solid',
              borderColor: wasCorrect
                ? isDark
                  ? 'green.700'
                  : 'green.300'
                : isDark
                  ? 'red.700'
                  : 'red.300',
            })}
          >
            {wasCorrect ? '✓ Correct!' : `✗ Incorrect (answer: ${correctAnswer})`}
          </div>
        )}
      </div>

      {/* Input area */}
      {!isSubmitted && (
        <div
          data-element="input-area"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center',
          })}
        >
          {/* Current answer display */}
          <div
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              minHeight: '3rem',
              padding: '0.5rem 1rem',
              backgroundColor: isDark ? 'gray.700' : 'gray.100',
              borderRadius: '8px',
              minWidth: '120px',
              textAlign: 'center',
              color: isDark ? 'white' : 'gray.900',
            })}
          >
            {userAnswer || '_'}
          </div>

          {/* Numpad */}
          <NumericKeypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={handleSubmit}
            disabled={!userAnswer}
            showSubmitButton={true}
          />
        </div>
      )}

      {/* After submit - retry button */}
      {isSubmitted && (
        <div
          data-element="retry-area"
          className={css({
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
          })}
        >
          <button
            type="button"
            data-action="retry"
            onClick={handleRetry}
            className={css({
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isDark ? 'blue.600' : 'blue.500',
              color: 'white',
              transition: 'all 0.15s ease',
              _hover: {
                backgroundColor: isDark ? 'blue.500' : 'blue.600',
              },
            })}
          >
            Try Again
          </button>
          {!inline && (
            <button
              type="button"
              data-action="back-after-submit"
              onClick={onBack}
              className={css({
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: isDark ? 'gray.500' : 'gray.400',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: isDark ? 'gray.300' : 'gray.600',
                transition: 'all 0.15s ease',
                _hover: {
                  backgroundColor: isDark ? 'gray.700' : 'gray.100',
                },
              })}
            >
              Back to Browse
            </button>
          )}
        </div>
      )}

      {/* Abacus dock - hidden in inline mode */}
      {!inline && <AbacusDock />}
    </div>
  )
}
