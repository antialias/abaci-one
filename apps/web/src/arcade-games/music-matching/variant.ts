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
        gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
        icon: '🎵',
      }
    }
    // note-name cards
    return {
      gradient: 'linear-gradient(135deg, #9b59b6, #8e44ad)',
      icon: '🎼',
    }
  },

  shouldDimCard: (card, firstFlippedCard) => {
    // Staff-to-name mode: after flipping one type, dim cards of the same type
    if (firstFlippedCard.type === 'staff-note' && card.type === 'staff-note') {
      return true
    }
    if (firstFlippedCard.type === 'note-name' && card.type === 'note-name') {
      return true
    }
    // Treble-to-bass mode: dim cards with the same clef
    if (
      firstFlippedCard.type === 'staff-note' &&
      card.type === 'staff-note' &&
      firstFlippedCard.clef === card.clef
    ) {
      return true
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
