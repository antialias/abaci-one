/**
 * Music Note Utilities — Pitch/Position Conversion
 *
 * Position system (ported from music-flashcards route):
 *   0 = bottom staff line, 8 = top staff line.
 *   Each increment = one line or space.
 *
 * Treble: pos 0=E4, 1=F4, 2=G4, 3=A4, 4=B4, 5=C5, 6=D5, 7=E5, 8=F5
 *         Middle C = pos -2
 * Bass:   pos 0=G2, 1=A2, 2=B2, 3=C3, 4=D3, 5=E3, 6=F3, 7=G3, 8=A3
 *         Middle C = pos 10
 */

export type Clef = 'treble' | 'bass'
export type PitchClass = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export type Accidental = 'sharp' | 'flat' | 'natural'

const TREBLE_NOTES: PitchClass[] = ['E', 'F', 'G', 'A', 'B', 'C', 'D']
const BASS_NOTES: PitchClass[] = ['G', 'A', 'B', 'C', 'D', 'E', 'F']

// Base octaves: position 0 maps to these octaves
const TREBLE_BASE_OCTAVE = 4 // pos 0 = E4
const BASS_BASE_OCTAVE = 2 // pos 0 = G2

// Chromatic note order for MIDI calculation
const CHROMATIC_ORDER: PitchClass[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const SEMITONE_OFFSETS: Record<PitchClass, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

/**
 * Convert a staff position to a pitch class and octave.
 */
export function staffPositionToPitch(
  position: number,
  clef: Clef
): { pitchClass: PitchClass; octave: number } {
  const notes = clef === 'treble' ? TREBLE_NOTES : BASS_NOTES
  const baseOctave = clef === 'treble' ? TREBLE_BASE_OCTAVE : BASS_BASE_OCTAVE

  // Use modular arithmetic to handle positions outside the staff
  const adjustedIndex = ((position % 7) + 7) % 7
  const pitchClass = notes[adjustedIndex]

  // Calculate octave offset from position
  // Every 7 positions = one octave
  const octaveOffset = Math.floor(position / 7)

  // The base octave corresponds to position 0.
  // But notes wrap: in treble, pos 5=C is in the NEXT octave from pos 4=B.
  // We need to account for where C falls in the note cycle.
  const cIndex = notes.indexOf('C')
  const noteIndex = adjustedIndex

  // If the note is at or past C in the cycle, it's one octave higher
  // (because C starts a new octave in standard notation)
  let octave = baseOctave + octaveOffset
  if (cIndex > 0 && noteIndex >= cIndex) {
    octave += 1
  }

  return { pitchClass, octave }
}

/**
 * Convert a pitch class and octave to a staff position for a given clef.
 */
export function pitchToStaffPosition(
  pitchClass: PitchClass,
  octave: number,
  clef: Clef
): number {
  const notes = clef === 'treble' ? TREBLE_NOTES : BASS_NOTES
  const baseOctave = clef === 'treble' ? TREBLE_BASE_OCTAVE : BASS_BASE_OCTAVE

  const noteIndex = notes.indexOf(pitchClass)
  if (noteIndex === -1) {
    throw new Error(`Invalid pitch class: ${pitchClass}`)
  }

  const cIndex = notes.indexOf('C')

  // Determine which octave group this note belongs to
  let octaveOffset = octave - baseOctave
  if (cIndex > 0 && noteIndex >= cIndex) {
    octaveOffset -= 1
  }

  return octaveOffset * 7 + noteIndex
}

/**
 * Convert a pitch to MIDI note number.
 * Middle C (C4) = 60
 */
export function pitchToMidi(
  pitchClass: PitchClass,
  octave: number,
  accidental?: Accidental
): number {
  const base = (octave + 1) * 12 + SEMITONE_OFFSETS[pitchClass]
  if (accidental === 'sharp') return base + 1
  if (accidental === 'flat') return base - 1
  return base
}

/**
 * Format a note name for display.
 * e.g. "C4", "F#3", "Bb5"
 */
export function formatNoteName(
  pitchClass: PitchClass,
  octave: number,
  accidental?: Accidental
): string {
  const accidentalSymbol =
    accidental === 'sharp' ? '#' : accidental === 'flat' ? 'b' : ''
  return `${pitchClass}${accidentalSymbol}${octave}`
}

/**
 * Get a friendly name for well-known notes.
 */
export function getFriendlyName(
  pitchClass: PitchClass,
  octave: number
): string | undefined {
  if (pitchClass === 'C' && octave === 4) return 'Middle C'
  return undefined
}

/**
 * Determine ledger lines needed for a given staff position.
 * Returns null if no ledger lines are needed (position 0-8).
 */
export function getLedgerLines(
  position: number
): { count: number; direction: 'below' | 'above' } | null {
  if (position >= 0 && position <= 8) {
    // Check if the position is ON a ledger line equivalent
    // Positions 0 and 8 are on staff lines, no ledger lines needed
    return null
  }

  if (position < 0) {
    // Below the staff: ledger lines at positions -2, -4, -6, ...
    // Count how many even positions are at or below position
    const count = Math.ceil(-position / 2)
    return { count, direction: 'below' }
  }

  // Above the staff: ledger lines at positions 10, 12, 14, ...
  const count = Math.ceil((position - 8) / 2)
  return { count, direction: 'above' }
}

/**
 * Get the positions where ledger lines should be drawn for a note.
 * Matches the route.ts logic: below staff starts at -2, above staff starts at 10.
 */
export function getLedgerLinePositions(position: number): number[] {
  const lines: number[] = []

  if (position < 0) {
    let ledgerPos = -2
    while (ledgerPos >= position) {
      lines.push(ledgerPos)
      ledgerPos -= 2
    }
  }

  if (position > 8) {
    let ledgerPos = 10
    while (ledgerPos <= position) {
      lines.push(ledgerPos)
      ledgerPos += 2
    }
  }

  return lines
}

/**
 * Determine stem direction based on staff position.
 * Notes on or above the middle line (position 4) get stems going down.
 * Notes below the middle line get stems going up.
 */
export function getStemDirection(position: number): 'up' | 'down' {
  return position >= 4 ? 'down' : 'up'
}
