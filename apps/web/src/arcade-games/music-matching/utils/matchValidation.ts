import type { MusicCard, MusicMatchValidationResult } from '../types'

/**
 * Validate staff-to-name match:
 * One card must be staff-note, the other must be note-name, and they must share the same MIDI note.
 */
export function validateStaffToNameMatch(
  card1: MusicCard,
  card2: MusicCard
): MusicMatchValidationResult {
  // Cards must be different types
  if (card1.type === card2.type) {
    return {
      isValid: false,
      reason: 'Must match a staff note with a note name',
      type: 'invalid',
    }
  }

  // One must be staff-note, one must be note-name
  const hasStaff = card1.type === 'staff-note' || card2.type === 'staff-note'
  const hasName = card1.type === 'note-name' || card2.type === 'note-name'

  if (!hasStaff || !hasName) {
    return {
      isValid: false,
      reason: 'Must match a staff note with a note name',
      type: 'invalid',
    }
  }

  // MIDI notes must match
  if (card1.midiNote !== card2.midiNote) {
    return {
      isValid: false,
      reason: 'Notes do not match',
      type: 'invalid',
    }
  }

  return {
    isValid: true,
    type: 'staff-to-name',
  }
}

/**
 * Validate treble-to-bass match:
 * Both cards must be staff-note, different clefs, same MIDI note.
 */
export function validateTrebleToBassMatch(
  card1: MusicCard,
  card2: MusicCard
): MusicMatchValidationResult {
  // Both must be staff-note
  if (card1.type !== 'staff-note' || card2.type !== 'staff-note') {
    return {
      isValid: false,
      reason: 'Both cards must be staff notes',
      type: 'invalid',
    }
  }

  // Must be different clefs
  if (card1.clef === card2.clef) {
    return {
      isValid: false,
      reason: 'Cards must be from different clefs',
      type: 'invalid',
    }
  }

  // MIDI notes must match
  if (card1.midiNote !== card2.midiNote) {
    return {
      isValid: false,
      reason: 'Notes do not match',
      type: 'invalid',
    }
  }

  return {
    isValid: true,
    type: 'treble-to-bass',
  }
}

/**
 * Main validation function — determines which validation to use based on card types.
 */
export function validateMatch(card1: MusicCard, card2: MusicCard): MusicMatchValidationResult {
  // Cannot match the same card with itself
  if (card1.id === card2.id) {
    return {
      isValid: false,
      reason: 'Cannot match card with itself',
      type: 'invalid',
    }
  }

  // Cannot match already matched cards
  if (card1.matched || card2.matched) {
    return {
      isValid: false,
      reason: 'Cannot match already matched cards',
      type: 'invalid',
    }
  }

  // Determine match type from card types
  const hasNoteName = card1.type === 'note-name' || card2.type === 'note-name'

  if (hasNoteName) {
    return validateStaffToNameMatch(card1, card2)
  }

  // Both are staff-note: treble-to-bass mode
  return validateTrebleToBassMatch(card1, card2)
}
