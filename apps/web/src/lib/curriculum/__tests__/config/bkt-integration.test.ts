/**
 * @vitest-environment node
 *
 * BKT Integration Configuration Tests
 *
 * Tests for classifySkill, shouldTargetSkill, calculateBktMultiplier,
 * isBktConfident, and validation of BKT threshold constants.
 */

import { describe, expect, it } from 'vitest'
import {
  BKT_THRESHOLDS,
  BKT_INTEGRATION_CONFIG,
  WEAK_SKILL_THRESHOLDS,
  classifySkill,
  shouldTargetSkill,
  calculateBktMultiplier,
  isBktConfident,
  DEFAULT_PROBLEM_GENERATION_MODE,
} from '@/lib/curriculum/config/bkt-integration'

// =============================================================================
// BKT_THRESHOLDS validation
// =============================================================================

describe('BKT_THRESHOLDS', () => {
  it('has expected threshold values', () => {
    expect(BKT_THRESHOLDS.strong).toBe(0.8)
    expect(BKT_THRESHOLDS.weak).toBe(0.5)
    expect(BKT_THRESHOLDS.confidence).toBe(0.3)
  })

  it('has weak < strong (valid range)', () => {
    expect(BKT_THRESHOLDS.weak).toBeLessThan(BKT_THRESHOLDS.strong)
  })

  it('has confidence in [0, 1]', () => {
    expect(BKT_THRESHOLDS.confidence).toBeGreaterThanOrEqual(0)
    expect(BKT_THRESHOLDS.confidence).toBeLessThanOrEqual(1)
  })
})

// =============================================================================
// BKT_INTEGRATION_CONFIG validation
// =============================================================================

describe('BKT_INTEGRATION_CONFIG', () => {
  it('has expected config values', () => {
    expect(BKT_INTEGRATION_CONFIG.confidenceThreshold).toBe(BKT_THRESHOLDS.confidence)
    expect(BKT_INTEGRATION_CONFIG.minMultiplier).toBe(1.0)
    expect(BKT_INTEGRATION_CONFIG.maxMultiplier).toBe(4.0)
    expect(BKT_INTEGRATION_CONFIG.sessionHistoryDepth).toBe(50)
  })

  it('has minMultiplier < maxMultiplier', () => {
    expect(BKT_INTEGRATION_CONFIG.minMultiplier).toBeLessThan(BKT_INTEGRATION_CONFIG.maxMultiplier)
  })

  it('has positive sessionHistoryDepth', () => {
    expect(BKT_INTEGRATION_CONFIG.sessionHistoryDepth).toBeGreaterThan(0)
  })
})

// =============================================================================
// WEAK_SKILL_THRESHOLDS (legacy, delegates to unified)
// =============================================================================

describe('WEAK_SKILL_THRESHOLDS', () => {
  it('delegates to BKT_THRESHOLDS', () => {
    expect(WEAK_SKILL_THRESHOLDS.pKnownThreshold).toBe(BKT_THRESHOLDS.weak)
    expect(WEAK_SKILL_THRESHOLDS.confidenceThreshold).toBe(BKT_THRESHOLDS.confidence)
  })
})

// =============================================================================
// DEFAULT_PROBLEM_GENERATION_MODE
// =============================================================================

describe('DEFAULT_PROBLEM_GENERATION_MODE', () => {
  it('defaults to adaptive-bkt', () => {
    expect(DEFAULT_PROBLEM_GENERATION_MODE).toBe('adaptive-bkt')
  })
})

// =============================================================================
// classifySkill
// =============================================================================

describe('classifySkill', () => {
  it('returns null when confidence is insufficient', () => {
    expect(classifySkill(0.9, 0.1)).toBeNull()
    expect(classifySkill(0.9, 0.29)).toBeNull()
    expect(classifySkill(0.2, 0.0)).toBeNull()
  })

  it('returns "strong" when pKnown >= 0.8 and confident', () => {
    expect(classifySkill(0.8, 0.5)).toBe('strong')
    expect(classifySkill(0.9, 0.3)).toBe('strong')
    expect(classifySkill(1.0, 0.99)).toBe('strong')
  })

  it('returns "weak" when pKnown < 0.5 and confident', () => {
    expect(classifySkill(0.0, 0.3)).toBe('weak')
    expect(classifySkill(0.2, 0.5)).toBe('weak')
    expect(classifySkill(0.49, 0.3)).toBe('weak')
  })

  it('returns "developing" when 0.5 <= pKnown < 0.8 and confident', () => {
    expect(classifySkill(0.5, 0.3)).toBe('developing')
    expect(classifySkill(0.6, 0.5)).toBe('developing')
    expect(classifySkill(0.79, 0.9)).toBe('developing')
  })

  it('returns null at exactly confidence threshold boundary', () => {
    // Confidence must be >= threshold (0.3)
    expect(classifySkill(0.5, 0.29)).toBeNull()
  })

  it('returns classification at exactly confidence threshold', () => {
    expect(classifySkill(0.5, 0.3)).toBe('developing')
  })

  it('handles boundary between weak and developing', () => {
    expect(classifySkill(0.49, 0.5)).toBe('weak')
    expect(classifySkill(0.5, 0.5)).toBe('developing')
  })

  it('handles boundary between developing and strong', () => {
    expect(classifySkill(0.79, 0.5)).toBe('developing')
    expect(classifySkill(0.8, 0.5)).toBe('strong')
  })
})

// =============================================================================
// shouldTargetSkill
// =============================================================================

