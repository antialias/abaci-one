import { describe, it, expect } from 'vitest'
import {
  calculateBeadDiff,
  calculateBeadDiffFromValues,
  calculateMultiStepBeadDiffs,
  areStatesEqual,
  validateBeadDiff
} from '../beadDiff'
import { numberToAbacusState } from '../abacusInstructionGenerator'

describe('Bead Diff Algorithm', () => {
  describe('Basic State Transitions', () => {
    it('should calculate diff for simple addition: 0 + 1', () => {
      const diff = calculateBeadDiffFromValues(0, 1)

      expect(diff.hasChanges).toBe(true)
      expect(diff.changes).toHaveLength(1)
      expect(diff.changes[0]).toEqual({
        placeValue: 0,
        beadType: 'earth',
        position: 0,
        direction: 'activate',
        order: 0
      })
      expect(diff.summary).toBe('add 1 earth bead in ones column')
    })

    it('should calculate diff for heaven bead: 0 + 5', () => {
      const diff = calculateBeadDiffFromValues(0, 5)

      expect(diff.hasChanges).toBe(true)
      expect(diff.changes).toHaveLength(1)
      expect(diff.changes[0]).toEqual({
        placeValue: 0,
        beadType: 'heaven',
        direction: 'activate',
        order: 0
      })
      expect(diff.summary).toBe('add heaven bead in ones column')
    })

    it('should calculate diff for complement operation: 3 + 4 = 7', () => {
      const diff = calculateBeadDiffFromValues(3, 7)

      expect(diff.hasChanges).toBe(true)
      expect(diff.changes).toHaveLength(2) // Remove 1 earth, add heaven

      // Should remove 1 earth bead first (pedagogical order)
      const removals = diff.changes.filter(c => c.direction === 'deactivate')
      const additions = diff.changes.filter(c => c.direction === 'activate')

      expect(removals).toHaveLength(1) // Remove 1 earth bead (position 2)
      expect(additions).toHaveLength(1) // Add heaven bead

      // Removals should come first in order
      expect(removals[0].order).toBeLessThan(additions[0].order)

      expect(diff.summary).toContain('remove 1 earth bead')
      expect(diff.summary).toContain('add heaven bead')
    })

    it('should calculate diff for ten transition: 9 + 1 = 10', () => {
      const diff = calculateBeadDiffFromValues(9, 10)

      expect(diff.hasChanges).toBe(true)

      // Should remove heaven + 4 earth in ones, add 1 earth in tens
      const onesChanges = diff.changes.filter(c => c.placeValue === 0)
      const tensChanges = diff.changes.filter(c => c.placeValue === 1)

      expect(onesChanges).toHaveLength(5) // Remove heaven + 4 earth
      expect(tensChanges).toHaveLength(1) // Add 1 earth in tens

      expect(diff.summary).toContain('tens column')
      expect(diff.summary).toContain('ones column')
    })
  })

  describe('Multi-Step Operations', () => {
    it('should calculate multi-step diff for 3 + 14 = 17', () => {
      const steps = [
        { expectedValue: 13, instruction: 'Add 10' },
        { expectedValue: 17, instruction: 'Add 4 using complement' }
      ]

      const multiStepDiffs = calculateMultiStepBeadDiffs(3, steps)

      expect(multiStepDiffs).toHaveLength(2)

      // Step 1: 3 → 13 (add 1 earth bead in tens)
      const step1 = multiStepDiffs[0]
      expect(step1.fromValue).toBe(3)
      expect(step1.toValue).toBe(13)
      expect(step1.diff.changes).toHaveLength(1)
      expect(step1.diff.changes[0].placeValue).toBe(1) // tens
      expect(step1.diff.changes[0].beadType).toBe('earth')
      expect(step1.diff.changes[0].direction).toBe('activate')

      // Step 2: 13 → 17 (complement operation in ones)
      const step2 = multiStepDiffs[1]
      expect(step2.fromValue).toBe(13)
      expect(step2.toValue).toBe(17)
      expect(step2.diff.changes.length).toBeGreaterThan(1) // Multiple bead movements
    })
  })

  describe('Edge Cases and Validation', () => {
    it('should return no changes for identical states', () => {
      const diff = calculateBeadDiffFromValues(5, 5)

      expect(diff.hasChanges).toBe(false)
      expect(diff.changes).toHaveLength(0)
      expect(diff.summary).toBe('No changes needed')
    })

    it('should handle large numbers correctly', () => {
      const diff = calculateBeadDiffFromValues(0, 999)

      expect(diff.hasChanges).toBe(true)
      expect(diff.changes.length).toBeGreaterThan(0)

      // Should have changes in hundreds, tens, and ones places
      const places = new Set(diff.changes.map(c => c.placeValue))
      expect(places).toContain(0) // ones
      expect(places).toContain(1) // tens
      expect(places).toContain(2) // hundreds
    })

    it('should validate impossible bead states', () => {
      // Create a diff that would result in more than 4 earth beads
      const fromState = numberToAbacusState(0)
      const toState = numberToAbacusState(0)
      toState[0] = { heavenActive: false, earthActive: 5 } // Invalid: too many earth beads

      const diff = calculateBeadDiff(fromState, toState)
      const validation = validateBeadDiff(diff)

      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors[0]).toContain('Cannot have more than 4 earth beads')
    })

    it('should correctly identify equal states', () => {
      const state1 = numberToAbacusState(42)
      const state2 = numberToAbacusState(42)
      const state3 = numberToAbacusState(43)

      expect(areStatesEqual(state1, state2)).toBe(true)
      expect(areStatesEqual(state1, state3)).toBe(false)
    })
  })

  describe('Pedagogical Ordering', () => {
    it('should process removals before additions', () => {
      // Test a case that requires both removing and adding beads
      const diff = calculateBeadDiffFromValues(7, 2) // 7 → 2: remove heaven, remove 2 earth, add 2 earth

      const removals = diff.changes.filter(c => c.direction === 'deactivate')
      const additions = diff.changes.filter(c => c.direction === 'activate')

      if (removals.length > 0 && additions.length > 0) {
        // All removals should have lower order numbers than additions
        const maxRemovalOrder = Math.max(...removals.map(r => r.order))
        const minAdditionOrder = Math.min(...additions.map(a => a.order))

        expect(maxRemovalOrder).toBeLessThan(minAdditionOrder)
      }
    })

    it('should maintain consistent ordering for animation', () => {
      const diff = calculateBeadDiffFromValues(0, 23) // Complex operation

      // Orders should be consecutive starting from 0
      const orders = diff.changes.map(c => c.order).sort((a, b) => a - b)

      for (let i = 0; i < orders.length; i++) {
        expect(orders[i]).toBe(i)
      }
    })
  })

  describe('Real Tutorial Examples', () => {
    it('should handle the classic "3 + 14 = 17" example', () => {
      console.log('=== Testing 3 + 14 = 17 ===')

      const diff = calculateBeadDiffFromValues(3, 17)

      console.log('Changes:', diff.changes)
      console.log('Summary:', diff.summary)

      expect(diff.hasChanges).toBe(true)
      expect(diff.summary).toBeDefined()

      // Should involve both tens and ones places
      const places = new Set(diff.changes.map(c => c.placeValue))
      expect(places).toContain(0) // ones
      expect(places).toContain(1) // tens
    })

    it('should handle "7 + 4 = 11" ten complement', () => {
      console.log('=== Testing 7 + 4 = 11 ===')

      const diff = calculateBeadDiffFromValues(7, 11)

      console.log('Changes:', diff.changes)
      console.log('Summary:', diff.summary)

      expect(diff.hasChanges).toBe(true)

      // Should involve both tens and ones places
      const places = new Set(diff.changes.map(c => c.placeValue))
      expect(places).toContain(0) // ones
      expect(places).toContain(1) // tens
    })

    it('should handle "99 + 1 = 100" boundary crossing', () => {
      console.log('=== Testing 99 + 1 = 100 ===')

      const diff = calculateBeadDiffFromValues(99, 100)

      console.log('Changes:', diff.changes)
      console.log('Summary:', diff.summary)

      expect(diff.hasChanges).toBe(true)

      // Should involve ones, tens, and hundreds places
      const places = new Set(diff.changes.map(c => c.placeValue))
      expect(places).toContain(0) // ones
      expect(places).toContain(1) // tens
      expect(places).toContain(2) // hundreds
    })
  })
})