/**
 * Music Note Matching Game Definition
 *
 * A matching-pairs game where players match staff notation with note names
 * or match the same pitch across treble and bass clefs.
 */

import { getGameTheme } from '@/lib/arcade/game-themes'
import type { GameManifest } from '@/lib/arcade/manifest-schema'
import { defineMatchingPairsGame } from '@/lib/arcade/matching-pairs-framework'
import { musicVariant } from './variant'
import type { MusicConfig } from './types'

const manifest: GameManifest = {
  name: 'music-matching',
  displayName: 'Music Note Match',
  shortName: 'Note Match',
  icon: '🎵',
  description: 'Match notes on the staff with their names',
  longDescription:
    'Learn to read music by matching staff notation with note names. ' +
    'Choose between treble clef, bass clef, or both. ' +
    'Challenge yourself with accidentals and ledger lines at higher difficulties!',
  maxPlayers: 4,
  difficulty: 'Beginner',
  chips: ['🎵 Music', '📖 Sight-Reading', '🧠 Memory'],
  ...getGameTheme('purple'),
  available: true,
  practiceBreakReady: true,
  practiceBreakConfig: {
    suggestedConfig: {
      gameType: 'staff-to-name',
      clef: 'treble',
      difficulty: 6,
      turnTimer: 30,
    },
    lockedFields: ['turnTimer'],
    minDurationMinutes: 2,
    maxDurationMinutes: 8,
    difficultyPresets: {
      easy: { difficulty: 6, gameType: 'staff-to-name', clef: 'treble' },
      medium: { difficulty: 8, gameType: 'staff-to-name', clef: 'both' },
      hard: { difficulty: 12, gameType: 'treble-to-bass', clef: 'both' },
    },
  },
  resultsConfig: {
    supportsResults: true,
    resultsDisplayDurationMs: 5000,
    scoreboardCategory: 'memory',
  },
}

function validateMusicConfig(config: unknown): config is MusicConfig {
  if (typeof config !== 'object' || config === null) {
    return false
  }

  const c = config as Record<string, unknown>

  if (!('gameType' in c) || !['staff-to-name', 'treble-to-bass'].includes(c.gameType as string)) {
    return false
  }

  if (!('clef' in c) || !['treble', 'bass', 'both'].includes(c.clef as string)) {
    return false
  }

  if (!('difficulty' in c) || ![6, 8, 12, 15].includes(c.difficulty as number)) {
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
  variant: musicVariant,
  validateConfig: validateMusicConfig,
})

export const musicMatchingGame = game
export { useMatchingPairs }
export const musicMatchingValidator = validator
