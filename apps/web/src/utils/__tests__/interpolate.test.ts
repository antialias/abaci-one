import { describe, it, expect } from 'vitest'
import {
  lerp,
  clamp,
  hexToRgb,
  rgbToHex,
  parseRgba,
  lerpColor,
  lerpRgba,
  rgbaToString,
  lerpRgbaString,
  gradientStop,
  lerpGradientStops,
  gradientToCss,
  lerpGradient,
  boxShadow,
  transparentShadow,
  lerpBoxShadowSingle,
  lerpBoxShadows,
  boxShadowToCss,
  boxShadowsToCss,
  lerpBoxShadowString,
  easeOutQuint,
  easeOutQuart,
  windDownProgress,
} from '../interpolate'

// ============================================================================
// Basic Interpolation
// ============================================================================

describe('lerp', () => {
  it('returns start at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10)
  })

  it('returns end at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20)
  })

  it('returns midpoint at t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50)
  })

  it('works with negative numbers', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0)
  })
})

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to min', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps to max', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

// ============================================================================
// Color Parsing & Interpolation
// ============================================================================

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
  })

  it('parses 3-digit hex', () => {
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 })
  })

  it('parses without hash', () => {
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 })
  })

  it('parses black', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('parses white', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
  })
})

describe('rgbToHex', () => {
  it('converts RGB to hex', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000')
  })

  it('pads single digit values', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
  })

  it('clamps out-of-range values', () => {
    expect(rgbToHex(300, -10, 128)).toBe('#ff0080')
  })
})

