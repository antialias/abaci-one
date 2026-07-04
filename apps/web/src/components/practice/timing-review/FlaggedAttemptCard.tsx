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

import { useState, type ReactNode } from 'react'
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

/** Small "here's the current state" chip, tinted by whether the attempt counts. */
const pillBase = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  paddingX: '0.55rem',
  paddingY: '0.2rem',
  borderRadius: 'full',
  border: '1px solid',
  fontSize: '0.75rem',
  fontWeight: 'semibold',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
})
const pillToneClass: Record<'counting' | 'notCounting' | 'edited', string> = {
  counting: css({
    color: 'green.700',
    backgroundColor: 'green.50',
    borderColor: 'green.200',
    _dark: { color: 'green.300', backgroundColor: 'rgba(6,78,59,0.4)', borderColor: 'green.800' },
  }),
  notCounting: css({
    color: 'gray.600',
    backgroundColor: 'gray.100',
    borderColor: 'gray.300',
    _dark: { color: 'gray.300', backgroundColor: 'gray.800', borderColor: 'gray.600' },
  }),
  edited: css({
    color: 'blue.700',
    backgroundColor: 'blue.50',
    borderColor: 'blue.200',
    _dark: { color: 'blue.300', backgroundColor: 'rgba(30,58,138,0.35)', borderColor: 'blue.800' },
  }),
}

function StatusPill({
  tone,
  children,
}: {
  tone: 'counting' | 'notCounting' | 'edited'
  children: ReactNode
}) {
  return (
    <span
      data-element="axis-status"
      data-status={tone}
      className={`${pillBase} ${pillToneClass[tone]}`}
    >
      <span
        aria-hidden="true"
        className={css({ width: '0.5rem', height: '0.5rem', borderRadius: 'full', backgroundColor: 'currentColor', flexShrink: 0 })}
      />
      {children}
    </span>
  )
}

// Segmented (radio-style) two-state control, so a binary choice reads as the
// toggle it is: both options visible, the current one filled.
const segTrack = css({
  display: 'inline-flex',
  padding: '2px',
  gap: '2px',
  borderRadius: '9px',
  border: '1px solid',
  borderColor: 'gray.200',
  backgroundColor: 'gray.100',
  _dark: { backgroundColor: 'gray.900', borderColor: 'gray.700' },
})
const segBase = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  paddingX: '0.7rem',
  paddingY: '0.35rem',
  borderRadius: '7px',
  fontSize: '0.82rem',
  fontWeight: 'medium',
  border: '1px solid transparent',
  transition: 'all 0.12s',
  _disabled: { opacity: 0.55, cursor: 'not-allowed' },
})
const segInactive = css({
  color: 'gray.600',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  _hover: { backgroundColor: 'gray.200' },
  _dark: { color: 'gray.400', _hover: { backgroundColor: 'gray.800' } },
})
const segActiveClass: Record<'counting' | 'notCounting', string> = {
  counting: css({
    cursor: 'default',
    fontWeight: 'semibold',
    color: 'green.800',
    backgroundColor: 'white',
    borderColor: 'green.300',
    boxShadow: 'sm',
    _dark: { color: 'green.200', backgroundColor: 'gray.700', borderColor: 'green.700' },
  }),
  notCounting: css({
    cursor: 'default',
    fontWeight: 'semibold',
    color: 'gray.900',
    backgroundColor: 'white',
    borderColor: 'gray.300',
    boxShadow: 'sm',
    _dark: { color: 'gray.50', backgroundColor: 'gray.700', borderColor: 'gray.500' },
  }),
}

