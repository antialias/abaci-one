'use client'

import type { DecisionOption } from '@/lib/flowcharts/schema'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'

interface FlowchartDecisionProps {
  options: DecisionOption[]
  onSelect: (value: string) => void
  disabled?: boolean
  /** Optional: show which option is correct after wrong answer */
  highlightCorrect?: string
  /** Optional: show which option was wrong */
  highlightWrong?: string
}

/**
 * Decision node UI - displays choice buttons for user to tap
 */
export function FlowchartDecision({
  options,
  onSelect,
  disabled = false,
  highlightCorrect,
  highlightWrong,
}: FlowchartDecisionProps) {
  return (
    <div className={hstack({ gap: '4', justifyContent: 'center', flexWrap: 'wrap' })}>
      {options.map((option) => {
        const isCorrect = highlightCorrect === option.value
        const isWrong = highlightWrong === option.value

        return (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            disabled={disabled}
            className={css({
              padding: '4 6',
              fontSize: 'lg',
              fontWeight: 'semibold',
              borderRadius: 'lg',
              border: '2px solid',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              minWidth: '120px',

              // Base styles
              backgroundColor: isCorrect
                ? { base: 'green.100', _dark: 'green.800' }
                : isWrong
                  ? { base: 'red.100', _dark: 'red.800' }
                  : { base: 'white', _dark: 'gray.800' },
              borderColor: isCorrect
                ? { base: 'green.500', _dark: 'green.400' }
                : isWrong
                  ? { base: 'red.500', _dark: 'red.400' }
                  : { base: 'gray.300', _dark: 'gray.600' },
              color: isCorrect
                ? { base: 'green.800', _dark: 'green.200' }
                : isWrong
                  ? { base: 'red.800', _dark: 'red.200' }
                  : { base: 'gray.800', _dark: 'gray.200' },

              // Hover
              _hover: disabled
                ? {}
                : {
                    backgroundColor: { base: 'blue.50', _dark: 'blue.900' },
                    borderColor: { base: 'blue.400', _dark: 'blue.500' },
                    transform: 'scale(1.02)',
                  },

              // Active
              _active: disabled
                ? {}
                : {
                    transform: 'scale(0.98)',
                  },

              // Disabled
              opacity: disabled && !isCorrect && !isWrong ? 0.5 : 1,
            })}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface FlowchartWrongAnswerFeedbackProps {
  message: string
  onRetry: () => void
}

/**
 * Feedback shown when user makes a wrong decision
 */
export function FlowchartWrongAnswerFeedback({
  message,
  onRetry,
}: FlowchartWrongAnswerFeedbackProps) {
  return (
    <div
      className={vstack({
        gap: '4',
        padding: '4',
        backgroundColor: { base: 'yellow.50', _dark: 'yellow.900' },
        borderRadius: 'lg',
        border: '2px solid',
        borderColor: { base: 'yellow.400', _dark: 'yellow.600' },
      })}
    >
      <p
        className={css({
          fontSize: 'md',
          color: { base: 'yellow.800', _dark: 'yellow.200' },
          textAlign: 'center',
        })}
      >
        {message}
      </p>
      <button
        onClick={onRetry}
        className={css({
          padding: '2 4',
          fontSize: 'md',
          fontWeight: 'medium',
          borderRadius: 'md',
          backgroundColor: { base: 'yellow.500', _dark: 'yellow.600' },
          color: 'white',
          cursor: 'pointer',
          transition: 'all 0.2s',
          _hover: {
            backgroundColor: { base: 'yellow.600', _dark: 'yellow.500' },
          },
        })}
      >
        Try again
      </button>
    </div>
  )
}
