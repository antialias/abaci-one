/**
 * Abacus Matching Game — Variant Definition
 *
 * Thin variant definition that plugs into the matching-pairs framework.
 * All game logic (Provider, Validator, components) comes from the framework;
 * this file only supplies the abacus-specific bits.
 */

import type { MatchingPairsVariant } from '@/lib/arcade/matching-pairs-framework'
import { generateGameCards, getGridConfiguration } from './utils/cardGeneration'
import { validateMatch } from './utils/matchValidation'
import { AbacusCardFront } from './components/AbacusCardFront'
import { AbacusSetupContent } from './components/AbacusSetupContent'
import { AbacusCardSchema } from './types'
import type { AbacusCard, AbacusConfig } from './types'

export const abacusVariant: MatchingPairsVariant<AbacusCard, AbacusConfig> = {
  gameName: 'matching',

  defaultConfig: {
    gameType: 'abacus-numeral',
    difficulty: 6,
    turnTimer: 30,
  },

  cardSchema: AbacusCardSchema,

  generateCards: (config) => generateGameCards(config.gameType, config.difficulty),

  validateMatch: (card1, card2) => validateMatch(card1, card2),

  validateConfigField: (field, value) => {
    switch (field) {
      case 'gameType':
        if (!['abacus-numeral', 'complement-pairs'].includes(value)) {
          return 'Invalid game type'
        }
        return null
      case 'difficulty':
        if (![6, 8, 12, 15].includes(value)) {
          return 'Invalid difficulty'
        }
        return null
      case 'turnTimer':
        if (typeof value !== 'number' || value < 5 || value > 300) {
          return 'Turn timer must be between 5 and 300'
        }
        return null
      default:
        return null
    }
  },

  getTotalPairs: (config) => config.difficulty,

  getOriginalConfig: (config) => ({
    gameType: config.gameType,
    difficulty: config.difficulty,
    turnTimer: config.turnTimer,
  }),

  hasConfigChangedFrom: (current, original) =>
    current.gameType !== original.gameType ||
    current.difficulty !== original.difficulty ||
    current.turnTimer !== original.turnTimer,

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
    // In abacus-numeral mode: dim cards of the same type as the first flipped card
    // (since matches require one abacus + one number card)
    if (firstFlippedCard.type === 'abacus' || firstFlippedCard.type === 'number') {
      return card.type === firstFlippedCard.type
    }
    // In complement mode: no smart dimming (all cards are 'complement' type)
    return false
  },

  SetupContent: AbacusSetupContent,

  getGridConfig: (config) => getGridConfiguration(config.difficulty),

  getNavInfo: (config) => ({
    title: config.gameType === 'abacus-numeral' ? 'Abacus Match' : 'Complement Pairs',
    emoji: config.gameType === 'abacus-numeral' ? '🧮' : '🤝',
  }),

  getQuickTip: (config) =>
    config.gameType === 'abacus-numeral'
      ? 'Match abacus beads with numbers'
      : 'Find pairs that add to 5 or 10',

  practiceBreakDefaults: {
    gameType: 'abacus-numeral',
    difficulty: 6,
    turnTimer: 30,
  },
}
