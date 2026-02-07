import { describe, it, expect } from 'vitest'
import {
  getSkillDisplayName,
  getCategoryDisplayName,
  parseSkillId,
  isValidCategory,
  getSkillsInCategory,
} from '../skillDisplay'

describe('parseSkillId', () => {
  it('parses category.shortKey format', () => {
    expect(parseSkillId('fiveComplements.4=5-1')).toEqual({
      category: 'fiveComplements',
      shortKey: '4=5-1',
    })
  })

  it('handles no-dot IDs', () => {
    expect(parseSkillId('noCategory')).toEqual({
      category: '',
      shortKey: 'noCategory',
    })
  })

  it('handles multiple dots (uses first)', () => {
    expect(parseSkillId('a.b.c')).toEqual({
      category: 'a',
      shortKey: 'b.c',
    })
  })
})

describe('getSkillDisplayName', () => {
  it('returns display name for known skill', () => {
    expect(getSkillDisplayName('tenComplements.9=10-1')).toBe('+9 = +10 - 1')
  })

  it('returns shortKey for unknown skill in known category', () => {
    expect(getSkillDisplayName('tenComplements.unknownSkill')).toBe('unknownSkill')
  })

  it('returns shortKey for unknown category', () => {
    expect(getSkillDisplayName('unknownCategory.someSkill')).toBe('someSkill')
  })

  it('returns full ID for no-dot input', () => {
    expect(getSkillDisplayName('noCategory')).toBe('noCategory')
  })
})

describe('getCategoryDisplayName', () => {
  it('returns name for known category', () => {
    expect(getCategoryDisplayName('tenComplements')).toBe('Ten Complements (Addition)')
  })

  it('returns category ID for unknown category', () => {
    expect(getCategoryDisplayName('unknownCat')).toBe('unknownCat')
  })
})

describe('isValidCategory', () => {
  it('returns true for known categories', () => {
    expect(isValidCategory('basic')).toBe(true)
    expect(isValidCategory('tenComplements')).toBe(true)
  })

  it('returns false for unknown categories', () => {
    expect(isValidCategory('notACategory')).toBe(false)
  })
})

describe('getSkillsInCategory', () => {
  it('returns skills for a known category', () => {
    const skills = getSkillsInCategory('tenComplements')
    expect(skills.length).toBeGreaterThan(0)
    expect(skills[0]).toHaveProperty('id')
    expect(skills[0]).toHaveProperty('displayName')
    expect(skills[0].id).toMatch(/^tenComplements\./)
  })

  it('returns empty array for unknown category', () => {
    expect(getSkillsInCategory('notReal')).toEqual([])
  })
})
