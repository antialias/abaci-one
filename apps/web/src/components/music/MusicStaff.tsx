'use client'

import {
  ANY_CLEF_EXTENT,
  COMMON_NOTE_RANGE,
  clefGlyph,
  fitStaff,
  glyphPathData,
  halfSpaceForWidth,
  ledgerHalfWidth,
  noteExtent,
  noteRangeExtent,
  placeClef,
  placeNotehead,
  positionY,
  STAFF_EXTENT,
  staffSpace,
  stemRect,
  unionExtents,
} from './glyphPath'
import type { Accidental, Clef, PitchClass } from './noteUtils'
import { getLedgerLinePositions, pitchToStaffPosition } from './noteUtils'
import { SMUFL_GLYPHS } from './smuflGlyphs'

export interface MusicStaffProps {
  pitchClass: PitchClass
  octave: number
  clef: Clef
  accidental?: Accidental
  width?: number
  height?: number
  showClef?: boolean
}

/** Fraction of the box width the staff spans. */
const STAFF_WIDTH_RATIO = 0.85

const INK = '#333'

/**
 * SVG staff with a single note.
 *
 * Shares all of its geometry with the printable PDF via `glyphPath.ts`. It used
 * to be a hand-port of that renderer and the copies had drifted: this drew the
 * clefs as Unicode characters in whatever serif font the machine happened to
 * have (U+1D11E is missing from most of them, and the two clefs needed wildly
 * different font sizes to line up), anchored the bass clef to the middle line
 * rather than the F line, and sized the notehead and ledger lines in fixed
 * pixels so they stopped matching the staff whenever `height` changed.
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
  const position = pitchToStaffPosition(pitchClass, octave, clef)
  const ledgerPositions = getLedgerLinePositions(position)

  const staffWidth = width * STAFF_WIDTH_RATIO
  const staffLeft = (width - staffWidth) / 2

  // Fit everything that gets drawn inside the box. The clef is the tallest of
  // them by some way — a G clef spans about 14 half-spaces against the staff's
  // own 8 — so this is what keeps it from spilling out of the SVG.
  //
  // The reserved range, rather than this note alone, is what fixes the scale:
  // two cards side by side must show the same size staff in the same place.
  // `noteExtent(position)` is unioned in as well so a note beyond the usual
  // range still fits, at the cost of that one card being scaled down.
  const metrics = fitStaff({
    top: 0,
    availableHeight: height,
    extent: unionExtents(
      STAFF_EXTENT,
      noteRangeExtent(COMMON_NOTE_RANGE.lowest, COMMON_NOTE_RANGE.highest),
      noteExtent(position),
      ...(showClef ? [ANY_CLEF_EXTENT] : [])
    ),
    maxHalfSpace: [halfSpaceForWidth(staffWidth)],
  })
  const { halfSpace } = metrics
  const space = staffSpace(metrics)

  const clefAt = showClef ? placeClef(metrics, clef, staffLeft + halfSpace) : null
  const clefRight = clefAt ? clefAt.x + clefGlyph(clef).bbox.right * clefAt.scale : staffLeft

  // Centre the note in whatever the clef leaves of the staff.
  const noteX = (clefRight + space + staffLeft + staffWidth) / 2
  const noteY = positionY(metrics, position)
  const headAt = placeNotehead(metrics, position, noteX)
  const stem = stemRect(metrics, position, headAt)
  const ledgerHalf = ledgerHalfWidth(metrics)

  const accidentalSymbol =
    accidental === 'sharp'
      ? '♯'
      : accidental === 'flat'
        ? '♭'
        : accidental === 'natural'
          ? '♮'
          : null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      // A <title> child would surface as a hover tooltip, which on the matching
      // game's cards reads as an answer key. role/aria-label names the graphic
      // for assistive tech without drawing anything.
      role="img"
      aria-label={`${pitchClass}${accidentalSymbol ?? ''}${octave} on the ${clef} staff`}
      data-component="MusicStaff"
      data-clef={clef}
      data-note={`${pitchClass}${octave}`}
    >
      {/* Staff lines */}
      {Array.from({ length: 5 }, (_, i) => {
        const y = positionY(metrics, i * 2)
        return (
          <line
            key={`staff-${i}`}
            x1={staffLeft}
            y1={y}
            x2={staffLeft + staffWidth}
            y2={y}
            stroke={INK}
            strokeWidth={0.8}
          />
        )
      })}

      {/*
        Clef, notehead and stem all come from Bravura outlines. A single <path>
        per glyph with the default nonzero fill rule keeps counters — the eye of
        the G clef — hollow.
      */}
      {clefAt && (
        <path
          d={glyphPathData(clefGlyph(clef), clefAt)}
          fill={INK}
          data-element="clef"
          data-clef-glyph={clefGlyph(clef).smuflName}
        />
      )}

      {/* Ledger lines */}
      {ledgerPositions.map((pos) => {
        const y = positionY(metrics, pos)
        return (
          <line
            key={`ledger-${pos}`}
            x1={noteX - ledgerHalf}
            y1={y}
            x2={noteX + ledgerHalf}
            y2={y}
            stroke={INK}
            strokeWidth={0.8}
          />
        )
      })}

      {/* Accidental */}
      {accidentalSymbol && (
        <text
          x={noteX - ledgerHalf - space * 0.4}
          y={noteY}
          fontSize={space * 2}
          fontFamily="serif"
          fill={INK}
          dominantBaseline="central"
          textAnchor="middle"
          data-element="accidental"
        >
          {accidentalSymbol}
        </text>
      )}

      <path
        d={glyphPathData(SMUFL_GLYPHS.noteheadBlack, headAt)}
        fill={INK}
        data-element="notehead"
      />
      <rect
        x={stem.x}
        y={stem.y}
        width={stem.width}
        height={stem.height}
        fill={INK}
        data-element="stem"
        data-stem-direction={stem.direction}
      />
    </svg>
  )
}
