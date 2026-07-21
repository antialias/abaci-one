/**
 * Ring throttle tests (#8.4): burst collapse per connection, independent
 * connections, recovery after the interval.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { claimRingSlot, resetRingThrottle, RING_MIN_INTERVAL_MS } from '../ring-throttle'

describe('claimRingSlot', () => {
  beforeEach(() => {
    resetRingThrottle()
  })

  it('grants the first ring and drops one inside the interval', () => {
    expect(claimRingSlot('conn-1', 1000)).toBe(true)
    expect(claimRingSlot('conn-1', 1000 + RING_MIN_INTERVAL_MS - 1)).toBe(false)
  })

  it('grants again once the interval has passed', () => {
    expect(claimRingSlot('conn-1', 1000)).toBe(true)
    expect(claimRingSlot('conn-1', 1000 + RING_MIN_INTERVAL_MS)).toBe(true)
  })

  it('throttles connections independently', () => {
    expect(claimRingSlot('conn-1', 1000)).toBe(true)
    expect(claimRingSlot('conn-2', 1001)).toBe(true) // different connection, not throttled
    expect(claimRingSlot('conn-1', 1002)).toBe(false)
  })

  it('a dropped ring does not extend the window', () => {
    expect(claimRingSlot('conn-1', 1000)).toBe(true)
    expect(claimRingSlot('conn-1', 1100)).toBe(false)
    // window is measured from the GRANTED ring at t=1000, not the dropped one
    expect(claimRingSlot('conn-1', 1000 + RING_MIN_INTERVAL_MS)).toBe(true)
  })
})
