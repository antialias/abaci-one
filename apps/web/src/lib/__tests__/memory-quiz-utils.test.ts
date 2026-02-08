import { describe, it, expect } from 'vitest'
import {
  isPrefix,
  couldBePrefix,
  isCompleteWrongNumber,
  shouldTriggerIncorrectGuess,
  isCorrectAndAvailable,
} from '../memory-quiz-utils'

// =============================================================================
// isPrefix
// =============================================================================
describe('isPrefix', () => {
  it('returns true when input is a prefix of an unfound target', () => {
    expect(isPrefix('1', [12, 34], [])).toBe(true)
  })

  it('returns false when input matches a target exactly (not a strict prefix)', () => {
    expect(isPrefix('12', [12, 34], [])).toBe(false)
  })

  it('returns false when the matching target is already found', () => {
    expect(isPrefix('1', [12, 34], [12])).toBe(false)
  })

  it('returns false when input is not a prefix of any target', () => {
    expect(isPrefix('9', [12, 34], [])).toBe(false)
  })

  it('returns false for empty target list', () => {
    expect(isPrefix('1', [], [])).toBe(false)
  })

  it('returns false for empty input', () => {
    // Empty string is a prefix of everything, but '' !== target.toString()
    // so it should return true for any unfound target
    expect(isPrefix('', [5], [])).toBe(true)
  })

  it('handles multi-digit targets with single-digit prefix', () => {
    expect(isPrefix('2', [25, 200, 3], [])).toBe(true)
  })

  it('handles multi-digit prefix', () => {
    expect(isPrefix('12', [123, 456], [])).toBe(true)
  })

  it('returns true when only some targets match and the matching ones are not found', () => {
    expect(isPrefix('1', [12, 15, 34], [12])).toBe(true) // 15 still unfound
  })

  it('returns false when all prefix-matching targets are already found', () => {
    expect(isPrefix('1', [12, 15, 34], [12, 15])).toBe(false)
  })
})

// =============================================================================
// couldBePrefix
// =============================================================================
describe('couldBePrefix', () => {
  it('returns true when input is a prefix of a target', () => {
    expect(couldBePrefix('1', [12, 34])).toBe(true)
  })

  it('returns true when input exactly matches a target (exact match is a prefix)', () => {
    expect(couldBePrefix('12', [12, 34])).toBe(true)
  })

  it('returns false when input is not a prefix of any target', () => {
    expect(couldBePrefix('9', [12, 34])).toBe(false)
  })

  it('returns false for empty target list', () => {
    expect(couldBePrefix('1', [])).toBe(false)
  })

  it('returns true for empty input (prefix of everything)', () => {
    expect(couldBePrefix('', [5])).toBe(true)
  })

  it('handles multi-digit targets', () => {
    expect(couldBePrefix('12', [123, 456])).toBe(true)
    expect(couldBePrefix('45', [123, 456])).toBe(true)
    expect(couldBePrefix('78', [123, 456])).toBe(false)
  })

  it('does not consider found numbers -- checks all targets', () => {
    // couldBePrefix does NOT filter by foundNumbers
    expect(couldBePrefix('1', [12])).toBe(true)
  })
})

// =============================================================================
// isCompleteWrongNumber
// =============================================================================
describe('isCompleteWrongNumber', () => {
  it('returns true when number is not a target and cannot be a prefix', () => {
    expect(isCompleteWrongNumber('99', [12, 34], 2)).toBe(true)
  })

  it('returns false when number is a target', () => {
    expect(isCompleteWrongNumber('12', [12, 34], 2)).toBe(false)
  })

  it('returns false when input could be a prefix of a target', () => {
    expect(isCompleteWrongNumber('1', [12, 34], 2)).toBe(false)
  })

  it('returns false for NaN input', () => {
    expect(isCompleteWrongNumber('abc', [12, 34], 2)).toBe(false)
  })

  it('returns false for empty string', () => {
    // Empty string parsed as NaN
    expect(isCompleteWrongNumber('', [12, 34], 2)).toBe(false)
  })

  it('handles single-digit wrong number that cannot be prefix', () => {
    // 9 is not in [12, 34] and '9' is not a prefix of '12' or '34'
    expect(isCompleteWrongNumber('9', [12, 34], 1)).toBe(true)
  })

  it('handles single-digit input that IS a prefix of a target', () => {
    // '3' is a prefix of '34', so it's not a complete wrong number
    expect(isCompleteWrongNumber('3', [12, 34], 1)).toBe(false)
  })

  it('returns true for a number longer than any target', () => {
    expect(isCompleteWrongNumber('999', [12, 34], 2)).toBe(true)
  })
})

// =============================================================================
// shouldTriggerIncorrectGuess
// =============================================================================
describe('shouldTriggerIncorrectGuess', () => {
  it('returns true for a clearly wrong number with no prefix match', () => {
    expect(shouldTriggerIncorrectGuess('99', [12, 34], [], true)).toBe(true)
  })

  it('returns false when no guesses remaining', () => {
    expect(shouldTriggerIncorrectGuess('99', [12, 34], [], false)).toBe(false)
  })

  it('returns false when input is a correct target number', () => {
    expect(shouldTriggerIncorrectGuess('12', [12, 34], [], true)).toBe(false)
  })

  it('returns false when input is a correct target already found (still correct)', () => {
    // The function checks targetNumbers.includes, not whether it is found
    expect(shouldTriggerIncorrectGuess('12', [12, 34], [12], true)).toBe(false)
  })

  it('returns false when input could be a prefix of a target', () => {
    expect(shouldTriggerIncorrectGuess('1', [12, 34], [], true)).toBe(false)
  })

  it('returns false for NaN input', () => {
    expect(shouldTriggerIncorrectGuess('abc', [12, 34], [], true)).toBe(false)
  })

  it('returns false for empty input', () => {
    expect(shouldTriggerIncorrectGuess('', [12, 34], [], true)).toBe(false)
  })

  it('defaults hasGuessesRemaining to true', () => {
    expect(shouldTriggerIncorrectGuess('99', [12, 34], [])).toBe(true)
  })

  it('handles edge case where input is a longer wrong number', () => {
    expect(shouldTriggerIncorrectGuess('999', [12, 34], [], true)).toBe(true)
  })
})

// =============================================================================
// isCorrectAndAvailable
// =============================================================================
describe('isCorrectAndAvailable', () => {
  it('returns true when number is in targets and not yet found', () => {
    expect(isCorrectAndAvailable(12, [12, 34], [])).toBe(true)
  })

  it('returns false when number is in targets but already found', () => {
    expect(isCorrectAndAvailable(12, [12, 34], [12])).toBe(false)
  })

  it('returns false when number is not in targets', () => {
    expect(isCorrectAndAvailable(99, [12, 34], [])).toBe(false)
  })

  it('returns false when number is not in targets even if in found', () => {
    expect(isCorrectAndAvailable(99, [12, 34], [99])).toBe(false)
  })

  it('handles empty target list', () => {
    expect(isCorrectAndAvailable(1, [], [])).toBe(false)
  })

  it('handles multiple occurrences: still correct if at least one is unfound', () => {
    // Note: includes() only checks existence, not count.
    // If 12 is found once but appears once in targets, it's found.
    expect(isCorrectAndAvailable(12, [12], [12])).toBe(false)
  })
})
