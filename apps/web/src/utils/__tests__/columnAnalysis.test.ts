import { describe, expect, it } from 'vitest'
import { analyzeColumnAddition, analyzeColumnSubtraction } from '../problemGenerator'

// Helper to simplify calls - the function takes (currentDigit, termDigit, resultDigit, column)
// For these unit tests, resultDigit and column are not used in the logic we're testing
const testAddition = (currentDigit: number, termDigit: number) => {
  const resultDigit = (currentDigit + termDigit) % 10
  return analyzeColumnAddition(currentDigit, termDigit, resultDigit, 0)
}

describe('analyzeColumnAddition', () => {
  describe('five complement detection', () => {
    it('detects five complement when heaven bead NOT active and result crosses 5', () => {
      // 3 + 4 = 7: heaven bead not active (3 < 5), result needs heaven bead
      // Correct technique: +5, -1 (five complement)
      const skills = testAddition(3, 4)
      expect(skills).toContain('fiveComplements.4=5-1')
    })

    it('detects five complement when adding 3 to 4', () => {
      // 4 + 3 = 7: heaven bead not active (4 < 5), result needs heaven bead
      // Correct technique: +5, -2 (five complement)
      const skills = testAddition(4, 3)
      expect(skills).toContain('fiveComplements.3=5-2')
    })

    it('does NOT detect five complement when heaven bead already active', () => {
      // This is the bug fix: 52 + 37 ones column = 2 + 7 = 9
      // But when adding term 37 to running sum 52, the ones column sees:
      // currentDigit = 2 (from 52), termDigit = 7
      // Result = 9, which is > 5 but heaven bead is NOT active yet
      // So this SHOULD use five complement

      // The ACTUAL buggy case was: currentDigit >= 5 (heaven bead active)
      // When adding 1-4 results in 6-9, should NOT use five complement
      // Example: 7 + 2 = 9
      // currentDigit = 7 (heaven bead active), termDigit = 2
      // Just add 2 earth beads directly - no five complement needed
      const skills = testAddition(7, 2)
      expect(skills).not.toContain('fiveComplements.2=5-3')
      expect(skills).toContain('basic.heavenBead')
      expect(skills).toContain('basic.simpleCombinations')
    })

    it('does NOT detect five complement when 5 + 3 = 8', () => {
      // 5 + 3 = 8: heaven bead already active (5 >= 5)
      // Just add 3 earth beads - no five complement needed
      const skills = testAddition(5, 3)
      expect(skills).not.toContain('fiveComplements.3=5-2')
      expect(skills).toContain('basic.heavenBead')
      expect(skills).toContain('basic.simpleCombinations')
    })

    it('does NOT detect five complement when 6 + 3 = 9', () => {
      // 6 + 3 = 9: heaven bead already active (6 >= 5)
      // Just add 3 earth beads - no five complement needed
      const skills = testAddition(6, 3)
      expect(skills).not.toContain('fiveComplements.3=5-2')
      expect(skills).toContain('basic.heavenBead')
      expect(skills).toContain('basic.simpleCombinations')
    })

    it('does NOT detect five complement when 8 + 1 = 9', () => {
      // 8 + 1 = 9: heaven bead already active (8 >= 5)
      // Just add 1 earth bead - no five complement needed
      const skills = testAddition(8, 1)
      expect(skills).not.toContain('fiveComplements.1=5-4')
      expect(skills).toContain('basic.heavenBead')
      expect(skills).toContain('basic.simpleCombinations')
    })
  })

  describe('direct addition (1-4 earth beads)', () => {
    it('detects direct addition when adding 1-4 and staying under 5', () => {
      // 1 + 2 = 3: just add earth beads
      const skills = testAddition(1, 2)
      expect(skills).toContain('basic.directAddition')
    })

    it('detects direct addition when adding to 0', () => {
      // 0 + 4 = 4: just add earth beads
      const skills = testAddition(0, 4)
      expect(skills).toContain('basic.directAddition')
    })
  })

  describe('heaven bead addition (5)', () => {
    it('detects heaven bead when adding exactly 5', () => {
      // 0 + 5 = 5: activate heaven bead
      const skills = testAddition(0, 5)
      expect(skills).toContain('basic.heavenBead')
    })

    it('detects heaven bead + simple combinations for 6-9', () => {
      // 0 + 7 = 7: activate heaven bead + 2 earth beads
      const skills = testAddition(0, 7)
      expect(skills).toContain('basic.heavenBead')
      expect(skills).toContain('basic.simpleCombinations')
    })
  })
})

