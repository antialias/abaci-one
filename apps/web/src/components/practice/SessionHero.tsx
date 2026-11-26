'use client'

import { useMemo } from 'react'
import { PRACTICE_TYPES, type PracticeTypeId } from '@/constants/practiceTypes'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { css } from '../../../styled-system/css'
import { TrendIndicator } from './TrendIndicator'

export interface SessionHeroProps {
  /** The session report (session architecture §4): every number shown comes from it */
  report: SessionReport
  studentName: string
  /** Whether we just transitioned from active practice - shows celebration header */
  justCompleted?: boolean
  /** Previous session's first-try accuracy (0-1) for trend comparison */
  previousAccuracy: number | null
  /** Dark mode */
  isDark: boolean
}

/** Whole minutes for display ("< 1" under a minute) and the unit's number. */
export function formatMinutes(ms: number): { value: string; plural: boolean } {
  const minutes = ms / 60_000
  if (minutes < 1) return { value: '< 1', plural: false }
  const rounded = Math.round(minutes)
  return { value: String(rounded), plural: rounded !== 1 }
}

/** The outcome line for a session that did not finish normally, else null. */
export function outcomeLabel(report: SessionReport): string | null {
  if (report.outcome === 'in_progress') return 'In progress'
  if (report.outcome === 'abandoned') return 'Not finished'
  if (report.outcome === 'completed' && report.endedEarly) return 'Ended early'
  return null
}

/**
 * SessionHero - The top section of session summary
 *
 * Contains:
 * - Header (celebration when just completed, date otherwise)
 * - Stats Row (First try, Problems, Active time)
 * - Outcome badge, and a detail line (fixed in retries, right by the end, wall and break time)
 * - Practice Type Badges
 * - Trend Indicator (comparison to previous session)
 *
 * Reads only the session report (Phase 4b): no counting of `results`.
 */
