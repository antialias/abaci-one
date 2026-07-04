'use client'

/**
 * Decision-point timing notice for the Start-Practice modal (#157).
 *
 * When the pace estimate the modal is showing may be distorted by flagged
 * timings (Tier-1 auto-quarantined and/or Tier-2 unusual-for-child), this
 * renders a NOTICEABLE, parent-facing banner directly under the "~N problems"
 * summary so a normal parent/teacher will actually see it — not a buried admin
 * list. It taps through to the single review destination
 * (`/practice/{studentId}/review-timings`, optionally focused on the one
 * affected session).
 *
 * Counts come straight from `PaceAssessment` (the single pace producer) — there
 * is no second counting mechanism here. The presentational `TimingDataNoticeView`
 * is a pure function of those counts so it can be unit-tested without the modal
 * provider; `TimingDataNotice` is the thin container that reads them off context.
 */

import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import type { AffectedSession } from '@/lib/curriculum/timing/pace-estimation'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal } from '../StartPracticeModalContext'

/** Pick singular/plural form based on a count. */
function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm
}

export interface TimingDataNoticeViewProps {
  studentId: string
  /** Flagged (Tier-1/Tier-2) attempts with no review yet — the gate for showing anything. */
  unresolvedCount: number
  tier1Count: number
  tier2Count: number
  /** The "~N problems" the modal currently shows (for the "instead of" comparison). */
  estimatedProblems: number
  /** The "~M problems" the estimate would become if the flagged timings were repaired. */
  estimatedProblemsIfRepaired: number | null
  /** Sessions containing flagged attempts (worst first) — drives single-session focus. */
  affectedSessions: readonly AffectedSession[]
  isDark: boolean
}

/**
 * Pure presentation of the timing notice. Renders nothing when there is nothing
 * unresolved to surface. Amber + prominent when genuine-but-unusual (Tier-2)
 * timings are still counted in the estimate; neutral when only broken (Tier-1)
 * measurements were auto-quarantined (the estimate is already protected).
 */
export function TimingDataNoticeView({
  studentId,
  unresolvedCount,
  tier1Count,
  tier2Count,
  estimatedProblems,
  estimatedProblemsIfRepaired,
  affectedSessions,
  isDark,
}: TimingDataNoticeViewProps) {
  if (unresolvedCount <= 0) return null

  // One affected session → focus it; otherwise open the full review list.
  const reviewHref =
    affectedSessions.length === 1
      ? `/practice/${studentId}/review-timings?session=${affectedSessions[0].sessionId}`
      : `/practice/${studentId}/review-timings`

  const hasTier2 = tier2Count > 0
  const showRepairPreview =
    hasTier2 &&
    estimatedProblemsIfRepaired != null &&
    estimatedProblemsIfRepaired !== estimatedProblems

  // Colors: amber attention vs neutral "already protected".
  const accent = hasTier2
    ? isDark
      ? { bg: 'rgba(120, 53, 15, 0.35)', border: 'rgba(245, 158, 11, 0.45)', text: '#fcd34d', body: '#fde68a', link: '#fbbf24' }
      : { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', body: '#b45309', link: '#b45309' }
    : isDark
      ? { bg: 'rgba(30, 41, 59, 0.6)', border: 'rgba(148, 163, 184, 0.3)', text: '#cbd5e1', body: '#94a3b8', link: '#93c5fd' }
      : { bg: '#f8fafc', border: '#e2e8f0', text: '#334155', body: '#64748b', link: '#2563eb' }

  return (
    <div
      data-component="timing-data-notice"
      data-tier={hasTier2 ? 'tier2' : 'tier1'}
      data-flag-count={unresolvedCount}
      className={css({
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.625rem',
        padding: '0.75rem 0.875rem',
        borderRadius: '10px',
        border: '1px solid',
        '@media (max-width: 480px), (max-height: 700px)': {
          padding: '0.5rem 0.625rem',
          gap: '0.5rem',
        },
      })}
      style={{ backgroundColor: accent.bg, borderColor: accent.border }}
    >
      <span
        data-element="notice-icon"
        aria-hidden="true"
        className={css({ fontSize: '1rem', lineHeight: 1.3, flexShrink: 0 })}
      >
        {hasTier2 ? '⚠️' : '🛡️'}
      </span>

      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          minWidth: 0,
          flex: 1,
        })}
      >
        {hasTier2 ? (
          <>
            <span
              data-element="notice-headline"
              className={css({
                fontSize: '0.8125rem',
                fontWeight: '600',
                lineHeight: 1.35,
                '@media (max-width: 480px), (max-height: 700px)': { fontSize: '0.75rem' },
              })}
              style={{ color: accent.text }}
            >
              This estimate may be affected by {tier2Count} unusually long{' '}
              {plural(tier2Count, 'timing', 'timings')}.
            </span>
            {showRepairPreview && (
              <span
                data-element="notice-repair-preview"
                className={css({ fontSize: '0.75rem', lineHeight: 1.4 })}
                style={{ color: accent.body }}
              >
                If those were interruptions, this session would hold about{' '}
                <strong data-value="repaired-problem-count">{estimatedProblemsIfRepaired}</strong>{' '}
                problems instead of{' '}
                <strong data-value="current-problem-count">{estimatedProblems}</strong>.
              </span>
            )}
            {tier1Count > 0 && (
              <span
                data-element="notice-tier1-note"
                className={css({ fontSize: '0.6875rem', lineHeight: 1.4 })}
                style={{ color: accent.body }}
              >
                {tier1Count} broken {plural(tier1Count, 'measurement', 'measurements')}{' '}
                {plural(tier1Count, 'was', 'were')} already set aside automatically.
              </span>
            )}
          </>
        ) : (
          <span
            data-element="notice-headline"
            className={css({
              fontSize: '0.8125rem',
              fontWeight: '500',
              lineHeight: 1.35,
              '@media (max-width: 480px), (max-height: 700px)': { fontSize: '0.75rem' },
            })}
            style={{ color: accent.text }}
          >
            {tier1Count} broken timing {plural(tier1Count, 'measurement', 'measurements')}{' '}
            {plural(tier1Count, 'was', 'were')} set aside automatically, so this estimate is
            protected.
          </span>
        )}

        <Link
          href={reviewHref}
          data-action="review-timings"
          className={css({
            alignSelf: 'flex-start',
            marginTop: '0.125rem',
            fontSize: '0.75rem',
            fontWeight: '600',
            textDecoration: 'none',
            borderRadius: '4px',
            _hover: { textDecoration: 'underline' },
            _focusVisible: {
              outline: '2px solid currentColor',
              outlineOffset: '2px',
            },
          })}
          style={{ color: accent.link }}
        >
          {hasTier2 ? 'Review timings →' : 'Review →'}
        </Link>
      </div>
    </div>
  )
}

/** Container: reads the pace assessment + estimates off the modal context. */
export function TimingDataNotice() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { studentId, paceAssessment, estimatedProblems, estimatedProblemsIfRepaired } =
    useStartPracticeModal()

  if (!paceAssessment) return null

  return (
    <TimingDataNoticeView
      studentId={studentId}
      unresolvedCount={paceAssessment.unresolvedCount}
      tier1Count={paceAssessment.tier1Count}
      tier2Count={paceAssessment.tier2Count}
      estimatedProblems={estimatedProblems}
      estimatedProblemsIfRepaired={estimatedProblemsIfRepaired}
      affectedSessions={paceAssessment.affectedSessions}
      isDark={isDark}
    />
  )
}
