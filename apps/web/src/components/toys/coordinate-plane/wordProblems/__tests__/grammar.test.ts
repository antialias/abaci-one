import { describe, it, expect } from 'vitest'
import { expandGrammar } from '../grammar'
import { FRAMES } from '../frames'
import { SeededRandom } from '../../../../../lib/SeededRandom'
import type { DifficultyLevel, AnnotatedSpan } from '../types'

describe('grammar', () => {
  const pizzaShop = FRAMES.find(f => f.id === 'pizza-shop')!

  it('produces non-empty spans', () => {
    const rng = new SeededRandom(42)
    const spans = expandGrammar(pizzaShop, { m: 3, b: 5, xAnswer: 4, yTarget: 17 }, 3, rng)
    expect(spans.length).toBeGreaterThan(0)
    const text = spans.map(s => s.text).join('')
    expect(text.length).toBeGreaterThan(20)
  })

  it('includes slope annotation for levels 2+', () => {
    const rng = new SeededRandom(42)
    const spans = expandGrammar(pizzaShop, { m: 3, b: 0, xAnswer: 4, yTarget: 12 }, 2, rng)
    const slopeSpan = spans.find(s => s.tag === 'slope')
    expect(slopeSpan).toBeDefined()
    expect(slopeSpan!.value).toBe(3)
  })

  it('includes intercept annotation for level 3', () => {
    const rng = new SeededRandom(42)
    const spans = expandGrammar(pizzaShop, { m: 2, b: 5, xAnswer: 3, yTarget: 11 }, 3, rng)
    const interceptSpan = spans.find(s => s.tag === 'intercept')
    expect(interceptSpan).toBeDefined()
    expect(interceptSpan!.value).toBe(5)
  })

  it('includes target annotation for level 3', () => {
    const rng = new SeededRandom(42)
    const spans = expandGrammar(pizzaShop, { m: 2, b: 5, xAnswer: 3, yTarget: 11 }, 3, rng)
    const targetSpan = spans.find(s => s.tag === 'target')
    expect(targetSpan).toBeDefined()
    expect(targetSpan!.value).toBe(11)
  })

  it('includes question annotation', () => {
    const rng = new SeededRandom(42)
    const spans = expandGrammar(pizzaShop, { m: 2, b: 5, xAnswer: 3, yTarget: 11 }, 3, rng)
    const questionSpan = spans.find(s => s.tag === 'question')
    expect(questionSpan).toBeDefined()
  })

  it('is deterministic for same seed', () => {
    const nums = { m: 3, b: 5, xAnswer: 4, yTarget: 17 }
    const spans1 = expandGrammar(pizzaShop, nums, 3, new SeededRandom(99))
    const spans2 = expandGrammar(pizzaShop, nums, 3, new SeededRandom(99))
    expect(spans1).toEqual(spans2)
  })

  it('produces variety across seeds', () => {
    const nums = { m: 3, b: 5, xAnswer: 4, yTarget: 17 }
    const texts = new Set<string>()
    for (let seed = 0; seed < 30; seed++) {
      const spans = expandGrammar(pizzaShop, nums, 3, new SeededRandom(seed))
      texts.add(spans.map(s => s.text).join(''))
    }
    // Should have meaningful variety
    expect(texts.size).toBeGreaterThan(5)
  })

  it('handles level 1 (constant function)', () => {
    const rng = new SeededRandom(42)
    const spans = expandGrammar(pizzaShop, { m: 0, b: 5, xAnswer: 1, yTarget: 5 }, 1, rng)
    const text = spans.map(s => s.text).join('')
    expect(text).toContain('5')
    const interceptSpan = spans.find(s => s.tag === 'intercept')
    expect(interceptSpan).toBeDefined()
  })

  it('handles level 4 (two points)', () => {
    const plantGrowth = FRAMES.find(f => f.id === 'plant-growth')!
    const rng = new SeededRandom(42)
    const nums = { m: 2, b: 3, xAnswer: 4, yTarget: 11, point1: { x: 1, y: 5 }, point2: { x: 3, y: 9 } }
    const spans = expandGrammar(plantGrowth, nums, 4, rng)
    const text = spans.map(s => s.text).join('')
    expect(text).toContain('equation')
    expect(spans.some(s => s.tag === 'point1')).toBe(true)
    expect(spans.some(s => s.tag === 'point2')).toBe(true)
  })

  it('works for all frames at their supported levels', () => {
    for (const frame of FRAMES) {
      for (const level of frame.supportedLevels) {
        const rng = new SeededRandom(42)
        const nums = {
          m: level === 1 ? 0 : 2,
          b: level === 2 ? 0 : 3,
          xAnswer: 2,
          yTarget: level === 1 ? 3 : level === 2 ? 4 : 7,
          ...(level === 4 ? { point1: { x: 1, y: 5 }, point2: { x: 2, y: 7 } } : {}),
        }
        const spans = expandGrammar(frame, nums, level as DifficultyLevel, rng)
        expect(spans.length).toBeGreaterThan(0)
        const text = spans.map(s => s.text).join('')
        expect(text.length).toBeGreaterThan(10)
      }
    }
  })

  // ── Regression tests for elapsed (time-based) frames ──────────

  describe('elapsed frame grammar', () => {
    const roadTrip = FRAMES.find(f => f.id === 'road-trip')!
    const plantGrowth = FRAMES.find(f => f.id === 'plant-growth')!
    const savings = FRAMES.find(f => f.id === 'savings')!

    it('rate sentence does not use x-unit as subject', () => {
      // Across many seeds, no road-trip rate sentence should say "Each hour travels"
      for (let seed = 0; seed < 50; seed++) {
        const rng = new SeededRandom(seed)
        const spans = expandGrammar(roadTrip, { m: 42, b: 38, xAnswer: 3, yTarget: 164 }, 3, rng)
        const text = spans.map(s => s.text).join('')
        expect(text).not.toMatch(/Each hour/i)
        expect(text).not.toMatch(/Hours travel/i)
      }
    })

    it('question sentence does not say "get hours"', () => {
      for (let seed = 0; seed < 50; seed++) {
        const rng = new SeededRandom(seed)
        const spans = expandGrammar(roadTrip, { m: 42, b: 38, xAnswer: 3, yTarget: 164 }, 3, rng)
        const text = spans.map(s => s.text).join('')
        expect(text).not.toContain('get hours')
        expect(text).not.toContain('get weeks')
      }
    })

    it('base sentence does not say "already has miles"', () => {
      for (let seed = 0; seed < 50; seed++) {
        const rng = new SeededRandom(seed)
        const spans = expandGrammar(roadTrip, { m: 42, b: 38, xAnswer: 3, yTarget: 164 }, 3, rng)
        const text = spans.map(s => s.text).join('')
        expect(text).not.toContain('already has')
      }
    })

    it('uses natural phrasing for plant-growth rate', () => {
      for (let seed = 0; seed < 50; seed++) {
        const rng = new SeededRandom(seed)
        const spans = expandGrammar(plantGrowth, { m: 3, b: 2, xAnswer: 4, yTarget: 14 }, 3, rng)
        const text = spans.map(s => s.text).join('')
        expect(text).not.toMatch(/Each week grows/i)
        expect(text).not.toMatch(/Weeks grow/i)
      }
    })

    it('savings level 2 question uses "after" phrasing', () => {
      for (let seed = 0; seed < 50; seed++) {
        const rng = new SeededRandom(seed)
        const spans = expandGrammar(savings, { m: 10, b: 0, xAnswer: 5, yTarget: 50 }, 2, rng)
        const text = spans.map(s => s.text).join('')
        // Should not say "gets 5 weeks"
        expect(text).not.toContain('gets 5 weeks')
        expect(text).not.toContain('gets 5 week')
      }
    })

    it('road-trip subject-verb agreement with "They"', () => {
      // "They" should get base form ("travel" not "travels")
      let sawThey = false
      for (let seed = 0; seed < 200; seed++) {
        const rng = new SeededRandom(seed)
        const spans = expandGrammar(roadTrip, { m: 42, b: 38, xAnswer: 3, yTarget: 164 }, 3, rng)
        const text = spans.map(s => s.text).join('')
        if (text.includes('They ') || text.includes('they ')) {
          sawThey = true
          // "They" should never pair with "travels" or "needs"
          expect(text).not.toMatch(/[Tt]hey travels/i)
          expect(text).not.toMatch(/[Tt]hey needs/i)
        }
      }
      expect(sawThey).toBe(true)
    })
  })

  describe('level 4 duplicate unit fix', () => {
    it('does not duplicate yUnit in level 4 sentences', () => {
      const plantGrowth = FRAMES.find(f => f.id === 'plant-growth')!
      for (let seed = 0; seed < 20; seed++) {
        const rng = new SeededRandom(seed)
        const nums = { m: 2, b: 3, xAnswer: 4, yTarget: 11, point1: { x: 1, y: 5 }, point2: { x: 3, y: 9 } }
        const spans = expandGrammar(plantGrowth, nums, 4, rng)
        const text = spans.map(s => s.text).join('')
        // "5 inches inches" should never appear
        expect(text).not.toMatch(/inches\s+inches/i)
        expect(text).not.toMatch(/miles\s+miles/i)
      }
    })
  })
})