export function SessionHero({
  report,
  studentName,
  justCompleted = false,
  previousAccuracy,
  isDark,
}: SessionHeroProps) {
  const { totals, time } = report

  // Practice types the session planned or practiced
  const practiceTypesInSession = useMemo(() => {
    const typeIds = new Set<PracticeTypeId>()
    for (const part of report.parts) {
      if (part.type && (part.plannedProblems > 0 || part.problems > 0)) {
        typeIds.add(part.type as PracticeTypeId)
      }
    }
    return PRACTICE_TYPES.filter((t) => typeIds.has(t.id as PracticeTypeId))
  }, [report.parts])

  // Format session date
  const sessionDate = useMemo(() => {
    const timestamp = report.startedAt ?? report.endedAt
    if (timestamp == null) return null
    return new Date(timestamp).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }, [report.startedAt, report.endedAt])

  // Headline accuracy: first try over attempted problems (§4)
  // (null when no problem counts: all tries excluded or practice-only)
  const firstTry = totals.firstTryAccuracy
  const accuracy = firstTry ?? 0
  // Offline and worksheet sessions carry no timing: no time stats at all
  const hasTiming = report.startedAt != null && time.activeMs > 0
  const active = formatMinutes(time.activeMs)
  const wall = formatMinutes(time.wallMs)
  const breakTime = formatMinutes(time.breakMs)
  const outcome = outcomeLabel(report)

  // Determine overall performance message
  const performanceMessage = getPerformanceMessage(accuracy)

  return (
    <div
      data-component="session-hero"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      })}
    >
      {/* Header - celebration when just completed, date otherwise */}
      {justCompleted ? (
        <div
          data-section="celebration-header"
          className={css({
            textAlign: 'center',
            padding: '1.5rem',
            backgroundColor: isDark
              ? accuracy >= 0.8
                ? 'green.900'
                : accuracy >= 0.6
                  ? 'yellow.900'
                  : 'orange.900'
              : accuracy >= 0.8
                ? 'green.50'
                : accuracy >= 0.6
                  ? 'yellow.50'
                  : 'orange.50',
            borderRadius: '16px',
            border: '2px solid',
            borderColor: isDark
              ? accuracy >= 0.8
                ? 'green.700'
                : accuracy >= 0.6
                  ? 'yellow.700'
                  : 'orange.700'
              : accuracy >= 0.8
                ? 'green.200'
                : accuracy >= 0.6
                  ? 'yellow.200'
                  : 'orange.200',
          })}
        >
          <div
            className={css({
              fontSize: '4rem',
              marginBottom: '0.5rem',
            })}
          >
            {accuracy >= 0.9 ? '🌟' : accuracy >= 0.8 ? '🎉' : accuracy >= 0.6 ? '👍' : '💪'}
          </div>
          <h1
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
              marginBottom: '0.25rem',
            })}
          >
            Great Work, {studentName}!
          </h1>
          <p
            className={css({
              fontSize: '1rem',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            {performanceMessage}
          </p>
        </div>
      ) : (
        <div
          data-section="date-header"
          className={css({
            textAlign: 'center',
            marginBottom: '0.5rem',
          })}
        >
          <h1
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
            })}
          >
            {sessionDate ?? 'Practice Session'}
          </h1>
        </div>
      )}

      {/* Practice type badges */}
      {practiceTypesInSession.length > 0 && (
        <div
          data-element="practice-types"
          className={css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            justifyContent: 'center',
          })}
        >
          {practiceTypesInSession.map((type) => (
            <span
              key={type.id}
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                px: '0.75rem',
                py: '0.25rem',
                fontSize: '0.8125rem',
                fontWeight: 'medium',
                borderRadius: 'full',
                backgroundColor: isDark ? 'gray.700' : 'gray.100',
                color: isDark ? 'gray.200' : 'gray.700',
              })}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* Outcome of a session that did not finish normally */}
      {outcome && (
        <div
          data-element="session-outcome"
          data-outcome={report.outcome}
          className={css({
            alignSelf: 'center',
            px: '0.75rem',
            py: '0.25rem',
            fontSize: '0.8125rem',
            fontWeight: 'medium',
            borderRadius: 'full',
            backgroundColor: isDark ? 'gray.700' : 'gray.100',
            color: isDark ? 'gray.200' : 'gray.700',
          })}
        >
          {outcome}
        </div>
      )}

      {/* Stats grid */}
      <div
        data-element="stats-grid"
        className={css({
          display: 'grid',
          gridTemplateColumns: hasTiming ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
          gap: '1rem',
        })}
      >
        <div
          data-element="stat-first-try"
          className={css({
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            boxShadow: 'sm',
          })}
        >
          <div
            data-value
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              color:
                firstTry === null
                  ? isDark
                    ? 'gray.400'
                    : 'gray.500'
                  : isDark
                    ? accuracy >= 0.8
                      ? 'green.400'
                      : accuracy >= 0.6
                        ? 'yellow.400'
                        : 'orange.400'
                    : accuracy >= 0.8
                      ? 'green.600'
                      : accuracy >= 0.6
                        ? 'yellow.600'
                        : 'orange.600',
            })}
          >
            {firstTry === null ? '—' : `${Math.round(firstTry * 100)}%`}
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            First try
          </div>
        </div>

        <div
          data-element="stat-problems"
          className={css({
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            boxShadow: 'sm',
          })}
        >
          <div
            data-value
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              color: isDark ? 'blue.400' : 'blue.600',
            })}
          >
            {totals.problems}
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            {totals.problems === 1 ? 'Problem' : 'Problems'} · {totals.tries}{' '}
            {totals.tries === 1 ? 'try' : 'tries'}
          </div>
        </div>

        {hasTiming && (
          <div
            data-element="stat-time"
            className={css({
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '12px',
              boxShadow: 'sm',
            })}
          >
            <div
              data-value
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'purple.400' : 'purple.600',
              })}
            >
              {active.value}
            </div>
            <div
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              {active.plural ? 'Active minutes' : 'Active minute'}
            </div>
          </div>
        )}
      </div>

      {/* Detail: retries, final verdict, wall and break time */}
      <div
        data-element="stats-detail"
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: '1rem',
          rowGap: '0.25rem',
          fontSize: '0.8125rem',
          color: isDark ? 'gray.300' : 'gray.600',
        })}
      >
        {report.outcome !== 'completed' && totals.plannedProblems > totals.problems && (
          <span data-element="stat-planned">
            {totals.problems} of {totals.plannedProblems} planned
          </span>
        )}
        <span data-element="stat-fixed">{totals.fixedInRetries} fixed in retries</span>
        {totals.finalAccuracy !== null && (
          <span data-element="stat-final">
            {Math.round(totals.finalAccuracy * 100)}% right by the end
          </span>
        )}
        {hasTiming && (
          <span data-element="stat-wall">
            {wall.value} {wall.plural ? 'minutes' : 'minute'} total
          </span>
        )}
        {time.breakMs > 0 && (
          <span data-element="stat-break">
            {breakTime.value} {breakTime.plural ? 'minutes' : 'minute'} break
          </span>
        )}
      </div>

      {/* Trend indicator */}
      {previousAccuracy !== null && (
        <div
          data-element="trend-row"
          className={css({
            display: 'flex',
            justifyContent: 'center',
          })}
        >
          <TrendIndicator current={accuracy} previous={previousAccuracy} isDark={isDark} />
        </div>
      )}
    </div>
  )
}

function getPerformanceMessage(accuracy: number): string {
  if (accuracy >= 0.95) return 'Outstanding! You are a math champion!'
  if (accuracy >= 0.9) return 'Excellent work! Keep up the great practice!'
  if (accuracy >= 0.8) return 'Great job! Your hard work is paying off!'
  if (accuracy >= 0.7) return "Good effort! You're getting stronger!"
  if (accuracy >= 0.6) return 'Nice try! Practice makes perfect!'
  return "Keep practicing! You'll get better with each session!"
}

export default SessionHero