// A "Count it as" value picker: the recorded-time preset and custom entry are
// two facets of ONE setting (both write the adjusted time), so they live in a
// single connected control rather than reading as unrelated buttons.
const valueGroupWrap = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
})
const valueGroupLabel = css({
  fontSize: '0.8rem',
  color: 'gray.500',
  _dark: { color: 'gray.400' },
})
const joinedGroup = css({
  display: 'inline-flex',
  alignItems: 'stretch',
  borderRadius: '9px',
  border: '1px solid',
  borderColor: 'gray.300',
  overflow: 'hidden',
  _dark: { borderColor: 'gray.600' },
})
const joinedSeg = css({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingX: '0.8rem',
  paddingY: '0.4rem',
  fontSize: '0.85rem',
  fontWeight: 'medium',
  lineHeight: 1.15,
  backgroundColor: 'white',
  color: 'gray.800',
  cursor: 'pointer',
  transition: 'all 0.12s',
  borderLeftWidth: '1px',
  borderLeftStyle: 'solid',
  borderLeftColor: 'gray.200',
  _first: { borderLeftWidth: '0' },
  _hover: { backgroundColor: 'gray.100' },
  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
  _dark: {
    backgroundColor: 'gray.800',
    color: 'gray.100',
    borderLeftColor: 'gray.700',
    _hover: { backgroundColor: 'gray.700' },
  },
})
const joinedSegSelected = css({
  backgroundColor: 'blue.50',
  color: 'blue.800',
  _hover: { backgroundColor: 'blue.100' },
  _dark: {
    backgroundColor: 'rgba(30,58,138,0.4)',
    color: 'blue.100',
    _hover: { backgroundColor: 'rgba(30,58,138,0.5)' },
  },
})
const joinedSegSub = css({
  fontSize: '0.7rem',
  fontWeight: 'normal',
  fontVariantNumeric: 'tabular-nums',
  opacity: 0.7,
})
const resetLink = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.2rem',
  fontSize: '0.78rem',
  fontWeight: 'medium',
  color: 'gray.500',
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  _hover: { color: 'gray.700' },
  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
  _dark: { color: 'gray.400', _hover: { color: 'gray.200' } },
})

interface SegmentOption {
  key: string
  label: string
  active: boolean
  tone: 'counting' | 'notCounting'
  dataAction: string
  onSelect: () => void
  disabled?: boolean
}

