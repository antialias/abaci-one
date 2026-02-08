import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateMultiStepBeadDiffs, validateBeadDiff } from '../beadDiff'
import { calculateBeadDiffFromValues } from '@soroban/abacus-react'

// The global mock for @soroban/abacus-react provides vi.fn() stubs.
// We configure them per test.

const mockCalculateBeadDiffFromValues = vi.mocked(calculateBeadDiffFromValues)

describe('calculateMultiStepBeadDiffs', () => {
  beforeEach(() => {
    mockCalculateBeadDiffFromValues.mockReset()
  })

  it('returns empty array for empty steps', () => {
    const result = calculateMultiStepBeadDiffs(0, [])
    expect(result).toEqual([])
    expect(mockCalculateBeadDiffFromValues).not.toHaveBeenCalled()
  })

  it('calculates diff for a single step', () => {
    const mockDiff = {
      changes: [
        {
          placeValue: 0,
          beadType: 'earth' as const,
          position: 0,
          direction: 'activate' as const,
          order: 0,
        },
      ],
    }
    mockCalculateBeadDiffFromValues.mockReturnValue(mockDiff as any)

    const result = calculateMultiStepBeadDiffs(0, [
      { expectedValue: 1, instruction: 'Add 1' },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].stepIndex).toBe(0)
    expect(result[0].instruction).toBe('Add 1')
    expect(result[0].fromValue).toBe(0)
    expect(result[0].toValue).toBe(1)
    expect(result[0].diff).toBe(mockDiff)
    expect(mockCalculateBeadDiffFromValues).toHaveBeenCalledWith(0, 1)
  })

  it('chains values between steps', () => {
    mockCalculateBeadDiffFromValues.mockReturnValue({ changes: [] } as any)

    const result = calculateMultiStepBeadDiffs(0, [
      { expectedValue: 5, instruction: 'Add 5' },
      { expectedValue: 8, instruction: 'Add 3' },
      { expectedValue: 10, instruction: 'Add 2' },
    ])

    expect(result).toHaveLength(3)
    expect(result[0].fromValue).toBe(0)
    expect(result[0].toValue).toBe(5)
    expect(result[1].fromValue).toBe(5)
    expect(result[1].toValue).toBe(8)
    expect(result[2].fromValue).toBe(8)
    expect(result[2].toValue).toBe(10)

    expect(mockCalculateBeadDiffFromValues).toHaveBeenCalledWith(0, 5)
    expect(mockCalculateBeadDiffFromValues).toHaveBeenCalledWith(5, 8)
    expect(mockCalculateBeadDiffFromValues).toHaveBeenCalledWith(8, 10)
  })

  it('assigns sequential step indices', () => {
    mockCalculateBeadDiffFromValues.mockReturnValue({ changes: [] } as any)

    const result = calculateMultiStepBeadDiffs(0, [
      { expectedValue: 1, instruction: 'Step 1' },
      { expectedValue: 2, instruction: 'Step 2' },
    ])

    expect(result[0].stepIndex).toBe(0)
    expect(result[1].stepIndex).toBe(1)
  })
})

describe('validateBeadDiff', () => {
  it('returns valid for empty changes', () => {
    const diff = { changes: [] }
    const result = validateBeadDiff(diff as any)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns valid for a simple earth bead activation', () => {
    const diff = {
      changes: [
        {
          placeValue: 0,
          beadType: 'earth',
          position: 0,
          direction: 'activate',
          order: 0,
        },
      ],
    }
    const result = validateBeadDiff(diff as any)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns valid for heaven bead changes (not checked for earth-specific limits)', () => {
    const diff = {
      changes: [
        {
          placeValue: 0,
          beadType: 'heaven',
          direction: 'activate',
          order: 0,
        },
      ],
    }
    const result = validateBeadDiff(diff as any)
    expect(result.isValid).toBe(true)
  })

  it('returns error when net earth beads exceed 4', () => {
    // 5 earth activations in the same place value
    const diff = {
      changes: [
        { placeValue: 0, beadType: 'earth', position: 0, direction: 'activate', order: 0 },
        { placeValue: 0, beadType: 'earth', position: 1, direction: 'activate', order: 1 },
        { placeValue: 0, beadType: 'earth', position: 2, direction: 'activate', order: 2 },
        { placeValue: 0, beadType: 'earth', position: 3, direction: 'activate', order: 3 },
        { placeValue: 0, beadType: 'earth', position: 4, direction: 'activate', order: 4 },
      ],
    }
    const result = validateBeadDiff(diff as any)
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('Cannot have more than 4 earth beads')
  })

  it('returns error when net earth beads are negative', () => {
    // 1 deactivation without prior activation in the validation context
    const diff = {
      changes: [
        { placeValue: 0, beadType: 'earth', position: 0, direction: 'deactivate', order: 0 },
      ],
    }
    const result = validateBeadDiff(diff as any)
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toContain('Cannot have negative earth beads')
  })

  it('validates across multiple place values independently', () => {
    const diff = {
      changes: [
        // Place 0: 1 activation (ok)
        { placeValue: 0, beadType: 'earth', position: 0, direction: 'activate', order: 0 },
        // Place 1: 5 activations (error)
        { placeValue: 1, beadType: 'earth', position: 0, direction: 'activate', order: 1 },
        { placeValue: 1, beadType: 'earth', position: 1, direction: 'activate', order: 2 },
        { placeValue: 1, beadType: 'earth', position: 2, direction: 'activate', order: 3 },
        { placeValue: 1, beadType: 'earth', position: 3, direction: 'activate', order: 4 },
        { placeValue: 1, beadType: 'earth', position: 4, direction: 'activate', order: 5 },
      ],
    }
    const result = validateBeadDiff(diff as any)
    expect(result.isValid).toBe(false)
    // Only place 1 should have an error
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Place 1')
  })

  it('net calculation: activations - deactivations within limit is valid', () => {
    const diff = {
      changes: [
        { placeValue: 0, beadType: 'earth', position: 0, direction: 'activate', order: 0 },
        { placeValue: 0, beadType: 'earth', position: 1, direction: 'activate', order: 1 },
        { placeValue: 0, beadType: 'earth', position: 2, direction: 'activate', order: 2 },
        { placeValue: 0, beadType: 'earth', position: 3, direction: 'activate', order: 3 },
        { placeValue: 0, beadType: 'earth', position: 0, direction: 'deactivate', order: 4 },
      ],
    }
    // Net = 4 - 1 = 3, which is <= 4
    const result = validateBeadDiff(diff as any)
    expect(result.isValid).toBe(true)
  })
})
