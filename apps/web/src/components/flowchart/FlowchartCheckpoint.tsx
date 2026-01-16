'use client'

import { useState, useRef, useEffect } from 'react'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'

interface FlowchartCheckpointProps {
  prompt: string
  inputType: 'number' | 'text' | 'two-numbers'
  onSubmit: (value: number | string | [number, number]) => void
  disabled?: boolean
  /** Labels for two-numbers inputs */
  inputLabels?: [string, string]
  /** Feedback after validation */
  feedback?: {
    correct: boolean
    expected?: number | string | [number, number]
    userAnswer?: number | string | [number, number]
  }
  /** Hint to show after repeated failures */
  hint?: string
}

/**
 * Checkpoint node UI - number/text input with validation
 */
export function FlowchartCheckpoint({
  prompt,
  inputType,
  onSubmit,
  disabled = false,
  inputLabels = ['First', 'Second'],
  feedback,
  hint,
}: FlowchartCheckpointProps) {
  const [value, setValue] = useState('')
  const [value1, setValue1] = useState('')
  const [value2, setValue2] = useState('')
  const input2Ref = useRef<HTMLInputElement>(null)

  // Auto-submit for two-numbers when both values are filled
  useEffect(() => {
    if (inputType !== 'two-numbers' || disabled || feedback) return

    const num1 = parseFloat(value1)
    const num2 = parseFloat(value2)

    // Only auto-submit if both are valid integers (denominators should be whole numbers)
    if (
      value1.trim() &&
      value2.trim() &&
      !isNaN(num1) &&
      !isNaN(num2) &&
      Number.isInteger(num1) &&
      Number.isInteger(num2)
    ) {
      // Small delay so the user sees what they typed
      const timeout = setTimeout(() => {
        onSubmit([num1, num2])
      }, 150)
      return () => clearTimeout(timeout)
    }
  }, [value1, value2, inputType, disabled, feedback, onSubmit])

  const handleSubmit = () => {
    if (inputType === 'two-numbers') {
      if (!value1.trim() || !value2.trim()) return
      const num1 = parseFloat(value1)
      const num2 = parseFloat(value2)
      if (!isNaN(num1) && !isNaN(num2)) {
        onSubmit([num1, num2])
      }
    } else if (inputType === 'number') {
      if (!value.trim()) return
      const num = parseFloat(value)
      if (!isNaN(num)) {
        onSubmit(num)
      }
    } else {
      if (!value.trim()) return
      onSubmit(value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, isFirstOfTwo?: boolean) => {
    if (e.key === 'Enter') {
      if (isFirstOfTwo && input2Ref.current) {
        // Move to second input
        input2Ref.current.focus()
      } else {
        handleSubmit()
      }
    }
  }

  const canSubmit =
    inputType === 'two-numbers' ? value1.trim() && value2.trim() : value.trim()

  // Check which inputs are wrong for two-numbers feedback
  const getTwoNumbersFeedback = () => {
    if (!feedback || inputType !== 'two-numbers') return { first: null, second: null }
    if (feedback.correct) return { first: true, second: true }

    const expected = feedback.expected as [number, number]
    const userAnswer = feedback.userAnswer as [number, number]

    return {
      first: userAnswer[0] === expected[0],
      second: userAnswer[1] === expected[1],
    }
  }

  const twoNumFeedback = getTwoNumbersFeedback()

  const inputStyle = (isCorrect: boolean | null) =>
    css({
      width: '80px',
      padding: '3',
      fontSize: 'xl',
      fontWeight: 'bold',
      textAlign: 'center',
      borderRadius: 'lg',
      border: '2px solid',
      borderColor:
        isCorrect === null
          ? { base: 'gray.300', _dark: 'gray.600' }
          : isCorrect
            ? { base: 'green.500', _dark: 'green.400' }
            : { base: 'red.500', _dark: 'red.400' },
      backgroundColor:
        isCorrect === null
          ? { base: 'white', _dark: 'gray.800' }
          : isCorrect
            ? { base: 'green.50', _dark: 'green.900' }
            : { base: 'red.50', _dark: 'red.900' },
      color: { base: 'gray.900', _dark: 'gray.100' },
      outline: 'none',
      _focus: {
        borderColor: { base: 'blue.500', _dark: 'blue.400' },
        boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.3)',
      },
      _disabled: {
        opacity: 0.7,
        cursor: 'not-allowed',
      },
    })

  return (
    <div
      data-testid="checkpoint-container"
      data-input-type={inputType}
      data-has-feedback={!!feedback}
      data-feedback-correct={feedback?.correct}
      className={vstack({ gap: '4', alignItems: 'center' })}
    >
      {/* Prompt */}
      <p
        data-testid="checkpoint-prompt"
        className={css({
          fontSize: 'lg',
          fontWeight: 'medium',
          color: { base: 'gray.800', _dark: 'gray.200' },
          textAlign: 'center',
        })}
      >
        {prompt}
      </p>

      {/* Input area */}
      {inputType === 'two-numbers' ? (
        <div data-testid="checkpoint-two-numbers-row" className={vstack({ gap: '3' })}>
          <div className={hstack({ gap: '4', alignItems: 'center' })}>
            {/* First input with label */}
            <div className={vstack({ gap: '1', alignItems: 'center' })}>
              <label
                className={css({
                  fontSize: 'sm',
                  color: { base: 'gray.600', _dark: 'gray.400' },
                  fontWeight: 'medium',
                })}
              >
                {inputLabels[0]}
              </label>
              <input
                data-testid="checkpoint-input-1"
                type="number"
                value={value1}
                onChange={(e) => setValue1(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, true)}
                disabled={disabled}
                autoFocus
                className={inputStyle(feedback ? twoNumFeedback.first : null)}
              />
            </div>

            <span
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: { base: 'gray.400', _dark: 'gray.500' },
                marginTop: '6', // Align with inputs (below labels)
              })}
            >
              and
            </span>

            {/* Second input with label */}
            <div className={vstack({ gap: '1', alignItems: 'center' })}>
              <label
                className={css({
                  fontSize: 'sm',
                  color: { base: 'gray.600', _dark: 'gray.400' },
                  fontWeight: 'medium',
                })}
              >
                {inputLabels[1]}
              </label>
              <input
                ref={input2Ref}
                data-testid="checkpoint-input-2"
                type="number"
                value={value2}
                onChange={(e) => setValue2(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, false)}
                disabled={disabled}
                className={inputStyle(feedback ? twoNumFeedback.second : null)}
              />
            </div>
          </div>
          {/* No Check button - auto-submits when both values are entered */}
        </div>
      ) : (
        /* Original single input */
        <div data-testid="checkpoint-input-row" className={hstack({ gap: '3' })}>
          <input
            data-testid="checkpoint-input"
            type={inputType === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e)}
            disabled={disabled}
            autoFocus
            className={css({
              width: '120px',
              padding: '3',
              fontSize: 'xl',
              fontWeight: 'bold',
              textAlign: 'center',
              borderRadius: 'lg',
              border: '2px solid',
              borderColor: feedback
                ? feedback.correct
                  ? { base: 'green.500', _dark: 'green.400' }
                  : { base: 'red.500', _dark: 'red.400' }
                : { base: 'gray.300', _dark: 'gray.600' },
              backgroundColor: feedback
                ? feedback.correct
                  ? { base: 'green.50', _dark: 'green.900' }
                  : { base: 'red.50', _dark: 'red.900' }
                : { base: 'white', _dark: 'gray.800' },
              color: { base: 'gray.900', _dark: 'gray.100' },
              outline: 'none',
              _focus: {
                borderColor: { base: 'blue.500', _dark: 'blue.400' },
                boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.3)',
              },
              _disabled: {
                opacity: 0.7,
                cursor: 'not-allowed',
              },
            })}
          />
          <button
            data-testid="checkpoint-check-button"
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className={css({
              padding: '3 5',
              fontSize: 'lg',
              fontWeight: 'semibold',
              borderRadius: 'lg',
              backgroundColor: { base: 'blue.500', _dark: 'blue.600' },
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
              },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            })}
          >
            Check
          </button>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          data-testid="checkpoint-feedback"
          data-feedback-correct={feedback.correct}
          data-expected={
            Array.isArray(feedback.expected)
              ? feedback.expected.join(',')
              : feedback.expected
          }
          data-user-answer={
            Array.isArray(feedback.userAnswer)
              ? feedback.userAnswer.join(',')
              : feedback.userAnswer
          }
          className={css({
            padding: '3 4',
            borderRadius: 'md',
            backgroundColor: feedback.correct
              ? { base: 'green.100', _dark: 'green.800' }
              : { base: 'red.100', _dark: 'red.800' },
            color: feedback.correct
              ? { base: 'green.800', _dark: 'green.200' }
              : { base: 'red.800', _dark: 'red.200' },
            fontSize: 'md',
            fontWeight: 'medium',
          })}
        >
          {feedback.correct ? (
            <span>Correct!</span>
          ) : inputType === 'two-numbers' ? (
            <span>
              Not quite.
              {!twoNumFeedback.first && (
                <>
                  {' '}
                  First should be {(feedback.expected as [number, number])[0]}.
                </>
              )}
              {!twoNumFeedback.second && (
                <>
                  {' '}
                  Second should be {(feedback.expected as [number, number])[1]}.
                </>
              )}
            </span>
          ) : (
            <span>
              Not quite. You entered {String(feedback.userAnswer)}, but the answer is{' '}
              {String(feedback.expected)}.
            </span>
          )}
        </div>
      )}

      {/* Hint */}
      {hint && (
        <div
          data-testid="checkpoint-hint"
          className={css({
            padding: '3 4',
            borderRadius: 'md',
            backgroundColor: { base: 'purple.100', _dark: 'purple.800' },
            color: { base: 'purple.800', _dark: 'purple.200' },
            fontSize: 'sm',
          })}
        >
          {hint}
        </div>
      )}
    </div>
  )
}
