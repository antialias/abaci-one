import { describe, it, expect } from 'vitest'
import {
  BASE_SKILL_COMPLEXITY,
  ROTATION_MULTIPLIERS,
  getBaseComplexity,
  createSkillCostCalculator,
  buildStudentSkillHistoryFromRecords,
  type StudentSkillHistory,
  type DbSkillRecord,
} from '../skillComplexity'

describe('BASE_SKILL_COMPLEXITY', () => {
  it('should have costs for all 34 skills', () => {
    expect(Object.keys(BASE_SKILL_COMPLEXITY).length).toBe(34)
  })

  it('should have base cost 0 for basic skills', () => {
    expect(BASE_SKILL_COMPLEXITY['basic.directAddition']).toBe(0)
    expect(BASE_SKILL_COMPLEXITY['basic.directSubtraction']).toBe(0)
    expect(BASE_SKILL_COMPLEXITY['basic.heavenBead']).toBe(0)
    expect(BASE_SKILL_COMPLEXITY['basic.heavenBeadSubtraction']).toBe(0)
    expect(BASE_SKILL_COMPLEXITY['basic.simpleCombinations']).toBe(0)
    expect(BASE_SKILL_COMPLEXITY['basic.simpleCombinationsSub']).toBe(0)
  })

  it('should have base cost 1 for five complement skills', () => {
    expect(BASE_SKILL_COMPLEXITY['fiveComplements.4=5-1']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplements.3=5-2']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplements.2=5-3']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplements.1=5-4']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplementsSub.-4=-5+1']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplementsSub.-3=-5+2']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplementsSub.-2=-5+3']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['fiveComplementsSub.-1=-5+4']).toBe(1)
  })

  it('should have base cost 2 for ten complement skills', () => {
    expect(BASE_SKILL_COMPLEXITY['tenComplements.9=10-1']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplements.8=10-2']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplements.7=10-3']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplements.6=10-4']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplements.5=10-5']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplements.4=10-6']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplements.3=10-7']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplements.2=10-8']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplements.1=10-9']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-9=+1-10']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-8=+2-10']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-7=+3-10']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-6=+4-10']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-5=+5-10']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-4=+6-10']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-3=+7-10']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-2=+8-10']).toBe(2)
    expect(BASE_SKILL_COMPLEXITY['tenComplementsSub.-1=+9-10']).toBe(2)
  })

  it('should have base cost 3 for advanced cascading skills', () => {
    expect(BASE_SKILL_COMPLEXITY['advanced.cascadingCarry']).toBe(3)
    expect(BASE_SKILL_COMPLEXITY['advanced.cascadingBorrow']).toBe(3)
  })
})

describe('ROTATION_MULTIPLIERS', () => {
  it('should have correct multipliers for rotation status (BKT handles fine-grained mastery)', () => {
    // Only two states: inRotation and outOfRotation
    // BKT provides fine-grained mastery via continuous P(known) values
    expect(ROTATION_MULTIPLIERS.inRotation).toBe(3)
    expect(ROTATION_MULTIPLIERS.outOfRotation).toBe(4)
  })

  it('should only have two rotation states', () => {
    const keys = Object.keys(ROTATION_MULTIPLIERS)
    expect(keys).toHaveLength(2)
    expect(keys).toContain('inRotation')
    expect(keys).toContain('outOfRotation')
  })
})

describe('getBaseComplexity', () => {
  it('should return base complexity for known skills', () => {
    expect(getBaseComplexity('basic.directAddition')).toBe(0)
    expect(getBaseComplexity('fiveComplements.4=5-1')).toBe(1)
    expect(getBaseComplexity('tenComplements.9=10-1')).toBe(2)
    expect(getBaseComplexity('advanced.cascadingCarry')).toBe(3)
  })

  it('should return 1 for unknown skills', () => {
    expect(getBaseComplexity('unknown.skill')).toBe(1)
  })
})

