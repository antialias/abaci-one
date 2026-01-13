/**
 * Matching Pairs Battle Game Definition
 *
 * A turn-based multiplayer memory game where players flip cards to find matching pairs.
 * Supports both abacus-numeral matching and complement pairs modes.
 */

import { defineGame, getGameTheme } from '@/lib/arcade/game-sdk'
import type { GameManifest } from '@/lib/arcade/game-sdk'
import { MemoryPairsGame } from './components/MemoryPairsGame'
import { MatchingProvider } from './Provider'
import type { MatchingConfig, MatchingMove, MatchingState } from './types'
import { matchingGameValidator } from './Validator'

const manifest: GameManifest = {
  name: 'matching',
  displayName: 'Matching Pairs Battle',
  shortName: 'Matching Pairs',
  icon: '⚔️',
  description: 'Multiplayer memory battle with friends',
  longDescription:
    'Battle friends in epic memory challenges. Match pairs faster than your opponents in this exciting multiplayer experience. ' +
    'Choose between abacus-numeral matching or complement pairs mode. Strategic thinking and quick memory are key to victory!',
  maxPlayers: 4,
  difficulty: 'Intermediate',
  chips: ['👥 Multiplayer', '🎯 Strategic', '🏆 Competitive'],
  ...getGameTheme('pink'),
  available: true,
  practiceBreakReady: true, // Works as single-player, quick 2-5 minute sessions
  practiceBreakConfig: {
    suggestedConfig: {
      gameType: 'abacus-numeral',
      difficulty: 6, // Quick games with fewer pairs
      turnTimer: 30,
    },
    lockedFields: ['turnTimer'], // Don't let kids change timer during break
    minDurationMinutes: 2,
    maxDurationMinutes: 8,
    difficultyPresets: {
      easy: { difficulty: 6, gameType: 'abacus-numeral' },
      medium: { difficulty: 8, gameType: 'abacus-numeral' },
      hard: { difficulty: 12, gameType: 'complement-pairs' },
    },
  },
}

const defaultConfig: MatchingConfig = {
  gameType: 'abacus-numeral',
  difficulty: 6,
  turnTimer: 30,
}

// Config validation function
function validateMatchingConfig(config: unknown): config is MatchingConfig {
  if (typeof config !== 'object' || config === null) {
    return false
  }

  const c = config as any

  // Validate gameType
  if (!('gameType' in c) || !['abacus-numeral', 'complement-pairs'].includes(c.gameType)) {
    return false
  }

  // Validate difficulty (number of pairs)
  if (!('difficulty' in c) || ![6, 8, 12, 15].includes(c.difficulty)) {
    return false
  }

  // Validate turnTimer
  if (
    !('turnTimer' in c) ||
    typeof c.turnTimer !== 'number' ||
    c.turnTimer < 5 ||
    c.turnTimer > 300
  ) {
    return false
  }

  return true
}

export const matchingGame = defineGame<MatchingConfig, MatchingState, MatchingMove>({
  manifest,
  Provider: MatchingProvider,
  GameComponent: MemoryPairsGame,
  validator: matchingGameValidator,
  defaultConfig,
  validateConfig: validateMatchingConfig,
})
