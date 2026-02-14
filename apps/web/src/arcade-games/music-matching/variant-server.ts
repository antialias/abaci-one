/**
 * Music Matching Game — Server-Safe Variant Definition
 *
 * Contains only the data/logic fields needed by the validator.
 * No React component imports — safe to use in server.js / socket-server.
 */

import type { MatchingPairsVariant } from '@/lib/arcade/matching-pairs-framework'
import { generateMusicCards, getGridConfiguration } from './utils/cardGeneration'
import { validateMatch } from './utils/matchValidation'
import { MusicCardSchema } from './types'
import type { MusicCard, MusicConfig } from './types'

export const musicVariantServer: Pick<
  MatchingPairsVariant<MusicCard, MusicConfig>,
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
> = {
  gameName: 'music-matching',

  defaultConfig: {
    gameType: 'staff-to-name',
    clef: 'treble',
    difficulty: 6,
    turnTimer: 30,
  },

  cardSchema: MusicCardSchema,

  generateCards: (config) => generateMusicCards(config),

  validateMatch: (card1, card2) => validateMatch(card1, card2),

  validateConfigField: (field, value) => {
    switch (field) {
      case 'gameType':
        if (!['staff-to-name', 'treble-to-bass'].includes(value)) {
          return 'Invalid game type'
        }
        return null
      case 'clef':
        if (!['treble', 'bass', 'both'].includes(value)) {
          return 'Invalid clef'
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
    clef: config.clef,
    difficulty: config.difficulty,
    turnTimer: config.turnTimer,
  }),

  hasConfigChangedFrom: (current, original) =>
    current.gameType !== original.gameType ||
    current.clef !== original.clef ||
    current.difficulty !== original.difficulty ||
    current.turnTimer !== original.turnTimer,

  getGridConfig: (config) => getGridConfiguration(config.difficulty),

  practiceBreakDefaults: {
    gameType: 'staff-to-name',
    clef: 'treble',
    difficulty: 6,
    turnTimer: 30,
  },
}
