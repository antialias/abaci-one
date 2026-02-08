'use client'

import { useEffect, useState } from 'react'
import { css, cx } from '../../../styled-system/css'
import type { AssistanceMachineState } from './hooks/useProgressiveAssistance'

interface ProgressiveAssistanceUIProps {
  machineState: AssistanceMachineState
  showWrongAnswerSuggestion: boolean
  isDark: boolean
  onHelpRequested: () => void
  onSkip: () => void
  onDismissWrongAnswerSuggestion: () => void
}

export function ProgressiveAssistanceUI({
  machineState,
  showWrongAnswerSuggestion,
  isDark,
  onHelpRequested,
  onSkip,
  onDismissWrongAnswerSuggestion,
}: ProgressiveAssistanceUIProps) {
  const { state } = machineState

  // Track fade-in for encouragement text
  const [encourageVisible, setEncourageVisible] = useState(false)
  useEffect(() => {
    if (state === 'encouraging' || state === 'offeringHelp') {
      // Small delay before fading in
      const id = setTimeout(() => setEncourageVisible(true), 50)
      return () => clearTimeout(id)
    }
    setEncourageVisible(false)
  }, [state])

  // Don't render anything during help mode or auto-paused (those have their own UI)
  if (state === 'inHelp' || state === 'autoPaused') {
    return null
  }

  return (
    <div
      data-component="progressive-assistance"
      data-state={state}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        minHeight: '2.5rem',
      })}
    >
      {/* Encouragement text */}
      {(state === 'encouraging' || state === 'offeringHelp') && (
        <div
          data-element="encouragement"
          className={css({
            fontSize: '0.875rem',
            fontWeight: '500',
            color: isDark ? 'blue.300' : 'blue.600',
            opacity: encourageVisible ? 1 : 0,
            transition: 'opacity 0.5s ease',
            textAlign: 'center',
          })}
        >
          Give it a try!
        </div>
      )}

      {/* Help button */}
      {state === 'offeringHelp' && (
        <button
          type="button"
          data-action="request-help"
          onClick={onHelpRequested}
          className={css({
            padding: '0.5rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            borderRadius: '20px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: isDark ? 'blue.700' : 'blue.100',
            color: isDark ? 'blue.100' : 'blue.700',
            transition: 'all 0.2s ease',
            _hover: {
              backgroundColor: isDark ? 'blue.600' : 'blue.200',
              transform: 'scale(1.02)',
            },
          })}
        >
          I need help
        </button>
      )}

      {/* Wrong answer suggestion */}
      {showWrongAnswerSuggestion && (
        <div
          data-element="wrong-answer-suggestion"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 1rem',
            borderRadius: '12px',
            backgroundColor: isDark ? 'orange.900/60' : 'orange.50',
            border: '1px solid',
            borderColor: isDark ? 'orange.700' : 'orange.200',
          })}
        >
          <span
            className={css({
              fontSize: '0.8125rem',
              color: isDark ? 'orange.200' : 'orange.800',
            })}
          >
            This is tricky! Try using help to work through it step by step
          </span>
          <button
            type="button"
            data-action="wrong-answer-help"
            onClick={onHelpRequested}
            className={css({
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: '600',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isDark ? 'blue.700' : 'blue.500',
              color: 'white',
              whiteSpace: 'nowrap',
              _hover: {
                backgroundColor: isDark ? 'blue.600' : 'blue.600',
              },
            })}
          >
            Help
          </button>
          <button
            type="button"
            data-action="dismiss-suggestion"
            onClick={onDismissWrongAnswerSuggestion}
            className={css({
              padding: '0.125rem 0.375rem',
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              _hover: {
                color: isDark ? 'gray.200' : 'gray.700',
              },
            })}
            aria-label="Dismiss suggestion"
          >
            ×
          </button>
        </div>
      )}

      {/* Skip button — always visible but understated so kids find help first */}
      <button
        type="button"
        data-action="skip"
        onClick={onSkip}
        className={css({
          padding: '0.25rem 0.75rem',
          fontSize: '0.75rem',
          fontWeight: '400',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          backgroundColor: 'transparent',
          color: isDark ? 'gray.400' : 'gray.500',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          _hover: {
            color: isDark ? 'gray.300' : 'gray.700',
          },
        })}
      >
        skip
      </button>
    </div>
  )
}
