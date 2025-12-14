/**
 * Browse Mode View Component
 *
 * Allows browsing through all problems in a session during practice.
 * Shows problems using DetailedProblemCard.
 * Navigation is handled via SessionProgressIndicator in the nav bar.
 * Does not affect actual session progress - just for viewing.
 */

'use client'

import { useMemo } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { ProblemSlot, SessionPart, SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { calculateAutoPauseInfo } from './autoPauseCalculator'
import { DetailedProblemCard } from './DetailedProblemCard'

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
  /** Called when user wants to exit browse mode and practice the current problem */
  onExitBrowse?: () => void
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

export function BrowseModeView({
  plan,
  browseIndex,
  currentPracticeIndex,
  onExitBrowse,
}: BrowseModeViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

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

      {/* Action Button */}
      <div
        data-element="browse-action"
        className={css({
          display: 'flex',
          justifyContent: 'center',
          padding: '0.5rem 0',
        })}
      >
        {isCurrentPractice && onExitBrowse && (
          <button
            type="button"
            data-action="practice-this-problem"
            onClick={onExitBrowse}
            className={css({
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isDark ? 'green.600' : 'green.500',
              color: 'white',
              transition: 'all 0.15s ease',
              _hover: {
                backgroundColor: isDark ? 'green.500' : 'green.600',
                transform: 'scale(1.02)',
              },
              _active: {
                transform: 'scale(0.98)',
              },
            })}
          >
            Practice This Problem
          </button>
        )}
        {isCompleted && (
          <div
            data-status="completed"
            className={css({
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              borderRadius: '6px',
              backgroundColor: isDark ? 'gray.700' : 'gray.200',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            This problem was already completed
          </div>
        )}
        {isUpcoming && (
          <div
            data-status="upcoming"
            className={css({
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              borderRadius: '6px',
              backgroundColor: isDark ? 'gray.700' : 'gray.200',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            This problem hasn't been reached yet
          </div>
        )}
      </div>
    </div>
  )
}
