import { describe, it, expect } from 'vitest'
import { FRAMES, buildFrame } from '../frames'
import { RATE_PAIRS, RATE_PAIR_REGISTRY } from '../ratePairs'
import { SCENARIOS } from '../scenarios'
import { expandGrammar } from '../grammar'
import { CHARACTERS, resolveCharacter } from '../characters'
import { SeededRandom } from '../../../../../lib/SeededRandom'
import type { DifficultyLevel } from '../types'

describe('buildFrame composition', () => {
  it('every scenario references a valid rate pair', () => {
    for (const scenario of SCENARIOS) {
      const pair = RATE_PAIR_REGISTRY.get(scenario.ratePairId)
      expect(
        pair,
        `Scenario "${scenario.id}" references unknown ratePairId "${scenario.ratePairId}"`
      ).toBeDefined()
    }
  })

  it('all frame IDs are unique', () => {
    const ids = FRAMES.map((f) => f.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('FRAMES.length equals SCENARIOS.length', () => {
    expect(FRAMES.length).toBe(SCENARIOS.length)
  })

  it('every rate pair has at least one scenario', () => {
    const usedPairIds = new Set(SCENARIOS.map((s) => s.ratePairId))
    for (const pair of RATE_PAIRS) {
      expect(usedPairIds.has(pair.id), `Rate pair "${pair.id}" has no scenarios`).toBe(true)
    }
  })

  it('all elapsed frames with level 3 have solveForXQuestions', () => {
    for (const frame of FRAMES) {
      if (frame.xRole === 'elapsed' && frame.supportedLevels.includes(3)) {
        expect(
          frame.solveForXQuestions && frame.solveForXQuestions.length > 0,
          `Elapsed frame "${frame.id}" supports level 3 but has no solveForXQuestions`
        ).toBe(true)
      }
    }
  })

  it('buildFrame produces correct composite ID', () => {
    const pair = RATE_PAIRS[0]
    const scenario = SCENARIOS.find((s) => s.ratePairId === pair.id)!
    const frame = buildFrame(pair, scenario)
    expect(frame.id).toBe(`${pair.id}:${scenario.id}`)
  })

  it('buildFrame merges pair and scenario fields correctly', () => {
    const pair = RATE_PAIRS[0]
    const scenario = SCENARIOS.find((s) => s.ratePairId === pair.id)!
    const frame = buildFrame(pair, scenario)

    // From pair
    expect(frame.category).toBe(pair.category)
    expect(frame.xNoun).toBe(pair.xNoun)
    expect(frame.yNoun).toBe(pair.yNoun)
    expect(frame.rateVerb).toBe(pair.rateVerb)
    expect(frame.xUnit).toBe(pair.xUnit)
    expect(frame.yUnit).toBe(pair.yUnit)
    expect(frame.xRole).toBe(pair.xRole)

    // From scenario
    expect(frame.setupPhrases).toBe(scenario.setupPhrases)
    expect(frame.subjects).toBe(scenario.subjects)
    expect(frame.emoji).toBe(scenario.emoji)
    expect(frame.supportedLevels).toBe(scenario.supportedLevels)
    expect(frame.slopeRange).toBe(scenario.slopeRange)
  })

  it('expandGrammar produces valid spans for every frame at every supported level', () => {
    const char = CHARACTERS[0]
    for (const frame of FRAMES) {
      const resolved = resolveCharacter(frame, char)
      for (const level of frame.supportedLevels) {
        const rng = new SeededRandom(42)
        const nums = {
          m: level === 1 ? 0 : 2,
          b: level === 2 ? 0 : 3,
          xAnswer: 2,
          yTarget: level === 1 ? 3 : level === 2 ? 4 : 7,
          ...(level === 4 ? { point1: { x: 1, y: 5 }, point2: { x: 2, y: 7 } } : {}),
        }
        const spans = expandGrammar(resolved, nums, level as DifficultyLevel, rng)
        expect(
          spans.length,
          `Frame "${frame.id}" level ${level} produced empty spans`
        ).toBeGreaterThan(0)
        const text = spans.map((s) => s.text).join('')
        expect(
          text.length,
          `Frame "${frame.id}" level ${level} produced very short text`
        ).toBeGreaterThan(10)
      }
    }
  })

  it('has significantly more frames than the original 6', () => {
    expect(FRAMES.length).toBeGreaterThanOrEqual(30)
  })

  it('all frames have non-empty setupPhrases and subjects', () => {
    for (const frame of FRAMES) {
      expect(frame.setupPhrases.length, `Frame "${frame.id}" has no setupPhrases`).toBeGreaterThan(
        0
      )
      expect(frame.subjects.length, `Frame "${frame.id}" has no subjects`).toBeGreaterThan(0)
    }
  })

  it('number ranges are valid (min <= max)', () => {
    for (const frame of FRAMES) {
      expect(frame.slopeRange.min).toBeLessThanOrEqual(frame.slopeRange.max)
      expect(frame.interceptRange.min).toBeLessThanOrEqual(frame.interceptRange.max)
      expect(frame.xRange.min).toBeLessThanOrEqual(frame.xRange.max)
      expect(frame.yRange.min).toBeLessThanOrEqual(frame.yRange.max)
    }
  })

  describe('scenario noun/verb overrides', () => {
    it('cake-sale uses "piece" instead of "slice"', () => {
      const frame = FRAMES.find((f) => f.id === 'slices-dollars-cost:cake-sale')!
      expect(frame.xNoun.singular).toBe('piece')
      expect(frame.xNoun.plural).toBe('pieces')
      expect(frame.xUnit).toBe('pieces')
    })

    it('pie-contest uses "pie" instead of "slice"', () => {
      const frame = FRAMES.find((f) => f.id === 'slices-dollars-cost:pie-contest')!
      expect(frame.xNoun.singular).toBe('pie')
      expect(frame.xUnit).toBe('pies')
    })

    it('necklace-craft uses "necklace" instead of "bracelet"', () => {
      const frame = FRAMES.find((f) => f.id === 'bracelets-beads-use:necklace-craft')!
      expect(frame.xNoun.singular).toBe('necklace')
      expect(frame.xUnit).toBe('necklaces')
    })

    it('keychain-craft uses "keychain" instead of "bracelet"', () => {
      const frame = FRAMES.find((f) => f.id === 'bracelets-beads-use:keychain-craft')!
      expect(frame.xNoun.singular).toBe('keychain')
      expect(frame.xUnit).toBe('keychains')
    })

    it('carnival-rides uses "ride" instead of "ticket"', () => {
      const frame = FRAMES.find((f) => f.id === 'tickets-dollars-cost:carnival-rides')!
      expect(frame.xNoun.singular).toBe('ride')
      expect(frame.xUnit).toBe('rides')
    })

    it('swim-laps uses "swim" instead of "run"', () => {
      const frame = FRAMES.find((f) => f.id === 'laps-meters-run:swim-laps')!
      expect(frame.rateVerb.base).toBe('swim')
      expect(frame.rateVerb.thirdPerson).toBe('swims')
    })

    it('pizza-shop still uses pair defaults (no overrides)', () => {
      const frame = FRAMES.find((f) => f.id === 'slices-dollars-cost:pizza-shop')!
      const pair = RATE_PAIR_REGISTRY.get('slices-dollars-cost')!
      expect(frame.xNoun).toBe(pair.xNoun)
      expect(frame.rateVerb).toBe(pair.rateVerb)
    })
  })
})
