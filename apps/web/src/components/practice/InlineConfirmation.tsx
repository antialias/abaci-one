'use client'

import { css } from '../../../styled-system/css'

interface InlineConfirmationProps {
  /** Warning message to display */
  message: string
  /** Called when user confirms the action */
  onConfirm: () => void
  /** Called when user cancels */
  onCancel: () => void
  /** Whether the mutation is in progress */
  isPending: boolean
  /** Dark mode */
  isDark: boolean
  /** Compact sizing */
  compact?: boolean
}

/**
 * InlineConfirmation — lightweight confirmation strip that replaces a row's content.
 * No modal overlay; keeps context visible.
 */
export function InlineConfirmation({
  message,
  onConfirm,
  onCancel,
  isPending,
  isDark,
  compact = false,
}: InlineConfirmationProps) {
  return (
    <div
      data-element="inline-confirmation"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '8px' : '10px',
        padding: compact ? '6px 8px' : '8px 10px',
        borderRadius: '6px',
        backgroundColor: isDark ? 'red.900/30' : 'red.50',
        border: '1px solid',
        borderColor: isDark ? 'red.800' : 'red.200',
        animation: 'fadeIn 0.15s ease-out',
      })}
    >
      <span
        className={css({
          flex: 1,
          fontSize: compact ? '0.75rem' : '0.8125rem',
          color: isDark ? 'red.200' : 'red.800',
          lineHeight: '1.3',
        })}
      >
        {message}
      </span>

      <div className={css({ display: 'flex', gap: '6px', flexShrink: 0 })}>
        <button
          type="button"
          data-action="cancel-confirmation"
          onClick={onCancel}
          disabled={isPending}
          className={css({
            padding: compact ? '3px 8px' : '4px 10px',
            borderRadius: '4px',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.300',
            backgroundColor: 'transparent',
            color: isDark ? 'gray.300' : 'gray.600',
            fontSize: compact ? '0.6875rem' : '0.75rem',
            cursor: 'pointer',
            _hover: { backgroundColor: isDark ? 'gray.700' : 'gray.100' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          Cancel
        </button>

        <button
          type="button"
          data-action="confirm-action"
          onClick={onConfirm}
          disabled={isPending}
          className={css({
            padding: compact ? '3px 8px' : '4px 10px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: isDark ? 'red.700' : 'red.600',
            color: 'white',
            fontSize: compact ? '0.6875rem' : '0.75rem',
            fontWeight: 'medium',
            cursor: 'pointer',
            _hover: { backgroundColor: isDark ? 'red.600' : 'red.700' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {isPending ? 'Removing...' : 'Remove'}
        </button>
      </div>
    </div>
  )
}
