/**
 * Abacus Matching Game — Full Variant Definition (Client-Side)
 *
 * Extends the server-safe variant with React components for rendering.
 * This file imports .tsx components and should only be used on the client.
 */

import type { MatchingPairsVariant } from '@/lib/arcade/matching-pairs-framework'
import { AbacusCardFront } from './components/AbacusCardFront'
import { AbacusSetupContent } from './components/AbacusSetupContent'
import type { AbacusCard, AbacusConfig } from './types'
import { abacusVariantServer } from './variant-server'

export const abacusVariant: MatchingPairsVariant<AbacusCard, AbacusConfig> = {
  ...abacusVariantServer,

  CardFront: AbacusCardFront,

  getCardBackStyle: (card, isMatched) => {
    if (isMatched) {
      return { gradient: 'linear-gradient(135deg, #48bb78, #38a169)', icon: '✓' }
    }
    switch (card.type) {
      case 'abacus':
        return { gradient: 'linear-gradient(135deg, #7b4397, #dc2430)', icon: '🧮' }
      case 'number':
        return { gradient: 'linear-gradient(135deg, #2E86AB, #A23B72)', icon: '🔢' }
      case 'complement':
        return { gradient: 'linear-gradient(135deg, #F18F01, #6A994E)', icon: '🤝' }
      default:
        return { gradient: 'linear-gradient(135deg, #667eea, #764ba2)', icon: '❓' }
    }
  },

  shouldDimCard: (card, firstFlippedCard) => {
    if (firstFlippedCard.type === 'abacus' || firstFlippedCard.type === 'number') {
      return card.type === firstFlippedCard.type
    }
    return false
  },

  SetupContent: AbacusSetupContent,

  getNavInfo: (config) => ({
    title: config.gameType === 'abacus-numeral' ? 'Abacus Match' : 'Complement Pairs',
    emoji: config.gameType === 'abacus-numeral' ? '🧮' : '🤝',
  }),

  getQuickTip: (config) =>
    config.gameType === 'abacus-numeral'
      ? 'Match abacus beads with numbers'
      : 'Find pairs that add to 5 or 10',
}
