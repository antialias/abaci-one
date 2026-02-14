/**
 * Abacus Matching Game — Server-Safe Variant Definition
 *
 * Contains only the data/logic fields needed by the validator.
 * No React component imports — safe to use in server.js / socket-server.
 *
 * The full variant (with React components) is in variant.ts,
 * which extends this with CardFront, SetupContent, etc.
 */

import type { MatchingPairsVariant } from '@/lib/arcade/matching-pairs-framework'
import { generateGameCards, getGridConfiguration } from './utils/cardGeneration'
import { validateMatch } from './utils/matchValidation'
import { AbacusCardSchema } from './types'
import type { AbacusCard, AbacusConfig } from './types'

/**
 * Server-safe subset of the variant — everything the validator needs.
 * React component fields (CardFront, SetupContent) are omitted.
 */
export const abacusVariantServer: Pick<
  MatchingPairsVariant<AbacusCard, AbacusConfig>,
  | 'gameName'
  | 'defaultConfig'
  | 'cardSchema'
  | 'generateCards'
  | 'validateMatch'
  | 'validateConfigField'
  | 'getTotalPairs'
  | 'getOriginalConfig'
  | 'hasConfigChangedFrom'
  | 'practiceBreakDefaults'
  | 'getGridConfig'
  | 'canFlipCard'
> = {
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

  getGridConfig: (config) => getGridConfiguration(config.difficulty),

  practiceBreakDefaults: {
    gameType: 'abacus-numeral',
    difficulty: 6,
    turnTimer: 30,
  },
}
