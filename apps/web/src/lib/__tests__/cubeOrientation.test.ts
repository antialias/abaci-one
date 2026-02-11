import { describe, it, expect } from 'vitest'
import {
  orientationForFace,
  tipUp,
  tipDown,
  tipLeft,
  tipRight,
  applyTip,
  isValidOrientation,
  type CubeOrientation,
  type TipDirection,
} from '../cubeOrientation'

describe('cubeOrientation', () => {
  describe('orientationForFace', () => {
    it('returns a valid orientation for each face 1-6', () => {
      for (let face = 1; face <= 6; face++) {
        const o = orientationForFace(face)
        expect(o.front).toBe(face)
        expect(isValidOrientation(o)).toBe(true)
      }
    })

    it('defaults to face 1 for invalid input', () => {
      const o = orientationForFace(0)
      expect(o.front).toBe(1)
    })
  })

  describe('isValidOrientation', () => {
    it('validates correct orientations', () => {
      expect(isValidOrientation({ front: 1, top: 3, right: 2 })).toBe(true)
      expect(isValidOrientation({ front: 6, top: 3, right: 5 })).toBe(true)
    })

    it('rejects invalid orientations', () => {
      // front and top are opposite faces (sum to 7)
      expect(isValidOrientation({ front: 1, top: 6, right: 2 })).toBe(false)
      // duplicate face
      expect(isValidOrientation({ front: 1, top: 1, right: 2 })).toBe(false)
    })
  })

  describe('tip operations maintain validity', () => {
    const allDirections: TipDirection[] = ['up', 'down', 'left', 'right']

    for (let face = 1; face <= 6; face++) {
      for (const dir of allDirections) {
        it(`tippping face ${face} ${dir} produces a valid orientation`, () => {
          const initial = orientationForFace(face)
          const tipped = applyTip(initial, dir)
          expect(isValidOrientation(tipped)).toBe(true)
        })
      }
    }
  })

  describe('tip operations produce correct face changes', () => {
    it('tipUp changes front to top face', () => {
      const o = orientationForFace(1) // front=1, top=3, right=2
      const result = tipUp(o)
      expect(result.front).toBe(3) // top face comes to front
      expect(result.right).toBe(2) // right unchanged
    })

    it('tipDown changes front to bottom face', () => {
      const o = orientationForFace(1) // front=1, top=3, right=2
      const result = tipDown(o)
      expect(result.front).toBe(7 - 3) // bottom (7-top) comes to front
      expect(result.front).toBe(4)
      expect(result.right).toBe(2)
    })

    it('tipRight changes front to right face', () => {
      const o = orientationForFace(1) // front=1, top=3, right=2
      const result = tipRight(o)
      expect(result.front).toBe(2) // right face comes to front
      expect(result.top).toBe(3) // top unchanged
    })

    it('tipLeft changes front to left face', () => {
      const o = orientationForFace(1) // front=1, top=3, right=2
      const result = tipLeft(o)
      expect(result.front).toBe(7 - 2) // left (7-right) comes to front
      expect(result.front).toBe(5)
      expect(result.top).toBe(3)
    })
  })

  describe('inverse operations', () => {
    it('tipUp then tipDown returns to original front face', () => {
      const o = orientationForFace(1)
      const result = tipDown(tipUp(o))
      expect(result.front).toBe(o.front)
      expect(result.top).toBe(o.top)
      expect(result.right).toBe(o.right)
    })

    it('tipRight then tipLeft returns to original front face', () => {
      const o = orientationForFace(1)
      const result = tipLeft(tipRight(o))
      expect(result.front).toBe(o.front)
      expect(result.top).toBe(o.top)
      expect(result.right).toBe(o.right)
    })
  })

  describe('four tips in same direction = identity', () => {
    const allDirections: TipDirection[] = ['up', 'down', 'left', 'right']

    for (let face = 1; face <= 6; face++) {
      for (const dir of allDirections) {
        it(`4x ${dir} from face ${face} returns to original`, () => {
          const initial = orientationForFace(face)
          let o: CubeOrientation = initial
          for (let i = 0; i < 4; i++) {
            o = applyTip(o, dir)
          }
          expect(o.front).toBe(initial.front)
          expect(o.top).toBe(initial.top)
          expect(o.right).toBe(initial.right)
        })
      }
    }
  })

  describe('opposite faces always sum to 7', () => {
    it('after any sequence of tips, derived faces still sum to 7', () => {
      let o = orientationForFace(1)
      const moves: TipDirection[] = ['up', 'right', 'down', 'left', 'up', 'up', 'right', 'down']
      for (const m of moves) {
        o = applyTip(o, m)
        // front + back = 7
        expect(o.front + (7 - o.front)).toBe(7)
        // top + bottom = 7
        expect(o.top + (7 - o.top)).toBe(7)
        // right + left = 7
        expect(o.right + (7 - o.right)).toBe(7)
        expect(isValidOrientation(o)).toBe(true)
      }
    })
  })
})
