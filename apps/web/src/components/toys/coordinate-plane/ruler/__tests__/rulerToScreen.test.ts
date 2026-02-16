import { describe, it, expect } from 'vitest'
import { rulerToScreen } from '../renderRuler'
import type { CoordinatePlaneState } from '../../types'

describe('rulerToScreen', () => {
  const defaultState: CoordinatePlaneState = {
    center: { x: 0, y: 0 },
    pixelsPerUnit: { x: 60, y: 60 },
  }

  it('converts ruler world coords to screen coords', () => {
    const info = rulerToScreen(
      { ax: 0, ay: 0, bx: 1, by: 0 },
      defaultState,
      800,
      600,
    )
    // (0,0) -> screen center (400, 300)
    expect(info.ax).toBeCloseTo(400)
    expect(info.ay).toBeCloseTo(300)
    // (1,0) -> (400 + 60, 300)
    expect(info.bx).toBeCloseTo(460)
    expect(info.by).toBeCloseTo(300)
  })

  it('computes midpoint', () => {
    const info = rulerToScreen(
      { ax: -1, ay: 0, bx: 1, by: 0 },
      defaultState,
      800,
      600,
    )
    expect(info.midX).toBeCloseTo(400)
    expect(info.midY).toBeCloseTo(300)
  })

  it('computes length', () => {
    const info = rulerToScreen(
      { ax: 0, ay: 0, bx: 1, by: 0 },
      defaultState,
      800,
      600,
    )
    expect(info.length).toBeCloseTo(60) // 1 world unit = 60px
  })

  it('computes angle for horizontal ruler', () => {
    const info = rulerToScreen(
      { ax: 0, ay: 0, bx: 1, by: 0 },
      defaultState,
      800,
      600,
    )
    expect(info.angle).toBeCloseTo(0)
  })

  it('computes angle for vertical ruler (positive Y → upward on screen)', () => {
    const info = rulerToScreen(
      { ax: 0, ay: 0, bx: 0, by: 1 },
      defaultState,
      800,
      600,
    )
    // World Y up -> screen Y down means atan2(dy, dx) where dy is negative
    expect(info.angle).toBeCloseTo(-Math.PI / 2)
  })

  it('handles non-origin center', () => {
    const state: CoordinatePlaneState = {
      center: { x: 5, y: 5 },
      pixelsPerUnit: { x: 60, y: 60 },
    }
    const info = rulerToScreen(
      { ax: 5, ay: 5, bx: 6, by: 5 },
      state,
      800,
      600,
    )
    expect(info.ax).toBeCloseTo(400) // centered
    expect(info.ay).toBeCloseTo(300) // centered
    expect(info.bx).toBeCloseTo(460)
  })

  it('handles independent X/Y scale', () => {
    const state: CoordinatePlaneState = {
      center: { x: 0, y: 0 },
      pixelsPerUnit: { x: 100, y: 50 },
    }
    const info = rulerToScreen(
      { ax: 0, ay: 0, bx: 1, by: 1 },
      state,
      800,
      600,
    )
    // bx: 400 + 1*100 = 500, by: 300 - 1*50 = 250
    expect(info.bx).toBeCloseTo(500)
    expect(info.by).toBeCloseTo(250)
    // Length should be sqrt(100^2 + 50^2) = sqrt(12500) ≈ 111.8
    expect(info.length).toBeCloseTo(Math.sqrt(100 * 100 + 50 * 50))
  })

  it('returns zero length for degenerate ruler', () => {
    const info = rulerToScreen(
      { ax: 3, ay: 2, bx: 3, by: 2 },
      defaultState,
      800,
      600,
    )
    expect(info.length).toBeCloseTo(0)
  })
})
