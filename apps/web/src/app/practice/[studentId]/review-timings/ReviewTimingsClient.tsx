'use client'

/**
 * Timing-review page client (#158).
 *
 * Lists every unresolved flagged attempt across the student's recent sessions
 * at the player level (a parent need not know which session to open —
 * acceptance criterion 2), grouped by session, each an actionable card. The
 * estimate-recovery header shows the live pace estimate and updates as cards are
 * acted on (acceptance criterion 3). A legacy > 5-minute attempt appears here
 * with no manual DB repair because classification is read-time (criterion 1).
 *
 * Optional `?session=<id>` focuses one session; a "show all" affordance widens
 * back to the whole window.
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useToast } from '@/components/common/ToastContext'
import { PageWithNav } from '@/components/PageWithNav'
import {
  useDeleteSessionPlan,
  useRestoreSessionPlan,
  useTimingReview,
} from '@/hooks/useTimingReview'
import type {
  DeletedSessionSummary,
  FlaggedAttempt,
} from '@/lib/curriculum/timing/review-types'
import { css } from '../../../../../styled-system/css'
import { EstimateRecoveryHeader } from '@/components/practice/timing-review/EstimateRecoveryHeader'
import { FlaggedAttemptCard } from '@/components/practice/timing-review/FlaggedAttemptCard'
import { formatSessionDate } from '@/components/practice/timing-review/formatting'

interface ReviewTimingsClientProps {
  studentId: string
  playerName: string
  playerEmoji: string
  focusSessionId?: string
}

interface SessionGroup {
  sessionId: string
  completedAt: string | null
  attempts: FlaggedAttempt[]
  worstMs: number
}

/** Group flagged attempts by session, unresolved first, worst session first. */
function groupBySession(flagged: readonly FlaggedAttempt[]): SessionGroup[] {
  const groups = new Map<string, SessionGroup>()
  for (const attempt of flagged) {
    const existing = groups.get(attempt.sessionId)
    const ms = attempt.effectiveMs ?? 0
    if (existing) {
      existing.attempts.push(attempt)
      existing.worstMs = Math.max(existing.worstMs, ms)
    } else {
      groups.set(attempt.sessionId, {
        sessionId: attempt.sessionId,
        completedAt: attempt.completedAt,
        attempts: [attempt],
        worstMs: ms,
      })
    }
  }
  for (const group of groups.values()) {
    // Unresolved first within a session so the work-to-do sits at the top.
    group.attempts.sort((a, b) => Number(a.resolved) - Number(b.resolved))
  }
  return [...groups.values()].sort((a, b) => b.worstMs - a.worstMs)
}

const cardSurface = css({
  borderRadius: '14px',
  border: '1px solid',
  borderColor: 'gray.200',
  backgroundColor: 'white',
  padding: '1.1rem 1.25rem',
  _dark: { backgroundColor: 'gray.900', borderColor: 'gray.700' },
})

const subtleButton = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  paddingX: '0.75rem',
  paddingY: '0.4rem',
  borderRadius: '8px',
  border: '1px solid',
  borderColor: 'gray.300',
  backgroundColor: 'white',
  color: 'gray.700',
  fontSize: '0.83rem',
  fontWeight: 'medium',
  cursor: 'pointer',
  transition: 'all 0.15s',
  _hover: { backgroundColor: 'gray.100' },
  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
  _dark: {
    backgroundColor: 'gray.800',
    borderColor: 'gray.600',
    color: 'gray.200',
    _hover: { backgroundColor: 'gray.700' },
  },
})

