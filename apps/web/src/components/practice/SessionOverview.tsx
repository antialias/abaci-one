/**
 * Session Overview Component
 *
 * Shows all problems in a session with detailed debugging information:
 * - Auto-pause timing summary
 * - Problems grouped by part (abacus, visualization, linear)
 * - Per-term skill annotations with effective costs
 * - Problem constraints and timing
 */

'use client'

import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { calculateAutoPauseInfo, formatMs, getAutoPauseExplanation } from './autoPauseCalculator'
import { DetailedProblemCard } from './DetailedProblemCard'

export interface SessionOverviewProps {
  /** The session plan with all problems */
  plan: SessionPlan
  /** Student name for the header */
  studentName: string
}

/**
 * Get display label for part type
 */
function getPartTypeLabel(type: 'abacus' | 'visualization' | 'linear'): string {
  switch (type) {
    case 'abacus':
      return 'Part 1: Use Abacus'
    case 'visualization':
      return 'Part 2: Mental Math (Visualization)'
    case 'linear':
      return 'Part 3: Mental Math (Linear)'
  }
}

/**
 * Get emoji for part type
 */
function getPartTypeEmoji(type: 'abacus' | 'visualization' | 'linear'): string {
  switch (type) {
    case 'abacus':
      return '🧮'
    case 'visualization':
      return '🧠'
    case 'linear':
      return '📝'
  }
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Calculate auto-pause stats at a specific position in results
 * (what the threshold would have been when this problem was presented)
 */
function calculateAutoPauseAtPosition(
  allResults: SlotResult[],
  position: number
): ReturnType<typeof calculateAutoPauseInfo> {
  const previousResults = allResults.slice(0, position)
  return calculateAutoPauseInfo(previousResults)
}

/**
 * Build a mapping from (partNumber, slotIndex) to position in overall results
 */
function buildResultMap(
  results: SlotResult[]
): Map<string, { result: SlotResult; position: number }> {
  const map = new Map<string, { result: SlotResult; position: number }>()
  results.forEach((result, position) => {
    const key = `${result.partNumber}-${result.slotIndex}`
    map.set(key, { result, position })
  })
  return map
}

export function SessionOverview({ plan, studentName }: SessionOverviewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Build result map for quick lookup
  const resultMap = buildResultMap(plan.results)

  // Calculate current auto-pause stats (based on all results)
  const currentAutoPause = calculateAutoPauseInfo(plan.results)

  // Calculate total problems and duration
  const totalProblems = plan.parts.reduce((sum, part) => sum + part.slots.length, 0)
  const sessionDate = plan.startedAt ?? plan.createdAt

  // Track problem number across all parts
  let globalProblemNumber = 0

  return (
    <div
      data-component="session-overview"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '1.5rem',
        maxWidth: '800px',
        margin: '0 auto',
      })}
    >
      {/* Header */}
      <header
        className={css({
          textAlign: 'center',
          paddingBottom: '1rem',
          borderBottom: '2px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <h1
          className={css({
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.900',
            marginBottom: '0.25rem',
          })}
        >
          Session Overview for {studentName}
        </h1>
        <p
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          {formatDate(sessionDate)} • {totalProblems} problems • {plan.targetDurationMinutes}{' '}
          minutes
        </p>
      </header>

      {/* Auto-Pause Timing Summary */}
      <section
        data-section="auto-pause-summary"
        className={css({
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <h2
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.200' : 'gray.700',
            marginBottom: '0.5rem',
          })}
        >
          ⏱️ Auto-Pause Timing
        </h2>
        <div
          className={css({
            display: 'grid',
            gap: '0.5rem',
            fontSize: '0.875rem',
          })}
        >
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
            })}
          >
            <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
              Current threshold:
            </span>
            <span
              className={css({
                fontWeight: 'bold',
                color: isDark ? 'gray.200' : 'gray.800',
              })}
            >
              {formatMs(currentAutoPause.threshold)}
            </span>
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.500' : 'gray.500',
              fontStyle: 'italic',
            })}
          >
            {getAutoPauseExplanation(currentAutoPause.stats)}
          </div>
          {currentAutoPause.stats.sampleCount > 0 && (
            <div
              className={css({
                display: 'flex',
                gap: '1rem',
                marginTop: '0.25rem',
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              <span>Mean: {formatMs(currentAutoPause.stats.meanMs)}</span>
              <span>Std Dev: {formatMs(currentAutoPause.stats.stdDevMs)}</span>
              <span>Samples: {currentAutoPause.stats.sampleCount}</span>
            </div>
          )}
        </div>
      </section>

      {/* Problems by Part */}
      {plan.parts.map((part, partIndex) => (
        <section
          key={part.partNumber}
          data-section={`part-${part.partNumber}`}
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          })}
        >
          {/* Part Header */}
          <h2
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.200' : 'gray.800',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid',
              borderColor: isDark ? 'gray.700' : 'gray.300',
            })}
          >
            <span>{getPartTypeEmoji(part.type)}</span>
            <span>{getPartTypeLabel(part.type)}</span>
            <span
              className={css({
                fontSize: '0.875rem',
                fontWeight: 'normal',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              ({part.slots.length} problems)
            </span>
          </h2>

          {/* Problems */}
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            })}
          >
            {part.slots.map((slot, slotIndex) => {
              globalProblemNumber++
              const key = `${part.partNumber}-${slotIndex}`
              const resultInfo = resultMap.get(key)

              // Calculate what the auto-pause would have been at this position
              const position = resultInfo?.position ?? plan.results.length
              const autoPauseAtPosition = calculateAutoPauseAtPosition(plan.results, position)

              return (
                <DetailedProblemCard
                  key={key}
                  slot={slot}
                  part={part}
                  result={resultInfo?.result}
                  autoPauseStats={autoPauseAtPosition.stats}
                  isDark={isDark}
                  problemNumber={globalProblemNumber}
                />
              )
            })}
          </div>
        </section>
      ))}

      {/* Footer */}
      <footer
        className={css({
          textAlign: 'center',
          paddingTop: '1rem',
          borderTop: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
          fontSize: '0.75rem',
          color: isDark ? 'gray.500' : 'gray.400',
        })}
      >
        Session ID: {plan.id}
      </footer>
    </div>
  )
}

export default SessionOverview
