import { describe, it, expect } from 'vitest'
import { generateShareId, isValidShareId } from '../generateShareId'

describe('generateShareId', () => {
  it('generates a 7-character ID by default', () => {
    const id = generateShareId()
    expect(id).toHaveLength(7)
  })

  it('generates IDs with custom length', () => {
    const id = generateShareId(10)
    expect(id).toHaveLength(10)
  })

  it('only contains base62 characters', () => {
    const id = generateShareId()
    expect(id).toMatch(/^[0-9a-zA-Z]+$/)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateShareId()))
    expect(ids.size).toBe(100)
  })
})

describe('isValidShareId', () => {
  it('accepts valid 7-character base62 IDs', () => {
    expect(isValidShareId('abc123X')).toBe(true)
    expect(isValidShareId('k7mP2qR')).toBe(true)
    expect(isValidShareId('0000000')).toBe(true)
    expect(isValidShareId('ZZZZZZZ')).toBe(true)
  })

  it('rejects wrong length', () => {
    expect(isValidShareId('abc')).toBe(false)
    expect(isValidShareId('abcdefgh')).toBe(false)
    expect(isValidShareId('')).toBe(false)
  })

  it('rejects invalid characters', () => {
    expect(isValidShareId('abc-123')).toBe(false)
    expect(isValidShareId('abc 123')).toBe(false)
    expect(isValidShareId('abc_123')).toBe(false)
  })

  it('validates generated IDs', () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidShareId(generateShareId())).toBe(true)
    }
  })
})