function DeletedSessionRow({
  studentId,
  session,
}: {
  studentId: string
  session: DeletedSessionSummary
}) {
  const restoreMutation = useRestoreSessionPlan()
  const { showSuccess, showError } = useToast()

  return (
    <div
      data-component="deleted-session-row"
      data-session-id={session.sessionId}
      className={css({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        padding: '0.75rem 0.9rem',
        borderRadius: '10px',
        border: '1px dashed',
        borderColor: 'gray.300',
        backgroundColor: 'gray.50',
        opacity: 0.85,
        _dark: { backgroundColor: 'gray.900', borderColor: 'gray.700' },
      })}
    >
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.2rem' })}>
        <span
          className={css({ fontSize: '0.9rem', fontWeight: 'medium', color: 'gray.700', _dark: { color: 'gray.300' } })}
        >
          {formatSessionDate(session.completedAt)}
        </span>
        <span className={css({ fontSize: '0.8rem', color: 'gray.500', _dark: { color: 'gray.500' } })}>
          {session.problemsCorrect}/{session.problemsAttempted} correct · removed
        </span>
      </div>
      <button
        type="button"
        data-action="restore-session"
        disabled={restoreMutation.isPending}
        onClick={() =>
          restoreMutation.mutate(
            { playerId: studentId, planId: session.sessionId },
            {
              onSuccess: () => showSuccess('Session restored'),
              onError: (err) =>
                showError(err instanceof Error ? err.message : 'Failed to restore session'),
            }
          )
        }
        className={subtleButton}
      >
        Restore
      </button>
    </div>
  )
}

function SessionGroupCard({
  studentId,
  group,
}: {
  studentId: string
  group: SessionGroup
}) {
  const deleteMutation = useDeleteSessionPlan()
  const { showSuccess, showError } = useToast()
  const [confirming, setConfirming] = useState(false)

  const unresolved = group.attempts.filter((a) => !a.resolved).length

  return (
    <section data-component="session-group" data-session-id={group.sessionId} className={cardSurface}>
      <header
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '0.9rem',
        })}
      >
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.15rem' })}>
          <span
            className={css({ fontSize: '1rem', fontWeight: 'semibold', color: 'gray.900', _dark: { color: 'gray.50' } })}
          >
            {formatSessionDate(group.completedAt)}
          </span>
          <span className={css({ fontSize: '0.8rem', color: 'gray.500', _dark: { color: 'gray.400' } })}>
            {group.attempts.length} flagged{unresolved > 0 ? ` · ${unresolved} to review` : ' · all reviewed'}
          </span>
        </div>
        <div className={css({ display: 'flex', gap: '0.5rem', alignItems: 'center' })}>
          <Link
            href={`/practice/${studentId}/session/${group.sessionId}`}
            data-action="open-session"
            className={subtleButton}
          >
            Open session
          </Link>
          {confirming ? (
            <>
              <button
                type="button"
                data-action="confirm-delete-session"
                disabled={deleteMutation.isPending}
                onClick={() =>
                  deleteMutation.mutate(
                    { playerId: studentId, planId: group.sessionId },
                    {
                      onSuccess: () => showSuccess('Session removed', 'You can restore it below.'),
                      onError: (err) =>
                        showError(err instanceof Error ? err.message : 'Failed to remove session'),
                    }
                  )
                }
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  paddingX: '0.75rem',
                  paddingY: '0.4rem',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: 'red.400',
                  backgroundColor: 'red.500',
                  color: 'white',
                  fontSize: '0.83rem',
                  fontWeight: 'semibold',
                  cursor: 'pointer',
                  _hover: { backgroundColor: 'red.600' },
                  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                Confirm remove
              </button>
              <button
                type="button"
                data-action="cancel-delete-session"
                onClick={() => setConfirming(false)}
                className={subtleButton}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              data-action="delete-session"
              onClick={() => setConfirming(true)}
              className={subtleButton}
            >
              Remove session
            </button>
          )}
        </div>
      </header>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' })}>
        {group.attempts.map((attempt) => (
          <FlaggedAttemptCard
            key={`${attempt.sessionId}-${attempt.resultIndex}`}
            playerId={studentId}
            attempt={attempt}
          />
        ))}
      </div>
    </section>
  )
}

