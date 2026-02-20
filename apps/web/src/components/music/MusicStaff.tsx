'use client'

import { pitchToStaffPosition, getStemDirection, getLedgerLinePositions } from './noteUtils'
import type { PitchClass, Clef, Accidental } from './noteUtils'

export interface MusicStaffProps {
  pitchClass: PitchClass
  octave: number
  clef: Clef
  accidental?: Accidental
  width?: number
  height?: number
  showClef?: boolean
}

/**
 * SVG component rendering a music staff with a single note.
 *
 * Ported from the jsPDF rendering in api/create/music-flashcards/route.ts.
 * Position system: 0 = bottom line, 8 = top line.
 * Y formula: staffTop + (8 - position) * lineGap
 */
export function MusicStaff({
  pitchClass,
  octave,
  clef,
  accidental,
  width = 120,
  height = 80,
  showClef = true,
}: MusicStaffProps) {
  const lineGap = height * 0.08
  const staffTop = height * 0.3
  const staffWidth = width * 0.85
  const staffLeft = (width - staffWidth) / 2

  const position = pitchToStaffPosition(pitchClass as PitchClass, octave, clef)
  const stemDir = getStemDirection(position)
  const ledgerPositions = getLedgerLinePositions(position)

  // Note position
  const noteY = staffTop + (8 - position) * lineGap
  const noteX = staffLeft + staffWidth * 0.72

  // Note head dimensions (ellipse) — sized to fill a staff space
  const noteRx = 6
  const noteRy = 4.2

  // Stem
  const stemHeight = lineGap * 7
  const stemX = stemDir === 'up' ? noteX + noteRx - 0.5 : noteX - noteRx + 0.5
  const stemY1 = noteY
  const stemY2 = stemDir === 'up' ? noteY - stemHeight : noteY + stemHeight

  // Clef positioning
  // The staff spans from staffTop (top line) to staffTop + 8*lineGap (bottom line).
  // The treble clef glyph (𝄞) visually centers around the G line (position 2).
  // The bass clef glyph (𝄢) visually centers around the F line (position 6, i.e. 4th line).
  // These Unicode glyphs are tall and need large font sizes to span the staff properly.
  const staffHeight = lineGap * 8
  const clefX = staffLeft + 2
  const clefSymbol = clef === 'treble' ? '\u{1D11E}' : '\u{1D122}'
  const clefFontSize = clef === 'treble' ? staffHeight * 2.4 : staffHeight * 0.9
  // Treble clef: anchor near bottom of staff — the glyph extends upward
  const trebleClefY = staffTop + staffHeight * 0.85 - lineGap * 1.5
  // Bass clef: anchor near the F line (4th line from bottom)
  const bassClefY = staffTop + (8 - 4) * lineGap + lineGap * 0.3
  const clefY = clef === 'treble' ? trebleClefY : bassClefY

  // Accidental positioning
  const accidentalSymbol =
    accidental === 'sharp'
      ? '\u266F'
      : accidental === 'flat'
        ? '\u266D'
        : accidental === 'natural'
          ? '\u266E'
          : null
  const accidentalX = noteX - noteRx - 8
  const accidentalY = noteY + 3

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      data-component="MusicStaff"
      data-clef={clef}
      data-note={`${pitchClass}${octave}`}
    >
      {/* Staff lines */}
      {Array.from({ length: 5 }, (_, i) => {
        const y = staffTop + i * lineGap * 2
        return (
          <line
            key={`staff-${i}`}
            x1={staffLeft}
            y1={y}
            x2={staffLeft + staffWidth}
            y2={y}
            stroke="#333"
            strokeWidth={0.8}
          />
        )
      })}

      {/* Clef */}
      {showClef && (
        <text
          x={clefX}
          y={clefY}
          fontSize={clefFontSize}
          fontFamily="serif"
          fill="#333"
          dominantBaseline="middle"
          textAnchor="start"
        >
          {clefSymbol}
        </text>
      )}

      {/* Ledger lines */}
      {ledgerPositions.map((pos) => {
        const y = staffTop + (8 - pos) * lineGap
        return (
          <line
            key={`ledger-${pos}`}
            x1={noteX - 11}
            y1={y}
            x2={noteX + 11}
            y2={y}
            stroke="#333"
            strokeWidth={0.8}
          />
        )
      })}

      {/* Accidental */}
      {accidentalSymbol && (
        <text
          x={accidentalX}
          y={accidentalY}
          fontSize={12}
          fontFamily="serif"
          fill="#333"
          textAnchor="middle"
        >
          {accidentalSymbol}
        </text>
      )}

      {/* Note head (slightly tilted ellipse) */}
      <ellipse
        cx={noteX}
        cy={noteY}
        rx={noteRx}
        ry={noteRy}
        fill="#333"
        transform={`rotate(-10, ${noteX}, ${noteY})`}
      />

      {/* Stem */}
      <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke="#333" strokeWidth={1.2} />
    </svg>
  )
}
