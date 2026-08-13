/**
 * Shared placement and path-walking for the Bravura outlines in
 * `smuflGlyphs.ts`.
 *
 * Two renderers draw the same staff: the on-screen SVG (`MusicStaff.tsx`) and
 * the printable PDF (`api/create/music-flashcards/route.ts`). They used to
 * carry independent, hand-tuned constants and had drifted — the PDF drew a
 * Helvetica "G" for a treble clef, the SVG anchored its bass clef to the middle
 * line instead of the F line, and neither drew stems. Everything positional now
 * lives here, so a fix lands in both at once.
 *
 * Coordinate conventions, matching both SVG and jsPDF:
 *   - y increases downward
 *   - staff positions count half-spaces from the bottom line: 0 = bottom line,
 *     8 = top line, odd numbers are the spaces between, and anything outside
 *     0..8 needs ledger lines
 */
import { type Clef, getStemDirection } from './noteUtils'
import { ENGRAVING, type GlyphCommand, SMUFL_GLYPHS, type SmuflGlyph } from './smuflGlyphs'

/**
 * How a staff is scaled and placed. `halfSpace` is the distance between
 * adjacent staff positions, i.e. HALF the distance between two staff lines —
 * both call sites already had this quantity, under the name `lineGap`.
 */
export interface StaffMetrics {
  /** y of the top staff line (position 8). */
  staffTop: number
  halfSpace: number
}

/** A glyph origin in user space, plus the scale to draw its outline at. */
export interface GlyphPlacement {
  x: number
  y: number
  /** User-space length of one staff space. */
  scale: number
}

/** Anything that can receive a path. jsPDF's document satisfies this as-is. */
export interface PathSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void
  close(): void
}

/** y of a staff position. Position 8 is the top line, so positions count down. */
export function positionY(m: StaffMetrics, position: number): number {
  return m.staffTop + (8 - position) * m.halfSpace
}

/** User-space size of one staff space (two positions). */
export function staffSpace(m: StaffMetrics): number {
  return m.halfSpace * 2
}

export function clefGlyph(clef: Clef): SmuflGlyph {
  return clef === 'treble' ? SMUFL_GLYPHS.gClef : SMUFL_GLYPHS.fClef
}

/** The staff position a clef's origin marks — the line the clef names. */
function clefOriginPosition(glyph: SmuflGlyph): number {
  if (glyph.originPosition === null) {
    throw new Error(`${glyph.smuflName} has no originPosition and cannot be placed as a clef`)
  }
  return glyph.originPosition
}

/**
 * Places a clef with its left edge at `left`.
 *
 * The vertical placement needs no per-clef tuning: a clef is *defined* by the
 * staff line its origin marks (G clef → the G line, F clef → the F line), and
 * the extracted glyphs record that as `originPosition`. This is what replaced
 * the two renderers' magic multipliers.
 */
export function placeClef(m: StaffMetrics, clef: Clef, left: number): GlyphPlacement {
  const glyph = clefGlyph(clef)
  const scale = staffSpace(m)
  return {
    // bbox.left is ~0 for both clefs but is not assumed to be.
    x: left - glyph.bbox.left * scale,
    y: positionY(m, clefOriginPosition(glyph)),
    scale,
  }
}

/**
 * Places a notehead centred horizontally on `centerX` and vertically on its
 * staff position. The glyph origin is at the notehead's left edge and on its
 * vertical centre, so only x needs adjusting.
 */
export function placeNotehead(m: StaffMetrics, position: number, centerX: number): GlyphPlacement {
  const scale = staffSpace(m)
  const glyph = SMUFL_GLYPHS.noteheadBlack
  const width = glyph.bbox.right - glyph.bbox.left
  return {
    x: centerX - (glyph.bbox.left + width / 2) * scale,
    y: positionY(m, position),
    scale,
  }
}

/**
 * The stem rectangle for a notehead, or null if the caller wants none.
 *
 * A filled notehead with no stem is not a valid note of any duration, which is
 * what the PDF was drawing. Attachment uses Bravura's own `stemUpSE` /
 * `stemDownNW` anchors, so the stem meets the notehead exactly where the font
 * designer intended rather than at an eyeballed offset.
 */
