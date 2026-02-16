import { describe, it, expect } from 'vitest'
import {
  worldToScreen,
  screenToWorld,
  worldToScreen2D,
  screenToWorld2D,
} from '../coordinateConversions'

describe('coordinateConversions', () => {
  // ── 1D: worldToScreen ────────────────────────────────────────────

  describe('worldToScreen', () => {
    it('maps center value to mid-extent', () => {
      expect(worldToScreen(5, 5, 60, 800)).toBe(400)
    })

    it('maps value right of center to right of mid-extent', () => {
      // value=7, center=5, ppu=60, extent=800 -> (7-5)*60 + 400 = 520
      expect(worldToScreen(7, 5, 60, 800)).toBe(520)
    })

    it('maps value left of center to left of mid-extent', () => {
      // value=3, center=5, ppu=60, extent=800 -> (3-5)*60 + 400 = 280
      expect(worldToScreen(3, 5, 60, 800)).toBe(280)
    })

    it('maps origin with zero center', () => {
      // value=0, center=0, ppu=100, extent=600 -> 0*100 + 300 = 300
      expect(worldToScreen(0, 0, 100, 600)).toBe(300)
    })
  })

  // ── 1D: screenToWorld ────────────────────────────────────────────

  describe('screenToWorld', () => {
    it('maps mid-extent to center value', () => {
      expect(screenToWorld(400, 5, 60, 800)).toBe(5)
    })

    it('maps right of mid-extent to right of center', () => {
      // screenPos=520, center=5, ppu=60, extent=800 -> (520-400)/60 + 5 = 7
      expect(screenToWorld(520, 5, 60, 800)).toBe(7)
    })

    it('maps left of mid-extent to left of center', () => {
      expect(screenToWorld(280, 5, 60, 800)).toBe(3)
    })
  })

  // ── 1D round-trip ────────────────────────────────────────────────

  describe('1D round-trip', () => {
    const cases = [
      { value: 0, center: 0, ppu: 60, extent: 800 },
      { value: 3.7, center: -2, ppu: 100, extent: 1200 },
      { value: -5, center: 10, ppu: 40, extent: 600 },
    ]

    for (const { value, center, ppu, extent } of cases) {
      it(`world(${value}) -> screen -> world with center=${center}, ppu=${ppu}`, () => {
        const screen = worldToScreen(value, center, ppu, extent)
        const back = screenToWorld(screen, center, ppu, extent)
        expect(back).toBeCloseTo(value, 10)
      })
    }
  })

  // ── 2D: worldToScreen2D ──────────────────────────────────────────

  describe('worldToScreen2D', () => {
    it('maps world origin to canvas center when center is (0,0)', () => {
      const p = worldToScreen2D(0, 0, 0, 0, 60, 60, 800, 600)
      expect(p.x).toBe(400)
      expect(p.y).toBe(300)
    })

    it('inverts Y axis (positive world Y → lower screen Y)', () => {
      const p = worldToScreen2D(0, 1, 0, 0, 60, 60, 800, 600)
      expect(p.x).toBe(400)
      expect(p.y).toBe(240) // 300 - 1*60
    })

    it('handles independent X/Y scale', () => {
      const p = worldToScreen2D(2, 3, 0, 0, 50, 100, 800, 600)
      expect(p.x).toBe(500)  // 400 + 2*50
      expect(p.y).toBe(0)    // 300 - 3*100
    })

    it('accounts for non-zero center', () => {
      const p = worldToScreen2D(5, 5, 5, 5, 60, 60, 800, 600)
      expect(p.x).toBe(400) // centered
      expect(p.y).toBe(300) // centered
    })
  })

  // ── 2D: screenToWorld2D ──────────────────────────────────────────

  describe('screenToWorld2D', () => {
    it('maps canvas center to world origin when center is (0,0)', () => {
      const p = screenToWorld2D(400, 300, 0, 0, 60, 60, 800, 600)
      expect(p.x).toBeCloseTo(0)
      expect(p.y).toBeCloseTo(0)
    })

    it('inverts Y axis (higher screen Y → lower world Y)', () => {
      const p = screenToWorld2D(400, 360, 0, 0, 60, 60, 800, 600)
      expect(p.x).toBeCloseTo(0)
      expect(p.y).toBeCloseTo(-1) // 60px down = -1 world unit
    })
  })

  // ── 2D round-trip ────────────────────────────────────────────────

  describe('2D round-trip', () => {
    const cases = [
      { wx: 0, wy: 0, cx: 0, cy: 0, ppuX: 60, ppuY: 60, cw: 800, ch: 600 },
      { wx: 3, wy: -2, cx: 1, cy: 1, ppuX: 80, ppuY: 50, cw: 1024, ch: 768 },
      { wx: -5, wy: 7, cx: -3, cy: 4, ppuX: 120, ppuY: 40, cw: 600, ch: 400 },
    ]

    for (const { wx, wy, cx, cy, ppuX, ppuY, cw, ch } of cases) {
      it(`world(${wx},${wy}) -> screen -> world`, () => {
        const screen = worldToScreen2D(wx, wy, cx, cy, ppuX, ppuY, cw, ch)
        const back = screenToWorld2D(screen.x, screen.y, cx, cy, ppuX, ppuY, cw, ch)
        expect(back.x).toBeCloseTo(wx, 10)
        expect(back.y).toBeCloseTo(wy, 10)
      })
    }
  })
})
