import { describe, it, expect } from 'vitest'
import {
  applyResponseTimeGuard,
  sanitizeResultTiming,
  type SanitizeTimingInput,
} from '../response-time-guard'
import { MAX_RESPONSE_TIME_CAP_MS } from '../constants'

// The per-child auto-pause cap used at the client seam in these tests (30s —
// the minimum prod-clamped threshold, exercising the debug-timing lower bound).
const CLIENT_CAP = 30_000

// ============================================================================
// applyResponseTimeGuard (client capture-time guard)
// ============================================================================

describe('applyResponseTimeGuard', () => {
  it('passes an in-bounds value through with no extra fields (legacy row shape)', () => {
    const result = applyResponseTimeGuard(12_345, CLIENT_CAP, 'client')
    expect(result).toEqual({ responseTimeMs: 12_345 })
    // Explicitly: no guard flags leaked onto a plain measurement.
    expect(result).not.toHaveProperty('wasIdleCapped')
    expect(result).not.toHaveProperty('responseTimeMsRaw')
    expect(result).not.toHaveProperty('capReason')
  })

  it('passes a value exactly at the cap through untouched', () => {
    expect(applyResponseTimeGuard(CLIENT_CAP, CLIENT_CAP, 'client')).toEqual({
      responseTimeMs: CLIENT_CAP,
    })
  })

  it('passes zero through untouched', () => {
    expect(applyResponseTimeGuard(0, CLIENT_CAP, 'client')).toEqual({ responseTimeMs: 0 })
  })

  it('caps a value above the threshold, preserving the raw and flagging idle-exceeded', () => {
    // Device slept with the tab visible: no visibility event fired, so the full
    // delta reaches the seam and only the cap catches it.
    const raw = 45_000
    const result = applyResponseTimeGuard(raw, CLIENT_CAP, 'client')
    expect(result).toEqual({
      responseTimeMs: CLIENT_CAP,
      responseTimeMsRaw: raw,
      wasIdleCapped: true,
      capReason: 'idle-exceeded',
      capThresholdMs: CLIENT_CAP,
      capSource: 'client',
    })
  })

  it('caps the 8h production repro at the client cap with the raw preserved', () => {
    const raw = 8 * 60 * 60 * 1000 // 28_800_000
    const result = applyResponseTimeGuard(raw, CLIENT_CAP, 'client')
    expect(result.responseTimeMs).toBe(CLIENT_CAP)
    expect(result.responseTimeMsRaw).toBe(raw)
    expect(result.wasIdleCapped).toBe(true)
    expect(result.capReason).toBe('idle-exceeded')
  })

  it('clamps a negative delta to 0 and flags it as a clock anomaly', () => {
    const raw = -5_000
    const result = applyResponseTimeGuard(raw, CLIENT_CAP, 'client')
    expect(result).toEqual({
      responseTimeMs: 0,
      responseTimeMsRaw: raw,
      wasIdleCapped: true,
      capReason: 'clock-anomaly',
      capThresholdMs: CLIENT_CAP,
      capSource: 'client',
    })
  })

  it('honors the contract invariant: raw is present iff the sample was capped', () => {
    const plain = applyResponseTimeGuard(10_000, CLIENT_CAP, 'client')
    expect(plain.wasIdleCapped).toBeUndefined()
    expect(plain.responseTimeMsRaw).toBeUndefined()

    const capped = applyResponseTimeGuard(999_999, CLIENT_CAP, 'client')
    expect(capped.wasIdleCapped).toBe(true)
    expect(capped.responseTimeMsRaw).toBeDefined()
  })

  it('records the exact cap that was applied via capThresholdMs', () => {
    const result = applyResponseTimeGuard(120_000, 60_000, 'client')
    expect(result.responseTimeMs).toBe(60_000)
    expect(result.capThresholdMs).toBe(60_000)
  })

  it('stamps capSource from the source argument', () => {
    expect(applyResponseTimeGuard(999_999, CLIENT_CAP, 'server').capSource).toBe('server')
  })
})

// ============================================================================
// sanitizeResultTiming (server backstop)
// ============================================================================

/** Build a minimal sanitize input; overrides win over a plain 30s default. */
function input(overrides: Partial<SanitizeTimingInput> = {}): SanitizeTimingInput {
  return { responseTimeMs: 30_000, ...overrides }
}

describe('sanitizeResultTiming', () => {
  it('leaves a normal in-range value untouched (empty patch)', () => {
    expect(sanitizeResultTiming(input({ responseTimeMs: 42_000 }))).toEqual({})
  })

  it('leaves a value exactly at the ceiling untouched', () => {
    expect(sanitizeResultTiming(input({ responseTimeMs: MAX_RESPONSE_TIME_CAP_MS }))).toEqual({})
  })

  it('passes a client-capped value through untouched', () => {
    const clientCapped = input({
      responseTimeMs: 30_000,
      responseTimeMsRaw: 8 * 60 * 60 * 1000,
      wasIdleCapped: true,
      capReason: 'idle-exceeded',
      capThresholdMs: 30_000,
      capSource: 'client',
    })
    expect(sanitizeResultTiming(clientCapped)).toEqual({})
  })

  it('caps an unflagged stale-client 8h value at the ceiling with server flags', () => {
    const raw = 8 * 60 * 60 * 1000
    expect(sanitizeResultTiming(input({ responseTimeMs: raw }))).toEqual({
      responseTimeMsRaw: raw,
      responseTimeMs: MAX_RESPONSE_TIME_CAP_MS,
      wasIdleCapped: true,
      capReason: 'clock-anomaly',
      capThresholdMs: MAX_RESPONSE_TIME_CAP_MS,
      capSource: 'server',
    })
  })

  it('normalizes an inconsistent combo (flagged but still above the ceiling), preserving the earliest raw', () => {
    // A client claimed it capped the sample but left responseTimeMs at 8h and
    // recorded a 10h raw. Trust the earliest raw, cap the stored value.
    const rawFromClient = 10 * 60 * 60 * 1000
    const patch = sanitizeResultTiming(
      input({
        responseTimeMs: 8 * 60 * 60 * 1000,
        responseTimeMsRaw: rawFromClient,
        wasIdleCapped: true,
        capReason: 'idle-exceeded',
        capThresholdMs: 30_000,
        capSource: 'client',
      })
    )
    expect(patch.responseTimeMs).toBe(MAX_RESPONSE_TIME_CAP_MS)
    expect(patch.responseTimeMsRaw).toBe(rawFromClient) // earliest raw preserved
    expect(patch.capSource).toBe('server')
    expect(patch.capReason).toBe('clock-anomaly')
  })

  it('leaves a recency-refresh / zero sentinel untouched', () => {
    expect(sanitizeResultTiming(input({ responseTimeMs: 0 }))).toEqual({})
  })

  it('clamps a hostile capThresholdMs even when the value is in range', () => {
    expect(
      sanitizeResultTiming(
        input({ responseTimeMs: 30_000, capThresholdMs: MAX_RESPONSE_TIME_CAP_MS + 1_000_000 })
      )
    ).toEqual({ capThresholdMs: MAX_RESPONSE_TIME_CAP_MS })
  })

  it('produces a patch that keeps the wasIdleCapped ⇔ raw invariant when it caps', () => {
    const patch = sanitizeResultTiming(input({ responseTimeMs: 9_000_000 }))
    expect(patch.wasIdleCapped).toBe(true)
    expect(patch.responseTimeMsRaw).toBeDefined()
  })
})
