/**
 * Music Matching Game — Full Variant Definition (Client-Side)
 *
 * Extends the server-safe variant with React components for rendering.
 * This file imports .tsx components and should only be used on the client.
 */

import type { MatchingPairsVariant } from '@/lib/arcade/matching-pairs-framework'
import { MusicCardFront } from './components/MusicCardFront'
import { MusicSetupContent } from './components/MusicSetupContent'
import type { MusicCard, MusicConfig } from './types'
import { musicVariantServer } from './variant-server'

export const musicVariant: MatchingPairsVariant<MusicCard, MusicConfig> = {
  ...musicVariantServer,

  CardFront: MusicCardFront,

  getCardBackStyle: (card, isMatched) => {
    if (isMatched) {
      return { gradient: 'linear-gradient(135deg, #48bb78, #38a169)', icon: '✓' }
    }
    if (card.type === 'staff-note') {
      return {
        gradient: 'linear-gradient(135deg, #2c3e80, #4a69bd)',
        icon: '𝄞',
      }
    }
    // note-name cards — warm orange/amber to contrast the cool blue staff cards
    return {
      gradient: 'linear-gradient(135deg, #e17055, #fdcb6e)',
      icon: 'A♯',
    }
  },

  shouldDimCard: (card, firstFlippedCard) => {
    // note-name flipped → dim other note-name cards (staff-to-name mode)
    if (firstFlippedCard.type === 'note-name' && card.type === 'note-name') {
      return true
    }

    // staff-note flipped → behaviour depends on what the candidate card is
    if (firstFlippedCard.type === 'staff-note') {
      // Dim note-name cards? No — those are the match target in staff-to-name
      if (card.type === 'note-name') {
        return false
      }

      // Both are staff-note: dim if same clef (treble-to-bass mode),
      // or dim if candidate has no clef differentiation (staff-to-name mode:
      // the match target is a note-name card, so other staff-note cards are wrong)
      if (card.type === 'staff-note') {
        // If clefs differ, keep it available (treble-to-bass: it's the match target)
        if (card.clef && firstFlippedCard.clef && card.clef !== firstFlippedCard.clef) {
          return false
        }
        // Same clef or no clef → dim
        return true
      }
    }

    return false
  },

  SetupContent: MusicSetupContent,

  getNavInfo: (config) => ({
    title: config.gameType === 'staff-to-name' ? 'Note Match' : 'Clef Match',
    emoji: '🎵',
  }),

  getQuickTip: (config) =>
    config.gameType === 'staff-to-name'
      ? 'Match notes on the staff to their names'
      : 'Match the same pitch across clefs',
}
