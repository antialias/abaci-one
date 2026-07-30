/**
 * Where the perimeter writing goes, and how big it prints (Gitea #28).
 *
 * This file exists because the rail geometry had NO test coverage at all: not a
 * coordinate, not a span, not a glyph size, and no headless OpenSCAD anywhere in
 * the repo to check the real thing against. The mirror is the risk —
 * `AbacusStudioViewer.swapPlug` tints each plug triangle by its nearest
 * `tokenCenters` centroid, so a layout change that isn't mirrored produces a
 * plausible-but-wrong preview with no error and no failure. Likewise the plate:
 * `definesFrom` and the ink partition both read `textSlots`, so if placement and
 * geometry ever disagree the 3MF inks the wrong rail.
 *
 * The single most important assertion in here is the compatibility pin: at the
 * default 13 columns, deriving placement must reproduce the old fixed layout
 * byte for byte. Everything else is a refinement that only shows up below 6
 * columns; that one is "we didn't break every abacus printed so far".
 */
import { describe, expect, it } from 'vitest'
import {
  AIDS,
  aidNote,
  defaultParams,
  definesFrom,
  estimateRailGlyphMm,
  inkFraction,
  type Params,
  placeAids,
  ROTATE_BELOW_MM,
  railFits,
  SMALL_PRINT_MM,
  slotGeom,
  slotSpan,
  TEXT_SLOTS,
  type TextSlot,
  textGroupCount,
  textSlots,
  tokenCenters,
} from '../abacus-model'

const at = (cols: number, over: Partial<Params> = {}): Params => ({
  ...defaultParams,
  cols,
  ...over,
})
const where = (p: Params, key: 'aid_10' | 'aid_5'): TextSlot | null =>
  placeAids(p).find((x) => x.aid.key === key)?.slot ?? null
const reasonOf = (p: Params, key: 'aid_10' | 'aid_5') =>
  placeAids(p).find((x) => x.aid.key === key)?.reason
const lengths = (p: Params) => textSlots(p).map((t) => t.length)

describe('the compatibility pin — deriving placement reproduces the old layout', () => {
  it('puts friends-of-10 on top and friends-of-5 on the bottom at the default 13 columns', () => {
    // This IS the pre-#28 layout (top_preset friends-of-10, bottom friends-of-5,
    // sides blank). Every abacus printed so far looks like this and must keep
    // looking like this.
    expect(lengths(defaultParams)).toEqual([5, 4, 0, 0, 0, 0, 0, 0])
    expect(where(defaultParams, 'aid_10')).toBe('top')
    expect(where(defaultParams, 'aid_5')).toBe('bottom')
    expect(reasonOf(defaultParams, 'aid_10')).toBe('preferred')
  })

  it('holds from 6 columns up — the whole range where the glyph cap binds first', () => {
    for (let cols = 6; cols <= 21; cols++) {
      expect(lengths(at(cols)), `${cols} columns`).toEqual([5, 4, 0, 0, 0, 0, 0, 0])
    }
  })

  it('emits the same eight -D token vectors the scad has always taken', () => {
    const defines = definesFrom(defaultParams)
    expect(defines).toContain('-Dtext_top=[["1+9",0],["2+8",0],["3+7",0],["4+6",0],["5+5",0]]')
    expect(defines).toContain('-Dtext_bottom=[["1+4",0],["2+3",0],["3+2",0],["4+1",0]]')
    expect(defines).toContain('-Dtext_left=[]')
    expect(defines).toContain('-Dedge_front=[]')
    // and no `-Dtop_preset=` survives: the scad never had such a param
    expect(defines.some((d) => d.includes('_preset'))).toBe(false)
  })
})

describe('rail geometry — why the sides are the answer', () => {
  it('grows the top rail with the column count but never the sides', () => {
    // The fact the whole design rests on: s_fd (field DEPTH) has no `cols` term,
    // so outer_d — and therefore the left/right span — is column-independent,
    // while the top/bottom span grows ~13 mm per column. Below the crossover the
    // sides are simply the bigger rails.
    const span = (cols: number, slot: TextSlot) =>
      slotSpan(slotGeom(at(cols))[TEXT_SLOTS.indexOf(slot)])
    expect(span(13, 'left')).toBeCloseTo(span(4, 'left'), 6)
    expect(span(21, 'left')).toBeCloseTo(span(4, 'left'), 6)
    expect(span(13, 'top')).toBeGreaterThan(span(4, 'top'))
    // crossover: at 4 columns a side rail is the roomier one, at 13 the top is
    expect(span(4, 'left')).toBeGreaterThan(span(4, 'top'))
    expect(span(13, 'left')).toBeLessThan(span(13, 'top'))
  })

  it('fits five facts on a side rail at EVERY column count', () => {
    // which is what makes relocation the fix, rather than splitting five facts
    // around a corner where a child can't follow the sequence
    for (let cols = 3; cols <= 21; cols++) {
      expect(railFits(at(cols), 'left', AIDS[0].tokens), `${cols} columns`).toBe(true)
      expect(railFits(at(cols), 'right', AIDS[0].tokens), `${cols} columns`).toBe(true)
    }
  })
})

