import { describe, it, expect } from 'vitest'
import { generateWordProblem, generateRandomProblem } from '../generate'
import { CHARACTERS } from '../characters'
import type { DifficultyLevel } from '../types'

describe('generateWordProblem', () => {
  it('is deterministic for same seed and difficulty', () => {
    const p1 = generateWordProblem(42, 3)
    const p2 = generateWordProblem(42, 3)
    expect(p1.text).toBe(p2.text)
    expect(p1.equation).toEqual(p2.equation)
    expect(p1.answer).toEqual(p2.answer)
    expect(p1.frameId).toBe(p2.frameId)
  })

  it('produces different problems for different seeds', () => {
    const texts = new Set<string>()
    for (let seed = 0; seed < 20; seed++) {
      texts.add(generateWordProblem(seed, 3).text)
    }
    expect(texts.size).toBeGreaterThan(5)
  })

  it('produces valid equation with integer solution for level 3', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateWordProblem(seed, 3)
      const { slope, intercept } = p.equation
      // y = mx + b should hold at the answer point
      const computedY = (slope.num / slope.den) * p.answer.x + intercept.num / intercept.den
      expect(computedY).toBeCloseTo(p.answer.y, 10)
      // Answer x should be an integer
      expect(Number.isInteger(p.answer.x)).toBe(true)
    }
  })

  it('sets correct solveFor per difficulty', () => {
    expect(generateWordProblem(42, 1).answer.solveFor).toBe('y')
    expect(generateWordProblem(42, 2).answer.solveFor).toBe('y')
    expect(generateWordProblem(42, 3).answer.solveFor).toBe('x')
    // Level 4 needs a frame that supports it
    expect(generateWordProblem(42, 4).answer.solveFor).toBe('equation')
  })

  it('has correct id format', () => {
    const p = generateWordProblem(42, 3)
    expect(p.id).toBe('wp-42-3')
  })

  it('has axis labels', () => {
    const p = generateWordProblem(42, 3)
    expect(p.axisLabels.x).toBeTruthy()
    expect(p.axisLabels.y).toBeTruthy()
  })

  it('spans join to form text', () => {
    const p = generateWordProblem(42, 3)
    const joined = p.spans.map((s) => s.text).join('')
    expect(joined).toBe(p.text)
  })

  it('has annotation spans with correct tags', () => {
    const p = generateWordProblem(42, 3)
    const tags = p.spans.filter((s) => s.tag).map((s) => s.tag!)
    expect(tags).toContain('slope')
    expect(tags).toContain('intercept')
    expect(tags).toContain('target')
    expect(tags).toContain('question')
  })

  it('works for all difficulty levels', () => {
    for (const level of [1, 2, 3, 4, 5] as DifficultyLevel[]) {
      const p = generateWordProblem(42, level)
      expect(p.text.length).toBeGreaterThan(10)
      expect(p.difficulty).toBe(level)
    }
  })

  it('uses multiple different character names across seeds', () => {
    const names = new Set<string>()
    for (let seed = 0; seed < 100; seed++) {
      const p = generateWordProblem(seed, 3)
      for (const char of CHARACTERS) {
        if (p.text.includes(char.name)) {
          names.add(char.name)
        }
      }
    }
    // Should use at least 5 different characters across 100 seeds
    expect(names.size).toBeGreaterThanOrEqual(5)
  })

  it('no unresolved placeholders leak into generated text', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const level of [1, 2, 3] as DifficultyLevel[]) {
        const p = generateWordProblem(seed, level)
        expect(p.text).not.toMatch(/\{name\}|\{pronoun\}|\{Pronoun\}|\{possessive\}|\{Possessive\}/)
      }
    }
  })
})

describe('generateRandomProblem', () => {
  it('returns a valid problem', () => {
    const p = generateRandomProblem(3)
    expect(p.text.length).toBeGreaterThan(10)
    expect(p.difficulty).toBe(3)
    expect(p.seed).toBeDefined()
  })
})