function SegmentedToggle({ options }: { options: readonly SegmentOption[] }) {
  return (
    <div data-element="segmented-toggle" role="group" className={segTrack}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          data-action={opt.dataAction}
          aria-pressed={opt.active}
          disabled={opt.disabled}
          // Clicking the already-active segment is a no-op (avoids a redundant
          // mutation); only the inactive one triggers a change.
          onClick={opt.active ? undefined : opt.onSelect}
          className={`${segBase} ${opt.active ? segActiveClass[opt.tone] : segInactive}`}
        >
          {opt.active && <span aria-hidden="true">✓</span>}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

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

/**
 * A titled cluster of repair buttons for one axis (pace vs. mastery). The label
 * + caption name *what the buttons in it affect*, which is what disambiguates
 * the two otherwise-similar "don't count this" actions.
 */
function ActionGroup({
  group,
  icon,
  label,
  caption,
  status,
  children,
}: {
  group: string
  icon: string
  label: string
  caption: string
  /** Current-state chip shown top-right — the thing the buttons below change. */
  status?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      data-element="action-group"
      data-group={group}
      className={css({ display: 'flex', flexDirection: 'column', gap: '0.45rem' })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.5rem 0.75rem',
          flexWrap: 'wrap',
        })}
      >
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.1rem' })}>
          <span
            data-element="action-group-label"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.72rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'gray.600',
              _dark: { color: 'gray.300' },
            })}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </span>
          <span
            data-element="action-group-caption"
            className={css({ fontSize: '0.75rem', color: 'gray.500', _dark: { color: 'gray.400' } })}
          >
            {caption}
          </span>
        </div>
        {status}
      </div>
      <div
        className={css({ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' })}
      >
        {children}
      </div>
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
  // The full un-capped span (present only when a guard trimmed the stored value,
  // e.g. idle-capped). When it exists, it becomes the "Full recorded" preset in
  // the Count-it-as picker.
  const rawMs = result.responseTimeMsRaw

  // Current effective handling for the pace estimate, surfaced as a chip so the
  // "set aside automatically / not counting" state is obvious at a glance. NOTE:
  // a Tier-1 attempt is auto-excluded even though it still has a stored value,
  // so "counting" is tier-aware, not merely `effectiveMs != null`.
  const paceStatus: { tone: 'counting' | 'notCounting' | 'edited'; label: string } =
    omittedFromTiming
      ? { tone: 'notCounting', label: 'Not counting' }
      : adjustedMs != null
        ? { tone: 'edited', label: `Counting as ${formatDuration(adjustedMs)}` }
        : attempt.tier === 'tier1'
          ? { tone: 'notCounting', label: 'Not counting' }
          : {
              tone: 'counting',
              label:
                attempt.effectiveMs != null
                  ? `Counting as ${formatDuration(attempt.effectiveMs)}`
                  : 'Counting',
            }

  const masteryCounting = !excludedFromMastery
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

      {/* Actions — split into two labeled axes so the near-identical "don't
          count" controls read as the different things they are: one changes the
          pace estimate, the other changes skill mastery. */}
      <div
        data-element="repair-actions"
        className={css({ display: 'flex', flexDirection: 'column', gap: '0.85rem' })}
      >
        <ActionGroup
          group="timing"
          icon="⏱"
          label="Pace estimate"
          caption="Whether this answer’s time is used to estimate practice length — and at what value."
          status={<StatusPill tone={paceStatus.tone}>{paceStatus.label}</StatusPill>}
        >
          {omittedFromTiming ? (
            <button
              type="button"
              data-action="include-timing"
              disabled={pending}
              onClick={() => runAction({ action: 'include', scope: 'timing' })}
              className={actionButtonClass}
            >
              Count this time again
            </button>
          ) : (
            <>
              <button
                type="button"
                data-action="exclude-timing"
                disabled={pending}
                onClick={() => runAction({ action: 'exclude', scope: 'timing' })}
                className={actionButtonClass}
              >
                Ignore this time
              </button>

              {/* One control, not two: the recorded-time preset and custom entry
                  both write the counted value, so they sit in a single connected
                  picker under a shared "Count it as" label. The recorded preset
                  only appears when a guard left a distinct raw span to fall back
                  to; otherwise the sole way to set a value is a custom time. */}
              <div data-element="pace-value" className={valueGroupWrap}>
                <span className={valueGroupLabel}>Count it as</span>
                <div role="group" aria-label="Counted time" className={joinedGroup}>
                  {rawMs != null && (
                    <button
                      type="button"
                      data-action="count-full-recorded-time"
                      aria-pressed={adjustedMs === rawMs}
                      disabled={pending}
                      onClick={() =>
                        runAction({ action: 'set_time', adjustedResponseTimeMs: rawMs })
                      }
                      className={`${joinedSeg} ${adjustedMs === rawMs ? joinedSegSelected : ''}`}
                    >
                      <span>Full recorded</span>
                      <span className={joinedSegSub}>{formatDuration(rawMs)}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    data-action="toggle-set-time"
                    aria-pressed={adjustedMs != null && adjustedMs !== rawMs}
                    disabled={pending}
                    onClick={() => {
                      const opening = !showSetTime
                      setShowSetTime(opening)
                      // Prefill with the current custom value so editing starts
                      // from where it is, not a blank field.
                      if (opening) {
                        setSecondsInput(
                          adjustedMs != null ? String(Math.round(adjustedMs / 1000)) : ''
                        )
                      }
                    }}
                    className={`${joinedSeg} ${
                      adjustedMs != null && adjustedMs !== rawMs ? joinedSegSelected : ''
                    }`}
                  >
                    {adjustedMs != null && adjustedMs !== rawMs ? (
                      <>
                        <span>Custom</span>
                        <span className={joinedSegSub}>{formatDuration(adjustedMs)}</span>
                      </>
                    ) : (
                      <span>Custom…</span>
                    )}
                  </button>
                </div>
                {adjustedMs != null && (
                  <button
                    type="button"
                    data-action="clear-time"
                    disabled={pending}
                    onClick={() => runAction({ action: 'clear_time' })}
                    className={resetLink}
                  >
                    ↩ Reset to automatic
                  </button>
                )}
              </div>
            </>
          )}

          {/* "Keep it counting" only makes sense for a Tier-2 attempt — one
              that's slow-but-plausible and currently counting. For a Tier-1
              attempt the value is set-aside/broken, so vouching it as real is
              incoherent; there the meaningful moves are Ignore or Count-it-as. */}
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
            attempt.tier === 'tier2' &&
            !omittedFromTiming &&
            adjustedMs == null && (
              <button
                type="button"
                data-action="confirm-timing"
                disabled={pending}
                onClick={() => confirmMutation.mutate(target)}
                className={actionButtonClass}
              >
                Looks right — keep it
              </button>
            )
          )}
        </ActionGroup>

        <ActionGroup
          group="mastery"
          icon="🎯"
          label="Skill progress"
          caption="Whether this answer counts toward this skill’s mastery."
        >
          <SegmentedToggle
            options={[
              {
                key: 'count',
                label: 'Counts toward progress',
                active: masteryCounting,
                tone: 'counting',
                dataAction: 'include-mastery',
                disabled: pending,
                onSelect: () => runAction({ action: 'include', scope: 'mastery' }),
              },
              {
                key: 'exclude',
                label: 'Doesn’t count',
                active: !masteryCounting,
                tone: 'notCounting',
                dataAction: 'exclude-mastery',
                disabled: pending,
                onSelect: () => runAction({ action: 'exclude', scope: 'mastery' }),
              },
            ]}
          />
        </ActionGroup>
      </div>

      {showSetTime && !omittedFromTiming && (
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
