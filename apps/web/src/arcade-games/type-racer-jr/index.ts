/**
 * Type Racer Jr. - Game Definition
 *
 * A typing game for young learners. Kids type words letter-by-letter,
 * starting with tiny words (cat, dog, sun) and progressing to bigger ones.
 */

import { defineGame, getGameTheme } from '@/lib/arcade/game-sdk'
import type { GameManifest } from '@/lib/arcade/game-sdk'
import { TypeRacerGame } from './components/TypeRacerGame'
import { TypeRacerJrProvider } from './Provider'
import type { TypeRacerJrConfig, TypeRacerJrMove, TypeRacerJrState } from './types'
import { typeRacerJrValidator } from './Validator'

const manifest: GameManifest = {
  name: 'type-racer-jr',
  displayName: 'Type Racer Jr.',
  icon: '⌨️',
  description: 'Type words letter by letter to earn stars',
  longDescription:
    'Learn to type by spelling words one letter at a time! ' +
    'Start with tiny words like "cat" and "dog", then progress to bigger words. ' +
    'Earn stars for speed and accuracy!',
  maxPlayers: 1,
  difficulty: 'Beginner',
  chips: ['⌨️ Typing', '⭐ Stars', '📚 Learning'],
  ...getGameTheme('orange'),
  available: true,
  practiceBreakReady: true,
  practiceBreakConfig: {
    suggestedConfig: {
      gameMode: 'free-play',
      startingDifficulty: 'level1',
      wordCount: 5,
      timeLimit: null,
    },
    lockedFields: ['gameMode'],
    minDurationMinutes: 1,
    maxDurationMinutes: 5,
    difficultyPresets: {
      easy: {
        startingDifficulty: 'level1',
        wordCount: 5,
      },
      medium: {
        startingDifficulty: 'level1',
        wordCount: 8,
      },
      hard: {
        startingDifficulty: 'level2',
        wordCount: 10,
      },
    },
  },
  resultsConfig: {
    supportsResults: true,
    resultsDisplayDurationMs: 5000,
    scoreboardCategory: 'speed',
  },
}

const defaultConfig: TypeRacerJrConfig = {
  gameMode: 'free-play',
  timeLimit: null,
  startingDifficulty: 'level1',
  wordCount: 5,
  keyboardLayout: 'qwerty',
  showVirtualKeyboard: false,
}

function validateTypeRacerJrConfig(config: unknown): config is TypeRacerJrConfig {
  if (typeof config !== 'object' || config === null) return false
  const c = config as Record<string, unknown>

  if (!('gameMode' in c) || !['free-play', 'beat-the-clock'].includes(c.gameMode as string)) {
    return false
  }
  if (
    !('startingDifficulty' in c) ||
    !['level1', 'level2', 'level3'].includes(c.startingDifficulty as string)
  ) {
    return false
  }
  if ('timeLimit' in c && c.timeLimit !== null && typeof c.timeLimit !== 'number') {
    return false
  }
  if ('wordCount' in c && c.wordCount !== null && typeof c.wordCount !== 'number') {
    return false
  }

  return true
}

export const typeRacerJrGame = defineGame<TypeRacerJrConfig, TypeRacerJrState, TypeRacerJrMove>({
  manifest,
  Provider: TypeRacerJrProvider,
  GameComponent: TypeRacerGame,
  validator: typeRacerJrValidator,
  defaultConfig,
  validateConfig: validateTypeRacerJrConfig,
})
