import { describe, it, expect } from 'vitest'
import {
  normalizeAngleDelta,
  rotateCCW,
  rotateCW,
  rotate180,
} from '../MemoryGrid'

describe('normalizeAngleDelta', () => {
  it('detects CW 90° rotation (0 → 90)', () => {
    expect(normalizeAngleDelta(0, 90)).toBe(90)
  })

  it('detects CCW 90° rotation (90 → 0)', () => {
    expect(normalizeAngleDelta(90, 0)).toBe(-90)
  })

  it('detects CW 90° rotation (270 → 0, wrapping)', () => {
    expect(normalizeAngleDelta(270, 0)).toBe(90)
  })

  it('detects CCW 90° rotation (0 → 270, wrapping)', () => {
    expect(normalizeAngleDelta(0, 270)).toBe(-90)
  })

  it('detects 180° rotation (0 → 180)', () => {
    expect(normalizeAngleDelta(0, 180)).toBe(180)
  })

  it('detects 180° rotation (90 → 270)', () => {
    expect(normalizeAngleDelta(90, 270)).toBe(180)
  })

  it('detects CW 90° rotation (180 → 270)', () => {
    expect(normalizeAngleDelta(180, 270)).toBe(90)
  })

  it('detects CCW 90° rotation (270 → 180)', () => {
    expect(normalizeAngleDelta(270, 180)).toBe(-90)
  })
})

describe('rotateCCW', () => {
  it('rotates a 5×3 landscape grid to 3×5 portrait (the plan example)', () => {
    // Landscape 5 cols × 3 rows:
    // A B C D E
    // F G H I J
    // K L M N O
    const items = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O']
    const result = rotateCCW(items, 5, 3)

    // Expected portrait 3 cols × 5 rows:
    // E J O
    // D I N
    // C H M
    // B G L
    // A F K
    expect(result).toEqual(['E','J','O','D','I','N','C','H','M','B','G','L','A','F','K'])
  })

  it('rotates a 2×2 grid CCW', () => {
    // 1 2
    // 3 4
    const result = rotateCCW([1, 2, 3, 4], 2, 2)
    // Expected:
    // 2 4
    // 1 3
    expect(result).toEqual([2, 4, 1, 3])
  })

  it('rotates a 3×2 grid to a 2×3 grid', () => {
    // 1 2 3
    // 4 5 6
    const result = rotateCCW([1, 2, 3, 4, 5, 6], 3, 2)
    // Expected 2 cols × 3 rows:
    // 3 6
    // 2 5
    // 1 4
    expect(result).toEqual([3, 6, 2, 5, 1, 4])
  })

  it('handles single-row grid (4×1 → 1×4)', () => {
    const result = rotateCCW([1, 2, 3, 4], 4, 1)
    // Expected 1 col × 4 rows:
    // 4
    // 3
    // 2
    // 1
    expect(result).toEqual([4, 3, 2, 1])
  })

  it('handles grid with null spacers', () => {
    // 3×2 grid with one null spacer
    // A  B  C
    // D  E  null
    const result = rotateCCW(['A', 'B', 'C', 'D', 'E', null], 3, 2)
    // Expected 2 cols × 3 rows:
    // C    null
    // B    E
    // A    D
    expect(result).toEqual(['C', null, 'B', 'E', 'A', 'D'])
  })
})

describe('rotateCW', () => {
  it('rotates a 3×5 portrait grid to 5×3 landscape (reverses CCW)', () => {
    // Portrait 3 cols × 5 rows:
    // E J O
    // D I N
    // C H M
    // B G L
    // A F K
    const portrait = ['E','J','O','D','I','N','C','H','M','B','G','L','A','F','K']
    const result = rotateCW(portrait, 3, 5)

    // Expected landscape 5 cols × 3 rows (original):
    // A B C D E
    // F G H I J
    // K L M N O
    expect(result).toEqual(['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'])
  })

  it('rotates a 2×2 grid CW', () => {
    // 1 2
    // 3 4
    const result = rotateCW([1, 2, 3, 4], 2, 2)
    // Expected:
    // 3 1
    // 4 2
    expect(result).toEqual([3, 1, 4, 2])
  })

  it('is the inverse of rotateCCW for any grid', () => {
    const original = [1, 2, 3, 4, 5, 6]
    const cols = 3
    const rows = 2
    const rotated = rotateCCW(original, cols, rows)
    // After CCW: new grid is 2 cols × 3 rows
    const restored = rotateCW(rotated, rows, cols)
    expect(restored).toEqual(original)
  })
})

describe('rotate180', () => {
  it('reverses the array', () => {
    expect(rotate180([1, 2, 3, 4])).toEqual([4, 3, 2, 1])
  })

  it('is its own inverse', () => {
    const items = ['A', 'B', 'C', 'D', 'E', 'F']
    expect(rotate180(rotate180(items))).toEqual(items)
  })

  it('preserves null spacers in correct positions', () => {
    expect(rotate180(['A', 'B', null, 'C'])).toEqual(['C', null, 'B', 'A'])
  })
})

describe('rotation round-trips', () => {
  it('four CCW rotations return to original', () => {
    const original = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O']
    let items = original
    let cols = 5
    let rows = 3
    for (let i = 0; i < 4; i++) {
      items = rotateCCW(items, cols, rows)
      const newCols = rows
      rows = cols
      cols = newCols
    }
    expect(items).toEqual(original)
  })

  it('four CW rotations return to original', () => {
    const original = [1, 2, 3, 4, 5, 6]
    let items = original
    let cols = 3
    let rows = 2
    for (let i = 0; i < 4; i++) {
      items = rotateCW(items, cols, rows)
      const newCols = rows
      rows = cols
      cols = newCols
    }
    expect(items).toEqual(original)
  })

  it('CCW then CW returns to original (rectangular)', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    const cols = 4
    const rows = 3
    const rotated = rotateCCW(original, cols, rows)
    const restored = rotateCW(rotated, rows, cols)
    expect(restored).toEqual(original)
  })

  it('two 180° rotations return to original', () => {
    const original = [1, 2, 3, 4, 5]
    expect(rotate180(rotate180(original))).toEqual(original)
  })

  it('two CCW rotations equal one 180°', () => {
    const original = ['A','B','C','D','E','F']
    const cols = 3
    const rows = 2
    const onceCCW = rotateCCW(original, cols, rows)
    // After first CCW: 2 cols × 3 rows
    const twiceCCW = rotateCCW(onceCCW, rows, cols)
    // Two 90° CCW rotations on a rectangle get back to original dimensions (3×2)
    // but with reversed order — equivalent to rotate180
    expect(twiceCCW).toEqual(rotate180(original))
  })
})
