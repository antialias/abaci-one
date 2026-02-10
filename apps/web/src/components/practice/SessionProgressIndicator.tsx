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
import type { ProblemSlot, SessionPart, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { Tooltip } from '../ui/Tooltip'
import { formatMs } from './autoPauseCalculator'
import { extractTargetSkillName } from './PurposeBadge'
import { getPurposeColors, getPurposeConfig } from './purposeExplanations'

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
  /** Callback when clicking a completed problem to redo it */
  onRedoProblem?: (linearIndex: number, originalResult: SlotResult) => void
  /** Callback when clicking the current position during redo to return to it */
  onCancelRedo?: () => void
  /** Linear index of the problem currently being redone (shows pulsing highlight) */
  redoLinearIndex?: number
  /** Linear index of the problem observer is watching (shows cyan ring, undefined = live view) */
  observerViewingIndex?: number
  /** Dark mode */
  isDark: boolean
  /** Compact mode for smaller screens */
  compact?: boolean
  /** Whether game breaks are enabled (shows game break icons between parts) */
  gameBreakEnabled?: boolean
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
 * Game Break Icon - shown between parts when game breaks are enabled
 * Indicates an upcoming game break with animated glow as the student progresses
 */
interface GameBreakIconProps {
  /** Icon state based on position relative to current part */
  state: 'upcoming' | 'current' | 'passed'
  /** Progress through current part (0-100) - used for glow intensity */
  progressPercent: number
  /** Dark mode */
  isDark: boolean
}

function GameBreakIcon({ state, progressPercent, isDark }: GameBreakIconProps) {
  // Calculate glow intensity based on progress (only for current state)
  const glowIntensity = state === 'current' ? progressPercent / 100 : 0

  // Determine progress level for data attribute (used for styling)
  const progressLevel = progressPercent >= 75 ? 'high' : progressPercent >= 40 ? 'medium' : 'low'

  return (
    <div
      data-element="game-break-icon"
      data-state={state}
      data-progress={progressLevel}
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: '0.875rem',
        transition: 'all 0.3s ease',
        // Base styling
        opacity: state === 'upcoming' ? 0.4 : state === 'passed' ? 0.6 : 1,
        transform: state === 'upcoming' ? 'scale(0.8)' : 'scale(1)',
        // Passed state shows checkmark overlay effect
        position: 'relative',
      })}
      style={{
        // Dynamic glow for current state
        filter:
          state === 'current'
            ? `drop-shadow(0 0 ${glowIntensity * 8}px ${isDark ? '#fbbf24' : '#f59e0b'})`
            : undefined,
      }}
      title={
        state === 'passed'
          ? 'Game break completed'
          : state === 'current'
            ? 'Game break coming up!'
            : 'Future game break'
      }
    >
      <span
        className={css({
          // Pulse animation for current state at high progress
          animation:
            state === 'current' && progressPercent >= 60
              ? 'pulse 1.5s ease-in-out infinite'
              : undefined,
        })}
      >
        🎮
      </span>
      {/* Checkmark overlay for passed breaks */}
      {state === 'passed' && (
        <span
          className={css({
            position: 'absolute',
            bottom: '-2px',
            right: '-4px',
            fontSize: '0.5rem',
            color: isDark ? 'green.400' : 'green.600',
          })}
        >
          ✓
        </span>
      )}
      {/* Add keyframe animation via style tag */}
      {state === 'current' && progressPercent >= 60 && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.15); }
              }
            `,
          }}
        />
      )}
    </div>
  )
}

/**
 * Get the most recent result for a specific slot.
 * Returns the last matching result because results are appended chronologically,
 * so the last match is the most recent (e.g., a redo after the original).
 */
function getSlotResult(
  results: SlotResult[],
  partNumber: number,
  slotIndex: number
): SlotResult | undefined {
  // Iterate from end to find most recent result for this slot
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i]
    if (r.partNumber === partNumber && r.slotIndex === slotIndex) {
      return r
    }
  }
  return undefined
}

/**
 * Count total attempts for a specific slot from results.
 * Both student and observer views have parts + results, so this is the single
 * source of truth for attempt counts.
 */
function getAttemptCount(results: SlotResult[], partNumber: number, slotIndex: number): number {
  // Count all results for this slot (including retries and manual redos)
  return results.filter(
    (r) => r.partNumber === partNumber && (r.originalSlotIndex ?? r.slotIndex) === slotIndex
  ).length
}

/**
 * Tooltip content for an individual slot dot
 */
function SlotTooltipContent({
  slot,
  linearIndex,
  result,
}: {
  slot: ProblemSlot
  linearIndex: number
  result?: SlotResult
}) {
  const config = getPurposeConfig(slot.purpose)
  const skillName = extractTargetSkillName(slot)

  return (
    <div data-element="slot-tooltip">
      <div className={css({ fontWeight: 'bold', marginBottom: '0.25rem' })}>
        {config.emoji} {config.shortLabel} — Problem {linearIndex + 1}
      </div>
      {skillName && (
        <div className={css({ fontSize: '0.8125rem', color: 'gray.300' })}>
          Targeting: {skillName}
        </div>
      )}
      {slot.constraints.termCount && (
        <div className={css({ fontSize: '0.8125rem', color: 'gray.300' })}>
          Terms: {slot.constraints.termCount.min}–{slot.constraints.termCount.max}
        </div>
      )}
      {result && (
        <div
          className={css({
            fontSize: '0.8125rem',
            marginTop: '0.25rem',
            color: result.isCorrect ? 'green.300' : 'red.300',
          })}
        >
          {result.isCorrect ? '✓ Correct' : '✗ Incorrect'} — {formatMs(result.responseTimeMs)}
        </div>
      )}
    </div>
  )
}

/**
 * Tooltip content for a part header (emoji or collapsed badge)
 */
function PartTooltipContent({ part, results }: { part: SessionPart; results: SlotResult[] }) {
  const purposeCounts = { focus: 0, reinforce: 0, review: 0, challenge: 0 }
  for (const slot of part.slots) purposeCounts[slot.purpose]++

  const completed = part.slots.filter((_, i) => getSlotResult(results, part.partNumber, i)).length

  const purposeEntries = (
    Object.entries(purposeCounts) as [keyof typeof purposeCounts, number][]
  ).filter(([, count]) => count > 0)

  return (
    <div data-element="part-tooltip">
      <div className={css({ fontWeight: 'bold', marginBottom: '0.25rem' })}>
        {getPartEmoji(part.type)} {getPartLabel(part.type)} — {part.slots.length} problems
        {part.estimatedMinutes > 0 && `, ~${part.estimatedMinutes} min`}
      </div>
      <div className={css({ fontSize: '0.8125rem', color: 'gray.300', marginBottom: '0.125rem' })}>
        {purposeEntries
          .map(([purpose, count]) => {
            const config = getPurposeConfig(purpose)
            return `${config.emoji}×${count}`
          })
          .join('  ')}
      </div>
      <div className={css({ fontSize: '0.8125rem', color: 'gray.400' })}>
        {completed} of {part.slots.length} completed
      </div>
    </div>
  )
}

/**
 * Collapsed section summary - shows section as compact badge
 * For completed sections: shows ✓count (green if all correct)
 * For future sections: shows just the count (gray)
 */
function CollapsedSection({
  part,
  partIndex,
  results,
  linearOffset,
  isDark,
  isBrowseMode,
  onNavigate,
  onRedoProblem,
  onCancelRedo,
  redoLinearIndex,
  observerViewingIndex,
  isCompleted,
}: {
  part: SessionPart
  partIndex: number
  results: SlotResult[]
  linearOffset: number
  isDark: boolean
  isBrowseMode: boolean
  onNavigate?: (linearIndex: number) => void
  onRedoProblem?: (linearIndex: number, originalResult: SlotResult) => void
  onCancelRedo?: () => void
  redoLinearIndex?: number
  observerViewingIndex?: number
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
        partIndex={partIndex}
        results={results}
        linearOffset={linearOffset}
        currentLinearIndex={-1}
        isDark={isDark}
        isBrowseMode={true}
        onNavigate={onNavigate}
        onRedoProblem={onRedoProblem}
        onCancelRedo={onCancelRedo}
        redoLinearIndex={redoLinearIndex}
        observerViewingIndex={observerViewingIndex}
      />
    )
  }

  return (
    <Tooltip
      content={<PartTooltipContent part={part} results={results} />}
      side="bottom"
      delayDuration={300}
    >
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
    </Tooltip>
  )
}

/**
 * Expanded section - shows individual problem slots
 */
function ExpandedSection({
  part,
  partIndex,
  results,
  linearOffset,
  currentLinearIndex,
  isDark,
  isBrowseMode,
  onNavigate,
  onRedoProblem,
  onCancelRedo,
  redoLinearIndex,
  observerViewingIndex,
}: {
  part: SessionPart
  partIndex: number
  results: SlotResult[]
  linearOffset: number
  currentLinearIndex: number
  isDark: boolean
  isBrowseMode: boolean
  onNavigate?: (linearIndex: number) => void
  onRedoProblem?: (linearIndex: number, originalResult: SlotResult) => void
  onCancelRedo?: () => void
  redoLinearIndex?: number
  observerViewingIndex?: number
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
      <Tooltip
        content={<PartTooltipContent part={part} results={results} />}
        side="bottom"
        delayDuration={300}
      >
        <span
          className={css({
            fontSize: '0.75rem',
            padding: '0 0.25rem',
            flexShrink: 0,
            cursor: 'help',
          })}
        >
          {getPartEmoji(part.type)}
        </span>
      </Tooltip>

      {/* Individual slots */}
      {part.slots.map((slot, slotIndex) => {
        const linearIndex = linearOffset + slotIndex
        const result = getSlotResult(results, part.partNumber, slotIndex)
        const purposeColors = getPurposeColors(slot.purpose, isDark)
        const isCurrent = linearIndex === currentLinearIndex
        const isRedo = linearIndex === redoLinearIndex
        const isObserverViewing = linearIndex === observerViewingIndex
        const isCompleted = result !== undefined
        const isCorrect = result?.isCorrect

        // Count attempts from results - both student and observer views have this data
        const attemptCount = getAttemptCount(results, part.partNumber, slotIndex)
        const hasRetried = attemptCount > 1

        // Clickable in browse mode for navigation, or on completed problems for redo
        // During redo mode, clicking another completed problem switches to redoing that one
        // During redo mode, clicking the current position returns to it (cancels redo)
        const isInRedoMode = redoLinearIndex !== undefined
        const isClickableForBrowse = isBrowseMode && onNavigate
        const isClickableForRedo =
          !isBrowseMode && isCompleted && !isRedo && onRedoProblem && result
        const isClickableToReturn = !isBrowseMode && isInRedoMode && isCurrent && onCancelRedo
        const isClickable = isClickableForBrowse || isClickableForRedo || isClickableToReturn

        // Handle click - browse navigation, redo, or return from redo
        const handleClick = () => {
          if (isClickableForBrowse) {
            onNavigate!(linearIndex)
          } else if (isClickableToReturn) {
            onCancelRedo!()
          } else if (isClickableForRedo && result) {
            onRedoProblem!(linearIndex, result)
          }
        }

        return (
          <Tooltip
            key={slotIndex}
            content={<SlotTooltipContent slot={slot} linearIndex={linearIndex} result={result} />}
            side="bottom"
            delayDuration={400}
          >
            <div
              className={css({
                position: 'relative',
                display: 'inline-block',
              })}
            >
              <button
                type="button"
                data-slot-index={slotIndex}
                data-linear-index={linearIndex}
                data-attempt-count={attemptCount}
                data-clickable-for-redo={isClickableForRedo || undefined}
                data-redo={isRedo || undefined}
                data-observer-viewing={isObserverViewing || undefined}
                data-status={
                  isRedo
                    ? 'redo'
                    : isCurrent
                      ? 'current'
                      : isCompleted
                        ? isCorrect
                          ? 'correct'
                          : 'incorrect'
                        : 'pending'
                }
                onClick={isClickable ? handleClick : undefined}
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
                  // Problem being redone (pulsing orange)
                  ...(isRedo && {
                    backgroundColor: isDark ? 'orange.600' : 'orange.400',
                    borderColor: isDark ? 'orange.500' : 'orange.500',
                    color: isDark ? 'orange.100' : 'orange.900',
                    boxShadow: `0 0 0 3px ${isDark ? 'rgba(251, 146, 60, 0.5)' : 'rgba(249, 115, 22, 0.5)'}`,
                    animation: 'redoPulse 1.5s ease-in-out infinite',
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
                  // Pending - purpose-colored border
                  ...(!isCurrent &&
                    !isCompleted && {
                      backgroundColor: isDark ? 'gray.700' : 'gray.200',
                      borderColor: purposeColors.border,
                      color: isDark ? 'gray.400' : 'gray.500',
                    }),
                  // Hover effect in browse mode or redo mode
                  ...(isClickable && {
                    _hover: {
                      transform: 'scale(1.15)',
                      boxShadow: isClickableForRedo
                        ? `0 0 0 2px ${isDark ? 'rgba(251, 146, 60, 0.5)' : 'rgba(249, 115, 22, 0.4)'}, 0 2px 4px rgba(0,0,0,0.2)`
                        : '0 2px 4px rgba(0,0,0,0.2)',
                    },
                  }),
                  // Observer viewing indicator (cyan ring) - shows which problem observer is watching
                  ...(isObserverViewing && {
                    outline: '2px solid',
                    outlineColor: isDark ? 'cyan.400' : 'cyan.500',
                    outlineOffset: '2px',
                  }),
                })}
                title={undefined}
              >
                {isBrowseMode ? linearIndex + 1 : isCompleted ? (isCorrect ? '✓' : '✗') : '○'}
              </button>
              {/* Retry attempt badge */}
              {hasRetried && (
                <span
                  data-element="retry-badge"
                  className={css({
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '12px',
                    height: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.5rem',
                    fontWeight: 'bold',
                    borderRadius: '50%',
                    backgroundColor: isDark ? 'orange.600' : 'orange.500',
                    color: 'white',
                    border: '1px solid',
                    borderColor: isDark ? 'orange.400' : 'orange.600',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  })}
                  title={`Attempt ${attemptCount} of 3`}
                >
                  {attemptCount}
                </span>
              )}
              {/* Redo pulse animation */}
              {isRedo && (
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes redoPulse {
                      0%, 100% { box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.5); }
                      50% { box-shadow: 0 0 0 5px rgba(251, 146, 60, 0.8), 0 0 8px rgba(251, 146, 60, 0.6); }
                    }
                  `,
                  }}
                />
              )}
            </div>
          </Tooltip>
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
  onRedoProblem,
  onCancelRedo,
  redoLinearIndex,
  observerViewingIndex,
  isDark,
  compact = false,
  gameBreakEnabled = false,
}: SessionProgressIndicatorProps) {
  // Calculate linear index for current position
  const currentLinearIndex = useMemo(() => {
    let index = 0
    for (let i = 0; i < currentPartIndex; i++) {
      index += parts[i].slots.length
    }
    return index + currentSlotIndex
  }, [parts, currentPartIndex, currentSlotIndex])

  // Calculate progress through current part (for game break icon glow)
  const currentPartProgress = useMemo(() => {
    const currentPart = parts[currentPartIndex]
    if (!currentPart || currentPart.slots.length === 0) return 0
    return (currentSlotIndex / currentPart.slots.length) * 100
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
        minWidth: 0, // Allow shrinking in flex container
        flex: 1,
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
          minWidth: 0, // Allow shrinking in flex container
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

          // Determine if we should show a game break icon AFTER this part
          // Only show between parts (not after the last part)
          const showGameBreakAfter = gameBreakEnabled && partIndex < parts.length - 1

          // Game break icon state for the icon after this part
          const gameBreakState: 'upcoming' | 'current' | 'passed' = isCompletedPart
            ? 'passed'
            : isCurrentPart
              ? 'current'
              : 'upcoming'

          return (
            <div
              key={part.partNumber}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              })}
            >
              {/* Part separator for non-first parts (when game breaks disabled) */}
              {partIndex > 0 && !gameBreakEnabled && (
                <div
                  className={css({
                    width: '1px',
                    height: '20px',
                    backgroundColor: isDark ? 'gray.600' : 'gray.300',
                    flexShrink: 0,
                  })}
                />
              )}

              {/* Game break icon BEFORE this part (from previous part) */}
              {partIndex > 0 && gameBreakEnabled && (
                <GameBreakIcon
                  state={
                    partIndex - 1 < currentPartIndex
                      ? 'passed'
                      : partIndex - 1 === currentPartIndex
                        ? 'current'
                        : 'upcoming'
                  }
                  progressPercent={partIndex - 1 === currentPartIndex ? currentPartProgress : 0}
                  isDark={isDark}
                />
              )}

              {shouldCollapse ? (
                <CollapsedSection
                  part={part}
                  partIndex={partIndex}
                  results={results}
                  linearOffset={partLinearOffset}
                  isDark={isDark}
                  isBrowseMode={isBrowseMode}
                  onNavigate={onNavigate}
                  onRedoProblem={onRedoProblem}
                  onCancelRedo={onCancelRedo}
                  redoLinearIndex={redoLinearIndex}
                  observerViewingIndex={observerViewingIndex}
                  isCompleted={isCompletedPart}
                />
              ) : (
                <ExpandedSection
                  part={part}
                  partIndex={partIndex}
                  results={results}
                  linearOffset={partLinearOffset}
                  currentLinearIndex={currentLinearIndex}
                  isDark={isDark}
                  isBrowseMode={isBrowseMode}
                  onNavigate={onNavigate}
                  onRedoProblem={onRedoProblem}
                  onCancelRedo={onCancelRedo}
                  redoLinearIndex={redoLinearIndex}
                  observerViewingIndex={observerViewingIndex}
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
