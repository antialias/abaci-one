import { describe, it, expect } from 'vitest'
import {
  searchSkills,
  getSkillsInCategory,
  getAllSkills,
  getSkillDisplayName,
  getSkillCategoryDisplayName,
  formatSkillChipName,
} from '../skillSearch'

// ============================================================================
// getAllSkills
// ============================================================================
describe('getAllSkills', () => {
  it('returns a non-empty array', () => {
    const skills = getAllSkills()
    expect(skills.length).toBeGreaterThan(0)
  })

  it('each skill has required properties', () => {
    const skills = getAllSkills()
    for (const skill of skills) {
      expect(skill).toHaveProperty('skillId')
      expect(skill).toHaveProperty('displayName')
      expect(skill).toHaveProperty('category')
      expect(skill).toHaveProperty('categoryName')
      expect(typeof skill.skillId).toBe('string')
      expect(typeof skill.displayName).toBe('string')
    }
  })

  it('returns a copy (not the internal array)', () => {
    const skills1 = getAllSkills()
    const skills2 = getAllSkills()
    expect(skills1).not.toBe(skills2)
    expect(skills1).toEqual(skills2)
  })

  it('skill IDs follow the "category.shortKey" format', () => {
    const skills = getAllSkills()
    for (const skill of skills) {
      expect(skill.skillId).toContain('.')
      const [category] = skill.skillId.split('.')
      expect(category).toBe(skill.category)
    }
  })
})

// ============================================================================
// searchSkills
// ============================================================================
describe('searchSkills', () => {
  it('returns empty array for empty query', () => {
    expect(searchSkills('')).toEqual([])
  })

  it('returns empty array for whitespace-only query', () => {
    expect(searchSkills('   ')).toEqual([])
  })

  it('finds skills by display name (case-insensitive)', () => {
    const results = searchSkills('cascading')
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(
        r.displayName.toLowerCase().includes('cascading') ||
          r.categoryName.toLowerCase().includes('cascading')
      ).toBe(true)
    }
  })

  it('finds skills by category name', () => {
    const results = searchSkills('five complements')
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(
        r.displayName.toLowerCase().includes('five complements') ||
          r.categoryName.toLowerCase().includes('five complements')
      ).toBe(true)
    }
  })

  it('sorts results with startsWith matches first', () => {
    // "+4" should match "+4 = +5 - 1" which starts with +4
    const results = searchSkills('+4')
    expect(results.length).toBeGreaterThan(0)
    // The first result should start with +4
    const firstStartsWith = results[0].displayName.toLowerCase().startsWith('+4')
    expect(firstStartsWith).toBe(true)
  })

  it('returns results for partial match', () => {
    const results = searchSkills('10')
    expect(results.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// getSkillsInCategory
// ============================================================================
describe('getSkillsInCategory', () => {
  it('returns skills for basic category', () => {
    const skills = getSkillsInCategory('basic')
    expect(skills.length).toBeGreaterThan(0)
    for (const skill of skills) {
      expect(skill.category).toBe('basic')
    }
  })

  it('returns skills for fiveComplements category', () => {
    const skills = getSkillsInCategory('fiveComplements')
    expect(skills.length).toBe(4) // 4=5-1, 3=5-2, 2=5-3, 1=5-4
    for (const skill of skills) {
      expect(skill.category).toBe('fiveComplements')
    }
  })

  it('returns skills for advanced category', () => {
    const skills = getSkillsInCategory('advanced')
    expect(skills.length).toBe(2) // cascadingCarry, cascadingBorrow
    for (const skill of skills) {
      expect(skill.category).toBe('advanced')
    }
  })
})

// ============================================================================
// getSkillDisplayName
// ============================================================================
describe('getSkillDisplayName', () => {
  it('returns display name for a valid skill ID', () => {
    const name = getSkillDisplayName('basic.directAddition')
    expect(name).toBe('Direct Addition (1-4)')
  })

  it('returns the skillId itself for an unknown skill', () => {
    expect(getSkillDisplayName('unknown.skill')).toBe('unknown.skill')
  })

  it('returns display name for a five complement skill', () => {
    const name = getSkillDisplayName('fiveComplements.4=5-1')
    expect(name).toBe('+4 = +5 - 1')
  })
})

// ============================================================================
// getSkillCategoryDisplayName
// ============================================================================
describe('getSkillCategoryDisplayName', () => {
  it('returns category display name for a valid skill', () => {
    expect(getSkillCategoryDisplayName('basic.directAddition')).toBe('Basic Skills')
  })

  it('returns "Unknown" for an unknown skill', () => {
    expect(getSkillCategoryDisplayName('unknown.skill')).toBe('Unknown')
  })

  it('returns correct category for ten complements', () => {
    expect(getSkillCategoryDisplayName('tenComplements.9=10-1')).toBe('Ten Complements (Addition)')
  })
})

// ============================================================================
// formatSkillChipName
// ============================================================================
describe('formatSkillChipName', () => {
  it('returns skillId for unknown skill', () => {
    expect(formatSkillChipName('unknown.skill')).toBe('unknown.skill')
  })

  it('formats a five complement skill with short category and operation', () => {
    const name = formatSkillChipName('fiveComplements.4=5-1')
    expect(name).toBe("5's Add: +4")
  })

  it('formats a ten complement skill', () => {
    const name = formatSkillChipName('tenComplements.9=10-1')
    expect(name).toBe("10's Add: +9")
  })

  it('formats a ten complement subtraction skill', () => {
    const name = formatSkillChipName('tenComplementsSub.-9=+1-10')
    expect(name).toBe("10's Sub: -9")
  })

  it('formats a basic skill (no operation match)', () => {
    // "Direct Addition (1-4)" - the regex matches on numeric start of displayName
    const name = formatSkillChipName('basic.directAddition')
    // "Direct Addition (1-4)" doesn't start with +/- number, so op is empty
    expect(name).toBe('Basic')
  })

  it('formats an advanced skill', () => {
    const name = formatSkillChipName('advanced.cascadingCarry')
    // "Cascading Carry (e.g., 999 + 1 = 1000)" doesn't start with a digit
    expect(name).toBe('Advanced')
  })
})
