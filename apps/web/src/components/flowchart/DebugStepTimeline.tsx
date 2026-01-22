'use client'

import { css } from '../../../styled-system/css'
import { hstack } from '../../../styled-system/patterns'
import type { FlowchartState } from '@/lib/flowcharts/schema'

interface TimelineStep {
  state: FlowchartState
  nodeTitle: string
}

interface DebugStepTimelineProps {
  /** All states in the timeline (history + current + redo) */
  steps: TimelineStep[]
  /** Index of current step */
  currentIndex: number
  /** Navigate to specific step */
  onNavigate: (index: number) => void
  /** Can go back */
  canGoBack: boolean
  /** Can go forward (redo stack has items) */
  canGoForward: boolean
  /** Can skip (not at terminal) */
  canSkip: boolean
  onBack: () => void
  onForward: () => void
  /** Skip/auto-advance through current node */
  onSkip: () => void
  /** Whether auto-advance is paused */
  autoAdvancePaused: boolean
  /** Toggle auto-advance pause */
  onToggleAutoAdvance: () => void
}

/**
 * DebugStepTimeline - A horizontal timeline showing all steps when visual debug is enabled.
 *
 * Shows:
 * - Past steps (green) - from stateHistory
 * - Current step (blue, highlighted)
 * - Future steps (gray) - from redoStack
 *
 * Users can click any step to jump directly to it.
 */
