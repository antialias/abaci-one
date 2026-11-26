import { describe, expect, it } from 'vitest'
import { estimateSpeechCost } from '../cost'

describe('estimateSpeechCost', () => {
  it('sums characters and prices them at the speech model rate ($80 per million on v3)', () => {
    const { chars, cost } = estimateSpeechCost([8264, 2633, 144, 2038])
    expect(chars).toBe(13079)
    expect(cost).toBeCloseTo(1.05, 2)
  })

  it('nothing missing costs nothing', () => {
    expect(estimateSpeechCost([])).toEqual({ chars: 0, cost: 0 })
  })
})
