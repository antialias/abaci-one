/**
 * Pure display helpers for the timing-review UI (#158).
 *
 * Kept framework-free so the numbers on the review cards and the estimate
 * header stay consistent and are unit-testable without rendering.
 */

import type { AttemptTimingReason } from '@/lib/curriculum/timing/effective-time'

/** Reference window the "≈ N problems" estimate is quoted against on the page. */
export const REFERENCE_MINUTES = 20

/**
 * How many problems fit in `minutes` at a given seconds-per-problem pace. Mirrors
 * the intent of the Start-Practice estimate at the coarse header level (floor —
 * you only finish whole problems). Returns 0 for a non-positive/NaN pace.
 */
export function problemsForDuration(secondsPerProblem: number, minutes = REFERENCE_MINUTES): number {
  if (!Number.isFinite(secondsPerProblem) || secondsPerProblem <= 0) return 0
  return Math.floor((minutes * 60) / secondsPerProblem)
}

/**
 * Human-readable duration: sub-second → `450ms`, sub-minute → `3.2s`, otherwise
 * `8h 1m` / `1m 5s`. Handles the pathological legacy values (e.g. an 8h01m
 * attempt) without scientific notation.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`

  const totalSeconds = ms / 1000
  if (totalSeconds < 60) {
    const rounded = Math.round(totalSeconds * 10) / 10
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}s`
  }

  const wholeSeconds = Math.round(totalSeconds)
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const seconds = wholeSeconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  // Only show trailing seconds when the value is under an hour (keeps big
  // durations tidy: "8h 1m", not "8h 1m 0s").
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`)
  return parts.join(' ') || '0s'
}

export interface TierCopy {
  /** Short badge label. */
  label: string
  /** One-sentence parent-facing explanation of why it was flagged. */
  blurb: string
}

/** Parent-facing copy for a flagged attempt's tier + reason. */
export function tierCopy(
  tier: 'tier1' | 'tier2',
  reason?: AttemptTimingReason
): TierCopy {
  if (tier === 'tier1') {
    if (reason === 'idle-capped') {
      return {
        label: 'Paused',
        blurb:
          'The timer kept running while this problem sat idle, so its time is set aside automatically and is not counting toward the pace estimate.',
      }
    }
    return {
      label: 'Unrealistic',
      blurb:
        'This time is longer than any real problem should take, so it is set aside automatically and is not counting toward the pace estimate.',
    }
  }
  return {
    label: 'Much slower than usual',
    blurb:
      'This attempt was much slower than this student’s typical pace. It is still counting toward the estimate until you review it.',
  }
}

/** Format an ISO date string as a short local date, tolerating null. */
export function formatSessionDate(iso: string | null): string {
  if (!iso) return 'Unknown date'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown date'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