describe('the gap bound — m/(m+1) instead of a flat 92%', () => {
  it('leaves one full character advance between tokens, not a quarter of one', () => {
    // The bug: 92% of pitch spent on a 3-glyph token makes one advance
    // 0.307·pitch and the gap 0.26 advances — tighter than the space around the
    // `+` inside `1+9`, so `1+9 2+8` reads as one number. m/(m+1) makes the gap
    // exactly one advance by construction, for any glyph count.
    for (const m of [1, 2, 3, 5, 8]) {
      const ink = 2 * inkFraction(m) // full-width fraction of pitch
      const advance = ink / m
      expect((1 - ink) / advance).toBeCloseTo(1, 6)
    }
    // the old constant, for the record: a 3-glyph token got 0.26 of an advance
    expect((1 - 0.92) / (0.92 / 3)).toBeCloseTo(0.26, 2)
  })

  it('costs nothing where the glyph cap already binds — 7 columns and up', () => {
    // the tighter bound only ever shows up on rails that were width-limited, and
    // from 7 columns the pitch (≈17 mm for a 5-fact rail) is wide enough that
    // text_size caps first. 6 is the one column count where it takes a real bite:
    // 6.0 → ~5.1 mm, in exchange for the gap the facts needed.
    for (let cols = 7; cols <= 21; cols++) {
      expect(estimateRailGlyphMm(at(cols), 'top', AIDS[0].tokens), `${cols} columns`).toBe(
        defaultParams.text_size
      )
    }
    expect(estimateRailGlyphMm(at(6), 'top', AIDS[0].tokens)).toBeLessThan(defaultParams.text_size)
  })

  it('shrinks monotonically as the rail shortens, which is what triggers relocation', () => {
    const mm = [4, 5, 6, 7].map((c) => estimateRailGlyphMm(at(c), 'top', AIDS[0].tokens))
    expect(mm).toEqual([...mm].sort((a, b) => a - b))
    // 4 and 5 columns both fall under the rotate floor; 6 clears it — the exact
    // crossover, pinned so a metric change can't move it silently
    expect(mm[0]).toBeLessThan(ROTATE_BELOW_MM)
    expect(mm[1]).toBeLessThan(ROTATE_BELOW_MM)
    expect(estimateRailGlyphMm(at(6), 'top', AIDS[0].tokens)).toBeGreaterThanOrEqual(
      ROTATE_BELOW_MM
    )
  })

  it('keeps the crossover off a cliff — a few percent of metric error cannot move it', () => {
    // EM_HALF_ADVANCE is measured off the shipped TTF, but it IS an estimate, so
    // the two column counts that decide the layout must not sit on the threshold.
    const five = estimateRailGlyphMm(at(5), 'top', AIDS[0].tokens)
    const six = estimateRailGlyphMm(at(6), 'top', AIDS[0].tokens)
    expect(ROTATE_BELOW_MM - five).toBeGreaterThan(0.05 * ROTATE_BELOW_MM)
    expect(six - ROTATE_BELOW_MM).toBeGreaterThan(0.05 * ROTATE_BELOW_MM)
  })

  it('never grows a rail past text_size — the knob is a MAXIMUM', () => {
    for (const slot of TEXT_SLOTS) {
      expect(estimateRailGlyphMm(at(21), slot, ['1'])).toBe(defaultParams.text_size)
    }
  })
})

