import { describe, it, expect } from 'vitest'
import { pluralize, conjugate3p, conjugateBase, formatWithUnit, capitalize } from '../inflect'
import type { NounEntry, VerbEntry } from '../types'

describe('inflect', () => {
  const slice: NounEntry = { singular: 'slice', plural: 'slices' }
  const cost: VerbEntry = { base: 'cost', thirdPerson: 'costs', pastTense: 'cost', gerund: 'costing' }

  describe('pluralize', () => {
    it('returns singular for count 1', () => {
      expect(pluralize(slice, 1)).toBe('slice')
    })

    it('returns plural for count != 1', () => {
      expect(pluralize(slice, 0)).toBe('slices')
      expect(pluralize(slice, 2)).toBe('slices')
      expect(pluralize(slice, 10)).toBe('slices')
    })
  })

  describe('conjugate3p', () => {
    it('returns third-person form', () => {
      expect(conjugate3p(cost)).toBe('costs')
    })
  })

  describe('conjugateBase', () => {
    it('returns base form', () => {
      expect(conjugateBase(cost)).toBe('cost')
    })
  })

  describe('formatWithUnit', () => {
    it('formats prefix units (e.g. $)', () => {
      expect(formatWithUnit(3, '$', 'prefix')).toBe('$3')
      expect(formatWithUnit(100, '$', 'prefix')).toBe('$100')
    })

    it('formats suffix units', () => {
      expect(formatWithUnit(5, 'inches', 'suffix')).toBe('5 inches')
      expect(formatWithUnit(1, 'cup', 'suffix')).toBe('1 cup')
    })
  })

  describe('capitalize', () => {
    it('capitalizes first letter', () => {
      expect(capitalize('hello')).toBe('Hello')
      expect(capitalize('already')).toBe('Already')
    })

    it('handles empty string', () => {
      expect(capitalize('')).toBe('')
    })

    it('handles already capitalized', () => {
      expect(capitalize('Hello')).toBe('Hello')
    })
  })
})
