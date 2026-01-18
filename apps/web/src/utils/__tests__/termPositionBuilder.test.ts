import { describe, expect, it } from 'vitest'
import { buildFullDecompositionWithPositions } from '../unifiedStepGenerator'

/**
 * Unit tests for the generalized segment-based term position builder.
 * Verifies that complement grouping and position mapping work correctly.
 */
describe('buildFullDecompositionWithPositions', () => {
  it('should correctly group cascading complement terms and map positions', () => {
    const seq = buildFullDecompositionWithPositions(3456, 3500, ['40', '100', '-90', '-6'])

    // Verify the full decomposition string format
    expect(seq.fullDecomposition).toBe('3456 + 44 = 3456 + 40 + (100 - 90 - 6) = 3500')

    // Verify term position mapping
    const [p40, p100, p90, p6] = seq.termPositions

    // Each term should map to the correct substring (exclusive end indices)
    expect(seq.fullDecomposition.slice(p40.startIndex, p40.endIndex)).toBe('40')
    expect(seq.fullDecomposition.slice(p100.startIndex, p100.endIndex)).toBe('100')
    expect(seq.fullDecomposition.slice(p90.startIndex, p90.endIndex)).toBe('90') // Maps to number only, not "-90"
    expect(seq.fullDecomposition.slice(p6.startIndex, p6.endIndex)).toBe('6') // Maps to number only, not "-6"
  })

  it('should handle simple five-complement grouping', () => {
    const seq = buildFullDecompositionWithPositions(4, 7, ['5', '-2'])

    expect(seq.fullDecomposition).toBe('4 + 3 = 4 + (5 - 2) = 7')

    const [p5, p2] = seq.termPositions
    expect(seq.fullDecomposition.slice(p5.startIndex, p5.endIndex)).toBe('5')
    expect(seq.fullDecomposition.slice(p2.startIndex, p2.endIndex)).toBe('2')
  })

  it('should handle ten-complement grouping', () => {
    const seq = buildFullDecompositionWithPositions(7, 15, ['10', '-2'])

    expect(seq.fullDecomposition).toBe('7 + 8 = 7 + (10 - 2) = 15')

    const [p10, p2] = seq.termPositions
    expect(seq.fullDecomposition.slice(p10.startIndex, p10.endIndex)).toBe('10')
    expect(seq.fullDecomposition.slice(p2.startIndex, p2.endIndex)).toBe('2')
  })

  it('should handle mixed segments (single terms + complements)', () => {
    const seq = buildFullDecompositionWithPositions(12, 34, ['20', '5', '-3'])

    expect(seq.fullDecomposition).toBe('12 + 22 = 12 + 20 + (5 - 3) = 34')

    const [p20, p5, p3] = seq.termPositions
    expect(seq.fullDecomposition.slice(p20.startIndex, p20.endIndex)).toBe('20')
    expect(seq.fullDecomposition.slice(p5.startIndex, p5.endIndex)).toBe('5')
    expect(seq.fullDecomposition.slice(p3.startIndex, p3.endIndex)).toBe('3')
  })

  it('should handle standalone negative terms', () => {
    const seq = buildFullDecompositionWithPositions(10, 5, ['-5'])

    // Subtraction is formatted nicely as "10 - 5" in the simplified form
    // and "10 + (-5)" in the expanded form
    expect(seq.fullDecomposition).toBe('10 - 5 = 10 + (-5) = 5')

    const [p5] = seq.termPositions
    expect(seq.fullDecomposition.slice(p5.startIndex, p5.endIndex)).toBe('5') // Maps to number only
  })

  it('should handle zero difference case', () => {
    const seq = buildFullDecompositionWithPositions(5, 5, [])

    expect(seq.fullDecomposition).toBe('5 + 0 = 5')
    expect(seq.termPositions).toEqual([])
  })

  it('should handle complex cascading with multiple negative terms', () => {
    const seq = buildFullDecompositionWithPositions(9999, 10007, [
      '10000',
      '-1000',
      '-100',
      '-10',
      '-1',
    ])

    expect(seq.fullDecomposition).toBe('9999 + 8 = 9999 + (10000 - 1000 - 100 - 10 - 1) = 10007')

    const [p10000, p1000, p100, p10, p1] = seq.termPositions
    expect(seq.fullDecomposition.slice(p10000.startIndex, p10000.endIndex)).toBe('10000')
    expect(seq.fullDecomposition.slice(p1000.startIndex, p1000.endIndex)).toBe('1000')
    expect(seq.fullDecomposition.slice(p100.startIndex, p100.endIndex)).toBe('100')
    expect(seq.fullDecomposition.slice(p10.startIndex, p10.endIndex)).toBe('10')
    expect(seq.fullDecomposition.slice(p1.startIndex, p1.endIndex)).toBe('1')
  })

  it('should handle mixed segments (single term + complement)', () => {
    const seq = buildFullDecompositionWithPositions(3, 17, ['10', '5', '-1'])

    expect(seq.fullDecomposition).toBe('3 + 14 = 3 + 10 + (5 - 1) = 17')

    const [p10, p5, p1] = seq.termPositions
    expect(seq.fullDecomposition.slice(p10.startIndex, p10.endIndex)).toBe('10')
    expect(seq.fullDecomposition.slice(p5.startIndex, p5.endIndex)).toBe('5')
    expect(seq.fullDecomposition.slice(p1.startIndex, p1.endIndex)).toBe('1')
  })
})
