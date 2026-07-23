import { describe, expect, it } from 'vitest'
import { defaultParams, type Params, type ShellInfo, shellRoleKey } from '../abacus-model'

// shellRoleKey is the single source of truth mapping an addressable render shell
// (frame / bead) to the print-plan role key `bead-${beadRoleIndex(...)}`. The
// viewer's row→hero highlight dims by it, and (Gitea #18) the hero→row raycaster
// will resolve a picked triangle through it — so its agreement with the plan's
// PrintRole keys is load-bearing.

const frame: ShellInfo = { isFrame: true, i: 0, isHeaven: false }
const bead = (i: number, isHeaven = false): ShellInfo => ({ isFrame: false, i, isHeaven })
const withScheme = (scheme: string, cols = 5, palette = 'default'): Params => ({
  ...defaultParams,
  color_scheme: scheme,
  color_palette: palette,
  cols,
})

describe('shellRoleKey', () => {
  it('maps any frame shell to the frame role, regardless of scheme', () => {
    expect(shellRoleKey(frame, withScheme('heaven-earth'))).toBe('frame')
    expect(shellRoleKey(frame, withScheme('place-value'))).toBe('frame')
    expect(shellRoleKey({ isFrame: true, i: 3, isHeaven: true }, withScheme('monochrome'))).toBe(
      'frame'
    )
  })

  it('monochrome collapses every bead to bead-0', () => {
    const p = withScheme('monochrome')
    for (let i = 0; i < p.cols; i++) {
      expect(shellRoleKey(bead(i, true), p)).toBe('bead-0')
      expect(shellRoleKey(bead(i, false), p)).toBe('bead-0')
    }
  })

  it('heaven-earth splits by bead type, not by column', () => {
    const p = withScheme('heaven-earth')
    expect(shellRoleKey(bead(2, true), p)).toBe('bead-0')
    expect(shellRoleKey(bead(2, false), p)).toBe('bead-1')
    // a different column, same split
    expect(shellRoleKey(bead(0, true), p)).toBe('bead-0')
  })

  it('alternating splits by column parity (place value)', () => {
    const p = withScheme('alternating', 5)
    // pv = cols-1-i; ones place (i = cols-1) is pv 0 → even → bead-0
    expect(shellRoleKey(bead(4, false), p)).toBe('bead-0') // pv 0
    expect(shellRoleKey(bead(3, false), p)).toBe('bead-1') // pv 1
    expect(shellRoleKey(bead(2, false), p)).toBe('bead-0') // pv 2
  })

  it('place-value keys each column by place value modulo the palette length', () => {
    const p = withScheme('place-value', 7) // default palette length is 5
    expect(shellRoleKey(bead(6, false), p)).toBe('bead-0') // pv 0
    expect(shellRoleKey(bead(2, false), p)).toBe('bead-4') // pv 4
    expect(shellRoleKey(bead(1, false), p)).toBe('bead-0') // pv 5 % 5
    expect(shellRoleKey(bead(0, false), p)).toBe('bead-1') // pv 6 % 5
  })
})