describe('placeAids', () => {
  it('moves friends-of-10 to a side below the crossover, and says why', () => {
    const p = at(4)
    expect(where(p, 'aid_10')).toBe('left')
    expect(reasonOf(p, 'aid_10')).toBe('moved')
    const note = aidNote(p, placeAids(p)[0]) ?? ''
    expect(note).toContain('left side')
    expect(note).toContain('4 columns')
    expect(note).toContain('bottom→top') // the cost of a rotated rail, disclosed
    // and it isn't small there, so the caption must NOT also warn about size
    expect(note).not.toContain('print small')
  })

  it('rotates BOTH aids where neither horizontal rail is worth keeping', () => {
    // 3 and 4 columns: the top/bottom rails give ~2.3–4.1 mm against ~5–6 mm on
    // the sides, so a rotated read is plainly the better deal for both.
    for (const cols of [3, 4]) {
      const p = at(cols)
      expect(where(p, 'aid_10'), `${cols} columns`).toBe('left')
      expect(where(p, 'aid_5'), `${cols} columns`).toBe('right')
      expect(lengths(p)).toEqual([0, 0, 5, 4, 0, 0, 0, 0])
    }
  })

  it('moves the aids as a PAIR — never one rotated and one horizontal', () => {
    // Left + bottom is an L around one corner: it reads as an accident rather
    // than a layout. 5 columns is the case that produced it, because the two aids
    // cross the rotate floor at different column counts (friends-of-5 is one fact
    // shorter, so it gets a wider pitch on the same rail and clears the bottom at
    // 5 while friends-of-10 still can't hold the top). The axis rule keeps them
    // mirrored instead.
    const five = at(5)
    expect(where(five, 'aid_10')).toBe('left')
    expect(where(five, 'aid_5')).toBe('right')
    // and it cost friends-of-5 nothing to come along — the right side is the
    // BIGGER rail here, which is precisely why the rotation is allowed
    expect(estimateRailGlyphMm(five, 'right', AIDS[1].tokens)).toBeGreaterThan(
      estimateRailGlyphMm(five, 'bottom', AIDS[1].tokens)
    )
    // no column count splits the pair across the two axes
    for (let cols = 3; cols <= 21; cols++) {
      const [ten, fives] = placeAids(at(cols))
      const sideways = (s: string | null): boolean => s === 'left' || s === 'right'
      expect(sideways(ten.slot), `${cols} columns`).toBe(sideways(fives.slot))
    }
  })

  it('symmetry is never bought with legibility', () => {
    // The pair only rotates when no aid LOSES glyph size by it. From 6 columns up
    // the horizontal rails are strictly roomier, so nothing moves — this is also
    // the guard on the compatibility pin above.
    expect(where(at(6), 'aid_10')).toBe('top')
    expect(reasonOf(at(6), 'aid_10')).toBe('preferred')
    for (let cols = 6; cols <= 21; cols++) {
      const p = at(cols)
      expect(where(p, 'aid_10'), `${cols} columns`).toBe('top')
      expect(where(p, 'aid_5'), `${cols} columns`).toBe('bottom')
      // ...because horizontal really is the roomier axis there
      expect(estimateRailGlyphMm(p, 'top', AIDS[0].tokens)).toBeGreaterThanOrEqual(
        estimateRailGlyphMm(p, 'left', AIDS[0].tokens)
      )
    }
  })

  it('a pinned aid announces the pin and names the automatic alternative', () => {
    // The bug this closes is a UI one: "right side" and "auto — right side" differ
    // by nine characters, and that was the ONLY signal that a rail had been chosen
    // by hand. So the placement carries `autoSlot` whatever the intent, and the
    // caption spends a clause on it.
    const p = at(19, { aid_5: 'right' })
    const fives = placeAids(p)[1]
    expect(fives.slot).toBe('right')
    expect(fives.reason).toBe('asked')
    expect(fives.autoSlot).toBe('bottom') // where letting go would put it
    const note = aidNote(p, fives) ?? ''
    expect(note).toContain('you pinned it there')
    expect(note).toContain('bottom rail')
    // an aid that is merely off still reports its automatic answer, so the select
    // can offer it without the user having to switch to find out
    expect(placeAids(at(19, { aid_5: 'off' }))[1].autoSlot).toBe('bottom')
    expect(placeAids(at(4, { aid_10: 'off' }))[0].autoSlot).toBe('left')
    // and on 'auto' the two agree by construction — one derivation, not two
    for (const cols of [4, 5, 13]) {
      for (const pl of placeAids(at(cols))) expect(pl.autoSlot).toBe(pl.slot)
    }
    // a pin the automatic rule would have chosen anyway gets no redundant clause
    expect(
      aidNote(at(19, { aid_5: 'bottom' }), placeAids(at(19, { aid_5: 'bottom' }))[1])
    ).not.toContain('would use')
  })

  it('gives a rail to the user words that are in it — words win', () => {
    const p = at(4, { left_text: 'ADA' })
    expect(where(p, 'aid_10')).toBe('right')
    expect(textSlots(p)[2]).toEqual([['ADA', 0]])
    // clearing the words hands the rail back
    expect(where(at(4, { left_text: '' }), 'aid_10')).toBe('left')
    // whitespace is not words (tokenize drops it), so it doesn't claim a rail
    expect(where(at(4, { left_text: '   ' }), 'aid_10')).toBe('left')
  })

  it('honours a rail you named, cramped or not, instead of overruling you', () => {
    const p = at(4, { aid_10: 'top' })
    const place = placeAids(p).find((x) => x.aid.key === 'aid_10')
    expect(place?.slot).toBe('top')
    expect(place?.reason).toBe('asked')
    expect(place?.fits).toBe(false)
    // …but it says the writing will be small rather than pretending otherwise
    expect(aidNote(p, place!) ?? '').toContain('print small')
  })

  it('still prints on the only rail left, and admits it will be small', () => {
    // words have taken every good rail; small writing beats no writing, but the
    // caption has to say which it is rather than reporting success
    const p = at(4, { aid_5: 'off', left_text: 'a', right_text: 'b', bottom_text: 'c' })
    const place = placeAids(p).find((x) => x.aid.key === 'aid_10')!
    expect(place.slot).toBe('top')
    expect(place.mm).toBeLessThan(SMALL_PRINT_MM)
    expect(place.fits).toBe(false)
    expect(textSlots(p)[0]).toHaveLength(5)
    expect(aidNote(p, place) ?? '').toContain('print small')
  })

  it('places nothing rather than crowding two aids onto one rail', () => {
    // nine facts concatenated onto one rail would be worse than absent, so the
    // aid drops out and the caption says the rails are full
    const p = at(13, { top_text: 'a', bottom_text: 'b', left_text: 'c', right_text: 'd' })
    for (const aid of AIDS) expect(where(p, aid.key)).toBeNull()
    expect(lengths(p)).toEqual([1, 1, 1, 1, 0, 0, 0, 0])
    const note = aidNote(p, placeAids(p)[0]) ?? ''
    expect(note).toContain('Nowhere')
  })

  it('never puts both aids on the same rail, at any column count', () => {
    for (let cols = 3; cols <= 21; cols++) {
      const slots = placeAids(at(cols))
        .map((x) => x.slot)
        .filter((s): s is TextSlot => s !== null)
      expect(new Set(slots).size, `${cols} columns`).toBe(slots.length)
    }
  })

  it("'off' empties the rail without freeing it to the other aid's second choice", () => {
    const p = at(13, { aid_10: 'off' })
    expect(where(p, 'aid_10')).toBeNull()
    expect(where(p, 'aid_5')).toBe('bottom')
    expect(lengths(p)).toEqual([0, 4, 0, 0, 0, 0, 0, 0])
    expect(aidNote(p, placeAids(p)[0])).toBeNull()
    const both = at(13, { aid_10: 'off', aid_5: 'off' })
    expect(textSlots(both).every((t) => t.length === 0)).toBe(true)
  })

  it('says nothing when there is nothing to say', () => {
    // the default layout needs no caption: it's the obvious one, read the obvious way
    for (const place of placeAids(defaultParams)) {
      expect(aidNote(defaultParams, place)).toBeNull()
    }
  })

  it('treats an unrecognized intent as auto rather than dropping the writing', () => {
    // a hand-edited param or a future value shouldn't silently blank a rail
    const p = at(13, { aid_10: 'sideways' })
    expect(where(p, 'aid_10')).toBe('top')
  })
})