export function stemRect(
  m: StaffMetrics,
  position: number,
  head: GlyphPlacement
): { x: number; y: number; width: number; height: number; direction: 'up' | 'down' } {
  const glyph = SMUFL_GLYPHS.noteheadBlack
  const direction = getStemDirection(position)
  const width = ENGRAVING.stemThickness * head.scale
  const length = ENGRAVING.stemLength * head.scale

  const anchor = direction === 'up' ? glyph.anchors.stemUpSE : glyph.anchors.stemDownNW
  const attachX = head.x + anchor[0] * head.scale
  const attachY = head.y + anchor[1] * head.scale

  return {
    // The anchor marks the outer corner of the stem, so the rectangle hangs
    // inward from it: leftward for an up-stem, rightward for a down-stem.
    x: direction === 'up' ? attachX - width : attachX,
    y: direction === 'up' ? attachY - length : attachY,
    width,
    height: length,
    direction,
  }
}

/**
 * Vertical extent, in staff positions, that something occupies when drawn.
 * `top` is the highest position reached, `bottom` the lowest.
 *
 * Callers need this to size a card *before* choosing a scale, so it is
 * expressed in unit-free positions rather than user space. It matters more
 * than it looks: a real G clef spans about fourteen half-spaces, nearly twice
 * the staff itself, so a layout sized only for the staff and its notes will
 * clip the clef off the top of the page.
 */
export interface PositionExtent {
  top: number
  bottom: number
}

export function unionExtents(...extents: PositionExtent[]): PositionExtent {
  return {
    top: Math.max(...extents.map((e) => e.top)),
    bottom: Math.min(...extents.map((e) => e.bottom)),
  }
}

/**
 * A glyph's extent around its origin. bbox is y-down in staff spaces while
 * positions count upward in half-spaces, hence the negation and the doubling.
 */
function glyphExtent(glyph: SmuflGlyph, originPosition: number): PositionExtent {
  return {
    top: originPosition - glyph.bbox.top * 2,
    bottom: originPosition - glyph.bbox.bottom * 2,
  }
}

export function clefExtent(clef: Clef): PositionExtent {
  const glyph = clefGlyph(clef)
  return glyphExtent(glyph, clefOriginPosition(glyph))
}

/**
 * Room enough for either clef.
 *
 * The two are nothing like the same height — a G clef spills well past the
 * staff at both ends while an F clef stays inside it — so a treble card and a
 * bass card fitted to their own clefs come out at noticeably different scales.
 * The matching game deals both at once, and pairs one of each side by side, so
 * a single card cannot be allowed to pick its own scale.
 */
export const ANY_CLEF_EXTENT: PositionExtent = unionExtents(
  clefExtent('treble'),
  clefExtent('bass')
)

/** Extent of a full note — notehead plus the stem attached to it. */
export function noteExtent(position: number): PositionExtent {
  const glyph = SMUFL_GLYPHS.noteheadBlack
  const head = glyphExtent(glyph, position)
  const direction = getStemDirection(position)
  const anchor = direction === 'up' ? glyph.anchors.stemUpSE : glyph.anchors.stemDownNW
  // Anchor y is y-down in staff spaces; positions count upward in half-spaces.
  const attach = position - anchor[1] * 2
  const stemTip =
    direction === 'up' ? attach + ENGRAVING.stemLength * 2 : attach - ENGRAVING.stemLength * 2
  return unionExtents(head, { top: stemTip, bottom: stemTip })
}

/** The staff itself: bottom line to top line. */
export const STAFF_EXTENT: PositionExtent = { top: 8, bottom: 0 }

/** Extent of every note in an inclusive range of positions. */
export function noteRangeExtent(lowest: number, highest: number): PositionExtent {
  const extents: PositionExtent[] = []
  for (let p = Math.floor(lowest); p <= Math.ceil(highest); p++) extents.push(noteExtent(p))
  return unionExtents(...extents)
}

/**
 * The note range a single-note staff reserves room for whether or not the note
 * needs it — a ledger line either side of the staff, which is what beginner
 * material uses.
 *
 * Reserving a fixed range is what keeps a row of cards on a common scale. Fit
 * each card to its own note instead and the staff visibly changes size and
 * height from card to card, which looks broken when several are on screen at
 * once and makes two notes harder to compare.
 */
