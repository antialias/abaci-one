import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MusicStaff } from '../MusicStaff'
import type { Clef, PitchClass } from '../noteUtils'

function staffOf(props: {
  pitchClass: PitchClass
  octave: number
  clef: Clef
  width?: number
  height?: number
  showClef?: boolean
  accidental?: 'sharp' | 'flat' | 'natural'
}) {
  const { container } = render(<MusicStaff width={100} height={70} {...props} />)
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('no svg rendered')
  return svg
}

/** Every x/y the SVG actually draws at, from paths, lines and rects alike. */
function drawnPoints(svg: SVGElement): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []

  for (const path of svg.querySelectorAll('path')) {
    const d = path.getAttribute('d') ?? ''
    // Commands are "M x y", "L x y" or "C x1 y1 x2 y2 x y" — read them in pairs.
    for (const match of d.matchAll(/[MLC]([-\d.\s]+)/g)) {
      const nums = match[1].trim().split(/\s+/).map(Number)
      for (let i = 0; i + 1 < nums.length; i += 2) points.push({ x: nums[i], y: nums[i + 1] })
    }
  }
  for (const line of svg.querySelectorAll('line')) {
    const n = (a: string) => Number(line.getAttribute(a))
    points.push({ x: n('x1'), y: n('y1') }, { x: n('x2'), y: n('y2') })
  }
  for (const rect of svg.querySelectorAll('rect')) {
    const n = (a: string) => Number(rect.getAttribute(a))
    points.push({ x: n('x'), y: n('y') }, { x: n('x') + n('width'), y: n('y') + n('height') })
  }
  return points
}

