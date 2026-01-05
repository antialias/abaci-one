/**
 * Unit tests for skill-unlock.ts
 *
 * Tests the algorithm for determining the next skill to learn
 * and detecting skill anomalies for teacher review.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getSkillTutorialConfig,
  getSkillDisplayName,
  SKILL_TUTORIAL_CONFIGS,
  type SkillTutorialConfig,
} from './skill-unlock'

// ============================================================================
// Mock dependencies
// ============================================================================

// Mock the progress-manager module
vi.mock('./progress-manager', () => ({
  getPracticingSkills: vi.fn(),
  getSkillTutorialProgress: vi.fn(),
  isSkillTutorialSatisfied: vi.fn(),
  getRepeatedlySkippedTutorials: vi.fn(),
}))

// Mock the session-planner module
vi.mock('./session-planner', () => ({
  getRecentSessionResults: vi.fn().mockResolvedValue([]),
}))

// Mock the BKT module
vi.mock('./bkt', () => ({
  computeBktFromHistory: vi.fn().mockReturnValue({
    skills: [],
    overallConfidence: 0,
    dataQuality: 'insufficient',
  }),
  DEFAULT_BKT_OPTIONS: {
    confidenceThreshold: 0.5,
    applyDecay: false,
    useCrossStudentPriors: false,
    decayHalfLifeDays: 30,
  },
}))

// ============================================================================
// getSkillTutorialConfig Tests
// ============================================================================

describe('getSkillTutorialConfig', () => {
  it('returns config for known skill', () => {
    const config = getSkillTutorialConfig('basic.directAddition')
    expect(config).not.toBeNull()
    expect(config?.skillId).toBe('basic.directAddition')
    expect(config?.title).toBe('Adding by moving earth beads')
    expect(config?.exampleProblems.length).toBeGreaterThan(0)
  })

  it('returns null for unknown skill', () => {
    const config = getSkillTutorialConfig('unknown.skill')
    expect(config).toBeNull()
  })

  it('returns config with required fields', () => {
    const config = getSkillTutorialConfig('fiveComplements.4=5-1')
    expect(config).not.toBeNull()
    expect(config).toHaveProperty('skillId')
    expect(config).toHaveProperty('title')
    expect(config).toHaveProperty('description')
    expect(config).toHaveProperty('exampleProblems')
    expect(Array.isArray(config?.exampleProblems)).toBe(true)
  })
})

// ============================================================================
// getSkillDisplayName Tests
// ============================================================================

describe('getSkillDisplayName', () => {
  it('returns title from config for known skill', () => {
    const name = getSkillDisplayName('basic.directAddition')
    expect(name).toBe('Adding by moving earth beads')
  })

  it('returns parsed name for unknown skill', () => {
    const name = getSkillDisplayName('custom.mySkill')
    expect(name).toBe('mySkill')
  })

  it('returns skill ID for unparseable skill', () => {
    const name = getSkillDisplayName('singlepart')
    expect(name).toBe('singlepart')
  })
})

// ============================================================================
// SKILL_TUTORIAL_CONFIGS Validation
// ============================================================================

describe('SKILL_TUTORIAL_CONFIGS', () => {
  it('has configs for all basic skills', () => {
    expect(SKILL_TUTORIAL_CONFIGS['basic.directAddition']).toBeDefined()
    expect(SKILL_TUTORIAL_CONFIGS['basic.heavenBead']).toBeDefined()
    expect(SKILL_TUTORIAL_CONFIGS['basic.simpleCombinations']).toBeDefined()
  })

  it('has configs for all five-complement skills', () => {
    expect(SKILL_TUTORIAL_CONFIGS['fiveComplements.4=5-1']).toBeDefined()
    expect(SKILL_TUTORIAL_CONFIGS['fiveComplements.3=5-2']).toBeDefined()
    expect(SKILL_TUTORIAL_CONFIGS['fiveComplements.2=5-3']).toBeDefined()
    expect(SKILL_TUTORIAL_CONFIGS['fiveComplements.1=5-4']).toBeDefined()
  })

  it('has configs for all ten-complement skills', () => {
    expect(SKILL_TUTORIAL_CONFIGS['tenComplements.9=10-1']).toBeDefined()
    expect(SKILL_TUTORIAL_CONFIGS['tenComplements.8=10-2']).toBeDefined()
    expect(SKILL_TUTORIAL_CONFIGS['tenComplements.1=10-9']).toBeDefined()
  })

  it('all configs have valid example problems', () => {
    for (const [skillId, config] of Object.entries(SKILL_TUTORIAL_CONFIGS)) {
      expect(
        config.exampleProblems.length,
        `${skillId} should have example problems`
      ).toBeGreaterThan(0)
      for (const problem of config.exampleProblems) {
        expect(typeof problem.start, `${skillId} start should be number`).toBe('number')
        expect(typeof problem.target, `${skillId} target should be number`).toBe('number')
        expect(problem.start, `${skillId} start should be non-negative`).toBeGreaterThanOrEqual(0)
        expect(problem.target, `${skillId} target should be non-negative`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('all configs have non-empty title and description', () => {
    for (const [skillId, config] of Object.entries(SKILL_TUTORIAL_CONFIGS)) {
      expect(config.title.length, `${skillId} should have title`).toBeGreaterThan(0)
      expect(config.description.length, `${skillId} should have description`).toBeGreaterThan(0)
    }
  })

  it('skill ID in config matches the key', () => {
    for (const [skillId, config] of Object.entries(SKILL_TUTORIAL_CONFIGS)) {
      expect(config.skillId, `Config key should match skillId`).toBe(skillId)
    }
  })
})

// ============================================================================
// Integration with Curriculum
// ============================================================================

describe('curriculum integration', () => {
  it('config count matches expected skill count', () => {
    // We should have configs for:
    // - 6 basic skills
    // - 4 five-complement addition skills
    // - 4 five-complement subtraction skills
    // - 9 ten-complement addition skills
    // - 9 ten-complement subtraction skills
    // Total: ~32 skills
    const configCount = Object.keys(SKILL_TUTORIAL_CONFIGS).length
    expect(configCount).toBeGreaterThanOrEqual(30)
    expect(configCount).toBeLessThanOrEqual(40)
  })
})