describe('analyzeColumnSubtraction', () => {
  describe('five complement in ten complement subtraction', () => {
    it('does NOT detect five complement when heaven bead already active during ten complement', () => {
      // Subtracting when currentDigit >= 5 and adding ten complement crosses 5 boundary
      // Example: currentDigit = 7, termDigit = 9, needs borrow
      // Ten complement: -9 = +1 - 10
      // 7 + 1 = 8 (crosses 5 boundary but heaven bead already active)
      // Should NOT push five complement for the +1 part
      const skills = analyzeColumnSubtraction(7, 9, true)
      expect(skills).toContain('tenComplementsSub.-9=+1-10')
      expect(skills).not.toContain('fiveComplements.1=5-4')
    })

    it('does NOT detect five complement when 6 + 3 during ten complement', () => {
      // currentDigit = 6, termDigit = 7, needs borrow
      // Ten complement: -7 = +3 - 10
      // 6 + 3 = 9 (crosses 5 boundary but heaven bead already active at 6)
      const skills = analyzeColumnSubtraction(6, 7, true)
      expect(skills).toContain('tenComplementsSub.-7=+3-10')
      expect(skills).not.toContain('fiveComplements.3=5-2')
    })

    it('DOES detect five complement when heaven bead NOT active during ten complement', () => {
      // currentDigit = 3, termDigit = 7, needs borrow
      // Ten complement: -7 = +3 - 10
      // 3 + 3 = 6 (crosses 5 boundary and heaven bead NOT active)
      // SHOULD push five complement for the +3 part
      const skills = analyzeColumnSubtraction(3, 7, true)
      expect(skills).toContain('tenComplementsSub.-7=+3-10')
      expect(skills).toContain('fiveComplements.3=5-2')
    })

    it('DOES detect five complement when 4 + 2 during ten complement', () => {
      // currentDigit = 4, termDigit = 8, needs borrow
      // Ten complement: -8 = +2 - 10
      // 4 + 2 = 6 (crosses 5 boundary and heaven bead NOT active at 4)
      const skills = analyzeColumnSubtraction(4, 8, true)
      expect(skills).toContain('tenComplementsSub.-8=+2-10')
      expect(skills).toContain('fiveComplements.2=5-3')
    })
  })

  describe('direct subtraction', () => {
    it('detects direct subtraction when enough earth beads available', () => {
      // 7 - 2 = 5: have 2 earth beads (7 % 5 = 2), can subtract 2 directly
      const skills = analyzeColumnSubtraction(7, 2, false)
      expect(skills).toContain('basic.directSubtraction')
    })

    it('detects five complement subtraction when not enough earth beads', () => {
      // 6 - 3 = 3: have 1 earth bead (6 % 5 = 1), need 3
      // Use five complement: -3 = -5 + 2
      const skills = analyzeColumnSubtraction(6, 3, false)
      expect(skills).toContain('fiveComplementsSub.-3=-5+2')
      expect(skills).toContain('basic.heavenBeadSubtraction')
    })
  })

  describe('heaven bead subtraction', () => {
    it('detects heaven bead subtraction when subtracting exactly 5', () => {
      // 7 - 5 = 2: just remove heaven bead
      const skills = analyzeColumnSubtraction(7, 5, false)
      expect(skills).toContain('basic.heavenBeadSubtraction')
    })

    it('detects combination subtraction for 6-9', () => {
      // 9 - 7 = 2: remove heaven bead and 2 earth beads
      const skills = analyzeColumnSubtraction(9, 7, false)
      expect(skills).toContain('basic.heavenBeadSubtraction')
      expect(skills).toContain('basic.simpleCombinationsSub')
    })
  })
})

describe('real-world problem: 52 + 37 = 89', () => {
  it('ones column (2 + 7 = 9) should use heaven bead pattern, NOT five complement', () => {
    // This is the exact bug scenario from the user report
    // Running sum = 52, adding term = 37
    // Ones column: currentDigit = 2, termDigit = 7
    // 2 + 7 = 9, no carry needed
    // Result is 9, heaven bead NOT active initially (2 < 5)
    // Need to activate heaven bead and add 4 earth beads

    // The bug was in detecting fiveComplements.3=5-2 incorrectly
    // Let's verify the correct behavior:
    const skills = testAddition(2, 7)

    // Result 9 requires heaven bead + 4 earth beads
    // Adding 7 is in the 6-9 range, so it uses heaven bead + earth beads pattern
    expect(skills).toContain('basic.heavenBead')
    expect(skills).toContain('basic.simpleCombinations')

    // Should NOT incorrectly detect five complement
    // Adding 7 doesn't use five complement - it's direct heaven bead + earth beads
    expect(skills).not.toContain('fiveComplements.3=5-2')
  })

  it('tens column (5 + 3 = 8) should NOT use five complement since heaven bead active', () => {
    // Running sum = 52, adding term = 37
    // Tens column: currentDigit = 5, termDigit = 3
    // 5 + 3 = 8, heaven bead already active (5 >= 5)
    // Just add 3 earth beads - no five complement needed
    const skills = testAddition(5, 3)

    expect(skills).toContain('basic.heavenBead')
    expect(skills).toContain('basic.simpleCombinations')

    // Should NOT detect five complement since heaven bead is already active
    expect(skills).not.toContain('fiveComplements.3=5-2')
  })
})
