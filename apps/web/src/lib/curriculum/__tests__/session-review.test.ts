/**
 * @vitest-environment node
 *
 * Unit tests for the per-attempt review mutation logic (#158).
 *
 * These exercise the pure `computeReviewedResult` transform — no database.
 * DB-backed soft-delete / restore integration tests are deferred until the
 * migration for the soft-delete columns is generated (the ephemeral test DB is
 * built from migration files, not the schema definition).
 */

import { describe, expect, it } from 'vitest'
import type { SlotResult } from '@/db/schema/session-plans'
import {
  computeReviewedResult,
  SessionReviewError,
  SET_TIME_MAX_MS,
  SET_TIME_MIN_MS,
} from '../session-review'
import { getEffectiveResponseTimeMs } from '../timing/effective-time'

const REVIEWER = 'user-adult-1'
const NOW = new Date('2026-07-03T12:00:00.000Z')

function makeSlot(overrides: Partial<SlotResult> = {}): SlotResult {
  return {
    slotId: 'slot-0',
    partNumber: 1,
    slotIndex: 0,
    problem: {} as SlotResult['problem'],
    studentAnswer: 3,
    isCorrect: true,
    responseTimeMs: 5000,
    skillsExercised: ['skillX'],
    usedOnScreenAbacus: false,
    timestamp: new Date('2025-01-01T10:00:00Z'),
    hadHelp: false,
    incorrectAttempts: 0,
    ...overrides,
  }
}

