/**
 * @vitest-environment node
 *
 * Tests for helpers.ts
 *
 * Tests the exported functions:
 * - checkSuccessCriteria: Validates profile outcomes against success criteria
 * - applyTuningAdjustments: Applies adjustments to skill history configurations
 * - generateSlotResults: Generates slot results for skill configs (integration-level)
 */

import { describe, expect, it } from 'vitest'
import { checkSuccessCriteria, applyTuningAdjustments, generateSlotResults } from '../helpers'
import type { SkillConfig, SuccessCriteria, TuningAdjustment } from '../types'

// =============================================================================
// checkSuccessCriteria
// =============================================================================

describe('checkSuccessCriteria', () => {
  const classifications = { weak: 2, developing: 3, strong: 5 }

  it('returns success when no criteria provided', () => {
    const result = checkSuccessCriteria(classifications)
    expect(result).toEqual({ success: true, reasons: [] })
  })

  it('returns success when criteria is undefined', () => {
    const result = checkSuccessCriteria(classifications, undefined)
    expect(result).toEqual({ success: true, reasons: [] })
  })

  it('returns success when all criteria are met', () => {
    const criteria: SuccessCriteria = {
      minWeak: 1,
      maxWeak: 3,
      minDeveloping: 2,
      maxDeveloping: 4,
      minStrong: 4,
      maxStrong: 6,
    }

    const result = checkSuccessCriteria(classifications, criteria)
    expect(result.success).toBe(true)
    expect(result.reasons).toHaveLength(0)
  })

  it('fails when weak count is below minimum', () => {
    const criteria: SuccessCriteria = { minWeak: 3 }
    const result = checkSuccessCriteria(classifications, criteria)

    expect(result.success).toBe(false)
    expect(result.reasons).toHaveLength(1)
    expect(result.reasons[0]).toContain('at least 3 weak')
    expect(result.reasons[0]).toContain('got 2')
  })

  it('fails when weak count exceeds maximum', () => {
    const criteria: SuccessCriteria = { maxWeak: 1 }
    const result = checkSuccessCriteria(classifications, criteria)

    expect(result.success).toBe(false)
    expect(result.reasons).toHaveLength(1)
    expect(result.reasons[0]).toContain('at most 1 weak')
    expect(result.reasons[0]).toContain('got 2')
  })

  it('fails when developing count is below minimum', () => {
    const criteria: SuccessCriteria = { minDeveloping: 4 }
    const result = checkSuccessCriteria(classifications, criteria)

    expect(result.success).toBe(false)
    expect(result.reasons[0]).toContain('at least 4 developing')
    expect(result.reasons[0]).toContain('got 3')
  })

  it('fails when developing count exceeds maximum', () => {
    const criteria: SuccessCriteria = { maxDeveloping: 2 }
    const result = checkSuccessCriteria(classifications, criteria)

    expect(result.success).toBe(false)
    expect(result.reasons[0]).toContain('at most 2 developing')
    expect(result.reasons[0]).toContain('got 3')
  })

  it('fails when strong count is below minimum', () => {
    const criteria: SuccessCriteria = { minStrong: 6 }
    const result = checkSuccessCriteria(classifications, criteria)

    expect(result.success).toBe(false)
    expect(result.reasons[0]).toContain('at least 6 strong')
    expect(result.reasons[0]).toContain('got 5')
  })

  it('fails when strong count exceeds maximum', () => {
    const criteria: SuccessCriteria = { maxStrong: 4 }
    const result = checkSuccessCriteria(classifications, criteria)

    expect(result.success).toBe(false)
    expect(result.reasons[0]).toContain('at most 4 strong')
    expect(result.reasons[0]).toContain('got 5')
  })

  it('accumulates multiple failure reasons', () => {
    const criteria: SuccessCriteria = {
      minWeak: 5,
      maxStrong: 2,
    }
    const result = checkSuccessCriteria(classifications, criteria)

    expect(result.success).toBe(false)
    expect(result.reasons).toHaveLength(2)
  })

  it('passes when criteria equal exact counts', () => {
    const criteria: SuccessCriteria = {
      minWeak: 2,
      maxWeak: 2,
      minDeveloping: 3,
      maxDeveloping: 3,
      minStrong: 5,
      maxStrong: 5,
    }
    const result = checkSuccessCriteria(classifications, criteria)
    expect(result.success).toBe(true)
  })

  it('handles zero counts correctly', () => {
    const zeroCounts = { weak: 0, developing: 0, strong: 0 }
    const criteria: SuccessCriteria = { minWeak: 0, maxWeak: 0 }
    const result = checkSuccessCriteria(zeroCounts, criteria)
    expect(result.success).toBe(true)
  })

  it('handles partial criteria (only some fields set)', () => {
    const criteria: SuccessCriteria = { minStrong: 3 }
    const result = checkSuccessCriteria(classifications, criteria)
    expect(result.success).toBe(true) // 5 >= 3
  })
})

