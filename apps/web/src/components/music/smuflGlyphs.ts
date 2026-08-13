/**
 * Bravura glyph outlines in staff-space units — GENERATED FILE, DO NOT EDIT.
 *
 * Regenerate with `node scripts/extract-smufl-glyphs.mjs` (see that script for
 * the temporary install it needs). Hand edits are lost on the next run.
 *
 * Coordinates are in staff spaces with y increasing DOWNWARD, matching both SVG
 * and jsPDF. That means a caller only has to supply an origin and a scale — no
 * per-glyph fudge factors — and the PDF and the on-screen staff render the same
 * shapes from the same numbers. Note that SMuFL's own metadata is y-UP; the
 * extraction script flips it, so everything in this file is already y-down.
 *
 * Bravura © Steinberg Media Technologies GmbH, licensed under the SIL Open Font
 * License 1.1 (https://scripts.sil.org/OFL), which permits redistributing
 * extracted outlines with attribution. Font version 1.392.
 */

export type GlyphCommand =
  | { t: 'M'; x: number; y: number }
  | { t: 'L'; x: number; y: number }
  | { t: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { t: 'Z' }

export interface SmuflGlyph {
  smuflName: string
  codepoint: number
  /**
   * Staff position (0 = bottom line, 8 = top line) that the glyph origin sits
   * on, or null for glyphs positioned by the note they belong to.
   */
  originPosition: number | null
  /** Extent in staff spaces relative to the origin; `top` < `bottom` (y-down). */
  bbox: { left: number; right: number; top: number; bottom: number }
  /** SMuFL attachment points in staff spaces, y-down, relative to the origin. */
  anchors?: Record<string, readonly [number, number]>
  commands: readonly GlyphCommand[]
}

/**
 * Engraving constants from Bravura's own metadata, in staff spaces. Using these
 * keeps stems and ledger lines proportioned the way the font expects rather
 * than by eye.
 */
export const ENGRAVING = {
  stemThickness: 0.12,
  /** How far a ledger line sticks out past the notehead on each side. */
  legerLineExtension: 0.4,
  /** Conventional stem length for a note inside the staff. */
  stemLength: 3.5,
} as const

export const SMUFL_GLYPHS = {
  // gClef (U+E050) — origin on the G line
  gClef: {
    smuflName: 'gClef',
    codepoint: 0xe050,
    originPosition: 2,
    bbox: { left: 0, right: 2.684, top: -4.392, bottom: 2.632 },
    commands: [
      { t: 'M', x: 1.504, y: -1.66 },
      { t: 'C', x1: 1.496, y1: -1.708, x2: 1.504, y2: -1.712, x: 1.528, y: -1.736 },
      { t: 'C', x1: 1.96, y1: -2.14, x2: 2.288, y2: -2.648, x: 2.288, y: -3.26 },
      { t: 'C', x1: 2.288, y1: -3.608, x2: 2.192, y2: -3.952, x: 2.028, y: -4.192 },
      { t: 'C', x1: 1.968, y1: -4.28, x2: 1.864, y2: -4.392, x: 1.82, y: -4.392 },
      { t: 'C', x1: 1.764, y1: -4.392, x2: 1.64, y2: -4.288, x: 1.56, y: -4.2 },
      { t: 'C', x1: 1.264, y1: -3.872, x2: 1.168, y2: -3.372, x: 1.168, y: -2.956 },
      { t: 'C', x1: 1.168, y1: -2.724, x2: 1.196, y2: -2.464, x: 1.224, y: -2.3 },
      { t: 'C', x1: 1.232, y1: -2.252, x2: 1.236, y2: -2.244, x: 1.188, y: -2.204 },
      { t: 'C', x1: 0.612, y1: -1.728, x2: 0, y2: -1.156, x: 0, y: -0.348 },
      { t: 'C', x1: 0, y1: 0.348, x2: 0.476, y2: 1.008, x: 1.456, y: 1.008 },
      { t: 'C', x1: 1.548, y1: 1.008, x2: 1.652, y2: 1, x: 1.732, y: 0.984 },
      { t: 'C', x1: 1.776, y1: 0.976, x2: 1.784, y2: 0.972, x: 1.792, y: 1.02 },
      { t: 'C', x1: 1.84, y1: 1.288, x2: 1.9, y2: 1.636, x: 1.9, y: 1.824 },
      { t: 'C', x1: 1.9, y1: 2.416, x2: 1.5, y2: 2.488, x: 1.264, y: 2.488 },
      { t: 'C', x1: 1.048, y1: 2.488, x2: 0.944, y2: 2.424, x: 0.944, y: 2.372 },
      { t: 'C', x1: 0.944, y1: 2.344, x2: 0.98, y2: 2.332, x: 1.072, y: 2.304 },
      { t: 'C', x1: 1.196, y1: 2.268, x2: 1.34, y2: 2.16, x: 1.34, y: 1.928 },
      { t: 'C', x1: 1.34, y1: 1.708, x2: 1.2, y2: 1.52, x: 0.956, y: 1.52 },
      { t: 'C', x1: 0.688, y1: 1.52, x2: 0.528, y2: 1.732, x: 0.528, y: 1.98 },
      { t: 'C', x1: 0.528, y1: 2.24, x2: 0.684, y2: 2.632, x: 1.288, y: 2.632 },
      { t: 'C', x1: 1.556, y1: 2.632, x2: 2.076, y2: 2.512, x: 2.076, y: 1.832 },
      { t: 'C', x1: 2.076, y1: 1.604, x2: 2.004, y2: 1.224, x: 1.96, y: 0.976 },
      { t: 'C', x1: 1.952, y1: 0.928, x2: 1.956, y2: 0.932, x: 2.012, y: 0.908 },
      { t: 'C', x1: 2.416, y1: 0.748, x2: 2.684, y2: 0.408, x: 2.684, y: -0.044 },
      { t: 'C', x1: 2.684, y1: -0.556, x2: 2.308, y2: -1.008, x: 1.72, y: -1.008 },
      { t: 'C', x1: 1.616, y1: -1.008, x2: 1.616, y2: -1.008, x: 1.604, y: -1.08 },
      { t: 'M', x: 1.88, y: -3.772 },
      { t: 'C', x1: 2.012, y1: -3.772, x2: 2.12, y2: -3.664, x: 2.12, y: -3.444 },
      { t: 'C', x1: 2.12, y1: -3, x2: 1.74, y2: -2.64, x: 1.424, y: -2.364 },
      { t: 'C', x1: 1.396, y1: -2.34, x2: 1.38, y2: -2.344, x: 1.372, y: -2.396 },
      { t: 'C', x1: 1.356, y1: -2.5, x2: 1.348, y2: -2.636, x: 1.348, y: -2.764 },
      { t: 'C', x1: 1.348, y1: -3.388, x2: 1.636, y2: -3.772, x: 1.88, y: -3.772 },
      { t: 'M', x: 1.444, y: -1.048 },
      { t: 'C', x1: 1.456, y1: -0.972, x2: 1.456, y2: -0.976, x: 1.384, y: -0.952 },
      { t: 'C', x1: 1.032, y1: -0.832, x2: 0.804, y2: -0.516, x: 0.804, y: -0.176 },
      { t: 'C', x1: 0.804, y1: 0.184, x2: 0.992, y2: 0.44, x: 1.264, y: 0.532 },
      { t: 'C', x1: 1.296, y1: 0.544, x2: 1.344, y2: 0.556, x: 1.372, y: 0.556 },
      { t: 'C', x1: 1.404, y1: 0.556, x2: 1.42, y2: 0.536, x: 1.42, y: 0.512 },
      { t: 'C', x1: 1.42, y1: 0.484, x2: 1.388, y2: 0.472, x: 1.36, y: 0.46 },
      { t: 'C', x1: 1.192, y1: 0.388, x2: 1.072, y2: 0.216, x: 1.072, y: 0.032 },
      { t: 'C', x1: 1.072, y1: -0.196, x2: 1.228, y2: -0.368, x: 1.472, y: -0.436 },
      { t: 'C', x1: 1.536, y1: -0.452, x2: 1.544, y2: -0.448, x: 1.552, y: -0.404 },
      { t: 'L', x: 1.752, y: 0.788 },
      { t: 'C', x1: 1.76, y1: 0.832, x2: 1.756, y2: 0.832, x: 1.696, y: 0.844 },
      { t: 'C', x1: 1.632, y1: 0.856, x2: 1.552, y2: 0.864, x: 1.472, y: 0.864 },
      { t: 'C', x1: 0.772, y1: 0.864, x2: 0.32, y2: 0.476, x: 0.32, y: -0.08 },
      { t: 'C', x1: 0.32, y1: -0.316, x2: 0.36, y2: -0.632, x: 0.692, y: -1.008 },
      { t: 'C', x1: 0.932, y1: -1.276, x2: 1.116, y2: -1.424, x: 1.304, y: -1.576 },
      { t: 'C', x1: 1.344, y1: -1.608, x2: 1.352, y2: -1.604, x: 1.36, y: -1.56 },
      { t: 'M', x: 1.72, y: -0.412 },
      { t: 'C', x1: 1.712, y1: -0.46, x2: 1.716, y2: -0.472, x: 1.764, y: -0.468 },
      { t: 'C', x1: 2.088, y1: -0.44, x2: 2.356, y2: -0.168, x: 2.356, y: 0.184 },
      { t: 'C', x1: 2.356, y1: 0.436, x2: 2.204, y2: 0.64, x: 1.98, y: 0.752 },
      { t: 'C', x1: 1.932, y1: 0.776, x2: 1.924, y2: 0.776, x: 1.916, y: 0.728 },
    ],
  },
  // fClef (U+E062) — origin on the F line
  fClef: {
    smuflName: 'fClef',
    codepoint: 0xe062,
    originPosition: 6,
    bbox: { left: -0.02, right: 2.736, top: -1.048, bottom: 2.54 },
    commands: [
      { t: 'M', x: 1.008, y: -1.048 },
      { t: 'C', x1: 0.312, y1: -1.048, x2: 0, y2: -0.54, x: 0, y: -0.156 },
      { t: 'C', x1: 0, y1: 0.164, x2: 0.168, y2: 0.44, x: 0.492, y: 0.44 },
      { t: 'C', x1: 0.744, y1: 0.44, x2: 0.916, y2: 0.264, x: 0.916, y: 0.016 },
      { t: 'C', x1: 0.916, y1: -0.24, x2: 0.728, y2: -0.4, x: 0.532, y: -0.4 },
      { t: 'C', x1: 0.424, y1: -0.4, x2: 0.384, y2: -0.372, x: 0.332, y: -0.372 },
      { t: 'C', x1: 0.28, y1: -0.372, x2: 0.268, y2: -0.404, x: 0.268, y: -0.444 },
      { t: 'C', x1: 0.268, y1: -0.604, x2: 0.508, y2: -0.896, x: 0.916, y: -0.896 },
      { t: 'C', x1: 1.34, y1: -0.896, x2: 1.524, y2: -0.48, x: 1.524, y: 0.148 },
      { t: 'C', x1: 1.524, y1: 1.264, x2: 0.972, y2: 1.888, x: 0.04, y: 2.42 },
      { t: 'C', x1: 0.004, y1: 2.44, x2: -0.02, y2: 2.46, x: -0.02, y: 2.492 },
      { t: 'C', x1: -0.02, y1: 2.516, x2: -0.004, y2: 2.54, x: 0.032, y: 2.54 },
      { t: 'C', x1: 0.052, y1: 2.54, x2: 0.076, y2: 2.532, x: 0.1, y: 2.52 },
      { t: 'C', x1: 1.084, y1: 2.04, x2: 2.124, y2: 1.328, x: 2.124, y: 0.112 },
      { t: 'C', x1: 2.124, y1: -0.584, x2: 1.7, y2: -1.048, x: 1.008, y: -1.048 },
      { t: 'M', x: 2.516, y: -0.72 },
      { t: 'C', x1: 2.392, y1: -0.72, x2: 2.296, y2: -0.624, x: 2.296, y: -0.5 },
      { t: 'C', x1: 2.296, y1: -0.376, x2: 2.392, y2: -0.28, x: 2.516, y: -0.28 },
      { t: 'C', x1: 2.64, y1: -0.28, x2: 2.736, y2: -0.376, x: 2.736, y: -0.5 },
      { t: 'C', x1: 2.736, y1: -0.624, x2: 2.64, y2: -0.72, x: 2.516, y: -0.72 },
      { t: 'M', x: 2.52, y: 0.284 },
      { t: 'C', x1: 2.396, y1: 0.284, x2: 2.304, y2: 0.376, x: 2.304, y: 0.5 },
      { t: 'C', x1: 2.304, y1: 0.624, x2: 2.396, y2: 0.716, x: 2.52, y: 0.716 },
      { t: 'C', x1: 2.644, y1: 0.716, x2: 2.736, y2: 0.624, x: 2.736, y: 0.5 },
      { t: 'C', x1: 2.736, y1: 0.376, x2: 2.644, y2: 0.284, x: 2.52, y: 0.284 },
    ],
  },
  // noteheadBlack (U+E0A4) — origin at the left edge, centred on the note’s own position
  noteheadBlack: {
    smuflName: 'noteheadBlack',
    codepoint: 0xe0a4,
    originPosition: null,
    bbox: { left: 0, right: 1.18, top: -0.5, bottom: 0.5 },
    anchors: {
      stemUpSE: [1.18, -0.168],
      stemDownNW: [0, 0.168],
    },
    commands: [
      { t: 'M', x: 0.388, y: 0.5 },
      { t: 'C', x1: 0.744, y1: 0.5, x2: 1.18, y2: 0.172, x: 1.18, y: -0.168 },
      { t: 'C', x1: 1.18, y1: -0.372, x2: 1.02, y2: -0.5, x: 0.792, y: -0.5 },
      { t: 'C', x1: 0.352, y1: -0.5, x2: 0, y2: -0.176, x: 0, y: 0.168 },
      { t: 'C', x1: 0, y1: 0.376, x2: 0.172, y2: 0.5, x: 0.388, y: 0.5 },
    ],
  },
} satisfies Record<string, SmuflGlyph>

export type SmuflGlyphName = keyof typeof SMUFL_GLYPHS
