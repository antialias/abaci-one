'use client'

import Link from 'next/link'
import {
  formatDuration,
  formatMinutes,
  formatPercent,
  reportEnding,
} from '@/lib/curriculum/observer-report'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { css } from '../../../styled-system/css'

interface SessionEndedSummaryProps {
  report: SessionReport
  studentName: string
  studentEmoji?: string
  /** Link to the full session report, for viewers who may open it */
  sessionReportUrl?: string
  isDark?: boolean
}

const HEADLINES = {
  completed: { icon: '🎉', title: (name: string) => `${name} finished practicing!` },
  ended_early: { icon: '🏁', title: (name: string) => `${name} ended the session early` },
  abandoned: { icon: '⏸️', title: (name: string) => `${name}'s session was left unfinished` },
} as const

/**
 * The ended view's numbers (session architecture Phase 4c), all from the
 * session report: outcome, problems, first try, fixed in retries, final
 * score, minutes (wall time), active and break time. Shown by the live
 * observers once the session ends and by the share link's ended page, so
 * both show the same numbers as the summary.
 */
export function SessionEndedSummary({
  report,
  studentName,
  studentEmoji,
  sessionReportUrl,
  isDark = false,
}: SessionEndedSummaryProps) {
  const ending = reportEnding(report) ?? 'completed'
  const headline = HEADLINES[ending]
  const { totals, time } = report
  const minutes = formatMinutes(time.wallMs)
  const stats: Array<{ key: string; value: string; label: string }> = [
    { key: 'problems', value: `${totals.problems}/${totals.plannedProblems}`, label: 'Problems' },
    {
      key: 'first-try',
      value: formatPercent(totals.firstTryAccuracy),
      label: `First try (${totals.firstTryCorrect}/${totals.problems})`,
    },
    { key: 'fixed', value: String(totals.fixedInRetries), label: 'Fixed in retries' },
    {
      key: 'final',
      value: formatPercent(totals.finalAccuracy),
      label: `Final (${totals.finalCorrect}/${totals.problems})`,
    },
    { key: 'minutes', value: minutes.value, label: minutes.plural ? 'Minutes' : 'Minute' },
  ]

  return (
    <div
      data-component="session-ended-summary"
      data-outcome={ending}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        width: '100%',
        maxWidth: '520px',
        textAlign: 'center',
      })}
    >
      <div className={css({ fontSize: '3rem' })} aria-hidden="true">
        {headline.icon}
      </div>
      <h2
        data-element="ended-title"
        className={css({
          fontSize: '1.25rem',
          fontWeight: 'bold',
          color: isDark ? 'gray.100' : 'gray.800',
          margin: 0,
        })}
      >
        {studentEmoji ? `${studentEmoji} ` : ''}
        {headline.title(studentName)}
      </h2>

      <div
        data-element="ended-stats"
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' },
          gap: '8px',
          width: '100%',
        })}
      >
        {stats.map((stat) => (
          <div
            key={stat.key}
            data-stat={stat.key}
            className={css({
              padding: '10px 6px',
              borderRadius: '10px',
              backgroundColor: isDark ? 'gray.800' : 'gray.100',
            })}
          >
            <div
              className={css({
                fontSize: '1.375rem',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.800',
              })}
            >
              {stat.value}
            </div>
            <div className={css({ fontSize: '0.75rem', color: isDark ? 'gray.400' : 'gray.500' })}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <p
        data-element="ended-time"
        className={css({ fontSize: '0.8125rem', color: isDark ? 'gray.400' : 'gray.500' })}
      >
        Active {formatDuration(time.activeMs)}
        {time.breakMs > 0 ? ` · Breaks ${formatDuration(time.breakMs)}` : ''}
      </p>

      {sessionReportUrl && (
        <Link
          href={sessionReportUrl}
          data-action="view-session-report"
          className={css({
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: 'green.600',
            color: 'white',
            fontWeight: 'semibold',
            fontSize: '0.875rem',
            _hover: { backgroundColor: 'green.700' },
          })}
        >
          View Session Report →
        </Link>
      )}
    </div>
  )
}