describe('createSkillCostCalculator', () => {
  it('should calculate cost based on isPracticing status (without BKT)', () => {
    // Without BKT data, practicing skills use multiplier 3, not practicing use 4
    const history: StudentSkillHistory = {
      skills: {
        'fiveComplements.4=5-1': {
          skillId: 'fiveComplements.4=5-1',
          isPracticing: true,
        },
        'tenComplements.9=10-1': {
          skillId: 'tenComplements.9=10-1',
          isPracticing: false,
        },
      },
    }

    const calculator = createSkillCostCalculator(history)

    // fiveComplement: base 1 × inRotation 3 = 3 (no BKT to override)
    expect(calculator.calculateSkillCost('fiveComplements.4=5-1')).toBe(3)

    // tenComplement: base 2 × outOfRotation 4 = 8
    expect(calculator.calculateSkillCost('tenComplements.9=10-1')).toBe(8)
  })

  it('should treat unknown skills as not practicing', () => {
    const history: StudentSkillHistory = { skills: {} }
    const calculator = createSkillCostCalculator(history)

    // Unknown skill with base 1: base 1 × outOfRotation 4 = 4
    expect(calculator.calculateSkillCost('fiveComplements.4=5-1')).toBe(4)
  })

  it('should calculate term cost as sum of skill costs', () => {
    // Without BKT, all practicing skills use multiplier 3
    const history: StudentSkillHistory = {
      skills: {
        'fiveComplements.4=5-1': {
          skillId: 'fiveComplements.4=5-1',
          isPracticing: true,
        },
        'fiveComplements.3=5-2': {
          skillId: 'fiveComplements.3=5-2',
          isPracticing: true,
        },
        'tenComplements.9=10-1': {
          skillId: 'tenComplements.9=10-1',
          isPracticing: true,
        },
      },
    }

    const calculator = createSkillCostCalculator(history)

    const termCost = calculator.calculateTermCost([
      'fiveComplements.4=5-1', // 1 × 3 = 3
      'fiveComplements.3=5-2', // 1 × 3 = 3
      'tenComplements.9=10-1', // 2 × 3 = 6
    ])

    expect(termCost).toBe(12)
  })

  it('should return 0 for empty skill list', () => {
    const history: StudentSkillHistory = { skills: {} }
    const calculator = createSkillCostCalculator(history)
    expect(calculator.calculateTermCost([])).toBe(0)
  })

  it('should return correct practicing status via getIsPracticing', () => {
    const history: StudentSkillHistory = {
      skills: {
        'fiveComplements.4=5-1': {
          skillId: 'fiveComplements.4=5-1',
          isPracticing: true,
        },
        'tenComplements.9=10-1': {
          skillId: 'tenComplements.9=10-1',
          isPracticing: false,
        },
      },
    }

    const calculator = createSkillCostCalculator(history)

    expect(calculator.getIsPracticing('fiveComplements.4=5-1')).toBe(true)
    expect(calculator.getIsPracticing('tenComplements.9=10-1')).toBe(false)
    expect(calculator.getIsPracticing('unknown.skill')).toBe(false)
  })
})

describe('buildStudentSkillHistoryFromRecords', () => {
  it('should build history from database records', () => {
    const records: DbSkillRecord[] = [
      {
        skillId: 'fiveComplements.4=5-1',
        isPracticing: true,
        attempts: 10,
        correct: 9,
        consecutiveCorrect: 5,
        lastPracticedAt: new Date('2024-02-25'),
      },
      {
        skillId: 'tenComplements.9=10-1',
        isPracticing: true,
        attempts: 5,
        correct: 4,
        consecutiveCorrect: 2,
        lastPracticedAt: null,
      },
      {
        skillId: 'basic.directAddition',
        isPracticing: false,
        attempts: 0,
        correct: 0,
        consecutiveCorrect: 0,
        lastPracticedAt: null,
      },
    ]

    const history = buildStudentSkillHistoryFromRecords(records)

    // In practice rotation = isPracticing true
    expect(history.skills['fiveComplements.4=5-1'].isPracticing).toBe(true)
    // In practice rotation = isPracticing true
    expect(history.skills['tenComplements.9=10-1'].isPracticing).toBe(true)
    // Not in practice rotation = isPracticing false
    expect(history.skills['basic.directAddition'].isPracticing).toBe(false)
  })

  it('should handle empty records', () => {
    const history = buildStudentSkillHistoryFromRecords([])
    expect(history.skills).toEqual({})
  })
})
