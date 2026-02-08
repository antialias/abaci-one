/**
 * @vitest-environment node
 *
 * Session Timing Configuration Tests
 *
 * Tests for DEFAULT_SECONDS_PER_PROBLEM, MIN_SECONDS_PER_PROBLEM,
 * SESSION_TIMEOUT_HOURS, and REVIEW_INTERVAL_DAYS.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SECONDS_PER_PROBLEM,
  MIN_SECONDS_PER_PROBLEM,
  SESSION_TIMEOUT_HOURS,
  REVIEW_INTERVAL_DAYS,
} from '@/lib/curriculum/config/session-timing'

// =============================================================================
// DEFAULT_SECONDS_PER_PROBLEM
// =============================================================================

describe('DEFAULT_SECONDS_PER_PROBLEM', () => {
  it('is 45 seconds', () => {
    expect(DEFAULT_SECONDS_PER_PROBLEM).toBe(45)
  })

  it('is a reasonable time for a new student', () => {
    // A new student should have enough time to read, think, and answer
    expect(DEFAULT_SECONDS_PER_PROBLEM).toBeGreaterThanOrEqual(20)
    expect(DEFAULT_SECONDS_PER_PROBLEM).toBeLessThanOrEqual(120)
  })
})

// =============================================================================
// MIN_SECONDS_PER_PROBLEM
// =============================================================================

describe('MIN_SECONDS_PER_PROBLEM', () => {
  it('is 10 seconds', () => {
    expect(MIN_SECONDS_PER_PROBLEM).toBe(10)
  })

  it('is less than the default', () => {
    expect(MIN_SECONDS_PER_PROBLEM).toBeLessThan(DEFAULT_SECONDS_PER_PROBLEM)
  })

  it('is positive', () => {
    expect(MIN_SECONDS_PER_PROBLEM).toBeGreaterThan(0)
  })

  it('prevents generating too many problems in a 5-minute session', () => {
    const sessionSeconds = 5 * 60
    const maxProblems = Math.floor(sessionSeconds / MIN_SECONDS_PER_PROBLEM)
    // 300 / 10 = 30 problems max, which is reasonable
    expect(maxProblems).toBeLessThanOrEqual(30)
    expect(maxProblems).toBeGreaterThanOrEqual(10)
  })
})

// =============================================================================
// SESSION_TIMEOUT_HOURS
// =============================================================================

describe('SESSION_TIMEOUT_HOURS', () => {
  it('is 24 hours', () => {
    expect(SESSION_TIMEOUT_HOURS).toBe(24)
  })

  it('is positive', () => {
    expect(SESSION_TIMEOUT_HOURS).toBeGreaterThan(0)
  })
})

// =============================================================================
// REVIEW_INTERVAL_DAYS
// =============================================================================

describe('REVIEW_INTERVAL_DAYS', () => {
  it('mastered review interval is 7 days', () => {
    expect(REVIEW_INTERVAL_DAYS.mastered).toBe(7)
  })

  it('practicing review interval is 3 days', () => {
    expect(REVIEW_INTERVAL_DAYS.practicing).toBe(3)
  })

  it('practicing interval is shorter than mastered (more frequent review)', () => {
    expect(REVIEW_INTERVAL_DAYS.practicing).toBeLessThan(REVIEW_INTERVAL_DAYS.mastered)
  })

  it('both intervals are positive', () => {
    expect(REVIEW_INTERVAL_DAYS.mastered).toBeGreaterThan(0)
    expect(REVIEW_INTERVAL_DAYS.practicing).toBeGreaterThan(0)
  })
})