describe('parseRgba', () => {
  it('parses rgba()', () => {
    const result = parseRgba('rgba(255, 128, 0, 0.5)')
    expect(result).toEqual({ r: 255, g: 128, b: 0, a: 0.5 })
  })

  it('parses rgb() with default alpha', () => {
    const result = parseRgba('rgb(100, 200, 50)')
    expect(result).toEqual({ r: 100, g: 200, b: 50, a: 1 })
  })

  it('parses hex string', () => {
    const result = parseRgba('#ff0000')
    expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })

  it('returns black for unrecognized strings', () => {
    expect(parseRgba('not-a-color')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })
})

describe('lerpColor', () => {
  it('returns start color at t=0', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000')
  })

  it('returns end color at t=1', () => {
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('returns midpoint color at t=0.5', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})

describe('lerpRgba', () => {
  it('interpolates all channels', () => {
    const start = { r: 0, g: 0, b: 0, a: 0 }
    const end = { r: 100, g: 200, b: 50, a: 1 }
    const result = lerpRgba(start, end, 0.5)
    expect(result).toEqual({ r: 50, g: 100, b: 25, a: 0.5 })
  })
})

describe('rgbaToString', () => {
  it('formats rgba string', () => {
    expect(rgbaToString({ r: 255, g: 128, b: 0, a: 0.5 })).toBe(
      'rgba(255, 128, 0, 0.500)'
    )
  })

  it('rounds RGB values', () => {
    expect(rgbaToString({ r: 128.7, g: 64.3, b: 0.1, a: 1 })).toBe(
      'rgba(129, 64, 0, 1.000)'
    )
  })
})

describe('lerpRgbaString', () => {
  it('returns interpolated rgba string', () => {
    const start = { r: 0, g: 0, b: 0, a: 0 }
    const end = { r: 200, g: 100, b: 50, a: 1 }
    const result = lerpRgbaString(start, end, 0.5)
    expect(result).toBe('rgba(100, 50, 25, 0.500)')
  })
})

// ============================================================================
// Gradient Interpolation
// ============================================================================

describe('gradientStop', () => {
  it('creates a gradient stop', () => {
    const stop = gradientStop(255, 0, 0, 1, 50)
    expect(stop).toEqual({
      color: { r: 255, g: 0, b: 0, a: 1 },
      position: 50,
    })
  })
})

describe('lerpGradientStops', () => {
  it('interpolates stops', () => {
    const start = [gradientStop(0, 0, 0, 1, 0)]
    const end = [gradientStop(100, 100, 100, 1, 100)]
    const result = lerpGradientStops(start, end, 0.5)
    expect(result[0].color.r).toBe(50)
    expect(result[0].position).toBe(50)
  })

  it('throws if arrays have different lengths', () => {
    const start = [gradientStop(0, 0, 0, 1, 0)]
    const end = [gradientStop(0, 0, 0, 1, 0), gradientStop(0, 0, 0, 1, 100)]
    expect(() => lerpGradientStops(start, end, 0.5)).toThrow(
      'Gradient stop arrays must have the same length'
    )
  })
})

describe('gradientToCss', () => {
  it('produces valid CSS gradient', () => {
    const stops = [
      gradientStop(255, 0, 0, 1, 0),
      gradientStop(0, 0, 255, 1, 100),
    ]
    const css = gradientToCss(90, stops)
    expect(css).toMatch(/^linear-gradient\(90deg,/)
    expect(css).toContain('rgba(255, 0, 0, 1.000) 0%')
    expect(css).toContain('rgba(0, 0, 255, 1.000) 100%')
  })
})

describe('lerpGradient', () => {
  it('interpolates angle and stops', () => {
    const start = [gradientStop(0, 0, 0, 1, 0)]
    const end = [gradientStop(100, 100, 100, 1, 100)]
    const css = lerpGradient(0, start, 180, end, 0.5)
    expect(css).toMatch(/^linear-gradient\(90deg,/)
  })
})

// ============================================================================
// Box Shadow Interpolation
// ============================================================================

describe('boxShadow', () => {
  it('creates a box shadow', () => {
    const s = boxShadow(1, 2, 3, 4, 255, 0, 0, 0.5, true)
    expect(s).toEqual({
      x: 1, y: 2, blur: 3, spread: 4,
      color: { r: 255, g: 0, b: 0, a: 0.5 },
      inset: true,
    })
  })

  it('defaults inset to false', () => {
    const s = boxShadow(0, 0, 0, 0, 0, 0, 0, 1)
    expect(s.inset).toBe(false)
  })
})

describe('transparentShadow', () => {
  it('creates invisible shadow', () => {
    const s = transparentShadow()
    expect(s.color.a).toBe(0)
    expect(s.blur).toBe(0)
    expect(s.spread).toBe(0)
  })
})

describe('lerpBoxShadowSingle', () => {
  it('interpolates shadow properties', () => {
    const start = boxShadow(0, 0, 0, 0, 0, 0, 0, 0)
    const end = boxShadow(10, 20, 30, 40, 200, 100, 50, 1)
    const result = lerpBoxShadowSingle(start, end, 0.5)
    expect(result.x).toBe(5)
    expect(result.y).toBe(10)
    expect(result.blur).toBe(15)
    expect(result.spread).toBe(20)
    expect(result.color.r).toBe(100)
  })

  it('switches inset at midpoint', () => {
    const start = boxShadow(0, 0, 0, 0, 0, 0, 0, 1, true)
    const end = boxShadow(0, 0, 0, 0, 0, 0, 0, 1, false)
    expect(lerpBoxShadowSingle(start, end, 0.4).inset).toBe(true)
    expect(lerpBoxShadowSingle(start, end, 0.6).inset).toBe(false)
  })
})

describe('lerpBoxShadows', () => {
  it('pads shorter arrays with transparent shadows', () => {
    const start = [boxShadow(10, 10, 10, 10, 255, 0, 0, 1)]
    const end = [
      boxShadow(20, 20, 20, 20, 0, 255, 0, 1),
      boxShadow(5, 5, 5, 5, 0, 0, 255, 1),
    ]
    const result = lerpBoxShadows(start, end, 0)
    expect(result).toHaveLength(2)
    // Second shadow should be transparent (padded)
    expect(result[1].color.a).toBe(0)
  })
})

describe('boxShadowToCss', () => {
  it('formats non-inset shadow', () => {
    const s = boxShadow(1, 2, 3, 4, 255, 0, 0, 1)
    expect(boxShadowToCss(s)).toBe('1px 2px 3px 4px rgba(255, 0, 0, 1.000)')
  })

  it('includes inset keyword', () => {
    const s = boxShadow(0, 0, 10, 0, 0, 0, 0, 0.5, true)
    expect(boxShadowToCss(s)).toMatch(/^inset /)
  })
})

describe('boxShadowsToCss', () => {
  it('returns "none" for all-transparent shadows', () => {
    expect(boxShadowsToCss([transparentShadow()])).toBe('none')
  })

  it('joins multiple shadows with comma', () => {
    const shadows = [
      boxShadow(1, 1, 2, 0, 0, 0, 0, 0.5),
      boxShadow(0, 0, 10, 0, 255, 0, 0, 1),
    ]
    const css = boxShadowsToCss(shadows)
    // Each shadow contains "px ... rgba()" — count by splitting on "px rgba" boundaries
    expect(css).toContain('px')
    // Should have both shadows separated
    const parts = css.split(/\)\s*,\s*(?=\d|inset)/)
    expect(parts.length).toBe(2)
  })
})

describe('lerpBoxShadowString', () => {
  it('returns interpolated CSS string', () => {
    const start = [boxShadow(0, 0, 0, 0, 0, 0, 0, 0)]
    const end = [boxShadow(10, 10, 10, 0, 255, 0, 0, 1)]
    const result = lerpBoxShadowString(start, end, 1)
    expect(result).toContain('10px')
  })
})

// ============================================================================
// Timing Functions
// ============================================================================

describe('easeOutQuint', () => {
  it('returns 0 at t=0', () => {
    expect(easeOutQuint(0)).toBe(0)
  })

  it('returns 1 at t=1', () => {
    expect(easeOutQuint(1)).toBe(1)
  })

  it('is > linear at t=0.5 (ease-out curve)', () => {
    expect(easeOutQuint(0.5)).toBeGreaterThan(0.5)
  })
})

describe('easeOutQuart', () => {
  it('returns 0 at t=0', () => {
    expect(easeOutQuart(0)).toBe(0)
  })

  it('returns 1 at t=1', () => {
    expect(easeOutQuart(1)).toBe(1)
  })

  it('is less aggressive than quint at same t', () => {
    expect(easeOutQuart(0.3)).toBeLessThan(easeOutQuint(0.3))
  })
})

describe('windDownProgress', () => {
  it('returns 0 during burst phase (first 5s)', () => {
    expect(windDownProgress(0)).toBe(0)
    expect(windDownProgress(2500)).toBe(0)
    expect(windDownProgress(4999)).toBe(0)
  })

  it('returns 1 after full wind-down (60s)', () => {
    expect(windDownProgress(60_000)).toBe(1)
    expect(windDownProgress(120_000)).toBe(1)
  })

  it('returns value between 0 and 1 during wind-down', () => {
    const progress = windDownProgress(30_000)
    expect(progress).toBeGreaterThan(0)
    expect(progress).toBeLessThan(1)
  })
})