describe('computeReviewedResult', () => {
  describe('mark_correct', () => {
    it('flips an incorrect result to correct and stamps the reviewer', () => {
      const result = makeSlot({ isCorrect: false, epochNumber: 1 })
      const next = computeReviewedResult(result, { action: 'mark_correct' }, REVIEWER, NOW)
      expect(next.isCorrect).toBe(true)
      expect(next.masteryWeight).toBe(0.5)
      expect(next.source).toBe('teacher-corrected')
      expect(next.timingReview?.reviewedBy).toBe(REVIEWER)
      expect(next.timingReview?.reviewedAt).toBe(NOW.toISOString())
    })

    it('throws 400 if already correct', () => {
      const result = makeSlot({ isCorrect: true })
      expect(() => computeReviewedResult(result, { action: 'mark_correct' }, REVIEWER, NOW)).toThrow(
        SessionReviewError
      )
    })
  })

  describe('exclude / include — scope mastery (default, backward compatible)', () => {
    it('sets teacher-excluded and preserves the original source', () => {
      const result = makeSlot({ source: 'practice' })
      const next = computeReviewedResult(result, { action: 'exclude' }, REVIEWER, NOW)
      expect(next.source).toBe('teacher-excluded')
      expect(next.originalSource).toBe('practice')
      // Timing sample is untouched by a mastery-only exclusion.
      expect(getEffectiveResponseTimeMs(next)).toBe(5000)
    })

    it('include restores the original source and clears originalSource', () => {
      const excluded = computeReviewedResult(
        makeSlot({ source: 'practice' }),
        { action: 'exclude' },
        REVIEWER,
        NOW
      )
      const restored = computeReviewedResult(excluded, { action: 'include' }, REVIEWER, NOW)
      expect(restored.source).toBe('practice')
      expect(restored.originalSource).toBeUndefined()
    })

    it('include tolerates the legacy untyped _originalSource key', () => {
      const legacy = makeSlot({ source: 'teacher-excluded' }) as SlotResult & {
        _originalSource?: string
      }
      legacy._originalSource = 'teacher-corrected'
      const restored = computeReviewedResult(legacy, { action: 'include' }, REVIEWER, NOW)
      expect(restored.source).toBe('teacher-corrected')
      expect((restored as { _originalSource?: string })._originalSource).toBeUndefined()
    })

    it('throws 400 when excluding an already-excluded result', () => {
      const result = makeSlot({ source: 'teacher-excluded' })
      expect(() => computeReviewedResult(result, { action: 'exclude' }, REVIEWER, NOW)).toThrow(
        SessionReviewError
      )
    })

    it('throws 400 when including a non-excluded result', () => {
      const result = makeSlot({ source: 'practice' })
      expect(() => computeReviewedResult(result, { action: 'include' }, REVIEWER, NOW)).toThrow(
        SessionReviewError
      )
    })
  })

  describe('exclude / include — scope timing', () => {
    it('omits only the timing sample, leaving mastery source intact', () => {
      const result = makeSlot({ source: 'practice' })
      const next = computeReviewedResult(
        result,
        { action: 'exclude', scope: 'timing' },
        REVIEWER,
        NOW
      )
      expect(next.source).toBe('practice')
      expect(next.timingReview?.omitFromTiming).toBe(true)
      expect(getEffectiveResponseTimeMs(next)).toBeNull()
    })

    it('include (timing) restores the timing sample', () => {
      const omitted = computeReviewedResult(
        makeSlot(),
        { action: 'exclude', scope: 'timing' },
        REVIEWER,
        NOW
      )
      const restored = computeReviewedResult(
        omitted,
        { action: 'include', scope: 'timing' },
        REVIEWER,
        NOW
      )
      expect(restored.timingReview?.omitFromTiming).toBe(false)
      expect(getEffectiveResponseTimeMs(restored)).toBe(5000)
    })
  })

  describe('exclude — scope both', () => {
    it('sets both mastery exclusion and timing omission, reversible independently', () => {
      const both = computeReviewedResult(
        makeSlot({ source: 'practice' }),
        { action: 'exclude', scope: 'both' },
        REVIEWER,
        NOW
      )
      expect(both.source).toBe('teacher-excluded')
      expect(both.timingReview?.omitFromTiming).toBe(true)

      // Reverse mastery only — timing omission remains.
      const masteryBack = computeReviewedResult(
        both,
        { action: 'include', scope: 'mastery' },
        REVIEWER,
        NOW
      )
      expect(masteryBack.source).toBe('practice')
      expect(masteryBack.timingReview?.omitFromTiming).toBe(true)
      expect(getEffectiveResponseTimeMs(masteryBack)).toBeNull()
    })
  })

  describe('set_time / clear_time', () => {
    it('stores an adjusted time without mutating responseTimeMs', () => {
      const result = makeSlot({ responseTimeMs: 28_860_000, responseTimeMsRaw: 28_860_000 })
      const next = computeReviewedResult(
        result,
        { action: 'set_time', adjustedResponseTimeMs: 42_000 },
        REVIEWER,
        NOW
      )
      expect(next.timingReview?.adjustedResponseTimeMs).toBe(42_000)
      // Raw measurement is never mutated.
      expect(next.responseTimeMs).toBe(28_860_000)
      expect(next.responseTimeMsRaw).toBe(28_860_000)
      expect(getEffectiveResponseTimeMs(next)).toBe(42_000)
    })

    it('accepts the full-recorded-time restore (raw value above the auto-pause cap)', () => {
      const result = makeSlot({ responseTimeMs: 300_000, responseTimeMsRaw: 480_060_000 })
      // 8h01m raw restore — allowed because bounds are 1s..24h, not a 30min cap.
      const next = computeReviewedResult(
        result,
        { action: 'set_time', adjustedResponseTimeMs: SET_TIME_MAX_MS },
        REVIEWER,
        NOW
      )
      expect(next.timingReview?.adjustedResponseTimeMs).toBe(SET_TIME_MAX_MS)
    })

    it('rejects out-of-bounds and non-integer times', () => {
      const result = makeSlot()
      expect(() =>
        computeReviewedResult(
          result,
          { action: 'set_time', adjustedResponseTimeMs: SET_TIME_MIN_MS - 1 },
          REVIEWER,
          NOW
        )
      ).toThrow(SessionReviewError)
      expect(() =>
        computeReviewedResult(
          result,
          { action: 'set_time', adjustedResponseTimeMs: SET_TIME_MAX_MS + 1 },
          REVIEWER,
          NOW
        )
      ).toThrow(SessionReviewError)
      expect(() =>
        computeReviewedResult(
          result,
          { action: 'set_time', adjustedResponseTimeMs: 1234.5 },
          REVIEWER,
          NOW
        )
      ).toThrow(SessionReviewError)
    })

    it('clear_time removes the adjustment and restores the measured time', () => {
      const adjusted = computeReviewedResult(
        makeSlot({ responseTimeMs: 5000 }),
        { action: 'set_time', adjustedResponseTimeMs: 42_000 },
        REVIEWER,
        NOW
      )
      const cleared = computeReviewedResult(adjusted, { action: 'clear_time' }, REVIEWER, NOW)
      expect(cleared.timingReview?.adjustedResponseTimeMs ?? null).toBeNull()
      expect(getEffectiveResponseTimeMs(cleared)).toBe(5000)
    })

    it('clear_time throws when there is nothing to clear', () => {
      expect(() => computeReviewedResult(makeSlot(), { action: 'clear_time' }, REVIEWER, NOW)).toThrow(
        SessionReviewError
      )
    })
  })

  describe('confirm_timing / unconfirm_timing', () => {
    it('marks the value confirmed but leaves the effective time unchanged', () => {
      const result = makeSlot({ responseTimeMs: 95_000 })
      const next = computeReviewedResult(result, { action: 'confirm_timing' }, REVIEWER, NOW)
      expect(next.timingReview?.timingConfirmed).toBe(true)
      // The genuine value stays in the estimate; confirm only silences the flag.
      expect(getEffectiveResponseTimeMs(next)).toBe(95_000)
    })

    it('unconfirm clears the confirmed flag (value still unchanged)', () => {
      const confirmed = computeReviewedResult(
        makeSlot({ responseTimeMs: 95_000 }),
        { action: 'confirm_timing' },
        REVIEWER,
        NOW
      )
      const unconfirmed = computeReviewedResult(
        confirmed,
        { action: 'unconfirm_timing' },
        REVIEWER,
        NOW
      )
      expect(unconfirmed.timingReview?.timingConfirmed).toBe(false)
      expect(getEffectiveResponseTimeMs(unconfirmed)).toBe(95_000)
    })

    it('confirm preserves an unrelated prior review field (omit) and never mutates raw', () => {
      const omitted = computeReviewedResult(
        makeSlot({ responseTimeMs: 95_000 }),
        { action: 'exclude', scope: 'timing' },
        REVIEWER,
        NOW
      )
      const confirmed = computeReviewedResult(omitted, { action: 'confirm_timing' }, REVIEWER, NOW)
      expect(confirmed.timingReview?.omitFromTiming).toBe(true)
      expect(confirmed.timingReview?.timingConfirmed).toBe(true)
      expect(confirmed.responseTimeMs).toBe(95_000)
    })
  })

  describe('invariants', () => {
    it('set_time clears a prior omit so the adjusted value counts (FIX C coherence)', () => {
      // Omit wins over an adjusted value in the resolution order, so set_time
      // must clear omit — otherwise the manual value would be silently dead.
      const omitted = computeReviewedResult(
        makeSlot(),
        { action: 'exclude', scope: 'timing' },
        REVIEWER,
        NOW
      )
      expect(omitted.timingReview?.omitFromTiming).toBe(true)
      const alsoAdjusted = computeReviewedResult(
        omitted,
        { action: 'set_time', adjustedResponseTimeMs: 3000 },
        REVIEWER,
        NOW
      )
      expect(alsoAdjusted.timingReview?.omitFromTiming).toBe(false)
      expect(alsoAdjusted.timingReview?.adjustedResponseTimeMs).toBe(3000)
      expect(getEffectiveResponseTimeMs(alsoAdjusted)).toBe(3000)
    })

    it('never mutates the input result', () => {
      const result = makeSlot({ source: 'practice', responseTimeMs: 5000 })
      const snapshot = JSON.parse(JSON.stringify(result))
      computeReviewedResult(result, { action: 'exclude', scope: 'both' }, REVIEWER, NOW)
      computeReviewedResult(result, { action: 'set_time', adjustedResponseTimeMs: 9000 }, REVIEWER, NOW)
      expect(JSON.parse(JSON.stringify(result))).toEqual(snapshot)
    })
  })
})
