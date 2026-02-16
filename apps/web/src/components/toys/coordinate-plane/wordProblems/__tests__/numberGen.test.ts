import { describe, it, expect } from 'vitest'
import { generateNumbers } from '../numberGen'
import { FRAMES } from '../frames'
import { SeededRandom } from '../../../../../lib/SeededRandom'
import type { DifficultyLevel } from '../types'

describe('numberGen', () => {
  const pizzaShop = FRAMES.find(f => f.id === 'pizza-shop')!

  it('generates integer solutions', () => {
    const rng = new SeededRandom(42)
    const nums = generateNumbers(pizzaShop, 3, rng)
    expect(Number.isInteger(nums.m)).toBe(true)
    expect(Number.isInteger(nums.b)).toBe(true)
    expect(Number.isInteger(nums.xAnswer)).toBe(true)
    expect(Number.isInteger(nums.yTarget)).toBe(true)
    expect(nums.yTarget).toBe(nums.m * nums.xAnswer + nums.b)
  })

  it('generates zero slope for level 1', () => {
    const rng = new SeededRandom(42)
    const nums = generateNumbers(pizzaShop, 1, rng)
    expect(nums.m).toBe(0)
    expect(nums.b).toBeGreaterThan(0)
  })

  it('generates zero intercept for level 2', () => {
    const rng = new SeededRandom(42)
    const nums = generateNumbers(pizzaShop, 2, rng)
    expect(nums.b).toBe(0)
    expect(nums.m).toBeGreaterThan(0)
  })

  it('generates non-zero slope and intercept for level 3', () => {
    // Try multiple seeds — at least some should have both non-zero
    let foundBoth = false
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRandom(seed)
      const nums = generateNumbers(pizzaShop, 3, rng)
      if (nums.m !== 0 && nums.b !== 0) {
        foundBoth = true
        break
      }
    }
    expect(foundBoth).toBe(true)
  })

  it('values stay within frame and grid bounds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = new SeededRandom(seed)
      for (const frame of FRAMES) {
        for (const level of frame.supportedLevels) {
          const nums = generateNumbers(frame, level, rng.derive(`${frame.id}-${level}`))
          // xAnswer within grid bounds (ruler placement)
          expect(nums.xAnswer).toBeGreaterThanOrEqual(-15)
          expect(nums.xAnswer).toBeLessThanOrEqual(15)
          // yTarget within frame's y range
          expect(nums.yTarget).toBeGreaterThanOrEqual(frame.yRange.min)
          expect(nums.yTarget).toBeLessThanOrEqual(frame.yRange.max)
        }
      }
    }
  })

  it('generates two distinct points for level 4', () => {
    const plantGrowth = FRAMES.find(f => f.id === 'plant-growth')!
    const rng = new SeededRandom(42)
    const nums = generateNumbers(plantGrowth, 4, rng)
    expect(nums.point1).toBeDefined()
    expect(nums.point2).toBeDefined()
    expect(nums.point1!.x).not.toBe(nums.point2!.x)
    // Both points should be on the line y = mx + b
    expect(nums.point1!.y).toBe(nums.m * nums.point1!.x + nums.b)
    expect(nums.point2!.y).toBe(nums.m * nums.point2!.x + nums.b)
  })

  it('is deterministic for same seed', () => {
    const rng1 = new SeededRandom(12345)
    const rng2 = new SeededRandom(12345)
    const nums1 = generateNumbers(pizzaShop, 3, rng1)
    const nums2 = generateNumbers(pizzaShop, 3, rng2)
    expect(nums1).toEqual(nums2)
  })

  it('produces different results for different seeds', () => {
    const results = new Set<string>()
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRandom(seed)
      const nums = generateNumbers(pizzaShop, 3, rng)
      results.add(JSON.stringify(nums))
    }
    // Should have some variety
    expect(results.size).toBeGreaterThan(3)
  })

  it('values stay within frame ranges', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = new SeededRandom(seed)
      for (const frame of FRAMES) {
        for (const level of frame.supportedLevels) {
          const nums = generateNumbers(frame, level, rng.derive(`${frame.id}-${level}`))
          if (level >= 2) {
            expect(nums.m).toBeGreaterThanOrEqual(frame.slopeRange.min)
            expect(nums.m).toBeLessThanOrEqual(frame.slopeRange.max)
          }
        }
      }
    }
  })
})
