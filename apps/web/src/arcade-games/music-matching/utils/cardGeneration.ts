import {
  pitchToStaffPosition,
  pitchToMidi,
  formatNoteName,
  getFriendlyName,
} from '@/components/music/noteUtils'
import type { PitchClass, Accidental } from '@/components/music/noteUtils'
import type { Difficulty, MusicCard, MusicConfig, ClefOption } from '../types'

interface NoteDefinition {
  pitchClass: PitchClass
  octave: number
  accidental?: Accidental
}

/**
 * Note pools per difficulty level.
 * Each pool contains notes appropriate for the difficulty:
 * - 6 pairs: Natural notes within staff (no ledger lines)
 * - 8 pairs: Naturals ±1 ledger line
 * - 12 pairs: Naturals + common sharps/flats, ±2 ledger lines
 * - 15 pairs: Extended range, chromatic subset
 */
const TREBLE_NOTE_POOLS: Record<Difficulty, NoteDefinition[]> = {
  6: [
    // Staff notes only (E4-F5, positions 0-8)
    { pitchClass: 'E', octave: 4 },
    { pitchClass: 'F', octave: 4 },
    { pitchClass: 'G', octave: 4 },
    { pitchClass: 'A', octave: 4 },
    { pitchClass: 'B', octave: 4 },
    { pitchClass: 'C', octave: 5 },
    { pitchClass: 'D', octave: 5 },
    { pitchClass: 'E', octave: 5 },
    { pitchClass: 'F', octave: 5 },
  ],
  8: [
    // +1 ledger line (C4-A5)
    { pitchClass: 'C', octave: 4 }, // Middle C - 1 ledger line below
    { pitchClass: 'D', octave: 4 },
    { pitchClass: 'E', octave: 4 },
    { pitchClass: 'F', octave: 4 },
    { pitchClass: 'G', octave: 4 },
    { pitchClass: 'A', octave: 4 },
    { pitchClass: 'B', octave: 4 },
    { pitchClass: 'C', octave: 5 },
    { pitchClass: 'D', octave: 5 },
    { pitchClass: 'E', octave: 5 },
    { pitchClass: 'F', octave: 5 },
    { pitchClass: 'G', octave: 5 },
    { pitchClass: 'A', octave: 5 }, // 1 ledger line above
  ],
  12: [
    // ±2 ledger lines + some accidentals
    { pitchClass: 'B', octave: 3 },
    { pitchClass: 'C', octave: 4 },
    { pitchClass: 'D', octave: 4 },
    { pitchClass: 'E', octave: 4 },
    { pitchClass: 'F', octave: 4 },
    { pitchClass: 'F', octave: 4, accidental: 'sharp' },
    { pitchClass: 'G', octave: 4 },
    { pitchClass: 'A', octave: 4 },
    { pitchClass: 'B', octave: 4, accidental: 'flat' },
    { pitchClass: 'B', octave: 4 },
    { pitchClass: 'C', octave: 5 },
    { pitchClass: 'D', octave: 5 },
    { pitchClass: 'E', octave: 5 },
    { pitchClass: 'F', octave: 5 },
    { pitchClass: 'G', octave: 5 },
    { pitchClass: 'A', octave: 5 },
    { pitchClass: 'B', octave: 5 },
  ],
  15: [
    // Extended range + chromatic
    { pitchClass: 'A', octave: 3 },
    { pitchClass: 'B', octave: 3 },
    { pitchClass: 'C', octave: 4 },
    { pitchClass: 'D', octave: 4 },
    { pitchClass: 'E', octave: 4, accidental: 'flat' },
    { pitchClass: 'E', octave: 4 },
    { pitchClass: 'F', octave: 4 },
    { pitchClass: 'F', octave: 4, accidental: 'sharp' },
    { pitchClass: 'G', octave: 4 },
    { pitchClass: 'A', octave: 4 },
    { pitchClass: 'B', octave: 4, accidental: 'flat' },
    { pitchClass: 'B', octave: 4 },
    { pitchClass: 'C', octave: 5 },
    { pitchClass: 'C', octave: 5, accidental: 'sharp' },
    { pitchClass: 'D', octave: 5 },
    { pitchClass: 'E', octave: 5 },
    { pitchClass: 'F', octave: 5 },
    { pitchClass: 'G', octave: 5 },
    { pitchClass: 'A', octave: 5 },
    { pitchClass: 'B', octave: 5 },
  ],
}

