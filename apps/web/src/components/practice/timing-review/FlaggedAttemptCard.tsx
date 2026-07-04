'use client'

/**
 * One flagged-attempt card for the timing-review page (#158).
 *
 * Renders a single Tier-1/Tier-2 attempt with its parent-facing explanation,
 * the stored vs. raw vs. adjusted timing values (plus the #156 audit fields,
 * read-only), and the repair actions — omit-from-timing, manually-set-time,
 * omit-from-mastery — each wired to the shared `useReviewSlotResult` mutation so
 * success invalidates the review, session, and curriculum (pace) caches.
 */

import { useState } from 'react'
import {
  useConfirmTiming,
  useReviewSlotResult,
  useUnconfirmTiming,
} from '@/hooks/useTimingReview'
import type { SlotResultReviewAction } from '@/lib/curriculum/session-review'
import type { FlaggedAttempt } from '@/lib/curriculum/timing/review-types'
import { css } from '../../../../styled-system/css'
import { formatDuration, tierCopy } from './formatting'

interface FlaggedAttemptCardProps {
  playerId: string
  attempt: FlaggedAttempt
}

/** Render a problem's terms as "12 + 34 − 5" (unicode minus for real subtraction). */
function formatProblem(terms: readonly number[]): string {
  return terms
    .map((term, i) => {
      if (i === 0) return String(term)
      return term < 0 ? `− ${Math.abs(term)}` : `+ ${term}`
    })
    .join(' ')
}

const actionButtonClass = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  paddingX: '0.75rem',
  paddingY: '0.4rem',
  borderRadius: '8px',
  border: '1px solid',
  borderColor: 'gray.300',
  backgroundColor: 'white',
  color: 'gray.800',
  fontSize: '0.85rem',
  fontWeight: 'medium',
  cursor: 'pointer',
  transition: 'all 0.15s',
  _hover: { backgroundColor: 'gray.100', borderColor: 'gray.400' },
  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
  _dark: {
    backgroundColor: 'gray.800',
    borderColor: 'gray.600',
    color: 'gray.100',
    _hover: { backgroundColor: 'gray.700' },
  },
})

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      data-element="timing-detail-row"
      className={css({
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
        fontSize: '0.82rem',
      })}
    >
      <span className={css({ color: 'gray.500', _dark: { color: 'gray.400' } })}>{label}</span>
      <span
        className={css({
          color: 'gray.800',
          fontWeight: 'medium',
          fontVariantNumeric: 'tabular-nums',
          _dark: { color: 'gray.100' },
        })}
      >
        {value}
      </span>
    </div>
  )
}

