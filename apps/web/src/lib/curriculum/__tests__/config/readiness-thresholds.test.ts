/**
 * @vitest-environment node
 *
 * Readiness Thresholds Configuration Tests
 *
 * Tests for the multi-dimensional readiness threshold constants.
 * These thresholds determine when a student is ready to advance past a skill.
 */

import { describe, expect, it } from 'vitest'
import { READINESS_THRESHOLDS } from '@/lib/curriculum/config/readiness-thresholds'
import { BKT_THRESHOLDS } from '@/lib/curriculum/config/bkt-integration'

// =============================================================================
// READINESS_THRESHOLDS
// =============================================================================

describe('READINESS_THRESHOLDS', () => {
  describe('mastery dimension', () => {
    it('pKnownThreshold is 0.85', () => {
      expect(READINESS_THRESHOLDS.pKnownThreshold).toBe(0.85)
    })

    it('confidenceThreshold is 0.5', () => {
      expect(READINESS_THRESHOLDS.confidenceThreshold).toBe(0.5)
    })

    it('pKnownThreshold is higher than BKT strong threshold', () => {
      // Readiness requires a higher bar than basic "strong" classification
      expect(READINESS_THRESHOLDS.pKnownThreshold).toBeGreaterThan(BKT_THRESHOLDS.strong)
    })

    it('confidenceThreshold is higher than BKT confidence threshold', () => {
      // Readiness requires more certainty before advancing
      expect(READINESS_THRESHOLDS.confidenceThreshold).toBeGreaterThan(BKT_THRESHOLDS.confidence)
    })

    it('both values are in [0, 1]', () => {
      expect(READINESS_THRESHOLDS.pKnownThreshold).toBeGreaterThan(0)
      expect(READINESS_THRESHOLDS.pKnownThreshold).toBeLessThanOrEqual(1)
      expect(READINESS_THRESHOLDS.confidenceThreshold).toBeGreaterThan(0)
      expect(READINESS_THRESHOLDS.confidenceThreshold).toBeLessThanOrEqual(1)
    })
  })

  describe('volume dimension', () => {
    it('minOpportunities is 20', () => {
      expect(READINESS_THRESHOLDS.minOpportunities).toBe(20)
    })

    it('minSessions is 3', () => {
      expect(READINESS_THRESHOLDS.minSessions).toBe(3)
    })

    it('minOpportunities is positive', () => {
      expect(READINESS_THRESHOLDS.minOpportunities).toBeGreaterThan(0)
    })

    it('minSessions is positive', () => {
      expect(READINESS_THRESHOLDS.minSessions).toBeGreaterThan(0)
    })

    it('requires multiple sessions (not just one)', () => {
      expect(READINESS_THRESHOLDS.minSessions).toBeGreaterThanOrEqual(2)
    })
  })

  describe('speed dimension', () => {
    it('maxMedianSecondsPerTerm is 4.0', () => {
      expect(READINESS_THRESHOLDS.maxMedianSecondsPerTerm).toBe(4.0)
    })

    it('speedWindowSize is 10', () => {
      expect(READINESS_THRESHOLDS.speedWindowSize).toBe(10)
    })

    it('maxMedianSecondsPerTerm is positive', () => {
      expect(READINESS_THRESHOLDS.maxMedianSecondsPerTerm).toBeGreaterThan(0)
    })

    it('speedWindowSize is positive', () => {
      expect(READINESS_THRESHOLDS.speedWindowSize).toBeGreaterThan(0)
    })
  })

  describe('consistency dimension', () => {
    it('noHelpInLastN is 5', () => {
      expect(READINESS_THRESHOLDS.noHelpInLastN).toBe(5)
    })

    it('accuracyWindowSize is 15', () => {
      expect(READINESS_THRESHOLDS.accuracyWindowSize).toBe(15)
    })

    it('minAccuracy is 0.85', () => {
      expect(READINESS_THRESHOLDS.minAccuracy).toBe(0.85)
    })

    it('lastNAllCorrect is 5', () => {
      expect(READINESS_THRESHOLDS.lastNAllCorrect).toBe(5)
    })

    it('accuracyWindowSize >= lastNAllCorrect', () => {
      expect(READINESS_THRESHOLDS.accuracyWindowSize).toBeGreaterThanOrEqual(
        READINESS_THRESHOLDS.lastNAllCorrect
      )
    })

    it('minAccuracy is high (requires consistency)', () => {
      expect(READINESS_THRESHOLDS.minAccuracy).toBeGreaterThanOrEqual(0.8)
    })

    it('noHelpInLastN === lastNAllCorrect (both check last 5)', () => {
      expect(READINESS_THRESHOLDS.noHelpInLastN).toBe(READINESS_THRESHOLDS.lastNAllCorrect)
    })
  })

  describe('cross-dimension validation', () => {
    it('all threshold values are finite numbers', () => {
      for (const [key, value] of Object.entries(READINESS_THRESHOLDS)) {
        expect(Number.isFinite(value), `${key} should be finite`).toBe(true)
      }
    })

    it('speed window is smaller than volume requirements', () => {
      // Speed is measured on recent problems, volume on all-time
      expect(READINESS_THRESHOLDS.speedWindowSize).toBeLessThanOrEqual(
        READINESS_THRESHOLDS.minOpportunities
      )
    })
  })
})
