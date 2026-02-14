'use client'

import {
  pitchToStaffPosition,
  getStemDirection,
  getLedgerLinePositions,
} from './noteUtils'
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
  const noteX = staffLeft + staffWidth * 0.6

  // Note head dimensions (ellipse)
  const noteRx = 4.5
  const noteRy = 3.2

  // Stem
  const stemHeight = lineGap * 7
  const stemX = stemDir === 'up' ? noteX + noteRx - 0.5 : noteX - noteRx + 0.5
  const stemY1 = noteY
  const stemY2 = stemDir === 'up' ? noteY - stemHeight : noteY + stemHeight

  // Clef positioning
  const clefX = staffLeft + 6
  const clefSymbol = clef === 'treble' ? '\u{1D11E}' : '\u{1D122}'
  // Treble clef centers on G line (position 2, the second line from bottom)
  // Bass clef centers on F line (position 6, the fourth line from bottom — wait,
  // actually in bass: position 6 = F3 which is the 4th line)
  const trebleClefY = staffTop + (8 - 2) * lineGap + 2
  const bassClefY = staffTop + (8 - 6) * lineGap + 2
  const clefY = clef === 'treble' ? trebleClefY : bassClefY
  const clefFontSize = clef === 'treble' ? lineGap * 8 : lineGap * 5

  // Accidental positioning
  const accidentalSymbol =
    accidental === 'sharp' ? '\u266F' : accidental === 'flat' ? '\u266D' : accidental === 'natural' ? '\u266E' : null
  const accidentalX = noteX - noteRx - 8
  const accidentalY = noteY + 3

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
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
            x1={noteX - 9}
            y1={y}
            x2={noteX + 9}
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
      <line
        x1={stemX}
        y1={stemY1}
        x2={stemX}
        y2={stemY2}
        stroke="#333"
        strokeWidth={1.2}
      />
    </svg>
  )
}
