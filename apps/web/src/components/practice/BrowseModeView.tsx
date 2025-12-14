/**
 * Browse Mode View Component
 *
 * Allows browsing through all problems in a session during practice.
 * Shows problems using DetailedProblemCard.
 * Navigation is handled via SessionProgressIndicator in the nav bar.
 * Does not affect actual session progress - just for viewing.
 */

'use client'

import { useMemo, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { ProblemSlot, SessionPart, SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { calculateAutoPauseInfo } from './autoPauseCalculator'
import { DetailedProblemCard } from './DetailedProblemCard'
import { PracticePreview } from './PracticePreview'

/**
 * Flattened problem item with all context needed for display
 */
export interface LinearProblemItem {
  partNumber: number
  slotIndex: number
  slot: ProblemSlot
  part: SessionPart
  linearIndex: number
}

/**
 * Build a flattened list of all problems for navigation
 */
export function buildLinearProblemList(parts: SessionPart[]): LinearProblemItem[] {
  const items: LinearProblemItem[] = []
  let linearIndex = 0

  for (const part of parts) {
    for (let slotIndex = 0; slotIndex < part.slots.length; slotIndex++) {
      items.push({
        partNumber: part.partNumber,
        slotIndex,
        slot: part.slots[slotIndex],
        part,
        linearIndex,
      })
      linearIndex++
    }
  }

  return items
}

/**
 * Convert current part/slot indices to linear index
 */
export function getLinearIndex(
  parts: SessionPart[],
  currentPartIndex: number,
  currentSlotIndex: number
): number {
  let index = 0
  for (let i = 0; i < currentPartIndex; i++) {
    index += parts[i].slots.length
  }
  return index + currentSlotIndex
}

export interface BrowseModeViewProps {
  /** The session plan with all problems */
  plan: SessionPlan
  /** Current browse index (linear) */
  browseIndex: number
  /** The actual current practice problem index (to highlight) */
  currentPracticeIndex: number
}

/**
 * Get result for a specific problem if it exists
 */
function getResultForProblem(
  results: SlotResult[],
  partNumber: number,
  slotIndex: number
): SlotResult | undefined {
  return results.find((r) => r.partNumber === partNumber && r.slotIndex === slotIndex)
}

export function BrowseModeView({ plan, browseIndex, currentPracticeIndex }: BrowseModeViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Practice preview mode - when true, show interactive practice interface
  const [isPracticing, setIsPracticing] = useState(false)

  // Build linear problem list
  const linearProblems = useMemo(() => buildLinearProblemList(plan.parts), [plan.parts])

  const currentItem = linearProblems[browseIndex]

  // Get result for current browse item
  const result = useMemo(() => {
    if (!currentItem) return undefined
    return getResultForProblem(plan.results, currentItem.partNumber, currentItem.slotIndex)
  }, [plan.results, currentItem])

  // Calculate auto-pause stats at this position
  const autoPauseStats = useMemo(() => {
    if (!currentItem) return undefined
    // Find the position in results where this problem would be
    const resultsUpToHere = plan.results.filter((r) => {
      const rLinear = linearProblems.findIndex(
        (p) => p.partNumber === r.partNumber && p.slotIndex === r.slotIndex
      )
      return rLinear < browseIndex
    })
    return calculateAutoPauseInfo(resultsUpToHere).stats
  }, [plan.results, linearProblems, browseIndex, currentItem])

  // Is this the current practice problem?
  const isCurrentPractice = browseIndex === currentPracticeIndex
  const isCompleted = browseIndex < currentPracticeIndex
  const isUpcoming = browseIndex > currentPracticeIndex

  if (!currentItem) {
    return (
      <div
        className={css({
          padding: '2rem',
          textAlign: 'center',
          color: isDark ? 'gray.400' : 'gray.600',
        })}
      >
        No problems to display
      </div>
    )
  }

  return (
    <div
      data-component="browse-mode-view"
      data-browse-index={browseIndex}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1rem',
        maxWidth: '800px',
        margin: '0 auto',
      })}
    >
      {/* Current Practice Indicator */}
      {isCurrentPractice && (
        <div
          className={css({
            padding: '0.5rem 1rem',
            backgroundColor: isDark ? 'yellow.900' : 'yellow.50',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: isDark ? 'yellow.700' : 'yellow.200',
            textAlign: 'center',
            fontSize: '0.875rem',
            fontWeight: 'bold',
            color: isDark ? 'yellow.200' : 'yellow.700',
          })}
        >
          This is your current practice problem
        </div>
      )}

      {/* Problem Display */}
      <DetailedProblemCard
        slot={currentItem.slot}
        part={currentItem.part}
        result={result}
        autoPauseStats={autoPauseStats}
        isDark={isDark}
        problemNumber={browseIndex + 1}
      />

      {/* Action Button - Toggle practice mode */}
      <div
        data-element="browse-action"
        className={css({
          display: 'flex',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '0.5rem 0',
        })}
      >
        <button
          type="button"
          data-action={isPracticing ? 'close-practice' : 'practice-this-problem'}
          onClick={() => setIsPracticing((prev) => !prev)}
          className={css({
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            borderRadius: '8px',
            border: isPracticing ? '2px solid' : 'none',
            borderColor: isPracticing ? (isDark ? 'gray.500' : 'gray.400') : undefined,
            cursor: 'pointer',
            backgroundColor: isPracticing ? 'transparent' : isDark ? 'green.600' : 'green.500',
            color: isPracticing ? (isDark ? 'gray.300' : 'gray.600') : 'white',
            transition: 'all 0.15s ease',
            _hover: {
              backgroundColor: isPracticing
                ? isDark
                  ? 'gray.700'
                  : 'gray.100'
                : isDark
                  ? 'green.500'
                  : 'green.600',
              transform: 'scale(1.02)',
            },
            _active: {
              transform: 'scale(0.98)',
            },
          })}
        >
          {isPracticing ? 'Close Practice Panel' : 'Practice This Problem'}
        </button>
      </div>

      {/* Inline Practice Preview - shown when practicing */}
      {isPracticing && (
        <div
          data-element="practice-panel"
          className={css({
            padding: '1rem',
            backgroundColor: isDark ? 'blue.950' : 'blue.50',
            borderRadius: '12px',
            border: '2px solid',
            borderColor: isDark ? 'blue.800' : 'blue.200',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid',
              borderColor: isDark ? 'blue.800' : 'blue.200',
            })}
          >
            <span
              className={css({
                fontSize: '0.875rem',
                fontWeight: 'bold',
                color: isDark ? 'blue.200' : 'blue.700',
              })}
            >
              Practice Panel
            </span>
            <span
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'blue.400' : 'blue.500',
              })}
            >
              (does not affect session)
            </span>
          </div>
          <PracticePreview
            slot={currentItem.slot}
            part={currentItem.part}
            problemNumber={browseIndex + 1}
            onBack={() => setIsPracticing(false)}
            inline
          />
        </div>
      )}

      {/* Status indicator */}
      {(isCompleted || isUpcoming || isCurrentPractice) && (
        <div
          data-element="status-indicator"
          className={css({
            textAlign: 'center',
            fontSize: '0.75rem',
            color: isDark ? 'gray.500' : 'gray.500',
          })}
        >
          {isCurrentPractice && '(Current problem in session)'}
          {isCompleted && '(Already completed in session)'}
          {isUpcoming && '(Not yet reached in session)'}
        </div>
      )}
    </div>
  )
}
