import { describe, it, expect } from 'vitest'
import {
  BASE_SKILL_COMPLEXITY,
  MASTERY_MULTIPLIERS,
  getBaseComplexity,
  createSkillCostCalculator,
  buildStudentSkillHistory,
  dbMasteryToState,
  type StudentSkillHistory,
} from '../skillComplexity'

describe('BASE_SKILL_COMPLEXITY', () => {
  it('should have costs for all 34 skills', () => {
    expect(Object.keys(BASE_SKILL_COMPLEXITY).length).toBe(34)
  })

  it('should have base cost 1 for basic and five complement skills', () => {
    expect(BASE_SKILL_COMPLEXITY['basic.directAddition']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['basic.directSubtraction']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['basic.heavenBead']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['basic.heavenBeadSubtraction']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['basic.simpleCombinations']).toBe(1)
    expect(BASE_SKILL_COMPLEXITY['basic.simpleCombinationsSub']).toBe(1)
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

describe('MASTERY_MULTIPLIERS', () => {
  it('should have correct multipliers', () => {
    expect(MASTERY_MULTIPLIERS.effortless).toBe(1)
    expect(MASTERY_MULTIPLIERS.fluent).toBe(2)
    expect(MASTERY_MULTIPLIERS.practicing).toBe(3)
    expect(MASTERY_MULTIPLIERS.learning).toBe(4)
  })
})

describe('getBaseComplexity', () => {
  it('should return base complexity for known skills', () => {
    expect(getBaseComplexity('basic.directAddition')).toBe(1)
    expect(getBaseComplexity('tenComplements.9=10-1')).toBe(2)
    expect(getBaseComplexity('advanced.cascadingCarry')).toBe(3)
  })

  it('should return 1 for unknown skills', () => {
    expect(getBaseComplexity('unknown.skill')).toBe(1)
  })
})

describe('createSkillCostCalculator', () => {
  it('should calculate cost based on mastery level', () => {
    const history: StudentSkillHistory = {
      skills: {
        'basic.directAddition': { skillId: 'basic.directAddition', masteryLevel: 'effortless' },
        'tenComplements.9=10-1': { skillId: 'tenComplements.9=10-1', masteryLevel: 'learning' },
      },
    }

    const calculator = createSkillCostCalculator(history)

    // directAddition: base 1 × effortless 1 = 1
    expect(calculator.calculateSkillCost('basic.directAddition')).toBe(1)

    // tenComplement: base 2 × learning 4 = 8
    expect(calculator.calculateSkillCost('tenComplements.9=10-1')).toBe(8)
  })

  it('should treat unknown skills as learning', () => {
    const history: StudentSkillHistory = { skills: {} }
    const calculator = createSkillCostCalculator(history)

    // Unknown skill: base 1 × learning 4 = 4
    expect(calculator.calculateSkillCost('basic.directAddition')).toBe(4)
  })

  it('should calculate term cost as sum of skill costs', () => {
    const history: StudentSkillHistory = {
      skills: {
        'basic.directAddition': { skillId: 'basic.directAddition', masteryLevel: 'effortless' },
        'fiveComplements.4=5-1': { skillId: 'fiveComplements.4=5-1', masteryLevel: 'fluent' },
        'tenComplements.9=10-1': { skillId: 'tenComplements.9=10-1', masteryLevel: 'practicing' },
      },
    }

    const calculator = createSkillCostCalculator(history)

    const termCost = calculator.calculateTermCost([
      'basic.directAddition', // 1 × 1 = 1
      'fiveComplements.4=5-1', // 1 × 2 = 2
      'tenComplements.9=10-1', // 2 × 3 = 6
    ])

    expect(termCost).toBe(9)
  })

  it('should return 0 for empty skill list', () => {
    const history: StudentSkillHistory = { skills: {} }
    const calculator = createSkillCostCalculator(history)
    expect(calculator.calculateTermCost([])).toBe(0)
  })

  it('should return correct mastery state via getMasteryState', () => {
    const history: StudentSkillHistory = {
      skills: {
        'basic.directAddition': { skillId: 'basic.directAddition', masteryLevel: 'effortless' },
        'tenComplements.9=10-1': { skillId: 'tenComplements.9=10-1', masteryLevel: 'practicing' },
      },
    }

    const calculator = createSkillCostCalculator(history)

    expect(calculator.getMasteryState('basic.directAddition')).toBe('effortless')
    expect(calculator.getMasteryState('tenComplements.9=10-1')).toBe('practicing')
    expect(calculator.getMasteryState('unknown.skill')).toBe('learning')
  })
})

describe('dbMasteryToState', () => {
  it('should map learning to learning', () => {
    expect(dbMasteryToState('learning')).toBe('learning')
  })

  it('should map practicing to practicing', () => {
    expect(dbMasteryToState('practicing')).toBe('practicing')
  })

  it('should map recently mastered to fluent', () => {
    expect(dbMasteryToState('mastered', 10)).toBe('fluent')
    expect(dbMasteryToState('mastered', 30)).toBe('fluent')
  })

  it('should map long-ago mastered to effortless', () => {
    expect(dbMasteryToState('mastered', 31)).toBe('effortless')
    expect(dbMasteryToState('mastered', 90)).toBe('effortless')
  })

  it('should default to fluent when no days provided', () => {
    expect(dbMasteryToState('mastered')).toBe('fluent')
  })
})

describe('buildStudentSkillHistory', () => {
  it('should build history from database records', () => {
    const records = [
      {
        skillId: 'basic.directAddition',
        masteryLevel: 'mastered' as const,
        lastPracticedAt: new Date('2024-01-01'),
      },
      {
        skillId: 'tenComplements.9=10-1',
        masteryLevel: 'practicing' as const,
        lastPracticedAt: null,
      },
    ]

    const referenceDate = new Date('2024-03-01') // 60 days later
    const history = buildStudentSkillHistory(records, referenceDate)

    expect(history.skills['basic.directAddition'].masteryLevel).toBe('effortless')
    expect(history.skills['tenComplements.9=10-1'].masteryLevel).toBe('practicing')
  })

  it('should handle empty records', () => {
    const history = buildStudentSkillHistory([])
    expect(history.skills).toEqual({})
  })

  it('should use current date as default reference', () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

    const records = [
      {
        skillId: 'basic.directAddition',
        masteryLevel: 'mastered' as const,
        lastPracticedAt: recentDate,
      },
    ]

    const history = buildStudentSkillHistory(records)
    // 5 days ago = fluent (< 30 days)
    expect(history.skills['basic.directAddition'].masteryLevel).toBe('fluent')
  })
})
