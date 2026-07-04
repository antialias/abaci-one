import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  formatSessionDate,
  problemsForDuration,
  REFERENCE_MINUTES,
  tierCopy,
} from '../formatting'

describe('formatDuration', () => {
  it('formats sub-second values in ms', () => {
    expect(formatDuration(450)).toBe('450ms')
  })

  it('formats sub-minute values in seconds with one decimal', () => {
    expect(formatDuration(3200)).toBe('3.2s')
    expect(formatDuration(5000)).toBe('5s')
  })

  it('formats minute+second values', () => {
    expect(formatDuration(65_000)).toBe('1m 5s')
  })

  it('formats the real prod 8h01m poison value tidily (no trailing seconds)', () => {
    // 8h 1m = 28,860,000 ms — the 2026-05-28 legacy attempt.
    expect(formatDuration(28_860_000)).toBe('8h 1m')
  })

  it('handles the 5-minute cap boundary', () => {
    expect(formatDuration(300_000)).toBe('5m')
  })
})

describe('problemsForDuration', () => {
  it('floors problems that fit in the reference window', () => {
    // 20 min = 1200s; at 45s/problem → 26.67 → 26.
    expect(problemsForDuration(45)).toBe(26)
    expect(REFERENCE_MINUTES).toBe(20)
  })

  it('reflects a faster (repaired) pace as more problems', () => {
    expect(problemsForDuration(30)).toBe(40)
  })

  it('returns 0 for a non-positive or NaN pace', () => {
    expect(problemsForDuration(0)).toBe(0)
    expect(problemsForDuration(Number.NaN)).toBe(0)
  })

  it('accepts a custom duration', () => {
    expect(problemsForDuration(60, 10)).toBe(10)
  })
})

describe('tierCopy', () => {
  it('labels a legacy-implausible Tier-1 attempt as unrealistic and auto-set-aside', () => {
    const copy = tierCopy('tier1', 'legacy-implausible')
    expect(copy.label).toBe('Unrealistic')
    expect(copy.blurb).toMatch(/set aside automatically/i)
  })

  it('labels an idle-capped Tier-1 attempt as paused', () => {
    expect(tierCopy('tier1', 'idle-capped').label).toBe('Paused')
  })

  it('labels a Tier-2 attempt as still counting until reviewed', () => {
    const copy = tierCopy('tier2', 'unusual-for-child')
    expect(copy.blurb).toMatch(/still counting/i)
  })
})

describe('formatSessionDate', () => {
  it('returns a fallback for null', () => {
    expect(formatSessionDate(null)).toBe('Unknown date')
  })

  it('formats a valid ISO date', () => {
    expect(formatSessionDate('2026-05-28T10:00:00.000Z')).toMatch(/2026/)
  })
})