const BASS_NOTE_POOLS: Record<Difficulty, NoteDefinition[]> = {
  6: [
    // Staff notes only (G2-A3, positions 0-8)
    { pitchClass: 'G', octave: 2 },
    { pitchClass: 'A', octave: 2 },
    { pitchClass: 'B', octave: 2 },
    { pitchClass: 'C', octave: 3 },
    { pitchClass: 'D', octave: 3 },
    { pitchClass: 'E', octave: 3 },
    { pitchClass: 'F', octave: 3 },
    { pitchClass: 'G', octave: 3 },
    { pitchClass: 'A', octave: 3 },
  ],
  8: [
    // +1 ledger line
    { pitchClass: 'E', octave: 2 },
    { pitchClass: 'F', octave: 2 },
    { pitchClass: 'G', octave: 2 },
    { pitchClass: 'A', octave: 2 },
    { pitchClass: 'B', octave: 2 },
    { pitchClass: 'C', octave: 3 },
    { pitchClass: 'D', octave: 3 },
    { pitchClass: 'E', octave: 3 },
    { pitchClass: 'F', octave: 3 },
    { pitchClass: 'G', octave: 3 },
    { pitchClass: 'A', octave: 3 },
    { pitchClass: 'B', octave: 3 },
    { pitchClass: 'C', octave: 4 }, // Middle C - 1 ledger line above
  ],
  12: [
    // ±2 ledger lines + some accidentals
    { pitchClass: 'D', octave: 2 },
    { pitchClass: 'E', octave: 2 },
    { pitchClass: 'F', octave: 2 },
    { pitchClass: 'G', octave: 2 },
    { pitchClass: 'A', octave: 2 },
    { pitchClass: 'B', octave: 2, accidental: 'flat' },
    { pitchClass: 'B', octave: 2 },
    { pitchClass: 'C', octave: 3 },
    { pitchClass: 'D', octave: 3 },
    { pitchClass: 'E', octave: 3, accidental: 'flat' },
    { pitchClass: 'E', octave: 3 },
    { pitchClass: 'F', octave: 3 },
    { pitchClass: 'G', octave: 3 },
    { pitchClass: 'A', octave: 3 },
    { pitchClass: 'B', octave: 3 },
    { pitchClass: 'C', octave: 4 },
    { pitchClass: 'D', octave: 4 },
  ],
  15: [
    // Extended range + chromatic
    { pitchClass: 'C', octave: 2 },
    { pitchClass: 'D', octave: 2 },
    { pitchClass: 'E', octave: 2 },
    { pitchClass: 'F', octave: 2 },
    { pitchClass: 'F', octave: 2, accidental: 'sharp' },
    { pitchClass: 'G', octave: 2 },
    { pitchClass: 'A', octave: 2 },
    { pitchClass: 'B', octave: 2, accidental: 'flat' },
    { pitchClass: 'B', octave: 2 },
    { pitchClass: 'C', octave: 3 },
    { pitchClass: 'C', octave: 3, accidental: 'sharp' },
    { pitchClass: 'D', octave: 3 },
    { pitchClass: 'E', octave: 3 },
    { pitchClass: 'F', octave: 3 },
    { pitchClass: 'G', octave: 3 },
    { pitchClass: 'A', octave: 3 },
    { pitchClass: 'B', octave: 3 },
    { pitchClass: 'C', octave: 4 },
    { pitchClass: 'D', octave: 4 },
    { pitchClass: 'E', octave: 4 },
  ],
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function selectNotes(pool: NoteDefinition[], count: number): NoteDefinition[] {
  return shuffleArray(pool).slice(0, count)
}

function getClefForSelection(clefOption: ClefOption): 'treble' | 'bass' {
  if (clefOption === 'both') {
    return Math.random() < 0.5 ? 'treble' : 'bass'
  }
  return clefOption
}

function getNotePool(clef: 'treble' | 'bass', difficulty: Difficulty): NoteDefinition[] {
  return clef === 'treble' ? TREBLE_NOTE_POOLS[difficulty] : BASS_NOTE_POOLS[difficulty]
}

/**
 * Generate cards for staff-to-name mode.
 * Each pair: one staff-note card + one note-name card.
 */
export function generateStaffToNameCards(config: MusicConfig): MusicCard[] {
  const { difficulty, clef: clefOption } = config
  const cards: MusicCard[] = []

  // When clef is "both", split roughly evenly
  let trebleCount = 0
  let bassCount = 0
  if (clefOption === 'both') {
    trebleCount = Math.ceil(difficulty / 2)
    bassCount = difficulty - trebleCount
  } else if (clefOption === 'treble') {
    trebleCount = difficulty
  } else {
    bassCount = difficulty
  }

  const selectedNotes: Array<NoteDefinition & { clef: 'treble' | 'bass' }> = []

  if (trebleCount > 0) {
    const pool = getNotePool('treble', difficulty)
    selectNotes(pool, trebleCount).forEach((note) => {
      selectedNotes.push({ ...note, clef: 'treble' })
    })
  }

  if (bassCount > 0) {
    const pool = getNotePool('bass', difficulty)
    selectNotes(pool, bassCount).forEach((note) => {
      selectedNotes.push({ ...note, clef: 'bass' })
    })
  }

  selectedNotes.forEach((note, index) => {
    const midi = pitchToMidi(note.pitchClass, note.octave, note.accidental)
    const display = formatNoteName(note.pitchClass, note.octave, note.accidental)
    const friendly = getFriendlyName(note.pitchClass, note.octave)

    // Staff card
    cards.push({
      id: `staff_${index}_${midi}`,
      type: 'staff-note',
      pitchClass: note.pitchClass,
      octave: note.octave,
      midiNote: midi,
      clef: note.clef,
      accidental: note.accidental ?? 'none',
      displayName: display,
      friendlyName: friendly,
      matched: false,
    })

    // Name card
    cards.push({
      id: `name_${index}_${midi}`,
      type: 'note-name',
      pitchClass: note.pitchClass,
      octave: note.octave,
      midiNote: midi,
      accidental: note.accidental ?? 'none',
      displayName: display,
      friendlyName: friendly,
      matched: false,
    })
  })

  return shuffleArray(cards)
}

/**
 * Generate cards for treble-to-bass mode.
 * Each pair: one staff-note in treble clef + one staff-note in bass clef.
 * Uses notes that exist in both clefs' ranges (overlapping pitches).
 */
export function generateTrebleToBassCards(config: MusicConfig): MusicCard[] {
  const { difficulty } = config
  const cards: MusicCard[] = []

  // Notes that make sense in both clefs (around Middle C area)
  const sharedNotes: NoteDefinition[] = [
    { pitchClass: 'C', octave: 3 },
    { pitchClass: 'D', octave: 3 },
    { pitchClass: 'E', octave: 3 },
    { pitchClass: 'F', octave: 3 },
    { pitchClass: 'G', octave: 3 },
    { pitchClass: 'A', octave: 3 },
    { pitchClass: 'B', octave: 3 },
    { pitchClass: 'C', octave: 4 }, // Middle C
    { pitchClass: 'D', octave: 4 },
    { pitchClass: 'E', octave: 4 },
    { pitchClass: 'F', octave: 4 },
    { pitchClass: 'G', octave: 4 },
    { pitchClass: 'A', octave: 4 },
    { pitchClass: 'B', octave: 4 },
    { pitchClass: 'C', octave: 5 },
  ]

  const selected = selectNotes(sharedNotes, difficulty)

  selected.forEach((note, index) => {
    const midi = pitchToMidi(note.pitchClass, note.octave, note.accidental)
    const display = formatNoteName(note.pitchClass, note.octave, note.accidental)
    const friendly = getFriendlyName(note.pitchClass, note.octave)

    // Treble clef card
    cards.push({
      id: `treble_${index}_${midi}`,
      type: 'staff-note',
      pitchClass: note.pitchClass,
      octave: note.octave,
      midiNote: midi,
      clef: 'treble',
      accidental: note.accidental ?? 'none',
      displayName: display,
      friendlyName: friendly,
      matched: false,
    })

    // Bass clef card
    cards.push({
      id: `bass_${index}_${midi}`,
      type: 'staff-note',
      pitchClass: note.pitchClass,
      octave: note.octave,
      midiNote: midi,
      clef: 'bass',
      accidental: note.accidental ?? 'none',
      displayName: display,
      friendlyName: friendly,
      matched: false,
    })
  })

  return shuffleArray(cards)
}

/**
 * Main card generation function.
 */
export function generateMusicCards(config: MusicConfig): MusicCard[] {
  switch (config.gameType) {
    case 'staff-to-name':
      return generateStaffToNameCards(config)
    case 'treble-to-bass':
      return generateTrebleToBassCards(config)
    default:
      throw new Error(`Unknown game type: ${config.gameType}`)
  }
}

/**
 * Grid configuration (same structure as abacus matching).
 */
export function getGridConfiguration(difficulty: Difficulty) {
  const configs: Record<
    Difficulty,
    {
      totalCards: number
      mobileColumns: number
      tabletColumns: number
      desktopColumns: number
      landscapeColumns: number
      cardSize: { width: string; height: string }
      gridTemplate: string
    }
  > = {
    6: {
      totalCards: 12,
      mobileColumns: 3,
      tabletColumns: 4,
      desktopColumns: 4,
      landscapeColumns: 6,
      cardSize: { width: '140px', height: '180px' },
      gridTemplate: 'repeat(3, 1fr)',
    },
    8: {
      totalCards: 16,
      mobileColumns: 3,
      tabletColumns: 4,
      desktopColumns: 4,
      landscapeColumns: 6,
      cardSize: { width: '120px', height: '160px' },
      gridTemplate: 'repeat(3, 1fr)',
    },
    12: {
      totalCards: 24,
      mobileColumns: 3,
      tabletColumns: 4,
      desktopColumns: 6,
      landscapeColumns: 6,
      cardSize: { width: '100px', height: '140px' },
      gridTemplate: 'repeat(3, 1fr)',
    },
    15: {
      totalCards: 30,
      mobileColumns: 3,
      tabletColumns: 5,
      desktopColumns: 6,
      landscapeColumns: 10,
      cardSize: { width: '90px', height: '120px' },
      gridTemplate: 'repeat(3, 1fr)',
    },
  }

  return configs[difficulty]
}
