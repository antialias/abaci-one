import { describe, expect, it } from 'vitest'
import { stripEntityMarkers } from '@/lib/character/parseEntityMarkers'
import { EUCLID_ENTITY_MARKERS } from '@/components/toys/euclid/euclidEntityMarkers'
import { validateMarkupStrict, wordOverlapRatio } from './validation'

const expandMarkers = (text: string) => stripEntityMarkers(text, EUCLID_ENTITY_MARKERS)

describe('validateMarkupStrict', () => {
  it('accepts the triangle △ABD example (model added period, replaced △ symbol)', () => {
    const original =
      'Describe circle with center A through B noting that we also have triangle △ABD'
    const model =
      'Describe circle with center {pt:A} through {pt:B} noting that we also have triangle {tri:ABD}.'
    expect(validateMarkupStrict(original, model, expandMarkers)).toBe(true)
  })

  it('accepts clean markup with no changes to surrounding text', () => {
    const original = 'Place the compass at A and draw through B.'
    const marked = 'Place the compass at {pt:A} and draw through {pt:B}.'
    expect(validateMarkupStrict(original, marked, expandMarkers)).toBe(true)
  })

  it('accepts markup that only adds markers (no trailing punctuation added)', () => {
    const original = 'Segment AB equals segment CD'
    const marked = 'Segment {seg:AB} equals segment {seg:CD}'
    expect(validateMarkupStrict(original, marked, expandMarkers)).toBe(true)
  })

  it('rejects when model completely rewrites the text', () => {
    const original = 'Draw a line from A to B'
    const marked = 'We construct {seg:AB} using {post:1}.'
    expect(validateMarkupStrict(original, marked, expandMarkers)).toBe(false)
  })

  it('rejects when model adds significant new words', () => {
    const original = 'Point A'
    const marked =
      'We observe that {pt:A} is a critical point in our construction of the equilateral triangle.'
    expect(validateMarkupStrict(original, marked, expandMarkers)).toBe(false)
  })

  it('accepts when model adds trailing period to text without one', () => {
    const original = 'Use Postulate 3 to draw a circle'
    const marked = 'Use {post:3} to draw a circle.'
    expect(validateMarkupStrict(original, marked, expandMarkers)).toBe(true)
  })

  it('accepts markup with display text overrides', () => {
    const original = 'By Proposition I.1 we know this'
    const marked = 'By {prop:1|Proposition I.1} we know this'
    expect(validateMarkupStrict(original, marked, expandMarkers)).toBe(true)
  })

  it('accepts when model strips △ symbol into {tri:} marker', () => {
    const original = 'triangle △ABD is equilateral'
    const marked = 'triangle {tri:ABD} is equilateral'
    expect(validateMarkupStrict(original, marked, expandMarkers)).toBe(true)
  })

  it('accepts when model strips ∠ symbol into {ang:} marker', () => {
    const original = 'we need ∠ABC to be a right angle'
    const marked = 'we need {ang:ABC} to be a right angle'
    expect(validateMarkupStrict(original, marked, expandMarkers)).toBe(true)
  })

  it('rejects when model replaces generic noun "point" with {pt:A}', () => {
    const original = 'Alright, can you just place the damn point?'
    const marked = 'Alright, can you just place the damn {pt:A}?'
    expect(validateMarkupStrict(original, marked, expandMarkers)).toBe(false)
  })

  it('rejects when model replaces "the line" with {seg:AB}', () => {
    const original = 'draw the line please'
    const marked = 'draw {seg:AB} please'
    expect(validateMarkupStrict(original, marked, expandMarkers)).toBe(false)
  })
})

describe('wordOverlapRatio', () => {
  it('returns 1 for identical text', () => {
    expect(wordOverlapRatio('hello world', 'hello world')).toBe(1)
  })

  it('returns 0 for completely different text', () => {
    expect(wordOverlapRatio('hello world', 'foo bar')).toBe(0)
  })

  it('returns partial overlap', () => {
    expect(wordOverlapRatio('a b c d', 'a b x y')).toBe(0.5)
  })
})
