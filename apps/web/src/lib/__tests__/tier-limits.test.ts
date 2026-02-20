import { describe, it, expect } from 'vitest'
import { TIER_LIMITS, durationOptionsForTier, type TierLimits } from '../tier-limits'

describe('tier-limits', () => {
  describe('TIER_LIMITS uses maxPracticeStudents (not maxPlayers)', () => {
    it.each(['guest', 'free', 'family'] as const)('%s tier has maxPracticeStudents', (tier) => {
      const limits: TierLimits = TIER_LIMITS[tier]
      expect(limits).toHaveProperty('maxPracticeStudents')
      expect(typeof limits.maxPracticeStudents).toBe('number')
      // Ensure the old property doesn't exist
      expect(limits).not.toHaveProperty('maxPlayers')
    })

    it('guest tier allows 1 practice student', () => {
      expect(TIER_LIMITS.guest.maxPracticeStudents).toBe(1)
    })

    it('free tier allows 1 practice student', () => {
      expect(TIER_LIMITS.free.maxPracticeStudents).toBe(1)
    })

    it('family tier allows unlimited practice students', () => {
      expect(TIER_LIMITS.family.maxPracticeStudents).toBe(Infinity)
    })
  })

  describe('durationOptionsForTier', () => {
    it('guest tier has durations up to 10 minutes', () => {
      const options = durationOptionsForTier('guest')
      expect(options).toEqual([5, 10])
    })

    it('family tier has all durations up to 20 minutes', () => {
      const options = durationOptionsForTier('family')
      expect(options).toEqual([5, 10, 15, 20])
    })
  })
})
