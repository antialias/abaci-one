/**
 * @vitest-environment node
 *
 * Skill Readiness Supplemental Tests
 *
 * Tests for readinessMapToRecord, which is not covered by the main
 * skill-readiness test suite at src/test/skill-readiness.test.ts.
 *
 * The main test suite covers assessSkillReadiness and assessAllSkillsReadiness
 * thoroughly. This file covers the serialization helper.
 */

import { describe, expect, it } from 'vitest'
import {
  readinessMapToRecord,
  type SkillReadinessResult,
} from '@/lib/curriculum/skill-readiness'

// =============================================================================
// readinessMapToRecord
// =============================================================================

describe('readinessMapToRecord', () => {
  const solidResult: SkillReadinessResult = {
    skillId: 'basic.directAddition',
    isSolid: true,
    dimensions: {
      mastery: { met: true, pKnown: 0.9, confidence: 0.8 },
      volume: { met: true, opportunities: 25, sessionCount: 4 },
      speed: { met: true, medianSecondsPerTerm: 1.5 },
      consistency: {
        met: true,
        recentAccuracy: 0.95,
        lastFiveAllCorrect: true,
        recentHelpCount: 0,
      },
    },
  }

  const notSolidResult: SkillReadinessResult = {
    skillId: 'fiveComplements.4=5-1',
    isSolid: false,
    dimensions: {
      mastery: { met: false, pKnown: 0.5, confidence: 0.3 },
      volume: { met: true, opportunities: 20, sessionCount: 3 },
      speed: { met: true, medianSecondsPerTerm: 2.0 },
      consistency: {
        met: false,
        recentAccuracy: 0.7,
        lastFiveAllCorrect: false,
        recentHelpCount: 2,
      },
    },
  }

  it('converts an empty map to an empty object', () => {
    const map = new Map<string, SkillReadinessResult>()
    const result = readinessMapToRecord(map)
    expect(result).toEqual({})
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('converts a single-entry map to a record', () => {
    const map = new Map<string, SkillReadinessResult>([
      ['basic.directAddition', solidResult],
    ])
    const result = readinessMapToRecord(map)
    expect(result['basic.directAddition']).toBe(solidResult)
    expect(Object.keys(result)).toHaveLength(1)
  })

  it('converts a multi-entry map to a record', () => {
    const map = new Map<string, SkillReadinessResult>([
      ['basic.directAddition', solidResult],
      ['fiveComplements.4=5-1', notSolidResult],
    ])
    const result = readinessMapToRecord(map)
    expect(result['basic.directAddition']).toBe(solidResult)
    expect(result['fiveComplements.4=5-1']).toBe(notSolidResult)
    expect(Object.keys(result)).toHaveLength(2)
  })

  it('preserves isSolid values', () => {
    const map = new Map<string, SkillReadinessResult>([
      ['basic.directAddition', solidResult],
      ['fiveComplements.4=5-1', notSolidResult],
    ])
    const result = readinessMapToRecord(map)
    expect(result['basic.directAddition'].isSolid).toBe(true)
    expect(result['fiveComplements.4=5-1'].isSolid).toBe(false)
  })

  it('preserves dimension details', () => {
    const map = new Map<string, SkillReadinessResult>([
      ['fiveComplements.4=5-1', notSolidResult],
    ])
    const result = readinessMapToRecord(map)
    const entry = result['fiveComplements.4=5-1']
    expect(entry.dimensions.mastery.pKnown).toBe(0.5)
    expect(entry.dimensions.volume.opportunities).toBe(20)
    expect(entry.dimensions.consistency.recentHelpCount).toBe(2)
  })

  it('result is serializable to JSON', () => {
    const map = new Map<string, SkillReadinessResult>([
      ['basic.directAddition', solidResult],
      ['fiveComplements.4=5-1', notSolidResult],
    ])
    const record = readinessMapToRecord(map)
    const json = JSON.stringify(record)
    const parsed = JSON.parse(json)
    expect(parsed['basic.directAddition'].isSolid).toBe(true)
    expect(parsed['fiveComplements.4=5-1'].isSolid).toBe(false)
  })
})
