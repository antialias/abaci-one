import { describe, it, expect } from 'vitest'
import {
  findTopmostBeadWithArrows,
  hasActiveBeadsToLeft,
  calculateTooltipPositioning,
} from '../beadTooltipUtils'

// StepBeadHighlight type from @soroban/abacus-react
interface StepBeadHighlight {
  placeValue: number
  beadType: 'heaven' | 'earth'
  position?: number
  direction?: 'activate' | 'deactivate'
  stepIndex?: number
  order?: number
}

// ============================================================================
// findTopmostBeadWithArrows
// ============================================================================
describe('findTopmostBeadWithArrows', () => {
  it('returns null for undefined input', () => {
    expect(findTopmostBeadWithArrows(undefined)).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(findTopmostBeadWithArrows([])).toBeNull()
  })

  it('returns null when no beads have direction', () => {
    const beads: StepBeadHighlight[] = [{ placeValue: 0, beadType: 'earth', position: 0 }]
    expect(findTopmostBeadWithArrows(beads as any)).toBeNull()
  })

  it('returns the single bead with a direction', () => {
    const beads: StepBeadHighlight[] = [
      {
        placeValue: 0,
        beadType: 'earth',
        position: 0,
        direction: 'activate',
      },
    ]
    const result = findTopmostBeadWithArrows(beads as any)
    expect(result).not.toBeNull()
    expect(result!.placeValue).toBe(0)
    expect(result!.beadType).toBe('earth')
  })

  it('prioritizes higher place value', () => {
    const beads: StepBeadHighlight[] = [
      {
        placeValue: 0,
        beadType: 'earth',
        position: 0,
        direction: 'activate',
      },
      {
        placeValue: 1,
        beadType: 'earth',
        position: 0,
        direction: 'activate',
      },
    ]
    const result = findTopmostBeadWithArrows(beads as any)
    expect(result!.placeValue).toBe(1)
  })

  it('prioritizes heaven beads over earth beads at same place value', () => {
    const beads: StepBeadHighlight[] = [
      {
        placeValue: 0,
        beadType: 'earth',
        position: 0,
        direction: 'activate',
      },
      {
        placeValue: 0,
        beadType: 'heaven',
        direction: 'deactivate',
      },
    ]
    const result = findTopmostBeadWithArrows(beads as any)
    expect(result!.beadType).toBe('heaven')
  })

  it('prioritizes lower position for earth beads at same place value', () => {
    const beads: StepBeadHighlight[] = [
      {
        placeValue: 0,
        beadType: 'earth',
        position: 3,
        direction: 'activate',
      },
      {
        placeValue: 0,
        beadType: 'earth',
        position: 1,
        direction: 'activate',
      },
    ]
    const result = findTopmostBeadWithArrows(beads as any)
    expect(result!.position).toBe(1)
  })

  it('filters out beads without direction before sorting', () => {
    const beads: StepBeadHighlight[] = [
      {
        placeValue: 2,
        beadType: 'heaven',
        // No direction - should be filtered out
      },
      {
        placeValue: 0,
        beadType: 'earth',
        position: 0,
        direction: 'activate',
      },
    ]
    const result = findTopmostBeadWithArrows(beads as any)
    expect(result!.placeValue).toBe(0) // Only the one with direction
  })
})

