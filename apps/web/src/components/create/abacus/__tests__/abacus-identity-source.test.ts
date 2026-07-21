import { describe, expect, it } from 'vitest'
import type { AbacusIdentity } from '@/lib/abacus/identity'
import { selectSourceIdentity } from '../abacus-identity-source'
import type { DisplayConfigInput } from '../abacus-model'

const config: DisplayConfigInput = {
  colorScheme: 'heaven-earth',
  colorPalette: 'colorblind',
  physicalAbacusColumns: 7,
}

const row: AbacusIdentity = {
  colorScheme: 'alternating',
  colorPalette: 'nature',
  columns: 5,
}

describe('selectSourceIdentity', () => {
  it('no player → the viewer display config projection', () => {
    expect(selectSourceIdentity(null, undefined, config)).toEqual({
      colorScheme: 'heaven-earth',
      colorPalette: 'colorblind',
      physicalAbacusColumns: 7,
    })
  })

  it('no player ignores a stale player row left in cache', () => {
    expect(selectSourceIdentity(null, row, config)).toEqual({
      colorScheme: 'heaven-earth',
      colorPalette: 'colorblind',
      physicalAbacusColumns: 7,
    })
  })

  it('player selected + row loaded → the row, columns mapped to physicalAbacusColumns', () => {
    expect(selectSourceIdentity('player-1', row, config)).toEqual({
      colorScheme: 'alternating',
      colorPalette: 'nature',
      physicalAbacusColumns: 5,
    })
  })

  it('player selected + row still in flight → null (hold, never seed a fake)', () => {
    expect(selectSourceIdentity('player-1', undefined, config)).toBeNull()
    expect(selectSourceIdentity('player-1', null, config)).toBeNull()
  })

  it('projects only the identity triple, never extra config fields', () => {
    const fatConfig = {
      ...config,
      soundEnabled: true,
      beadShape: 'diamond',
    } as DisplayConfigInput
    expect(Object.keys(selectSourceIdentity(null, undefined, fatConfig) ?? {})).toEqual([
      'colorScheme',
      'colorPalette',
      'physicalAbacusColumns',
    ])
  })
})