// =============================================================================
// applyTuningAdjustments
// =============================================================================

describe('applyTuningAdjustments', () => {
  const baseHistory: SkillConfig[] = [
    { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 10 },
    { skillId: 'fiveComplements.4=5-1', targetClassification: 'developing', problems: 8 },
    { skillId: 'tenComplements.9=10-1', targetClassification: 'weak', problems: 12 },
  ]

  it('returns original history when no adjustments provided', () => {
    const result = applyTuningAdjustments(baseHistory)
    expect(result).toEqual(baseHistory)
  })

  it('returns original history when adjustments is undefined', () => {
    const result = applyTuningAdjustments(baseHistory, undefined)
    expect(result).toEqual(baseHistory)
  })

  it('returns original history when adjustments is empty array', () => {
    const result = applyTuningAdjustments(baseHistory, [])
    expect(result).toEqual(baseHistory)
  })

  it('applies problemsAdd to a specific skill', () => {
    const adjustments: TuningAdjustment[] = [
      { skillId: 'basic.directAddition', problemsAdd: 5 },
    ]

    const result = applyTuningAdjustments(baseHistory, adjustments)

    expect(result[0].problems).toBe(15) // 10 + 5
    expect(result[1].problems).toBe(8) // unchanged
    expect(result[2].problems).toBe(12) // unchanged
  })

  it('applies problemsMultiplier to a specific skill', () => {
    const adjustments: TuningAdjustment[] = [
      { skillId: 'fiveComplements.4=5-1', problemsMultiplier: 2 },
    ]

    const result = applyTuningAdjustments(baseHistory, adjustments)

    expect(result[0].problems).toBe(10) // unchanged
    expect(result[1].problems).toBe(16) // 8 * 2
    expect(result[2].problems).toBe(12) // unchanged
  })

  it('applies adjustments to all skills when skillId is "all"', () => {
    const adjustments: TuningAdjustment[] = [
      { skillId: 'all', problemsAdd: 3 },
    ]

    const result = applyTuningAdjustments(baseHistory, adjustments)

    expect(result[0].problems).toBe(13) // 10 + 3
    expect(result[1].problems).toBe(11) // 8 + 3
    expect(result[2].problems).toBe(15) // 12 + 3
  })

  it('applies both problemsAdd and problemsMultiplier (add first, then multiply)', () => {
    const adjustments: TuningAdjustment[] = [
      { skillId: 'basic.directAddition', problemsAdd: 5, problemsMultiplier: 2 },
    ]

    const result = applyTuningAdjustments(baseHistory, adjustments)

    // First add: 10 + 5 = 15, then multiply: 15 * 2 = 30
    expect(result[0].problems).toBe(30)
  })

  it('applies multiple adjustments sequentially', () => {
    const adjustments: TuningAdjustment[] = [
      { skillId: 'all', problemsAdd: 2 },
      { skillId: 'basic.directAddition', problemsMultiplier: 3 },
    ]

    const result = applyTuningAdjustments(baseHistory, adjustments)

    // First: 10 + 2 = 12 (all add)
    // Then: 12 * 3 = 36 (specific multiply)
    expect(result[0].problems).toBe(36)
    // Others only get the 'all' add
    expect(result[1].problems).toBe(10) // 8 + 2
    expect(result[2].problems).toBe(14) // 12 + 2
  })

  it('does not mutate original history', () => {
    const original = baseHistory.map((h) => ({ ...h }))
    const adjustments: TuningAdjustment[] = [
      { skillId: 'all', problemsAdd: 100 },
    ]

    applyTuningAdjustments(baseHistory, adjustments)

    expect(baseHistory).toEqual(original)
  })

  it('rounds when using problemsMultiplier', () => {
    const history: SkillConfig[] = [
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 7 },
    ]
    const adjustments: TuningAdjustment[] = [
      { skillId: 'basic.directAddition', problemsMultiplier: 1.5 },
    ]

    const result = applyTuningAdjustments(history, adjustments)

    // 7 * 1.5 = 10.5, rounded to 11 (Math.round)
    expect(result[0].problems).toBe(Math.round(7 * 1.5))
  })

  it('preserves non-problems fields', () => {
    const adjustments: TuningAdjustment[] = [
      { skillId: 'all', problemsAdd: 5 },
    ]

    const result = applyTuningAdjustments(baseHistory, adjustments)

    expect(result[0].skillId).toBe('basic.directAddition')
    expect(result[0].targetClassification).toBe('strong')
    expect(result[1].skillId).toBe('fiveComplements.4=5-1')
    expect(result[1].targetClassification).toBe('developing')
  })

  it('ignores adjustments for non-matching skillIds', () => {
    const adjustments: TuningAdjustment[] = [
      { skillId: 'nonexistent.skill', problemsAdd: 100 },
    ]

    const result = applyTuningAdjustments(baseHistory, adjustments)

    // No changes since skill doesn't exist in history
    expect(result[0].problems).toBe(10)
    expect(result[1].problems).toBe(8)
    expect(result[2].problems).toBe(12)
  })
})