// ============================================================================
// hasActiveBeadsToLeft
// ============================================================================
describe('hasActiveBeadsToLeft', () => {
  it('returns false when target is the leftmost column (col 0)', () => {
    expect(hasActiveBeadsToLeft(0, undefined, 4, 0)).toBe(false)
  })

  it('returns false when current value is 0 (no active beads)', () => {
    expect(hasActiveBeadsToLeft(0, undefined, 4, 2)).toBe(false)
  })

  it('returns true when earth beads are active to the left', () => {
    // Value 30 on 4-column abacus: digits = [0, 0, 3, 0]
    // Column 2 has 3 earth beads active, checking column 3
    expect(hasActiveBeadsToLeft(30, undefined, 4, 3)).toBe(true)
  })

  it('returns true when heaven bead is active to the left', () => {
    // Value 500 on 4-column abacus: digits = [0, 5, 0, 0]
    // Column 1 has heaven bead active (digit=5)
    expect(hasActiveBeadsToLeft(500, undefined, 4, 2)).toBe(true)
  })

  it('returns true when step bead highlights have arrows in a left column', () => {
    // Value is 0, but step highlights have a bead with direction in column 0
    const beads: StepBeadHighlight[] = [
      {
        placeValue: 3, // column index = 4-1-3 = 0
        beadType: 'earth',
        position: 0,
        direction: 'activate',
      },
    ]
    // Target column is 2, checking columns 0 and 1
    expect(hasActiveBeadsToLeft(0, beads as any, 4, 2)).toBe(true)
  })

  it('returns false when active beads are to the right', () => {
    // Value 3 on 4-column abacus: digits = [0, 0, 0, 3]
    // Column 3 has earth beads active, but we're checking left of column 2
    expect(hasActiveBeadsToLeft(3, undefined, 4, 2)).toBe(false)
  })

  it('detects earth beads with value mod 5 > 0', () => {
    // Value 7 on 4-column abacus: digits = [0, 0, 0, 7]
    // Column 3: digit=7, 7>=5 means heaven is active
    // But checking left of column 3 -- no beads to left
    expect(hasActiveBeadsToLeft(7, undefined, 4, 3)).toBe(false)
    // Now check left of col 3 with value 70
    // digits = [0, 0, 7, 0], col 2: digit=7, >=5
    expect(hasActiveBeadsToLeft(70, undefined, 4, 3)).toBe(true)
  })
})

// ============================================================================
// calculateTooltipPositioning
// ============================================================================
describe('calculateTooltipPositioning', () => {
  it('returns null when no beads with arrows', () => {
    expect(calculateTooltipPositioning(0, undefined, 4)).toBeNull()
    expect(calculateTooltipPositioning(0, [], 4)).toBeNull()
  })

  it('returns "left" positioning when no active beads to the left', () => {
    // Value 0, bead in the rightmost column (placeValue 0)
    const beads: StepBeadHighlight[] = [
      {
        placeValue: 0,
        beadType: 'earth',
        position: 0,
        direction: 'activate',
      },
    ]
    const result = calculateTooltipPositioning(0, beads as any, 4)
    expect(result).not.toBeNull()
    expect(result!.side).toBe('left')
    expect(result!.target.beadType).toBe('earth')
    expect(result!.target.beadPosition).toBe(0)
  })

  it('returns "top" positioning when there are active beads to the left', () => {
    // Value 100, bead in the rightmost column (placeValue 0)
    // digits = [0, 1, 0, 0] -- column 1 has active earth beads
    // target column for placeValue 0 is column 3
    // columns to the left: 0, 1, 2
    // column 1 has digit 1 -> earth beads active
    const beads: StepBeadHighlight[] = [
      {
        placeValue: 0,
        beadType: 'earth',
        position: 0,
        direction: 'activate',
      },
    ]
    const result = calculateTooltipPositioning(100, beads as any, 4)
    expect(result).not.toBeNull()
    expect(result!.side).toBe('top')
    // When positioned above, target should be the heaven bead
    expect(result!.target.beadType).toBe('heaven')
    expect(result!.target.beadPosition).toBe(0)
  })

  it('calculates correct column index from place value', () => {
    // placeValue 1, abacusColumns 4 => columnIndex = 4-1-1 = 2
    const beads: StepBeadHighlight[] = [
      {
        placeValue: 1,
        beadType: 'earth',
        position: 0,
        direction: 'activate',
      },
    ]
    const result = calculateTooltipPositioning(0, beads as any, 4)
    expect(result!.targetColumnIndex).toBe(2)
  })

  it('returns the topmost bead in the result', () => {
    const beads: StepBeadHighlight[] = [
      {
        placeValue: 0,
        beadType: 'earth',
        position: 2,
        direction: 'activate',
      },
      {
        placeValue: 1,
        beadType: 'heaven',
        direction: 'deactivate',
      },
    ]
    const result = calculateTooltipPositioning(0, beads as any, 4)
    expect(result!.topmostBead.placeValue).toBe(1)
    expect(result!.topmostBead.beadType).toBe('heaven')
  })
})
