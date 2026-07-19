import { describe, expect, it } from 'vitest'
import { catalogFromParams } from '../abacus-catalog'
import { defaultParams, type Params } from '../abacus-model'

const withCount = (filament_count: number): Params => ({ ...defaultParams, filament_count })

describe('catalogFromParams', () => {
  it('is a params-derived, color-only catalog defaulting every spool to PLA', () => {
    const cat = catalogFromParams(defaultParams)
    expect(cat.source).toBe('manual-params')
    expect(cat.fetchedAt).toBeUndefined()
    expect(cat.spools.every((s) => s.material === 'PLA')).toBe(true)
  })

  it('takes the first `filament_count` slots in order, with stable ids and hexes', () => {
    const cat = catalogFromParams(withCount(3))
    expect(cat.spools).toEqual([
      { id: 'filament-1', name: 'Filament 1', hex: defaultParams.filament_1, material: 'PLA' },
      { id: 'filament-2', name: 'Filament 2', hex: defaultParams.filament_2, material: 'PLA' },
      { id: 'filament-3', name: 'Filament 3', hex: defaultParams.filament_3, material: 'PLA' },
    ])
  })

  it('clamps the slot count to [1, 8] (matching the historical filament map)', () => {
    expect(catalogFromParams(withCount(0)).spools).toHaveLength(1)
    expect(catalogFromParams(withCount(1)).spools).toHaveLength(1)
    expect(catalogFromParams(withCount(8)).spools).toHaveLength(8)
    expect(catalogFromParams(withCount(99)).spools).toHaveLength(8)
  })
})
