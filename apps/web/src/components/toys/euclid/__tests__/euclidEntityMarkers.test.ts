import { describe, it, expect } from 'vitest'
import { EUCLID_ENTITY_MARKERS } from '../euclidEntityMarkers'
import { parseEntityMarkers } from '../../../../lib/character/parseEntityMarkers'

describe('EUCLID_ENTITY_MARKERS', () => {
  function parse(text: string) {
    return parseEntityMarkers(text, EUCLID_ENTITY_MARKERS)
  }

  it('parses segment markers', () => {
    const result = parse('{seg:AB}')
    expect(result).toEqual([
      {
        kind: 'entity',
        text: 'AB',
        entity: { type: 'segment', from: 'A', to: 'B' },
      },
    ])
  })

  it('parses triangle markers with △ prefix', () => {
    const result = parse('{tri:ABC}')
    expect(result).toEqual([
      {
        kind: 'entity',
        text: '△ABC',
        entity: { type: 'triangle', vertices: ['A', 'B', 'C'] },
      },
    ])
  })

  it('parses angle markers with ∠ prefix', () => {
    const result = parse('{ang:DEF}')
    expect(result).toEqual([
      {
        kind: 'entity',
        text: '∠DEF',
        entity: { type: 'angle', points: ['D', 'E', 'F'] },
      },
    ])
  })

  it('parses point markers', () => {
    const result = parse('{pt:A}')
    expect(result).toEqual([
      {
        kind: 'entity',
        text: 'A',
        entity: { type: 'point', label: 'A' },
      },
    ])
  })

  it('rejects segment with wrong label count', () => {
    expect(parse('{seg:A}')).toEqual([{ kind: 'text', text: '{seg:A}' }])
    expect(parse('{seg:ABC}')).toEqual([{ kind: 'text', text: '{seg:ABC}' }])
  })

  it('rejects triangle with wrong label count', () => {
    expect(parse('{tri:AB}')).toEqual([{ kind: 'text', text: '{tri:AB}' }])
  })

  it('rejects angle with wrong label count', () => {
    expect(parse('{ang:AB}')).toEqual([{ kind: 'text', text: '{ang:AB}' }])
  })

  it('rejects point with multiple labels', () => {
    expect(parse('{pt:AB}')).toEqual([{ kind: 'text', text: '{pt:AB}' }])
  })

  it('parses complex text with multiple entity types', () => {
    const result = parse('Draw {seg:AB} to form {tri:ABC} with {ang:BAC} at {pt:A}')
    expect(result).toHaveLength(8) // 4 entities + 4 text segments
    expect(result[0]).toEqual({ kind: 'text', text: 'Draw ' })
    expect(result[1]).toMatchObject({ kind: 'entity', entity: { type: 'segment' } })
    expect(result[3]).toMatchObject({ kind: 'entity', entity: { type: 'triangle' } })
    expect(result[5]).toMatchObject({ kind: 'entity', entity: { type: 'angle' } })
    expect(result[7]).toMatchObject({ kind: 'entity', entity: { type: 'point' } })
  })

  it('does not match lowercase tags', () => {
    expect(parse('{seg:ab}')).toEqual([{ kind: 'text', text: '{seg:ab}' }])
  })

  it('does not match unknown tags', () => {
    expect(parse('{line:AB}')).toEqual([{ kind: 'text', text: '{line:AB}' }])
  })
})
