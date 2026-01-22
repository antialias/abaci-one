'use client'

import { useEffect, useRef } from 'react'
import type { StreamingStatus } from '@/lib/flowchart-workshop/state-machine'
import { css } from '../../../styled-system/css'
import { hstack } from '../../../styled-system/patterns'

interface GenerationProgressPanelProps {
  /** Whether the panel is expanded */
  isExpanded: boolean
  /** Toggle expanded state */
  onToggle: () => void
  /** Current streaming status */
  status: StreamingStatus
  /** Progress message to display */
  progressMessage: string | null
  /** Accumulated reasoning text from the LLM */
  reasoningText: string
  /** Callback to cancel the operation */
  onCancel?: () => void
}

/**
 * Panel showing LLM generation/refinement progress with reasoning display
 */
export function GenerationProgressPanel({
  isExpanded,
  onToggle,
  status,
  progressMessage,
  reasoningText,
  onCancel,
}: GenerationProgressPanelProps) {
  const reasoningRef = useRef<HTMLDivElement>(null)

  // Auto-scroll reasoning as it comes in
  useEffect(() => {
    if (reasoningRef.current && reasoningText) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight
    }
  }, [reasoningText])

  const isActive =
    status === 'connecting' ||
    status === 'reasoning' ||
    status === 'generating' ||
    status === 'validating'
  const isError = status === 'error'
  const isComplete = status === 'complete'
  const isCancelled = status === 'cancelled'

  return (
    <div
      data-component="generation-progress-panel"
      className={css({
        borderRadius: 'lg',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isError
          ? { base: 'red.300', _dark: 'red.700' }
          : isComplete
            ? { base: 'green.300', _dark: 'green.700' }
            : { base: 'blue.300', _dark: 'blue.700' },
        backgroundColor: isError
          ? { base: 'red.50', _dark: 'red.900/30' }
          : isComplete
            ? { base: 'green.50', _dark: 'green.900/30' }
            : { base: 'blue.50', _dark: 'blue.900/30' },
        transition: 'all 0.2s',
      })}
    >
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className={css({
          width: '100%',
          padding: '3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          border: 'none',
          backgroundColor: 'transparent',
          textAlign: 'left',
        })}
      >
        <div className={hstack({ gap: '3', alignItems: 'center' })}>
          {/* Status indicator */}
          <div
            className={css({
              width: '10px',
              height: '10px',
              borderRadius: 'full',
              backgroundColor: isError
                ? { base: 'red.500', _dark: 'red.400' }
                : isComplete
                  ? { base: 'green.500', _dark: 'green.400' }
                  : isCancelled
                    ? { base: 'gray.500', _dark: 'gray.400' }
                    : { base: 'blue.500', _dark: 'blue.400' },
              animation: isActive ? 'pulse 1.5s ease-in-out infinite' : 'none',
            })}
          />
          <span
            className={css({
              fontWeight: 'medium',
              fontSize: 'sm',
              color: isError
                ? { base: 'red.700', _dark: 'red.300' }
                : isComplete
                  ? { base: 'green.700', _dark: 'green.300' }
                  : { base: 'blue.700', _dark: 'blue.300' },
            })}
          >
            {progressMessage || getStatusLabel(status)}
          </span>
        </div>
        <div className={hstack({ gap: '2' })}>
          {isActive && onCancel && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCancel()
              }}
              className={css({
                paddingY: '1',
                paddingX: '2',
                fontSize: 'xs',
                borderRadius: 'md',
                backgroundColor: { base: 'red.100', _dark: 'red.900/50' },
                color: { base: 'red.700', _dark: 'red.300' },
                border: 'none',
                cursor: 'pointer',
                _hover: {
                  backgroundColor: { base: 'red.200', _dark: 'red.800' },
                },
              })}
            >
              Cancel
            </button>
          )}
          <span
            className={css({
              fontSize: 'sm',
              color: { base: 'gray.500', _dark: 'gray.400' },
              transition: 'transform 0.2s',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            })}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Expanded content - reasoning display */}
      {isExpanded && reasoningText && (
        <div
          ref={reasoningRef}
          className={css({
            padding: '3',
            paddingTop: '0',
            maxHeight: '200px',
            overflow: 'auto',
            borderTop: '1px solid',
            borderColor: isError
              ? { base: 'red.200', _dark: 'red.800' }
              : isComplete
                ? { base: 'green.200', _dark: 'green.800' }
                : { base: 'blue.200', _dark: 'blue.800' },
          })}
        >
          <p
            className={css({
              fontSize: 'xs',
              fontWeight: 'medium',
              color: { base: 'gray.500', _dark: 'gray.400' },
              marginBottom: '2',
            })}
          >
            AI Thinking:
          </p>
          <pre
            className={css({
              fontSize: 'xs',
              fontFamily: 'mono',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: { base: 'gray.700', _dark: 'gray.300' },
              lineHeight: '1.5',
            })}
          >
            {reasoningText}
          </pre>
        </div>
      )}

      {/* Show toggle hint when there's reasoning but panel is collapsed */}
      {!isExpanded && reasoningText && (
        <div
          className={css({
            paddingY: '2',
            paddingX: '3',
            paddingTop: '0',
            fontSize: 'xs',
            color: { base: 'gray.500', _dark: 'gray.400' },
          })}
        >
          Click to see AI thinking process...
        </div>
      )}
    </div>
  )
}

function getStatusLabel(status: StreamingStatus): string {
  switch (status) {
    case 'idle':
      return 'Ready'
    case 'connecting':
      return 'Connecting...'
    case 'reasoning':
      return 'AI is thinking...'
    case 'generating':
      return 'Generating output...'
    case 'validating':
      return 'Validating result...'
    case 'complete':
      return 'Complete!'
    case 'error':
      return 'Error'
    case 'cancelled':
      return 'Cancelled'
    default:
      return ''
  }
}
