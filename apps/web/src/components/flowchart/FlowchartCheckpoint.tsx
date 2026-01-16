'use client'

import { useState } from 'react'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'

interface FlowchartCheckpointProps {
  prompt: string
  inputType: 'number' | 'text'
  onSubmit: (value: number | string) => void
  disabled?: boolean
  /** Feedback after validation */
  feedback?: {
    correct: boolean
    expected?: number | string
    userAnswer?: number | string
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
  feedback,
  hint,
}: FlowchartCheckpointProps) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    if (!value.trim()) return
    if (inputType === 'number') {
      const num = parseFloat(value)
      if (!isNaN(num)) {
        onSubmit(num)
      }
    } else {
      onSubmit(value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div className={vstack({ gap: '4', alignItems: 'center' })}>
      {/* Prompt */}
      <p
        className={css({
          fontSize: 'lg',
          fontWeight: 'medium',
          color: { base: 'gray.800', _dark: 'gray.200' },
          textAlign: 'center',
        })}
      >
        {prompt}
      </p>

      {/* Input and button */}
      <div className={hstack({ gap: '3' })}>
        <input
          type={inputType === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
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

      {/* Feedback */}
      {feedback && (
        <div
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
