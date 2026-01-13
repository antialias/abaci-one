/**
 * Memory Quiz (Memory Lightning) Game Definition
 *
 * A memory game where players memorize soroban numbers and recall them.
 * Supports both cooperative and competitive multiplayer modes.
 */

import { defineGame, getGameTheme } from '@/lib/arcade/game-sdk'
import type { GameManifest } from '@/lib/arcade/game-sdk'
import { MemoryQuizGame } from './components/MemoryQuizGame'
import { MemoryQuizProvider } from './Provider'
import type { MemoryQuizConfig, MemoryQuizMove, MemoryQuizState } from './types'
import { memoryQuizGameValidator } from './Validator'

const manifest: GameManifest = {
  name: 'memory-quiz',
  displayName: 'Memory Lightning',
  icon: '🧠',
  description: 'Memorize soroban numbers and recall them',
  longDescription:
    'Test your memory by studying soroban numbers for a brief time, then recall as many as you can. ' +
    'Choose your difficulty level, number of cards, and display time. Play cooperatively with friends or compete for the highest score!',
  maxPlayers: 8,
  difficulty: 'Intermediate',
  chips: ['👥 Multiplayer', '🧠 Memory', '🧮 Soroban'],
  ...getGameTheme('purple'),
  available: true,
  practiceBreakReady: false, // Has practiceBreakConfig but UI integration not yet complete
  practiceBreakConfig: {
    suggestedConfig: {
      selectedCount: 5,
      displayTime: 2.0,
      selectedDifficulty: 'easy',
      playMode: 'cooperative', // Solo = cooperative with one player
    },
    lockedFields: ['playMode'], // Keep it solo for practice breaks
    minDurationMinutes: 1,
    maxDurationMinutes: 5,
    difficultyPresets: {
      easy: {
        selectedCount: 5,
        displayTime: 2.5,
        selectedDifficulty: 'beginner',
      },
      medium: {
        selectedCount: 5,
        displayTime: 2.0,
        selectedDifficulty: 'easy',
      },
      hard: {
        selectedCount: 8,
        displayTime: 1.5,
        selectedDifficulty: 'medium',
      },
    },
  },
}

const defaultConfig: MemoryQuizConfig = {
  selectedCount: 5,
  displayTime: 2.0,
  selectedDifficulty: 'easy',
  playMode: 'cooperative',
}

// Config validation function
function validateMemoryQuizConfig(config: unknown): config is MemoryQuizConfig {
  if (typeof config !== 'object' || config === null) {
    return false
  }

  const c = config as any

  // Validate selectedCount
  if (!('selectedCount' in c) || ![2, 5, 8, 12, 15].includes(c.selectedCount)) {
    return false
  }

  // Validate displayTime
  if (
    !('displayTime' in c) ||
    typeof c.displayTime !== 'number' ||
    c.displayTime < 0.5 ||
    c.displayTime > 10
  ) {
    return false
  }

  // Validate selectedDifficulty
  if (
    !('selectedDifficulty' in c) ||
    !['beginner', 'easy', 'medium', 'hard', 'expert'].includes(c.selectedDifficulty)
  ) {
    return false
  }

  // Validate playMode
  if (!('playMode' in c) || !['cooperative', 'competitive'].includes(c.playMode)) {
    return false
  }

  return true
}

export const memoryQuizGame = defineGame<MemoryQuizConfig, MemoryQuizState, MemoryQuizMove>({
  manifest,
  Provider: MemoryQuizProvider,
  GameComponent: MemoryQuizGame,
  validator: memoryQuizGameValidator,
  defaultConfig,
  validateConfig: validateMemoryQuizConfig,
})
