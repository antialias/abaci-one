/**
 * Card Sorting Challenge Game Definition
 *
 * A single-player pattern recognition game where players arrange abacus cards
 * in ascending order using only visual patterns (no numbers shown).
 */

import { defineGame, getGameTheme } from '@/lib/arcade/game-sdk'
import type { GameManifest } from '@/lib/arcade/game-sdk'
import { GameComponent } from './components/GameComponent'
import { CardSortingProvider } from './Provider'
import type { CardSortingConfig, CardSortingMove, CardSortingState } from './types'
import { cardSortingValidator } from './Validator'

const manifest: GameManifest = {
  name: 'card-sorting',
  displayName: 'Card Sorting Challenge',
  icon: '🔢',
  description: 'Sort abacus cards using pattern recognition',
  longDescription:
    'Challenge your abacus reading skills! Arrange cards in ascending order using only ' +
    'the visual patterns - no numbers shown. Perfect for practicing number recognition and ' +
    'developing mental math intuition.',
  maxPlayers: 1, // Single player only
  difficulty: 'Intermediate',
  chips: ['🧠 Pattern Recognition', '🎯 Solo Challenge', '📊 Smart Scoring'],
  ...getGameTheme('green'),
  available: true,
}

const defaultConfig: CardSortingConfig = {
  cardCount: 8,
  showNumbers: true,
  timeLimit: null,
}

// Config validation function
function validateCardSortingConfig(config: unknown): config is CardSortingConfig {
  if (typeof config !== 'object' || config === null) {
    return false
  }

  const c = config as Record<string, unknown>

  // Validate cardCount
  if (!('cardCount' in c) || ![5, 8, 12, 15].includes(c.cardCount as number)) {
    return false
  }

  // Validate showNumbers
  if (!('showNumbers' in c) || typeof c.showNumbers !== 'boolean') {
    return false
  }

  // Validate timeLimit
  if ('timeLimit' in c) {
    if (c.timeLimit !== null && (typeof c.timeLimit !== 'number' || c.timeLimit < 30)) {
      return false
    }
  }

  return true
}

export const cardSortingGame = defineGame<CardSortingConfig, CardSortingState, CardSortingMove>({
  manifest,
  Provider: CardSortingProvider,
  GameComponent,
  validator: cardSortingValidator,
  defaultConfig,
  validateConfig: validateCardSortingConfig,
})
