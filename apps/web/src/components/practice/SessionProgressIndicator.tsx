/**
 * Session Progress Indicator Component
 *
 * A unified progress display that shows:
 * - Discrete problem slots grouped by section (abacus, visualization, linear)
 * - Completion status for each problem (correct/incorrect/pending)
 * - Current position in the session
 * - Time remaining estimate
 *
 * Features:
 * - Collapsed mode: completed sections show as compact summaries
 * - Expanded mode (browse): all sections show individual slots for navigation
 * - Smooth transitions between states
 * - Click-to-navigate in browse mode
 */

'use client'

import { useMemo } from 'react'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'

export interface SessionProgressIndicatorProps {
  /** Session parts with their slots */
  parts: SessionPart[]
  /** Completed results */
  results: SlotResult[]
  /** Current part index */
  currentPartIndex: number
  /** Current slot index within the part */
  currentSlotIndex: number
  /** Whether browse mode is active (enables navigation) */
  isBrowseMode: boolean
  /** Callback when clicking a problem in browse mode */
  onNavigate?: (linearIndex: number) => void
  /** Dark mode */
  isDark: boolean
  /** Compact mode for smaller screens */
  compact?: boolean
}

function getPartEmoji(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return '🧮'
    case 'visualization':
      return '🧠'
    case 'linear':
      return '💭'
  }
}

function getPartLabel(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return 'Abacus'
    case 'visualization':
      return 'Visual'
    case 'linear':
      return 'Mental'
  }
}

/**
 * Get result for a specific slot
 */
function getSlotResult(
  results: SlotResult[],
  partNumber: number,
  slotIndex: number
): SlotResult | undefined {
  return results.find((r) => r.partNumber === partNumber && r.slotIndex === slotIndex)
}

/**
 * Collapsed section summary - shows section as compact badge
 * For completed sections: shows ✓count (green if all correct)
 * For future sections: shows just the count (gray)
 */
function CollapsedSection({
  part,
  results,
  linearOffset,
  isDark,
  isBrowseMode,
  onNavigate,
  isCompleted,
}: {
  part: SessionPart
  results: SlotResult[]
  linearOffset: number
  isDark: boolean
  isBrowseMode: boolean
  onNavigate?: (linearIndex: number) => void
  isCompleted: boolean
}) {
  const completedCount = part.slots.filter((_, i) =>
    getSlotResult(results, part.partNumber, i)
  ).length
  const correctCount = part.slots.filter((_, i) => {
    const result = getSlotResult(results, part.partNumber, i)
    return result?.isCorrect
  }).length
  const allCorrect = isCompleted && correctCount === part.slots.length
  const totalCount = part.slots.length

  // In browse mode, expand to show individual slots
  if (isBrowseMode) {
    return (
      <ExpandedSection
        part={part}
        results={results}
        linearOffset={linearOffset}
        currentLinearIndex={-1}
        isDark={isDark}
        isBrowseMode={true}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <div
      data-element="collapsed-section"
      data-part-type={part.type}
      data-status={isCompleted ? 'completed' : 'future'}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.25rem 0.5rem',
        borderRadius: '6px',
        backgroundColor: allCorrect
          ? isDark
            ? 'green.900/60'
            : 'green.100'
          : isDark
            ? 'gray.700'
            : 'gray.200',
        border: '1px solid',
        borderColor: allCorrect
          ? isDark
            ? 'green.700'
            : 'green.300'
          : isDark
            ? 'gray.600'
            : 'gray.300',
        flexShrink: 0,
        transition: 'all 0.2s ease',
      })}
    >
      <span className={css({ fontSize: '0.875rem' })}>{getPartEmoji(part.type)}</span>
      <span
        className={css({
          fontSize: '0.75rem',
          fontWeight: 'bold',
          color: allCorrect
            ? isDark
              ? 'green.300'
              : 'green.700'
            : isDark
              ? 'gray.300'
              : 'gray.600',
        })}
      >
        {isCompleted ? `✓${completedCount}` : totalCount}
      </span>
    </div>
  )
}

/**
 * Expanded section - shows individual problem slots
 */