export function DebugStepTimeline({
  steps,
  currentIndex,
  onNavigate,
  canGoBack,
  canGoForward,
  canSkip,
  onBack,
  onForward,
  onSkip,
  autoAdvancePaused,
  onToggleAutoAdvance,
}: DebugStepTimelineProps) {
  if (steps.length === 0) return null

  return (
    <div
      data-testid="debug-step-timeline"
      data-current-index={currentIndex}
      data-step-count={steps.length}
      className={css({
        padding: '3',
        backgroundColor: { base: 'purple.50', _dark: 'purple.900/30' },
        borderRadius: 'lg',
        border: '2px dashed',
        borderColor: { base: 'purple.300', _dark: 'purple.700' },
      })}
    >
      {/* Header with nav buttons */}
      <div
        className={hstack({
          gap: '3',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2',
        })}
      >
        {/* Back button */}
        <button
          data-testid="debug-back-button"
          onClick={onBack}
          disabled={!canGoBack}
          className={css({
            paddingY: '1',
            paddingX: '2',
            fontSize: 'sm',
            fontWeight: 'medium',
            borderRadius: 'md',
            border: '1px solid',
            borderColor: { base: 'purple.300', _dark: 'purple.600' },
            backgroundColor: { base: 'white', _dark: 'purple.900' },
            color: canGoBack
              ? { base: 'purple.700', _dark: 'purple.300' }
              : { base: 'gray.400', _dark: 'gray.600' },
            cursor: canGoBack ? 'pointer' : 'not-allowed',
            opacity: canGoBack ? 1 : 0.5,
            transition: 'all 0.15s',
            _hover: canGoBack
              ? {
                  backgroundColor: { base: 'purple.100', _dark: 'purple.800' },
                }
              : {},
          })}
        >
          ← Prev
        </button>

        {/* Title and auto-advance toggle */}
        <div className={hstack({ gap: '3', alignItems: 'center' })}>
          <span
            className={css({
              fontSize: 'xs',
              fontWeight: 'semibold',
              color: { base: 'purple.700', _dark: 'purple.300' },
              textTransform: 'uppercase',
              letterSpacing: 'wide',
            })}
          >
            Debug ({currentIndex + 1}/{steps.length})
          </span>

          {/* Auto-advance toggle */}
          <button
            data-testid="debug-auto-advance-toggle"
            onClick={onToggleAutoAdvance}
            title={autoAdvancePaused ? 'Auto-advance is paused' : 'Auto-advance is enabled'}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '1',
              paddingY: '1',
              paddingX: '2',
              fontSize: '2xs',
              fontWeight: 'medium',
              borderRadius: 'md',
              border: '1px solid',
              cursor: 'pointer',
              transition: 'all 0.15s',
              borderColor: autoAdvancePaused
                ? { base: 'orange.400', _dark: 'orange.600' }
                : { base: 'gray.300', _dark: 'gray.600' },
              backgroundColor: autoAdvancePaused
                ? { base: 'orange.100', _dark: 'orange.900/50' }
                : { base: 'gray.100', _dark: 'gray.800' },
              color: autoAdvancePaused
                ? { base: 'orange.700', _dark: 'orange.300' }
                : { base: 'gray.600', _dark: 'gray.400' },
              _hover: {
                backgroundColor: autoAdvancePaused
                  ? { base: 'orange.200', _dark: 'orange.800/50' }
                  : { base: 'gray.200', _dark: 'gray.700' },
              },
            })}
          >
            <span>{autoAdvancePaused ? '⏸' : '▶'}</span>
            <span>Auto</span>
          </button>
        </div>

        {/* Navigation buttons */}
        <div className={hstack({ gap: '2' })}>
          {/* Forward button (redo) */}
          <button
            data-testid="debug-forward-button"
            onClick={onForward}
            disabled={!canGoForward}
            title="Redo - go forward to previously visited step"
            className={css({
              paddingY: '1',
              paddingX: '2',
              fontSize: 'sm',
              fontWeight: 'medium',
              borderRadius: 'md',
              border: '1px solid',
              borderColor: { base: 'purple.300', _dark: 'purple.600' },
              backgroundColor: { base: 'white', _dark: 'purple.900' },
              color: canGoForward
                ? { base: 'purple.700', _dark: 'purple.300' }
                : { base: 'gray.400', _dark: 'gray.600' },
              cursor: canGoForward ? 'pointer' : 'not-allowed',
              opacity: canGoForward ? 1 : 0.5,
              transition: 'all 0.15s',
              _hover: canGoForward
                ? {
                    backgroundColor: { base: 'purple.100', _dark: 'purple.800' },
                  }
                : {},
            })}
          >
            Redo
          </button>

          {/* Skip button (auto-advance) */}
          <button
            data-testid="debug-skip-button"
            onClick={onSkip}
            disabled={!canSkip}
            title="Skip - auto-answer and advance to next step"
            className={css({
              paddingY: '1',
              paddingX: '2',
              fontSize: 'sm',
              fontWeight: 'semibold',
              borderRadius: 'md',
              border: '1px solid',
              borderColor: { base: 'green.400', _dark: 'green.600' },
              backgroundColor: canSkip
                ? { base: 'green.500', _dark: 'green.600' }
                : { base: 'gray.200', _dark: 'gray.700' },
              color: canSkip ? 'white' : { base: 'gray.400', _dark: 'gray.600' },
              cursor: canSkip ? 'pointer' : 'not-allowed',
              opacity: canSkip ? 1 : 0.5,
              transition: 'all 0.15s',
              _hover: canSkip
                ? {
                    backgroundColor: { base: 'green.600', _dark: 'green.500' },
                  }
                : {},
            })}
          >
            Skip →
          </button>
        </div>
      </div>

      {/* Step timeline */}
      <div
        data-testid="debug-timeline-steps"
        className={css({
          display: 'flex',
          gap: '1',
          overflowX: 'auto',
          paddingY: '2',
          scrollbarWidth: 'thin',
        })}
      >
        {steps.map((step, idx) => {
          const isPast = idx < currentIndex
          const isCurrent = idx === currentIndex
          const isFuture = idx > currentIndex

          return (
            <button
              key={idx}
              data-testid={`debug-step-${idx}`}
              data-step-status={isCurrent ? 'current' : isPast ? 'past' : 'future'}
              onClick={() => onNavigate(idx)}
              title={`Step ${idx + 1}: ${step.nodeTitle}`}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '1',
                paddingY: '1',
                paddingX: '2',
                borderRadius: 'md',
                border: '2px solid',
                cursor: isCurrent ? 'default' : 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0,
                maxWidth: '150px',

                // Colors based on status
                backgroundColor: isCurrent
                  ? { base: 'blue.100', _dark: 'blue.800' }
                  : isPast
                    ? { base: 'green.50', _dark: 'green.900/50' }
                    : { base: 'gray.100', _dark: 'gray.800' },
                borderColor: isCurrent
                  ? { base: 'blue.500', _dark: 'blue.400' }
                  : isPast
                    ? { base: 'green.300', _dark: 'green.700' }
                    : { base: 'gray.300', _dark: 'gray.600' },
                color: isCurrent
                  ? { base: 'blue.800', _dark: 'blue.200' }
                  : isPast
                    ? { base: 'green.700', _dark: 'green.300' }
                    : { base: 'gray.500', _dark: 'gray.400' },

                // Hover states (only for non-current)
                _hover: isCurrent
                  ? {}
                  : {
                      backgroundColor: isPast
                        ? { base: 'green.100', _dark: 'green.800' }
                        : { base: 'gray.200', _dark: 'gray.700' },
                      borderColor: isPast
                        ? { base: 'green.400', _dark: 'green.600' }
                        : { base: 'gray.400', _dark: 'gray.500' },
                      transform: 'translateY(-1px)',
                    },
              })}
            >
              {/* Step number / icon */}
              <span
                className={css({
                  fontSize: '2xs',
                  fontWeight: 'bold',
                })}
              >
                {isPast ? '✓' : isCurrent ? '📍' : '○'}
              </span>

              {/* Step title (truncated) */}
              <span
                className={css({
                  fontSize: 'xs',
                  fontWeight: isCurrent ? 'semibold' : 'medium',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                })}
              >
                {step.nodeTitle.length > 12 ? `${step.nodeTitle.slice(0, 10)}…` : step.nodeTitle}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