describe('what placement does to the plate', () => {
  it('keeps the ink-group count when an aid relocates', () => {
    // textGroupCount is min(5, longest rail), which follows the aid wherever it
    // goes — the reason splitting one aid as 3+2 was rejected: THAT would drop
    // the plate to 3 groups and recolour it.
    expect(textGroupCount(at(4))).toBe(textGroupCount(at(13)))
    expect(textGroupCount(at(4))).toBe(5)
  })

  it('mirrors the relocated layout into tokenCenters — the swapPlug contract', () => {
    // swapPlug tints each plug triangle by its NEAREST centroid, so a layout the
    // mirror doesn't know about mis-tints the preview with nothing to catch it.
    const p = at(4) // both aids rotated: left = friends-of-10, right = friends-of-5
    const slots = textSlots(p)
    const centers = tokenCenters(p)
    expect(centers).toHaveLength(slots.reduce((n, t) => n + t.length, 0))
    // per-slot index restarts at 0 for each occupied rail
    expect(centers.map((c) => c.k)).toEqual([0, 1, 2, 3, 4, 0, 1, 2, 3])
    // the relocated facts really are on the side rails: constant x each, and the
    // scad's reading directions — left runs bottom→top, right runs top→bottom
    const left = centers.slice(0, 5)
    const right = centers.slice(5)
    expect(new Set(left.map((c) => c.x.toFixed(6))).size).toBe(1)
    expect(new Set(right.map((c) => c.x.toFixed(6))).size).toBe(1)
    expect(left[0].x).toBeLessThan(right[0].x)
    expect(left.map((c) => c.y)).toEqual([...left.map((c) => c.y)].sort((a, b) => a - b))
    expect(right.map((c) => c.y)).toEqual([...right.map((c) => c.y)].sort((a, b) => b - a))
  })

  it('re-derives placement from params alone — no hidden state between reads', () => {
    // 'auto' resolves on every read and writes nothing back, which is what keeps
    // hydrating a saved design from mutating it (or its content hash)
    const p = at(4)
    const before = JSON.stringify(p)
    expect(lengths(p)).toEqual(lengths(p))
    expect(JSON.stringify(p)).toBe(before)
  })
})
