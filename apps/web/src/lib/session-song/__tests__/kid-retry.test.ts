import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({ db: {}, schema: { sessionSongs: {} } }))

import { KID_RETRY_LIMIT, kidRetryRefusal, type RetryCandidate } from '../kid-retry'

const failedAt = new Date('2026-11-14T18:00:00Z')
const later = new Date('2026-11-25T18:00:00Z')

function failed(overrides: Partial<RetryCandidate> = {}): RetryCandidate {
  return {
    status: 'failed',
    failureKind: 'rate_limited',
    errorMessage: '429 rate limit',
    regenerationCount: 0,
    createdAt: failedAt,
    ...overrides,
  }
}

const workingNow = { status: 'completed', createdAt: later }

describe('kidRetryRefusal', () => {
  it('allows a song that failed for a passing reason once songs work again', () => {
    for (const kind of [
      'rate_limited',
      'transient',
      'quota_exceeded',
      'auth_invalid',
      'missing_config',
    ] as const) {
      expect(kidRetryRefusal(failed({ failureKind: kind }), workingNow)).toBeNull()
    }
  })

  it('classifies older failures that were stored without a kind', () => {
    expect(kidRetryRefusal(failed({ failureKind: null }), workingNow)).toBeNull()
    expect(
      kidRetryRefusal(failed({ failureKind: null, errorMessage: 'something odd' }), workingNow)
    ).toMatch(/grown-up/)
  })

  it('leaves unknown failures to a grown-up', () => {
    expect(kidRetryRefusal(failed({ failureKind: 'unknown' }), workingNow)).toMatch(/grown-up/)
  })

  it('waits until the newest song in the app has finished, after this one failed', () => {
    expect(kidRetryRefusal(failed(), null)).toMatch(/not working yet/)
    expect(kidRetryRefusal(failed(), { status: 'failed', createdAt: later })).toMatch(
      /not working yet/
    )
    expect(
      kidRetryRefusal(failed(), { status: 'completed', createdAt: new Date('2026-11-01') })
    ).toMatch(/not working yet/)
  })

  it(`stops after ${KID_RETRY_LIMIT} tries`, () => {
    expect(
      kidRetryRefusal(failed({ regenerationCount: KID_RETRY_LIMIT - 1 }), workingNow)
    ).toBeNull()
    expect(kidRetryRefusal(failed({ regenerationCount: KID_RETRY_LIMIT }), workingNow)).toMatch(
      /tried enough/
    )
  })

  it('never retries a song that is not missing', () => {
    expect(kidRetryRefusal(failed({ status: 'completed' }), workingNow)).toMatch(/missing song/)
    expect(kidRetryRefusal(failed({ status: 'generating' }), workingNow)).toMatch(/missing song/)
  })
})