function ExpandedSection({
  part,
  results,
  linearOffset,
  currentLinearIndex,
  isDark,
  isBrowseMode,
  onNavigate,
}: {
  part: SessionPart
  results: SlotResult[]
  linearOffset: number
  currentLinearIndex: number
  isDark: boolean
  isBrowseMode: boolean
  onNavigate?: (linearIndex: number) => void
}) {
  return (
    <div
      data-element="expanded-section"
      data-part-type={part.type}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.125rem',
        borderRadius: '6px',
        backgroundColor: isDark ? 'gray.800/50' : 'gray.100/50',
        transition: 'all 0.2s ease',
      })}
    >
      {/* Section emoji */}
      <span
        className={css({
          fontSize: '0.75rem',
          padding: '0 0.25rem',
          flexShrink: 0,
        })}
        title={getPartLabel(part.type)}
      >
        {getPartEmoji(part.type)}
      </span>

      {/* Individual slots */}
      {part.slots.map((_, slotIndex) => {
        const linearIndex = linearOffset + slotIndex
        const result = getSlotResult(results, part.partNumber, slotIndex)
        const isCurrent = linearIndex === currentLinearIndex
        const isCompleted = result !== undefined
        const isCorrect = result?.isCorrect

        const isClickable = isBrowseMode && onNavigate

        return (
          <button
            key={slotIndex}
            type="button"
            data-slot-index={slotIndex}
            data-linear-index={linearIndex}
            data-status={
              isCurrent
                ? 'current'
                : isCompleted
                  ? isCorrect
                    ? 'correct'
                    : 'incorrect'
                  : 'pending'
            }
            onClick={isClickable ? () => onNavigate(linearIndex) : undefined}
            disabled={!isClickable}
            className={css({
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.625rem',
              fontWeight: isCurrent ? 'bold' : 'normal',
              borderRadius: '4px',
              border: '1px solid',
              cursor: isClickable ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
              // Current problem
              ...(isCurrent && {
                backgroundColor: isDark ? 'yellow.600' : 'yellow.400',
                borderColor: isDark ? 'yellow.500' : 'yellow.500',
                color: isDark ? 'yellow.100' : 'yellow.900',
                boxShadow: `0 0 0 2px ${isDark ? 'rgba(234, 179, 8, 0.3)' : 'rgba(234, 179, 8, 0.4)'}`,
              }),
              // Completed correct
              ...(!isCurrent &&
                isCompleted &&
                isCorrect && {
                  backgroundColor: isDark ? 'green.900' : 'green.100',
                  borderColor: isDark ? 'green.700' : 'green.300',
                  color: isDark ? 'green.300' : 'green.700',
                }),
              // Completed incorrect
              ...(!isCurrent &&
                isCompleted &&
                !isCorrect && {
                  backgroundColor: isDark ? 'red.900' : 'red.100',
                  borderColor: isDark ? 'red.700' : 'red.300',
                  color: isDark ? 'red.300' : 'red.700',
                }),
              // Pending
              ...(!isCurrent &&
                !isCompleted && {
                  backgroundColor: isDark ? 'gray.700' : 'gray.200',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  color: isDark ? 'gray.400' : 'gray.500',
                }),
              // Hover effect in browse mode
              ...(isClickable && {
                _hover: {
                  transform: 'scale(1.15)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                },
              }),
            })}
            title={isBrowseMode ? `Go to problem ${linearIndex + 1}` : undefined}
          >
            {isBrowseMode ? linearIndex + 1 : isCompleted ? (isCorrect ? '✓' : '✗') : '○'}
          </button>
        )
      })}
    </div>
  )
}

export function SessionProgressIndicator({
  parts,
  results,
  currentPartIndex,
  currentSlotIndex,
  isBrowseMode,
  onNavigate,
  isDark,
  compact = false,
}: SessionProgressIndicatorProps) {
  // Calculate linear index for current position
  const currentLinearIndex = useMemo(() => {
    let index = 0
    for (let i = 0; i < currentPartIndex; i++) {
      index += parts[i].slots.length
    }
    return index + currentSlotIndex
  }, [parts, currentPartIndex, currentSlotIndex])

  // Track linear offset for each part
  let linearOffset = 0

  return (
    <div
      data-component="session-progress-indicator"
      data-browse-mode={isBrowseMode}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '0.375rem' : '0.5rem',
        padding: compact ? '0.25rem' : '0.375rem',
        backgroundColor: isDark ? 'gray.800' : 'gray.100',
        borderRadius: '8px',
        overflow: 'hidden',
        minHeight: '36px',
      })}
    >
      {/* Section indicators */}
      <div
        data-element="sections"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          // Hide scrollbar but allow scrolling
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        })}
      >
        {parts.map((part, partIndex) => {
          const partLinearOffset = linearOffset
          linearOffset += part.slots.length

          const isCurrentPart = partIndex === currentPartIndex
          const isCompletedPart = partIndex < currentPartIndex
          const isFuturePart = partIndex > currentPartIndex

          // In browse mode: always expanded
          // In practice mode: collapse non-current sections (both completed and future)
          const shouldCollapse = !isBrowseMode && !isCurrentPart

          return (
            <div
              key={part.partNumber}
              className={css({ display: 'flex', alignItems: 'center', gap: '0.25rem' })}
            >
              {/* Part separator for non-first parts */}
              {partIndex > 0 && (
                <div
                  className={css({
                    width: '1px',
                    height: '20px',
                    backgroundColor: isDark ? 'gray.600' : 'gray.300',
                    flexShrink: 0,
                  })}
                />
              )}

              {shouldCollapse ? (
                <CollapsedSection
                  part={part}
                  results={results}
                  linearOffset={partLinearOffset}
                  isDark={isDark}
                  isBrowseMode={isBrowseMode}
                  onNavigate={onNavigate}
                  isCompleted={isCompletedPart}
                />
              ) : (
                <ExpandedSection
                  part={part}
                  results={results}
                  linearOffset={partLinearOffset}
                  currentLinearIndex={currentLinearIndex}
                  isDark={isDark}
                  isBrowseMode={isBrowseMode}
                  onNavigate={onNavigate}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SessionProgressIndicator