describe('shouldTargetSkill', () => {
  it('returns true for weak skills with sufficient confidence', () => {
    expect(shouldTargetSkill(0.2, 0.5)).toBe(true)
    expect(shouldTargetSkill(0.0, 0.3)).toBe(true)
    expect(shouldTargetSkill(0.49, 0.3)).toBe(true)
  })

  it('returns false for strong/developing skills', () => {
    expect(shouldTargetSkill(0.5, 0.5)).toBe(false)
    expect(shouldTargetSkill(0.8, 0.9)).toBe(false)
    expect(shouldTargetSkill(1.0, 0.99)).toBe(false)
  })

  it('returns false when confidence is too low', () => {
    expect(shouldTargetSkill(0.2, 0.1)).toBe(false)
    expect(shouldTargetSkill(0.0, 0.0)).toBe(false)
    expect(shouldTargetSkill(0.1, 0.29)).toBe(false)
  })

  it('is consistent with classifySkill for weak classification', () => {
    // shouldTargetSkill should return true exactly when classifySkill returns 'weak'
    const testCases = [
      { pKnown: 0.2, confidence: 0.5 },
      { pKnown: 0.5, confidence: 0.5 },
      { pKnown: 0.8, confidence: 0.5 },
      { pKnown: 0.2, confidence: 0.1 },
    ]
    for (const { pKnown, confidence } of testCases) {
      const classified = classifySkill(pKnown, confidence)
      const targeted = shouldTargetSkill(pKnown, confidence)
      expect(targeted).toBe(classified === 'weak')
    }
  })
})

// =============================================================================
// calculateBktMultiplier
// =============================================================================

describe('calculateBktMultiplier', () => {
  it('returns minMultiplier (1.0) when pKnown is 1.0 (fully mastered)', () => {
    const result = calculateBktMultiplier(1.0)
    expect(result).toBe(BKT_INTEGRATION_CONFIG.minMultiplier)
  })

  it('returns maxMultiplier (4.0) when pKnown is 0.0 (unknown)', () => {
    const result = calculateBktMultiplier(0.0)
    expect(result).toBe(BKT_INTEGRATION_CONFIG.maxMultiplier)
  })

  it('returns intermediate values for partial mastery', () => {
    const result = calculateBktMultiplier(0.5)
    expect(result).toBeGreaterThan(BKT_INTEGRATION_CONFIG.minMultiplier)
    expect(result).toBeLessThan(BKT_INTEGRATION_CONFIG.maxMultiplier)
  })

  it('uses non-linear (squared) mapping for better differentiation', () => {
    // pKnown = 0.8 → effectivePKnown = 0.64 → multiplier > linear mapping
    const at08 = calculateBktMultiplier(0.8)
    // With squared: 4 - 0.64 * 3 = 4 - 1.92 = 2.08
    expect(at08).toBeCloseTo(2.08, 1)

    const at09 = calculateBktMultiplier(0.9)
    // With squared: 4 - 0.81 * 3 = 4 - 2.43 = 1.57
    expect(at09).toBeCloseTo(1.57, 1)

    const at095 = calculateBktMultiplier(0.95)
    // With squared: 4 - 0.9025 * 3 = 4 - 2.7075 = 1.2925
    expect(at095).toBeCloseTo(1.29, 1)
  })

  it('is monotonically decreasing (higher mastery = lower multiplier)', () => {
    const values = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    for (let i = 1; i < values.length; i++) {
      const prev = calculateBktMultiplier(values[i - 1])
      const curr = calculateBktMultiplier(values[i])
      expect(curr).toBeLessThan(prev)
    }
  })

  it('is clamped to [minMultiplier, maxMultiplier]', () => {
    // Even out-of-range pKnown should be clamped
    for (const pKnown of [-0.1, 0, 0.5, 1.0, 1.1]) {
      const result = calculateBktMultiplier(pKnown)
      expect(result).toBeGreaterThanOrEqual(BKT_INTEGRATION_CONFIG.minMultiplier)
      expect(result).toBeLessThanOrEqual(BKT_INTEGRATION_CONFIG.maxMultiplier)
    }
  })

  it('returns maxMultiplier for NaN pKnown (defensive fallback)', () => {
    const result = calculateBktMultiplier(NaN)
    expect(result).toBe(BKT_INTEGRATION_CONFIG.maxMultiplier)
  })

  it('returns maxMultiplier for Infinity pKnown (defensive fallback)', () => {
    const result = calculateBktMultiplier(Infinity)
    expect(result).toBe(BKT_INTEGRATION_CONFIG.maxMultiplier)
  })

  it('returns maxMultiplier for -Infinity pKnown (defensive fallback)', () => {
    const result = calculateBktMultiplier(-Infinity)
    expect(result).toBe(BKT_INTEGRATION_CONFIG.maxMultiplier)
  })
})

// =============================================================================
// isBktConfident
// =============================================================================

describe('isBktConfident', () => {
  it('returns true when confidence meets threshold', () => {
    expect(isBktConfident(0.3)).toBe(true)
    expect(isBktConfident(0.5)).toBe(true)
    expect(isBktConfident(0.9)).toBe(true)
    expect(isBktConfident(1.0)).toBe(true)
  })

  it('returns false when confidence is below threshold', () => {
    expect(isBktConfident(0.0)).toBe(false)
    expect(isBktConfident(0.1)).toBe(false)
    expect(isBktConfident(0.29)).toBe(false)
  })

  it('returns true at exactly the threshold', () => {
    expect(isBktConfident(BKT_INTEGRATION_CONFIG.confidenceThreshold)).toBe(true)
  })
})