export const COMMON_NOTE_RANGE = { lowest: -3, highest: 11 } as const

/**
 * Minimum staff width, counted in staff spaces.
 *
 * A G clef is 2.7 staff spaces wide, so a staff scaled purely to fill the
 * available height ends up only about five spaces wide with the clef covering
 * half of it and running over the note. Nine spaces leaves the clef roughly a
 * third of the staff, which is about what engraved music looks like.
 */
export const MIN_STAFF_SPACES = 9

/** The largest `halfSpace` at which `staffWidth` still fits a clef and a note. */
export function halfSpaceForWidth(staffWidth: number): number {
  return staffWidth / (MIN_STAFF_SPACES * 2)
}

export interface StaffFit {
  /** Vertical space the staff and everything around it may occupy. */
  availableHeight: number
  /** y of the top of that space. */
  top: number
  /** Everything that will be drawn, so none of it lands outside. */
  extent: PositionExtent
  /** Additional upper bounds on `halfSpace` — width limits, absolute caps. */
  maxHalfSpace?: number[]
}

/**
 * Chooses a scale that fits `extent` into the available height and centres it.
 *
 * Both renderers need exactly this and used to do it separately with different
 * constants, which is how the on-screen staff and the printed one drifted
 * apart.
 */
export function fitStaff({
  availableHeight,
  top,
  extent,
  maxHalfSpace = [],
}: StaffFit): StaffMetrics {
  const spanUnits = extent.top - extent.bottom
  const halfSpace = Math.min(availableHeight / spanUnits, ...maxHalfSpace)
  const contentTop = top + (availableHeight - spanUnits * halfSpace) / 2
  // contentTop is the y of the highest drawn position; step down to position 8.
  return { halfSpace, staffTop: contentTop + (extent.top - 8) * halfSpace }
}

/** Half-width of a ledger line, from Bravura's `legerLineExtension`. */
export function ledgerHalfWidth(m: StaffMetrics): number {
  const glyph = SMUFL_GLYPHS.noteheadBlack
  const space = staffSpace(m)
  const headWidth = (glyph.bbox.right - glyph.bbox.left) * space
  return headWidth / 2 + ENGRAVING.legerLineExtension * space
}

/**
 * Walks a glyph outline into a sink.
 *
 * All subpaths go into a single path so that one fill covers the whole glyph:
 * with nonzero winding that is what keeps counters — the eye of a G clef, the
 * hole in a half note — hollow. Filling each subpath separately would paint
 * them solid.
 */
export function traceGlyph(
  commands: readonly GlyphCommand[],
  at: GlyphPlacement,
  sink: PathSink
): void {
  const { x: ox, y: oy, scale: s } = at
  for (const c of commands) {
    switch (c.t) {
      case 'M':
        sink.moveTo(ox + c.x * s, oy + c.y * s)
        break
      case 'L':
        sink.lineTo(ox + c.x * s, oy + c.y * s)
        break
      case 'C':
        sink.curveTo(
          ox + c.x1 * s,
          oy + c.y1 * s,
          ox + c.x2 * s,
          oy + c.y2 * s,
          ox + c.x * s,
          oy + c.y * s
        )
        break
      case 'Z':
        sink.close()
        break
    }
  }
}

/**
 * An SVG `d` string for a glyph. Built through the same walk the PDF uses, so
 * the two outputs cannot disagree about a coordinate.
 */
export function glyphPathData(glyph: SmuflGlyph, at: GlyphPlacement): string {
  const parts: string[] = []
  const n = (v: number) => Number(v.toFixed(3))
  traceGlyph(glyph.commands, at, {
    moveTo: (x, y) => parts.push(`M${n(x)} ${n(y)}`),
    lineTo: (x, y) => parts.push(`L${n(x)} ${n(y)}`),
    curveTo: (x1, y1, x2, y2, x, y) =>
      parts.push(`C${n(x1)} ${n(y1)} ${n(x2)} ${n(y2)} ${n(x)} ${n(y)}`),
    close: () => parts.push('Z'),
  })
  return parts.join('')
}
