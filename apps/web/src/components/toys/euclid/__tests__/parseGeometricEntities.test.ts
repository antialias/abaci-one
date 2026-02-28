import { describe, it, expect } from 'vitest'
import { parseGeometricEntities } from '../chat/parseGeometricEntities'

describe('parseGeometricEntities', () => {
  it('returns plain text when no markers present', () => {
    const result = parseGeometricEntities('Hello world')
    expect(result).toEqual([{ kind: 'text', text: 'Hello world' }])
  })

  it('parses a segment marker', () => {
    const result = parseGeometricEntities('Draw {seg:AB} now')
    expect(result).toEqual([
      { kind: 'text', text: 'Draw ' },
      {
        kind: 'entity',
        text: 'AB',
        entity: { type: 'segment', from: 'A', to: 'B' },
      },
      { kind: 'text', text: ' now' },
    ])
  })

  it('parses a triangle marker', () => {
    const result = parseGeometricEntities('{tri:ABC}')
    expect(result).toEqual([
      {
        kind: 'entity',
        text: '△ABC',
        entity: { type: 'triangle', vertices: ['A', 'B', 'C'] },
      },
    ])
  })

  it('parses an angle marker', () => {
    const result = parseGeometricEntities('angle {ang:DEF} is right')
    expect(result).toEqual([
      { kind: 'text', text: 'angle ' },
      {
        kind: 'entity',
        text: '∠DEF',
        entity: { type: 'angle', points: ['D', 'E', 'F'] },
      },
      { kind: 'text', text: ' is right' },
    ])
  })

  it('parses a point marker', () => {
    const result = parseGeometricEntities('Place {pt:A} here')
    expect(result).toEqual([
      { kind: 'text', text: 'Place ' },
      {
        kind: 'entity',
        text: 'A',
        entity: { type: 'point', label: 'A' },
      },
      { kind: 'text', text: ' here' },
    ])
  })

  it('parses multiple markers in sequence', () => {
    const result = parseGeometricEntities('{seg:AB} equals {seg:CD}')
    expect(result).toEqual([
      {
        kind: 'entity',
        text: 'AB',
        entity: { type: 'segment', from: 'A', to: 'B' },
      },
      { kind: 'text', text: ' equals ' },
      {
        kind: 'entity',
        text: 'CD',
        entity: { type: 'segment', from: 'C', to: 'D' },
      },
    ])
  })

  it('skips invalid segment (wrong label count)', () => {
    const result = parseGeometricEntities('{seg:A} alone')
    // Invalid segment (only 1 letter), so treated as plain text
    expect(result).toEqual([{ kind: 'text', text: '{seg:A} alone' }])
  })

  it('skips invalid triangle (wrong label count)', () => {
    const result = parseGeometricEntities('{tri:AB}')
    expect(result).toEqual([{ kind: 'text', text: '{tri:AB}' }])
  })

  it('skips invalid angle (wrong label count)', () => {
    const result = parseGeometricEntities('{ang:AB}')
    expect(result).toEqual([{ kind: 'text', text: '{ang:AB}' }])
  })

  it('skips invalid point (multiple letters)', () => {
    const result = parseGeometricEntities('{pt:AB}')
    expect(result).toEqual([{ kind: 'text', text: '{pt:AB}' }])
  })

  it('handles empty string', () => {
    const result = parseGeometricEntities('')
    expect(result).toEqual([{ kind: 'text', text: '' }])
  })

  it('handles mixed valid and invalid markers', () => {
    const result = parseGeometricEntities('{seg:A} and {seg:AB}')
    expect(result).toEqual([
      { kind: 'text', text: '{seg:A} and ' },
      {
        kind: 'entity',
        text: 'AB',
        entity: { type: 'segment', from: 'A', to: 'B' },
      },
    ])
  })

  it('accepts knownLabels parameter without using it', () => {
    const labels = new Set(['A', 'B'])
    const result = parseGeometricEntities('{seg:AB}', labels)
    expect(result).toEqual([
      {
        kind: 'entity',
        text: 'AB',
        entity: { type: 'segment', from: 'A', to: 'B' },
      },
    ])
  })

  it('works correctly when called multiple times (regex state reset)', () => {
    parseGeometricEntities('{pt:A}')
    const result = parseGeometricEntities('{pt:B}')
    expect(result).toEqual([
      {
        kind: 'entity',
        text: 'B',
        entity: { type: 'point', label: 'B' },
      },
    ])
  })
})
