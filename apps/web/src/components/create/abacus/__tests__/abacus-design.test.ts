import { beadColorActive } from '@soroban/abacus-react/color'
import { describe, expect, it } from 'vitest'
import {
  ABACUS_DESIGN_SCHEMA_VERSION,
  physicalColumnsOf,
  toAbacusDesign,
} from '../abacus-design'
import { defaultParams, type Params } from '../abacus-model'

const params = (over: Partial<Params> = {}): Params => ({ ...defaultParams, ...over })

// profileId is an opaque passthrough for toAbacusDesign; the literal doesn't have
// to be a real solver profile for these projection tests.
const PROFILE = 'common'

describe('toAbacusDesign', () => {
  it('stamps the current schema version', () => {
    const d = toAbacusDesign(params(), PROFILE)
    expect(d.schemaVersion).toBe(ABACUS_DESIGN_SCHEMA_VERSION)
    expect(d.schemaVersion).toBe(1)
  })

  it('carries the params and selected profile through verbatim', () => {
    const p = params({ cols: 9, color_scheme: 'heaven-earth' })
    const d = toAbacusDesign(p, 'fine')
    expect(d.params).toEqual(p)
    expect(d.profileId).toBe('fine')
  })

  it('is a pure JSON value (survives a serialize round-trip unchanged)', () => {
    const d = toAbacusDesign(
      params({ cols: 7, color_scheme: 'place-value', color_palette: 'nature' }),
      PROFILE,
    )
    expect(JSON.parse(JSON.stringify(d))).toEqual(d)
  })

  it('does not mutate the params it is handed', () => {
    const p = params({ cols: 5 })
    const snapshot = structuredClone(p)
    toAbacusDesign(p, PROFILE)
    expect(p).toEqual(snapshot)
  })

  it('leaves styleOverlay unset in v1 (reserved slot for the bead-shape morph)', () => {
    expect(toAbacusDesign(params(), PROFILE).styleOverlay).toBeUndefined()
  })

  describe('resolvedColors', () => {
    it('has one column per physical column, keyed by ascending place value', () => {
      const d = toAbacusDesign(params({ cols: 11 }), PROFILE)
      expect(d.resolvedColors.columns).toHaveLength(11)
      d.resolvedColors.columns.forEach((col, k) => expect(col.placeValue).toBe(k))
    })

    it('passes the frame color through intrinsically (frame_color, verbatim)', () => {
      const d = toAbacusDesign(params({ frame_color: '#123456' }), PROFILE)
      expect(d.resolvedColors.frame).toBe('#123456')
    })

    it.each(['monochrome', 'heaven-earth', 'alternating', 'place-value'] as const)(
      "bakes each column's bead colors from the canonical resolver (scheme %s)",
      (scheme) => {
        const p = params({ cols: 13, color_scheme: scheme, color_palette: 'colorblind' })
        const d = toAbacusDesign(p, PROFILE)
        d.resolvedColors.columns.forEach((col) => {
          expect(col.heaven).toBe(
            beadColorActive({ placeValue: col.placeValue, type: 'heaven' }, scheme, 'colorblind'),
          )
          expect(col.earth).toBe(
            beadColorActive({ placeValue: col.placeValue, type: 'earth' }, scheme, 'colorblind'),
          )
        })
      },
    )

    it('records INTRINSIC colors, never AMS filament-snapped ones', () => {
      // frame_color deliberately far from any loaded filament slot; the projection
      // must still carry the exact intrinsic hex (the screen→spool snap is #10).
      const d = toAbacusDesign(params({ frame_color: '#010203' }), PROFILE)
      expect(d.resolvedColors.frame).toBe('#010203')
      // place-value default: column 0 is the raw palette hex, not a spool approx.
      const pv = toAbacusDesign(
        params({ cols: 5, color_scheme: 'place-value', color_palette: 'default' }),
        PROFILE,
      )
      expect(pv.resolvedColors.columns[0].earth).toBe('#2E86AB')
    })

    it('wraps the palette across a wide (21-column) abacus', () => {
      const d = toAbacusDesign(
        params({ cols: 21, color_scheme: 'place-value', color_palette: 'default' }),
        PROFILE,
      )
      // pv 0 and pv 5 both land on palette slot 0
      expect(d.resolvedColors.columns[5].earth).toBe(d.resolvedColors.columns[0].earth)
      expect(d.resolvedColors.columns[20].earth).toBe(
        beadColorActive({ placeValue: 20, type: 'earth' }, 'place-value', 'default'),
      )
    })
  })
})

describe('physicalColumnsOf', () => {
  it('reads the design column count back (the reverse of the columns bridge)', () => {
    expect(physicalColumnsOf(toAbacusDesign(params({ cols: 8 }), PROFILE))).toBe(8)
  })
})
