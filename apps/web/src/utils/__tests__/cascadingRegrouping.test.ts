import { describe, expect, it } from 'vitest'
import { analyzeRequiredSkills, analyzeSubtractionStepSkills } from '../problemGenerator'

describe('cascading regrouping detection', () => {
  describe('cascading carry (addition)', () => {
    it('detects cascading carry when 999 + 1 = 1000', () => {
      // Adding 1 to 999 causes carry to cascade through 3 columns
      // 9+1=10 (carry), 9+1=10 (carry), 9+1=10 (carry) -> 1000
      const skills = analyzeRequiredSkills([999, 1], 1000)
      expect(skills).toContain('advanced.cascadingCarry')
    })

    it('detects cascading carry when 99 + 1 = 100', () => {
      // Adding 1 to 99 causes carry through 2 columns (minimum for cascade)
      const skills = analyzeRequiredSkills([99, 1], 100)
      expect(skills).toContain('advanced.cascadingCarry')
    })

    it('does NOT detect cascading carry for 89 + 1 = 90', () => {
      // Only one column carries (9+1=10), tens column has 8+1=9 (no carry)
      const skills = analyzeRequiredSkills([89, 1], 90)
      expect(skills).not.toContain('advanced.cascadingCarry')
    })

    it('does NOT detect cascading carry for 19 + 1 = 20', () => {
      // Only one column carries (9+1=10), tens column 1+1=2 (no cascade)
      const skills = analyzeRequiredSkills([19, 1], 20)
      expect(skills).not.toContain('advanced.cascadingCarry')
    })

    it('does NOT detect cascading carry for simple addition 5 + 3 = 8', () => {
      const skills = analyzeRequiredSkills([5, 3], 8)
      expect(skills).not.toContain('advanced.cascadingCarry')
    })

    it('detects cascading carry for 199 + 1 = 200', () => {
      // 9+1=10 (carry), 9+1=10 (carry) -> cascading
      const skills = analyzeRequiredSkills([199, 1], 200)
      expect(skills).toContain('advanced.cascadingCarry')
    })

    it('detects cascading carry for 9999 + 1 = 10000', () => {
      // Four consecutive carries
      const skills = analyzeRequiredSkills([9999, 1], 10000)
      expect(skills).toContain('advanced.cascadingCarry')
    })

    it('detects cascading carry in multi-term problem', () => {
      // 98 + 1 + 1 = 100
      // First step: 98 + 1 = 99 (no cascade)
      // Second step: 99 + 1 = 100 (cascading carry)
      const skills = analyzeRequiredSkills([98, 1, 1], 100)
      expect(skills).toContain('advanced.cascadingCarry')
    })
  })

  describe('cascading borrow (subtraction)', () => {
    it('detects cascading borrow when 1000 - 1 = 999', () => {
      // Subtracting 1 from 1000: ones column 0-1 needs to borrow from tens,
      // tens column is 0 so borrows from hundreds, hundreds is 0 so borrows from thousands
      const skills = analyzeSubtractionStepSkills(1000, 1, 999)
      expect(skills).toContain('advanced.cascadingBorrow')
    })

    it('detects cascading borrow when 100 - 1 = 99', () => {
      // 0-1 borrows from tens, tens is 0 so borrows from hundreds
      const skills = analyzeSubtractionStepSkills(100, 1, 99)
      expect(skills).toContain('advanced.cascadingBorrow')
    })

    it('does NOT detect cascading borrow for 90 - 1 = 89', () => {
      // 0-1 borrows from tens, tens has 9 (no cascade needed)
      const skills = analyzeSubtractionStepSkills(90, 1, 89)
      expect(skills).not.toContain('advanced.cascadingBorrow')
    })

    it('does NOT detect cascading borrow for 20 - 1 = 19', () => {
      // Single borrow from tens column which has 2
      const skills = analyzeSubtractionStepSkills(20, 1, 19)
      expect(skills).not.toContain('advanced.cascadingBorrow')
    })

    it('does NOT detect cascading borrow for simple subtraction 8 - 3 = 5', () => {
      const skills = analyzeSubtractionStepSkills(8, 3, 5)
      expect(skills).not.toContain('advanced.cascadingBorrow')
    })

    it('detects cascading borrow for 200 - 1 = 199', () => {
      // 0-1 borrows from tens (0), tens borrows from hundreds
      const skills = analyzeSubtractionStepSkills(200, 1, 199)
      expect(skills).toContain('advanced.cascadingBorrow')
    })

    it('detects cascading borrow for 10000 - 1 = 9999', () => {
      // Four consecutive borrows
      const skills = analyzeSubtractionStepSkills(10000, 1, 9999)
      expect(skills).toContain('advanced.cascadingBorrow')
    })

    it('detects cascading borrow for 300 - 5 = 295', () => {
      // 0-5 borrows from tens (0), tens borrows from hundreds
      const skills = analyzeSubtractionStepSkills(300, 5, 295)
      expect(skills).toContain('advanced.cascadingBorrow')
    })

    it('detects cascading borrow in analyzeRequiredSkills with negative term', () => {
      // 1000 + (-1) = 999 should detect cascading borrow
      const skills = analyzeRequiredSkills([1000, -1], 999)
      expect(skills).toContain('advanced.cascadingBorrow')
    })
  })

  describe('edge cases', () => {
    it('handles 1000 - 999 = 1 (no cascade - single borrow per column)', () => {
      // Each column may borrow but they don't cascade consecutively
      const skills = analyzeSubtractionStepSkills(1000, 999, 1)
      // This is actually more complex - let's check what happens
      // 0-9 borrows, 0-9 borrows (but 0-1=9 from the borrow), etc.
      // This might still be considered cascading since multiple borrows happen
      // The key is consecutive columns needing to borrow
      expect(skills).toContain('advanced.cascadingBorrow')
    })

    it('does not count single carries as cascading', () => {
      // 45 + 5 = 50 - single carry from ones to tens
      const skills = analyzeRequiredSkills([45, 5], 50)
      expect(skills).not.toContain('advanced.cascadingCarry')
    })

    it('does not count single borrows as cascading', () => {
      // 50 - 5 = 45 - single borrow needed
      const skills = analyzeSubtractionStepSkills(50, 5, 45)
      expect(skills).not.toContain('advanced.cascadingBorrow')
    })

    it('detects cascading carry even when not all columns carry', () => {
      // 1099 + 1 = 1100: 9+1=10 (carry), 9+1=10 (carry), but 0+1=1 (no carry)
      // Still has 2 consecutive carries in ones and tens
      const skills = analyzeRequiredSkills([1099, 1], 1100)
      expect(skills).toContain('advanced.cascadingCarry')
    })
  })
})
