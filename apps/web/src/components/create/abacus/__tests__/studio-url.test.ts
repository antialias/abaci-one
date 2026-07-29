/** studioHref (Gitea #22): the two address-carried selections never drop each other. */
import { describe, expect, it } from 'vitest'
import { studioHref } from '../studio-url'

const PATH = '/create/abacus'

describe('studioHref', () => {
  it('keeps the design when selecting a player', () => {
    expect(studioHref(PATH, { playerId: 'p1', designId: 'd1' })).toBe(
      '/create/abacus?design=d1&player=p1'
    )
  })

  it('keeps the design when clearing the player', () => {
    expect(studioHref(PATH, { playerId: null, designId: 'd1' })).toBe('/create/abacus?design=d1')
  })

  it('is the plain page with neither selection', () => {
    expect(studioHref(PATH, { playerId: null, designId: null })).toBe('/create/abacus')
  })

  it('carries a player alone (pre-#22 behavior)', () => {
    expect(studioHref(PATH, { playerId: 'p1', designId: null })).toBe('/create/abacus?player=p1')
  })
})