export function FlaggedAttemptCard({ playerId, attempt }: FlaggedAttemptCardProps) {
  const reviewMutation = useReviewSlotResult()
  const confirmMutation = useConfirmTiming()
  const unconfirmMutation = useUnconfirmTiming()
  const [showSetTime, setShowSetTime] = useState(false)
  const [secondsInput, setSecondsInput] = useState('')

  const { result } = attempt
  const copy = tierCopy(attempt.tier, attempt.reason)
  const review = result.timingReview
  const omittedFromTiming = review?.omitFromTiming === true
  const excludedFromMastery = result.source === 'teacher-excluded'
  const adjustedMs = review?.adjustedResponseTimeMs
  const confirmed = review?.timingConfirmed === true
  const pending =
    reviewMutation.isPending || confirmMutation.isPending || unconfirmMutation.isPending

  const actionError =
    reviewMutation.error ?? confirmMutation.error ?? unconfirmMutation.error ?? null

  const target = { playerId, planId: attempt.sessionId, resultIndex: attempt.resultIndex }

  function runAction(action: SlotResultReviewAction) {
    reviewMutation.mutate({ ...target, action })
  }

  function submitSetTime() {
    const seconds = Number(secondsInput)
    if (!Number.isFinite(seconds) || seconds <= 0) return
    runAction({ action: 'set_time', adjustedResponseTimeMs: Math.round(seconds * 1000) })
    setShowSetTime(false)
    setSecondsInput('')
  }

  return (
    <div
      data-component="flagged-attempt-card"
      data-tier={attempt.tier}
      data-resolved={attempt.resolved}
      className={css({
        borderRadius: '12px',
        border: '1px solid',
        borderColor: attempt.resolved ? 'gray.200' : 'amber.300',
        backgroundColor: attempt.resolved ? 'gray.50' : 'white',
        padding: '1rem 1.15rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        opacity: attempt.resolved ? 0.85 : 1,
        _dark: {
          backgroundColor: attempt.resolved ? 'gray.900' : 'gray.800',
          borderColor: attempt.resolved ? 'gray.700' : 'amber.700',
        },
      })}
    >
      {/* Header: tier badge + problem + accuracy */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.75rem',
          flexWrap: 'wrap',
        })}
      >
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.35rem' })}>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
            <span
              data-element="tier-badge"
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 'full',
                paddingX: '0.6rem',
                paddingY: '0.2rem',
                fontSize: '0.72rem',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                backgroundColor: attempt.tier === 'tier1' ? 'red.100' : 'amber.100',
                color: attempt.tier === 'tier1' ? 'red.700' : 'amber.800',
                _dark: {
                  backgroundColor: attempt.tier === 'tier1' ? 'red.950' : 'amber.900',
                  color: attempt.tier === 'tier1' ? 'red.300' : 'amber.200',
                },
              })}
            >
              {copy.label}
            </span>
            {attempt.resolved && (
              <span
                data-element="resolved-chip"
                className={css({
                  fontSize: '0.72rem',
                  fontWeight: 'semibold',
                  color: 'green.700',
                  _dark: { color: 'green.400' },
                })}
              >
                ✓ Reviewed
              </span>
            )}
          </div>
          <span
            data-element="problem"
            className={css({
              fontSize: '1.05rem',
              fontWeight: 'semibold',
              fontVariantNumeric: 'tabular-nums',
              color: 'gray.900',
              _dark: { color: 'gray.50' },
            })}
          >
            {formatProblem(result.problem.terms)} = {result.problem.answer}
          </span>
        </div>
        <span
          data-element="accuracy"
          className={css({
            fontSize: '0.8rem',
            fontWeight: 'semibold',
            color: result.isCorrect ? 'green.600' : 'red.600',
            _dark: { color: result.isCorrect ? 'green.400' : 'red.400' },
          })}
        >
          {result.isCorrect ? 'Correct' : `Answered ${result.studentAnswer}`}
        </span>
      </div>

      <p
        data-element="tier-blurb"
        className={css({
          fontSize: '0.85rem',
          color: 'gray.600',
          margin: 0,
          _dark: { color: 'gray.400' },
        })}
      >
        {copy.blurb}
      </p>

      {/* Timing values */}
      <div
        data-element="timing-details"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem',
          borderRadius: '8px',
          backgroundColor: 'gray.50',
          padding: '0.6rem 0.75rem',
          _dark: { backgroundColor: 'gray.900' },
        })}
      >
        <DetailRow label="Recorded time" value={formatDuration(result.responseTimeMs)} />
        {result.responseTimeMsRaw != null && (
          <DetailRow label="Raw measured" value={formatDuration(result.responseTimeMsRaw)} />
        )}
        {adjustedMs != null && (
          <DetailRow label="Your manual time" value={formatDuration(adjustedMs)} />
        )}
        <DetailRow
          label="Counts toward pace as"
          value={attempt.effectiveMs != null ? formatDuration(attempt.effectiveMs) : 'Not counted'}
        />
        {result.capReason != null && (
          <DetailRow label="Cap reason" value={result.capReason} />
        )}
        {result.capThresholdMs != null && (
          <DetailRow label="Cap threshold" value={formatDuration(result.capThresholdMs)} />
        )}
        {result.capSource != null && <DetailRow label="Capped by" value={result.capSource} />}
        {result.hiddenTimeExcludedMs != null && result.hiddenTimeExcludedMs > 0 && (
          <DetailRow
            label="Hidden-tab time removed"
            value={formatDuration(result.hiddenTimeExcludedMs)}
          />
        )}
      </div>

      {actionError && (
        <p
          data-element="action-error"
          className={css({ fontSize: '0.8rem', color: 'red.600', margin: 0, _dark: { color: 'red.400' } })}
        >
          {actionError instanceof Error ? actionError.message : 'Action failed'}
        </p>
      )}

      {/* Actions */}
      <div
        data-element="repair-actions"
        className={css({ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' })}
      >
        {omittedFromTiming ? (
          <button
            type="button"
            data-action="include-timing"
            disabled={pending}
            onClick={() => runAction({ action: 'include', scope: 'timing' })}
            className={actionButtonClass}
          >
            Count this timing again
          </button>
        ) : (
          <button
            type="button"
            data-action="exclude-timing"
            disabled={pending}
            onClick={() => runAction({ action: 'exclude', scope: 'timing' })}
            className={actionButtonClass}
          >
            Don’t count this timing
          </button>
        )}

        {/* Confirm the raw value is genuine (keeps it in the estimate, silences
            the flag). Only meaningful while the value is actually counting — not
            when it's omitted or already replaced by a manual time. */}
        {confirmed ? (
          <button
            type="button"
            data-action="unconfirm-timing"
            disabled={pending}
            onClick={() => unconfirmMutation.mutate(target)}
            className={actionButtonClass}
          >
            Undo “kept as real”
          </button>
        ) : (
          !omittedFromTiming &&
          adjustedMs == null && (
            <button
              type="button"
              data-action="confirm-timing"
              disabled={pending}
              onClick={() => confirmMutation.mutate(target)}
              className={actionButtonClass}
            >
              This time is real — keep it
            </button>
          )
        )}

        {/* Set-time controls are hidden while the sample is omitted: the primary
            CTA there is to re-include it first (setting a time from an omitted
            state re-includes via the coherence fix, but we don't surface a
            control that reads as a no-op). */}
        {!omittedFromTiming &&
          result.responseTimeMsRaw != null &&
          adjustedMs !== result.responseTimeMsRaw && (
            <button
              type="button"
              data-action="count-full-recorded-time"
              disabled={pending}
              onClick={() =>
                runAction({
                  action: 'set_time',
                  adjustedResponseTimeMs: result.responseTimeMsRaw as number,
                })
              }
              className={actionButtonClass}
            >
              Count the full recorded time
            </button>
          )}

        {!omittedFromTiming &&
          (adjustedMs != null ? (
            <button
              type="button"
              data-action="clear-time"
              disabled={pending}
              onClick={() => runAction({ action: 'clear_time' })}
              className={actionButtonClass}
            >
              Clear manual time
            </button>
          ) : (
            <button
              type="button"
              data-action="toggle-set-time"
              disabled={pending}
              onClick={() => setShowSetTime((v) => !v)}
              className={actionButtonClass}
            >
              Set exact time…
            </button>
          ))}

        {excludedFromMastery ? (
          <button
            type="button"
            data-action="include-mastery"
            disabled={pending}
            onClick={() => runAction({ action: 'include', scope: 'mastery' })}
            className={actionButtonClass}
          >
            Count toward progress
          </button>
        ) : (
          <button
            type="button"
            data-action="exclude-mastery"
            disabled={pending}
            onClick={() => runAction({ action: 'exclude', scope: 'mastery' })}
            className={actionButtonClass}
          >
            Don’t count toward progress
          </button>
        )}
      </div>

      {showSetTime && adjustedMs == null && !omittedFromTiming && (
        <div
          data-element="set-time-form"
          className={css({ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' })}
        >
          <label
            className={css({ fontSize: '0.82rem', color: 'gray.600', _dark: { color: 'gray.400' } })}
          >
            Actual time (seconds):
          </label>
          <input
            type="number"
            min="1"
            step="1"
            data-element="set-time-input"
            value={secondsInput}
            onChange={(e) => setSecondsInput(e.target.value)}
            className={css({
              width: '6rem',
              paddingX: '0.5rem',
              paddingY: '0.35rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: 'gray.300',
              fontSize: '0.85rem',
              _dark: { backgroundColor: 'gray.800', borderColor: 'gray.600', color: 'gray.100' },
            })}
          />
          <button
            type="button"
            data-action="submit-set-time"
            disabled={pending || secondsInput.trim() === ''}
            onClick={submitSetTime}
            className={actionButtonClass}
          >
            Save time
          </button>
        </div>
      )}
    </div>
  )
}
