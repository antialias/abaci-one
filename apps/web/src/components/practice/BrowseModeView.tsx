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
import type { SessionPlan } from '@/db/schema/session-plans'
import { useSessionReport } from '@/hooks/useSessionReport'
import {
  type ArithmeticItemCell,
  arithmeticItemCells,
  triesBeforeItem,
} from '@/lib/curriculum/parts/arithmetic/result-view'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { css } from '../../../styled-system/css'
import { AttemptHistoryPanel, type ResultWithGlobalIndex } from './AttemptHistoryPanel'
import { calculateAutoPauseInfo } from './autoPauseCalculator'
import { DetailedProblemCard } from './DetailedProblemCard'
import { PracticePreview } from './PracticePreview'

/**
 * Every problem of the session in the dots' order (`browseIndex` is the dots'
 * 0-based index), each with its tries and verdict from the session report.
 */
export function browseCells(
  plan: Pick<SessionPlan, 'id' | 'parts' | 'results'>,
  report: Pick<SessionReport, 'tries'> | null | undefined
): ArithmeticItemCell[] {
  return arithmeticItemCells(plan, report).flat()
}

/** A cell's tries as the attempt history lists them: stored tries with their index and id (review edits address the id). */
export function attemptHistoryOf(cell: ArithmeticItemCell): ResultWithGlobalIndex[] {
  return cell.tries.flatMap((t) =>
    t.result && t.resultIndex >= 0
      ? [{ result: t.result, globalIndex: t.resultIndex, tryId: t.row.tryId }]
      : []
  )
}

export interface BrowseModeViewProps {
  /** The session plan with all problems */
  plan: SessionPlan
  /** Current browse index (linear) */
  browseIndex: number
  /** The actual current practice problem index (to highlight) */
  currentPracticeIndex: number
  /** Student ID for edit API calls */
  studentId: string
  /** Callback when results are edited (to refetch plan) */
  onResultEdited?: () => void
}

export function BrowseModeView({
  plan,
  browseIndex,
  currentPracticeIndex,
  studentId,
  onResultEdited,
}: BrowseModeViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Practice preview mode - when true, show interactive practice interface
  const [isPracticing, setIsPracticing] = useState(false)

  // The session report (Phase 5c): each problem's tries and verdict. The kid's
  // page holds the same cache entry and keeps it current with the pushes; the
  // fetch needs only the cookie (no viewer id: no second push room).
  const { data: report } = useSessionReport({
    playerId: studentId,
    planId: plan.id,
    viewerId: null,
  })

  // Every problem in the dots' order, with its tries from the report
  const cells = useMemo(() => browseCells(plan, report), [plan, report])

  const currentCell = cells[browseIndex]

  // The problem's verdict try (DetailedProblemCard), by the report's rules
  const result = currentCell?.shown ?? undefined

  // All of the problem's tries (including retries and do-overs) for AttemptHistoryPanel
  const allResults = useMemo(
    () => (currentCell ? attemptHistoryOf(currentCell) : []),
    [currentCell]
  )

  // The auto-pause threshold in force when the problem was first answered
  // (counted tries only: `calculateAutoPauseInfo` reads through `isCountedTry`)
  const autoPauseStats = useMemo(() => {
    if (!currentCell) return undefined
    return calculateAutoPauseInfo(triesBeforeItem(plan, currentCell)).stats
  }, [plan, currentCell])

  // Is this the current practice problem?
  const isCurrentPractice = browseIndex === currentPracticeIndex
  const isCompleted = browseIndex < currentPracticeIndex
  const isUpcoming = browseIndex > currentPracticeIndex

  if (!currentCell) {
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
        slot={currentCell.slot}
        part={currentCell.part}
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
            slot={currentCell.slot}
            part={currentCell.part}
            problemNumber={browseIndex + 1}
            onBack={() => setIsPracticing(false)}
            inline
          />
        </div>
      )}

      {/* Attempt History Panel - show all attempts with edit options */}
      {allResults.length > 0 && currentCell.slot.problem && (
        <AttemptHistoryPanel
          results={allResults}
          correctAnswer={currentCell.slot.problem.answer}
          isDark={isDark}
          studentId={studentId}
          planId={plan.id}
          onResultEdited={onResultEdited}
        />
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