// =============================================================================
// generateSlotResults
// =============================================================================

describe('generateSlotResults', () => {
  it('generates the correct number of slot results', () => {
    const config: SkillConfig = {
      skillId: 'basic.directAddition',
      targetClassification: 'strong',
      problems: 5,
    }

    const results = generateSlotResults(config, 0, new Date())
    expect(results).toHaveLength(5)
  })

  it('each result has required fields', () => {
    const config: SkillConfig = {
      skillId: 'basic.directAddition',
      targetClassification: 'strong',
      problems: 3,
    }

    const startTime = new Date('2024-01-01T10:00:00Z')
    const results = generateSlotResults(config, 0, startTime)

    for (const result of results) {
      expect(result.partNumber).toBe(1)
      expect(typeof result.slotIndex).toBe('number')
      expect(result.problem).toBeDefined()
      expect(result.problem.terms).toBeDefined()
      expect(typeof result.problem.answer).toBe('number')
      expect(typeof result.studentAnswer).toBe('number')
      expect(typeof result.isCorrect).toBe('boolean')
      expect(typeof result.responseTimeMs).toBe('number')
      expect(result.skillsExercised).toBeDefined()
      expect(result.usedOnScreenAbacus).toBe(false)
      expect(result.timestamp).toBeInstanceOf(Date)
    }
  })

  it('assigns sequential slot indices starting from startIndex', () => {
    const config: SkillConfig = {
      skillId: 'basic.directAddition',
      targetClassification: 'strong',
      problems: 3,
    }

    const results = generateSlotResults(config, 5, new Date())

    expect(results[0].slotIndex).toBe(5)
    expect(results[1].slotIndex).toBe(6)
    expect(results[2].slotIndex).toBe(7)
  })

  it('timestamps increase sequentially', () => {
    const config: SkillConfig = {
      skillId: 'basic.directAddition',
      targetClassification: 'strong',
      problems: 3,
    }

    const startTime = new Date('2024-01-01T10:00:00Z')
    const results = generateSlotResults(config, 0, startTime)

    for (let i = 1; i < results.length; i++) {
      expect(results[i].timestamp.getTime()).toBeGreaterThan(
        results[i - 1].timestamp.getTime()
      )
    }
  })

  it('correct answers have matching student and problem answers', () => {
    const config: SkillConfig = {
      skillId: 'basic.directAddition',
      targetClassification: 'strong',
      problems: 20,
    }

    const results = generateSlotResults(config, 0, new Date())
    const correctResults = results.filter((r) => r.isCorrect)

    for (const result of correctResults) {
      expect(result.studentAnswer).toBe(result.problem.answer)
    }
  })

  it('incorrect answers have different student and problem answers', () => {
    const config: SkillConfig = {
      skillId: 'basic.directAddition',
      targetClassification: 'weak', // More incorrects
      problems: 20,
    }

    const results = generateSlotResults(config, 0, new Date())
    const incorrectResults = results.filter((r) => !r.isCorrect)

    for (const result of incorrectResults) {
      expect(result.studentAnswer).not.toBe(result.problem.answer)
    }
  })

  it('includes hadHelp field by default', () => {
    const config: SkillConfig = {
      skillId: 'basic.directAddition',
      targetClassification: 'strong',
      problems: 3,
    }

    const results = generateSlotResults(config, 0, new Date())

    for (const result of results) {
      expect(result).toHaveProperty('hadHelp', false)
      expect(result).toHaveProperty('helpTrigger', 'none')
    }
  })

  it('omits hadHelp field when simulateLegacyData is true', () => {
    const config: SkillConfig = {
      skillId: 'basic.directAddition',
      targetClassification: 'strong',
      problems: 3,
      simulateLegacyData: true,
    }

    const results = generateSlotResults(config, 0, new Date())

    for (const result of results) {
      expect(result).not.toHaveProperty('hadHelp')
      expect(result).not.toHaveProperty('helpTrigger')
    }
  })

  it('response times are in a reasonable range', () => {
    const config: SkillConfig = {
      skillId: 'basic.directAddition',
      targetClassification: 'strong',
      problems: 10,
    }

    const results = generateSlotResults(config, 0, new Date())

    for (const result of results) {
      // 4000 + random * 2000, so range is [4000, 6000)
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(4000)
      expect(result.responseTimeMs).toBeLessThan(6000)
    }
  })

  it('incorrect attempts count is 0 for correct and 1 for incorrect', () => {
    const config: SkillConfig = {
      skillId: 'basic.directAddition',
      targetClassification: 'strong',
      problems: 20,
    }

    const results = generateSlotResults(config, 0, new Date())

    for (const result of results) {
      if (result.isCorrect) {
        expect(result.incorrectAttempts).toBe(0)
      } else {
        expect(result.incorrectAttempts).toBe(1)
      }
    }
  })
})
