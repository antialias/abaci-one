/**
 * Matching Pairs Battle Game Definition
 *
 * A turn-based multiplayer memory game where players flip cards to find matching pairs.
 * Supports both abacus-numeral matching and complement pairs modes.
 *
 * Now powered by the matching-pairs framework with a thin variant definition.
 */

import { getGameTheme } from '@/lib/arcade/game-themes'
import type { GameManifest } from '@/lib/arcade/manifest-schema'
import { defineMatchingPairsGame } from '@/lib/arcade/matching-pairs-framework'
import { abacusVariant } from './variant'
import type { AbacusConfig } from './types'

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
  practiceBreakReady: true,
  practiceBreakConfig: {
    suggestedConfig: {
      gameType: 'abacus-numeral',
      difficulty: 6,
      turnTimer: 30,
    },
    lockedFields: ['turnTimer'],
    minDurationMinutes: 2,
    maxDurationMinutes: 8,
    difficultyPresets: {
      easy: { difficulty: 6, gameType: 'abacus-numeral' },
      medium: { difficulty: 8, gameType: 'abacus-numeral' },
      hard: { difficulty: 12, gameType: 'complement-pairs' },
    },
    fieldConfig: {
      gameType: {
        label: 'Match Type',
        type: 'select',
        options: [
          { value: 'abacus-numeral', label: 'Abacus ↔ Number' },
          { value: 'complement-pairs', label: 'Complement Pairs' },
        ],
      },
      difficulty: {
        label: 'Pairs',
        type: 'select',
        options: [
          { value: 6, label: '6' },
          { value: 8, label: '8' },
          { value: 12, label: '12' },
          { value: 15, label: '15' },
        ],
      },
    },
  },
  resultsConfig: {
    supportsResults: true,
    resultsDisplayDurationMs: 5000,
    scoreboardCategory: 'memory',
  },
}

// Config validation function
function validateMatchingConfig(config: unknown): config is AbacusConfig {
  if (typeof config !== 'object' || config === null) {
    return false
  }

  const c = config as any

  if (!('gameType' in c) || !['abacus-numeral', 'complement-pairs'].includes(c.gameType)) {
    return false
  }

  if (!('difficulty' in c) || ![6, 8, 12, 15].includes(c.difficulty)) {
    return false
  }

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

const { game, useMatchingPairs, validator } = defineMatchingPairsGame({
  manifest,
  variant: abacusVariant,
  validateConfig: validateMatchingConfig,
})

export const matchingGame = game
export { useMatchingPairs }
export const matchingGameValidator = validator
