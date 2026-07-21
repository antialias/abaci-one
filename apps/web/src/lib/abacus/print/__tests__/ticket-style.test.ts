import { describe, expect, it } from 'vitest'
import { parseTicketStyle } from '../ticket-style'

describe('parseTicketStyle', () => {
  it('accepts a minimal style', () => {
    expect(parseTicketStyle({ basePreset: '0.20mm-standard', process: {} })).toEqual({
      basePreset: '0.20mm-standard',
      process: {},
    })
  })

  it('accepts scalar and vector process values', () => {
    const style = {
      basePreset: '0.16mm-fine',
      process: {
        sparse_infill_density: 15,
        spiral_mode: false,
        notes: 'silk',
        first_layer_temperature: [220, 220],
        flags: ['a', true, 3],
      },
    }
    expect(parseTicketStyle(style)).toEqual(style)
  })

  it('drops unknown top-level fields (returns only the TicketStyle shape)', () => {
    const parsed = parseTicketStyle({
      basePreset: '0.20mm-standard',
      process: {},
      applied: { wall_loops: 2 },
    })
    expect(parsed).toEqual({ basePreset: '0.20mm-standard', process: {} })
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'preset'],
    ['an array', []],
    ['missing basePreset', { process: {} }],
    ['empty basePreset', { basePreset: '', process: {} }],
    ['non-string basePreset', { basePreset: 5, process: {} }],
    ['missing process', { basePreset: 'p' }],
    ['null process', { basePreset: 'p', process: null }],
    ['array process', { basePreset: 'p', process: [] }],
    ['nested-object value', { basePreset: 'p', process: { k: { deep: 1 } } }],
    ['null value', { basePreset: 'p', process: { k: null } }],
    ['NaN value', { basePreset: 'p', process: { k: Number.NaN } }],
    ['Infinity value', { basePreset: 'p', process: { k: Number.POSITIVE_INFINITY } }],
    ['empty vector', { basePreset: 'p', process: { k: [] } }],
    ['mixed-invalid vector', { basePreset: 'p', process: { k: [1, null] } }],
  ])('rejects %s', (_label, input) => {
    expect(parseTicketStyle(input)).toBeNull()
  })
})