export function ReviewTimingsClient({
  studentId,
  playerName,
  playerEmoji,
  focusSessionId,
}: ReviewTimingsClientProps) {
  const query = useTimingReview(studentId)
  const [showAll, setShowAll] = useState(false)

  const focusing = Boolean(focusSessionId) && !showAll

  const groups = useMemo(() => {
    const flagged = query.data?.flagged ?? []
    const scoped = focusing ? flagged.filter((a) => a.sessionId === focusSessionId) : flagged
    return groupBySession(scoped)
  }, [query.data?.flagged, focusing, focusSessionId])

  return (
    <PageWithNav>
      <div
        data-component="review-timings-page"
        className={css({
          maxWidth: '760px',
          marginX: 'auto',
          paddingX: '1rem',
          paddingY: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        })}
      >
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.5rem' })}>
          <Link
            href={`/practice/${studentId}/summary`}
            data-action="back-to-summary"
            className={css({
              fontSize: '0.85rem',
              color: 'blue.600',
              textDecoration: 'none',
              _hover: { textDecoration: 'underline' },
              _dark: { color: 'blue.400' },
            })}
          >
            ← Back to summary
          </Link>
          <h1
            className={css({
              fontSize: '1.6rem',
              fontWeight: 'bold',
              color: 'gray.900',
              margin: 0,
              _dark: { color: 'gray.50' },
            })}
          >
            {playerEmoji} Review timings for {playerName}
          </h1>
          <p className={css({ fontSize: '0.9rem', color: 'gray.600', margin: 0, _dark: { color: 'gray.400' } })}>
            Unusually long or interrupted timings across recent practice. Reviewing them keeps the
            pace estimate accurate.
          </p>
        </div>

        {query.isLoading && (
          <p data-element="loading" className={css({ color: 'gray.500', _dark: { color: 'gray.400' } })}>
            Loading timings…
          </p>
        )}

        {query.isError && (
          <p data-element="error" className={css({ color: 'red.600', _dark: { color: 'red.400' } })}>
            Couldn’t load timing data. Please try again.
          </p>
        )}

        {query.data && (
          <>
            <EstimateRecoveryHeader assessment={query.data.assessment} />

            {focusing && (
              <div
                data-element="focus-note"
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  fontSize: '0.85rem',
                  color: 'gray.600',
                  _dark: { color: 'gray.400' },
                })}
              >
                <span>Showing one session.</span>
                <button
                  type="button"
                  data-action="show-all-sessions"
                  onClick={() => setShowAll(true)}
                  className={subtleButton}
                >
                  Show all sessions
                </button>
              </div>
            )}

            {groups.length === 0 ? (
              <div
                data-element="empty-state"
                className={css({
                  borderRadius: '14px',
                  border: '1px solid',
                  borderColor: 'gray.200',
                  backgroundColor: 'white',
                  textAlign: 'center',
                  padding: '2.5rem 1.5rem',
                  color: 'gray.600',
                  _dark: { backgroundColor: 'gray.900', borderColor: 'gray.700' },
                })}
              >
                <div className={css({ fontSize: '2rem', marginBottom: '0.5rem' })}>✓</div>
                <p className={css({ margin: 0, fontWeight: 'medium', color: 'gray.800', _dark: { color: 'gray.200' } })}>
                  No unusual timings to review.
                </p>
                <p className={css({ marginTop: '0.35rem', fontSize: '0.85rem', color: 'gray.500' })}>
                  This student’s pace data looks clean.
                </p>
              </div>
            ) : (
              <div
                data-element="session-groups"
                className={css({ display: 'flex', flexDirection: 'column', gap: '1.25rem' })}
              >
                {groups.map((group) => (
                  <SessionGroupCard key={group.sessionId} studentId={studentId} group={group} />
                ))}
              </div>
            )}

            {query.data.deletedSessions.length > 0 && (
              <div
                data-element="deleted-sessions"
                className={css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' })}
              >
                <h2
                  className={css({
                    fontSize: '1rem',
                    fontWeight: 'semibold',
                    color: 'gray.700',
                    margin: 0,
                    _dark: { color: 'gray.300' },
                  })}
                >
                  Removed sessions ({query.data.deletedSessions.length})
                </h2>
                {query.data.deletedSessions.map((session) => (
                  <DeletedSessionRow
                    key={session.sessionId}
                    studentId={studentId}
                    session={session}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageWithNav>
  )
}
