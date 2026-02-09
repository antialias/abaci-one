import { describe, expect, it } from 'vitest'
import { numberToEnglish } from '../numberToEnglish'

describe('numberToEnglish', () => {
  it('handles 0', () => {
    expect(numberToEnglish(0)).toBe('zero')
  })

  it('handles single digits (1-9)', () => {
    expect(numberToEnglish(1)).toBe('one')
    expect(numberToEnglish(5)).toBe('five')
    expect(numberToEnglish(9)).toBe('nine')
  })

  it('handles teens (10-20)', () => {
    expect(numberToEnglish(10)).toBe('ten')
    expect(numberToEnglish(11)).toBe('eleven')
    expect(numberToEnglish(15)).toBe('fifteen')
    expect(numberToEnglish(19)).toBe('nineteen')
    expect(numberToEnglish(20)).toBe('twenty')
  })

  it('handles two-digit numbers (21-99)', () => {
    expect(numberToEnglish(21)).toBe('twenty one')
    expect(numberToEnglish(30)).toBe('thirty')
    expect(numberToEnglish(42)).toBe('forty two')
    expect(numberToEnglish(55)).toBe('fifty five')
    expect(numberToEnglish(99)).toBe('ninety nine')
  })

  it('handles hundreds', () => {
    expect(numberToEnglish(100)).toBe('one hundred')
    expect(numberToEnglish(157)).toBe('one hundred fifty seven')
    expect(numberToEnglish(200)).toBe('two hundred')
    expect(numberToEnglish(305)).toBe('three hundred five')
    expect(numberToEnglish(410)).toBe('four hundred ten')
    expect(numberToEnglish(512)).toBe('five hundred twelve')
    expect(numberToEnglish(999)).toBe('nine hundred ninety nine')
  })

  it('handles thousands', () => {
    expect(numberToEnglish(1000)).toBe('one thousand')
    expect(numberToEnglish(2000)).toBe('two thousand')
    expect(numberToEnglish(2345)).toBe('two thousand three hundred forty five')
    expect(numberToEnglish(1001)).toBe('one thousand one')
    expect(numberToEnglish(9999)).toBe('nine thousand nine hundred ninety nine')
  })

  it('handles round thousands with hundreds', () => {
    expect(numberToEnglish(1100)).toBe('one thousand one hundred')
    expect(numberToEnglish(5020)).toBe('five thousand twenty')
  })

  it('throws for negative numbers', () => {
    expect(() => numberToEnglish(-1)).toThrow()
  })

  it('throws for numbers > 9999', () => {
    expect(() => numberToEnglish(10000)).toThrow()
  })

  it('throws for non-integers', () => {
    expect(() => numberToEnglish(1.5)).toThrow()
  })
})
