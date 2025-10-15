import { describe, expect, it } from 'vitest'
import {
  generatePlayerName,
  generateUniquePlayerName,
  generateUniquePlayerNames,
} from '../playerNames'

describe('playerNames', () => {
  describe('generatePlayerName', () => {
    it('should generate a player name with adjective and noun', () => {
      const name = generatePlayerName()
      expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/) // e.g., "Swift Ninja"
      expect(name.split(' ')).toHaveLength(2)
    })

    it('should generate different names on multiple calls', () => {
      const names = new Set()
      // Generate 50 names and expect at least some variety
      for (let i = 0; i < 50; i++) {
        names.add(generatePlayerName())
      }
      // With 50 adjectives and 50 nouns, we should get many unique combinations
      expect(names.size).toBeGreaterThan(30)
    })
  })

  describe('generateUniquePlayerName', () => {
    it('should generate a unique name not in existing names', () => {
      const existingNames = ['Swift Ninja', 'Cosmic Wizard', 'Radiant Dragon']
      const newName = generateUniquePlayerName(existingNames)

      expect(existingNames).not.toContain(newName)
    })

    it('should be case-insensitive when checking uniqueness', () => {
      const existingNames = ['swift ninja', 'COSMIC WIZARD']
      const newName = generateUniquePlayerName(existingNames)

      expect(existingNames.map((n) => n.toLowerCase())).not.toContain(newName.toLowerCase())
    })

    it('should handle empty existing names array', () => {
      const name = generateUniquePlayerName([])
      expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
    })

    it('should append number if all combinations are exhausted', () => {
      // Create a mock with limited attempts
      const existingNames = ['Swift Ninja']
      const name = generateUniquePlayerName(existingNames, undefined, 1)

      // Should either be unique or have a number appended
      expect(name).toBeTruthy()
      expect(name).not.toBe('Swift Ninja')
    })
  })

  describe('generateUniquePlayerNames', () => {
    it('should generate the requested number of unique names', () => {
      const names = generateUniquePlayerNames(4)
      expect(names).toHaveLength(4)

      // All names should be unique
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(4)
    })

    it('should generate unique names across all entries', () => {
      const names = generateUniquePlayerNames(10)
      expect(names).toHaveLength(10)

      // Check uniqueness (case-insensitive)
      const uniqueNames = new Set(names.map((n) => n.toLowerCase()))
      expect(uniqueNames.size).toBe(10)
    })

    it('should handle generating zero names', () => {
      const names = generateUniquePlayerNames(0)
      expect(names).toHaveLength(0)
      expect(names).toEqual([])
    })

    it('should generate names with expected format', () => {
      const names = generateUniquePlayerNames(5)

      for (const name of names) {
        expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+( \d+)?$/)
        expect(name.split(' ').length).toBeGreaterThanOrEqual(2)
      }
    })
  })
})