describe('MusicStaff', () => {
  it('draws the clefs as real outlines, not as font characters', () => {
    // U+1D11E is absent from most system fonts, so the previous <text> approach
    // rendered a missing-glyph box on plenty of machines.
    for (const clef of ['treble', 'bass'] as const) {
      const svg = staffOf({ pitchClass: 'E', octave: clef === 'treble' ? 4 : 3, clef })
      const path = svg.querySelector('[data-element="clef"]')
      expect(path?.tagName.toLowerCase()).toBe('path')
      expect(path?.getAttribute('data-clef-glyph')).toBe(clef === 'treble' ? 'gClef' : 'fClef')
      expect(path?.getAttribute('d')).toMatch(/^M[-\d.]/)
    }
  })

  it('omits the clef when asked to', () => {
    const svg = staffOf({ pitchClass: 'E', octave: 4, clef: 'treble', showClef: false })
    expect(svg.querySelector('[data-element="clef"]')).toBeNull()
  })

  it('always gives the note a head and a stem', () => {
    // A filled notehead with no stem — what this used to draw in the PDF — is
    // not a note of any duration.
    const svg = staffOf({ pitchClass: 'G', octave: 4, clef: 'treble' })
    expect(svg.querySelector('[data-element="notehead"]')).not.toBeNull()
    expect(svg.querySelector('[data-element="stem"]')).not.toBeNull()
  })

  it('turns the stem down at and above the middle line', () => {
    const dir = (pitchClass: PitchClass, octave: number) =>
      staffOf({ pitchClass, octave, clef: 'treble' })
        .querySelector('[data-element="stem"]')
        ?.getAttribute('data-stem-direction')

    expect(dir('A', 4)).toBe('up') // position 3, below the middle line
    expect(dir('B', 4)).toBe('down') // position 4, the middle line
    expect(dir('C', 4)).toBe('up') // middle C, well below
  })

  it('draws a ledger line only when the note leaves the staff', () => {
    const ledgers = (pitchClass: PitchClass, octave: number, clef: Clef) =>
      staffOf({ pitchClass, octave, clef }).querySelectorAll('line').length - 5 // less the staff

    expect(ledgers('E', 4, 'treble')).toBe(0) // bottom line
    expect(ledgers('C', 4, 'treble')).toBe(1) // middle C, one below
    expect(ledgers('A', 5, 'treble')).toBe(1) // one above
    expect(ledgers('C', 4, 'bass')).toBe(1) // middle C sits above a bass staff
  })

  /**
   * The overflow guard. A correctly-drawn G clef is nearly twice the height of
   * the staff, so a component that scales to the staff alone spills the clef
   * out of its own box and over whatever is laid out next to it.
   */
  it.each([
    ['treble, on the staff', 'B' as PitchClass, 4, 'treble' as Clef],
    ['treble, middle C below', 'C' as PitchClass, 4, 'treble' as Clef],
    ['treble, high ledger', 'A' as PitchClass, 5, 'treble' as Clef],
    ['bass, on the staff', 'D' as PitchClass, 3, 'bass' as Clef],
    ['bass, middle C above', 'C' as PitchClass, 4, 'bass' as Clef],
  ])('keeps every mark inside the viewBox: %s', (_label, pitchClass, octave, clef) => {
    const width = 100
    const height = 70
    const svg = staffOf({ pitchClass, octave, clef, width, height })
    const points = drawnPoints(svg)
    expect(points.length).toBeGreaterThan(10)

    for (const p of points) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
      expect(p.x).toBeGreaterThanOrEqual(-0.5)
      expect(p.x).toBeLessThanOrEqual(width + 0.5)
      expect(p.y).toBeGreaterThanOrEqual(-0.5)
      expect(p.y).toBeLessThanOrEqual(height + 0.5)
    }
  })

  /**
   * The matching game shows a row of these at once, so the staff has to land in
   * the same place at the same size on every card. Fitting each card to its own
   * note makes the staff jump around between cards and makes two notes harder
   * to compare.
   */
  it('puts the staff in the same place whatever the note or clef is', () => {
    const staffLines = (pitchClass: PitchClass, octave: number, clef: Clef) =>
      [...staffOf({ pitchClass, octave, clef }).querySelectorAll('line')]
        .slice(0, 5)
        .map((l) => Number(l.getAttribute('y1')))

    const reference = staffLines('B', 4, 'treble')
    for (const [pitchClass, octave, clef] of [
      ['C', 4, 'treble'], // middle C, a ledger line below
      ['F', 5, 'treble'], // top line
      ['A', 5, 'treble'], // a ledger line above
      // The game deals treble and bass cards together, and pairs one of each
      // side by side, so the two clefs have to agree on the staff as well.
      ['D', 3, 'bass'],
      ['C', 4, 'bass'],
    ] as Array<[PitchClass, number, Clef]>) {
      expect(staffLines(pitchClass, octave, clef), `${pitchClass}${octave} ${clef}`).toEqual(
        reference
      )
    }
  })

  it('scales its marks with the box rather than pinning them to pixels', () => {
    // Note head, ledger lines and stem were previously fixed pixel sizes, so
    // they stayed put while the staff around them grew.
    const small = staffOf({ pitchClass: 'C', octave: 4, clef: 'treble', width: 100, height: 70 })
    const large = staffOf({ pitchClass: 'C', octave: 4, clef: 'treble', width: 200, height: 140 })

    const stemHeight = (svg: SVGElement) =>
      Number(svg.querySelector('[data-element="stem"]')?.getAttribute('height'))
    expect(stemHeight(large)).toBeCloseTo(stemHeight(small) * 2, 4)
  })

  it('labels itself for the debug tooling', () => {
    const svg = staffOf({ pitchClass: 'F', octave: 4, clef: 'treble', accidental: 'sharp' })
    expect(svg.getAttribute('data-component')).toBe('MusicStaff')
    expect(svg.getAttribute('data-clef')).toBe('treble')
    expect(svg.getAttribute('data-note')).toBe('F4')
    expect(svg.querySelector('[data-element="accidental"]')?.textContent).toBe('♯')
  })
})
