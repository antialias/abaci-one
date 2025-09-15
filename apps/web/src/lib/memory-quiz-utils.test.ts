import { describe, it, expect } from 'vitest'
import {
  isPrefix,
  couldBePrefix,
  isCompleteWrongNumber,
  shouldTriggerIncorrectGuess,
  isCorrectAndAvailable
} from './memory-quiz-utils'

describe('Memory Quiz Utils', () => {
  describe('isPrefix', () => {
    it('should return true when input is a prefix of target numbers', () => {
      const targets = [555, 123, 789]
      const found = []

      expect(isPrefix('5', targets, found)).toBe(true)
      expect(isPrefix('55', targets, found)).toBe(true)
      expect(isPrefix('1', targets, found)).toBe(true)
      expect(isPrefix('12', targets, found)).toBe(true)
    })

    it('should return false when input is an exact match', () => {
      const targets = [555, 123, 789]
      const found = []

      expect(isPrefix('555', targets, found)).toBe(false)
      expect(isPrefix('123', targets, found)).toBe(false)
    })

    it('should return false when input is not a prefix', () => {
      const targets = [555, 123, 789]
      const found = []

      expect(isPrefix('6', targets, found)).toBe(false)
      expect(isPrefix('13', targets, found)).toBe(false)
      expect(isPrefix('999', targets, found)).toBe(false)
    })

    it('should exclude found numbers from prefix checking - BUG FIX: 55/555 scenario', () => {
      const targets = [55, 555, 123]
      const found = [55] // 55 is already found

      // After finding 55, typing "55" again should not be considered a prefix of 555
      expect(isPrefix('55', targets, found)).toBe(false)

      // But "5" should still be a prefix of 555 (since 555 is not found)
      expect(isPrefix('5', targets, found)).toBe(true)
    })

    it('should handle multiple found numbers correctly', () => {
      const targets = [5, 55, 555, 5555]
      const found = [5, 55] // First two are found

      // "5" and "55" should still be prefixes of the remaining unfound numbers
      expect(isPrefix('5', targets, found)).toBe(true) // prefix of 555, 5555
      expect(isPrefix('55', targets, found)).toBe(true) // prefix of 555, 5555
      expect(isPrefix('555', targets, found)).toBe(true) // prefix of 5555
    })

    it('should handle when all potential targets are found', () => {
      const targets = [5, 55, 555]
      const found = [55, 555] // All numbers that start with 5 are found

      expect(isPrefix('5', targets, found)).toBe(false) // 5 is not found, but exact match
    })
  })

  describe('couldBePrefix', () => {
    it('should return true for valid prefixes', () => {
      const targets = [123, 456, 789]

      expect(couldBePrefix('1', targets)).toBe(true)
      expect(couldBePrefix('12', targets)).toBe(true)
      expect(couldBePrefix('4', targets)).toBe(true)
      expect(couldBePrefix('45', targets)).toBe(true)
    })

    it('should return false for invalid prefixes', () => {
      const targets = [123, 456, 789]

      expect(couldBePrefix('2', targets)).toBe(false)
      expect(couldBePrefix('13', targets)).toBe(false)
      expect(couldBePrefix('999', targets)).toBe(false)
    })

    it('should return true for exact matches', () => {
      const targets = [123, 456, 789]

      expect(couldBePrefix('123', targets)).toBe(true)
      expect(couldBePrefix('456', targets)).toBe(true)
    })
  })

  describe('isCompleteWrongNumber', () => {
    it('should return true for clearly wrong numbers with length >= 2', () => {
      const targets = [123, 456, 789]

      expect(isCompleteWrongNumber('99', targets)).toBe(true)
      expect(isCompleteWrongNumber('999', targets)).toBe(true)
      expect(isCompleteWrongNumber('13', targets)).toBe(true) // not 123
    })

    it('should return true for single digits that cannot be prefixes', () => {
      const targets = [123, 456, 789]

      expect(isCompleteWrongNumber('2', targets)).toBe(true)
      expect(isCompleteWrongNumber('9', targets)).toBe(true)
    })

    it('should return false for valid prefixes', () => {
      const targets = [123, 456, 789]

      expect(isCompleteWrongNumber('1', targets)).toBe(false) // prefix of 123
      expect(isCompleteWrongNumber('12', targets)).toBe(false) // prefix of 123
      expect(isCompleteWrongNumber('4', targets)).toBe(false) // prefix of 456
    })

    it('should return false for exact matches', () => {
      const targets = [123, 456, 789]

      expect(isCompleteWrongNumber('123', targets)).toBe(false)
      expect(isCompleteWrongNumber('456', targets)).toBe(false)
    })

    it('should handle numbers that cannot be prefixes regardless of length', () => {
      const targets = [123, 456, 789]

      // Numbers that can't be prefixes are always wrong regardless of length
      expect(isCompleteWrongNumber('2', targets)).toBe(true) // can't be prefix of any target
      expect(isCompleteWrongNumber('99', targets)).toBe(true) // can't be prefix of any target
      expect(isCompleteWrongNumber('999', targets)).toBe(true) // can't be prefix of any target
    })
  })

  describe('shouldTriggerIncorrectGuess', () => {
    it('should not trigger for correct answers', () => {
      const targets = [55, 555, 123]
      const found = []

      expect(shouldTriggerIncorrectGuess('55', targets, found)).toBe(false)
      expect(shouldTriggerIncorrectGuess('555', targets, found)).toBe(false)
      expect(shouldTriggerIncorrectGuess('123', targets, found)).toBe(false)
    })

    it('should not trigger for correct answers even if already found', () => {
      const targets = [55, 555, 123]
      const found = [55]

      // Should not trigger even though 55 is already found
      expect(shouldTriggerIncorrectGuess('55', targets, found)).toBe(false)
    })

    it('should trigger for clearly wrong numbers', () => {
      const targets = [55, 555, 123]
      const found = []

      expect(shouldTriggerIncorrectGuess('99', targets, found)).toBe(true)
      expect(shouldTriggerIncorrectGuess('999', targets, found)).toBe(true)
      expect(shouldTriggerIncorrectGuess('12', targets, found)).toBe(true) // not 123 or any other target
    })

    it('should trigger for single digits that cannot be prefixes', () => {
      const targets = [123, 456, 789]
      const found = []

      expect(shouldTriggerIncorrectGuess('2', targets, found)).toBe(true)
      expect(shouldTriggerIncorrectGuess('9', targets, found)).toBe(true)
    })

    it('should not trigger for valid prefixes', () => {
      const targets = [555, 123, 789]
      const found = []

      expect(shouldTriggerIncorrectGuess('5', targets, found)).toBe(false)
      expect(shouldTriggerIncorrectGuess('55', targets, found)).toBe(false)
      expect(shouldTriggerIncorrectGuess('1', targets, found)).toBe(false)
    })

    it('should not trigger when no guesses remaining', () => {
      const targets = [123, 456, 789]
      const found = []

      expect(shouldTriggerIncorrectGuess('99', targets, found, false)).toBe(false)
    })

    it('should handle the 55/555 bug scenario correctly', () => {
      const targets = [55, 555, 123]
      const found = [55] // 55 already found

      // After finding 55, user types "555" - should not trigger incorrect guess
      expect(shouldTriggerIncorrectGuess('555', targets, found)).toBe(false)

      // User types "99" - should trigger incorrect guess
      expect(shouldTriggerIncorrectGuess('99', targets, found)).toBe(true)
    })
  })

  describe('isCorrectAndAvailable', () => {
    it('should return true for correct unfound numbers', () => {
      const targets = [55, 555, 123]
      const found = []

      expect(isCorrectAndAvailable(55, targets, found)).toBe(true)
      expect(isCorrectAndAvailable(555, targets, found)).toBe(true)
      expect(isCorrectAndAvailable(123, targets, found)).toBe(true)
    })

    it('should return false for already found numbers', () => {
      const targets = [55, 555, 123]
      const found = [55, 123]

      expect(isCorrectAndAvailable(55, targets, found)).toBe(false)
      expect(isCorrectAndAvailable(123, targets, found)).toBe(false)
      expect(isCorrectAndAvailable(555, targets, found)).toBe(true) // still available
    })

    it('should return false for incorrect numbers', () => {
      const targets = [55, 555, 123]
      const found = []

      expect(isCorrectAndAvailable(99, targets, found)).toBe(false)
      expect(isCorrectAndAvailable(999, targets, found)).toBe(false)
    })
  })

  describe('Integration scenarios', () => {
    it('should handle the reported 55/555 bug correctly', () => {
      const targets = [55, 555, 789]
      let found: number[] = []

      // User types "55" - should be accepted
      expect(isCorrectAndAvailable(55, targets, found)).toBe(true)
      expect(isPrefix('55', targets, found)).toBe(true) // prefix of 555

      // Accept "55"
      found = [55]

      // Now user tries to type "555"
      // First they type "5" - should be valid prefix of 555
      expect(isPrefix('5', targets, found)).toBe(true) // still prefix of 555
      expect(shouldTriggerIncorrectGuess('5', targets, found)).toBe(false)

      // Then "55" - should NOT be considered prefix anymore since 55 is found
      expect(isPrefix('55', targets, found)).toBe(false) // 55 is found, not prefix of remaining
      expect(shouldTriggerIncorrectGuess('55', targets, found)).toBe(false) // but still correct answer

      // Finally "555" - should be accepted
      expect(isCorrectAndAvailable(555, targets, found)).toBe(true)
      expect(shouldTriggerIncorrectGuess('555', targets, found)).toBe(false)
    })

    it('should handle multiple overlapping prefixes', () => {
      const targets = [1, 12, 123, 1234]
      let found: number[] = []

      // All should be prefixes initially
      expect(isPrefix('1', targets, found)).toBe(true) // prefix of 12, 123, 1234
      expect(isPrefix('12', targets, found)).toBe(true) // prefix of 123, 1234
      expect(isPrefix('123', targets, found)).toBe(true) // prefix of 1234

      // Find 1 and 123
      found = [1, 123]

      // Check prefixes with some found
      expect(isPrefix('1', targets, found)).toBe(true) // still prefix of 12, 1234
      expect(isPrefix('12', targets, found)).toBe(true) // still prefix of 12, 1234
      expect(isPrefix('123', targets, found)).toBe(true) // still prefix of 1234 (123 is found but 1234 isn't)
    })
  })
})