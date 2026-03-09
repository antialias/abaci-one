/**
 * Constant Explorer — Practice Break "Game"
 *
 * Embeds the number line's narrated constant explorations (pi, phi, e, etc.)
 * as a calm, contemplative practice break option. Not a game in the traditional
 * sense — no moves, no scoring — but registered in the game system so it
 * appears alongside arcade games in the break selection UI.
 */

import { defineGame, getGameTheme } from '@/lib/arcade/game-sdk'
import type { GameManifest } from '@/lib/arcade/game-sdk'
import { ConstantExplorerGame } from './GameComponent'
import { ConstantExplorerProvider } from './Provider'
import type { ConstantExplorerConfig, ConstantExplorerMove, ConstantExplorerState } from './types'
import { constantExplorerValidator } from './Validator'

const manifest: GameManifest = {
  name: 'constant-explorer',
  displayName: 'Math Discovery',
  icon: '\uD83D\uDD2D', // telescope
  description: 'Watch a beautiful math constant come to life',
  longDescription:
    'A narrated exploration of famous mathematical constants like pi, the golden ratio, ' +
    "and Euler's number. Watch animated visualizations on the number line while a narrator " +
    'explains what makes each constant special. A calm, contemplative break from practice.',
  maxPlayers: 1,
  difficulty: 'Beginner',
  chips: ['Discovery', 'Constants', 'Narrated'],
  ...getGameTheme('teal'),
  available: true,
  practiceBreakReady: true,
  practiceBreakConfig: {
    suggestedConfig: {
      constantId: 'random',
    },
    lockedFields: [],
    minDurationMinutes: 1,
    maxDurationMinutes: 5,
    difficultyPresets: {
      easy: { constantId: 'random' },
      medium: { constantId: 'random' },
      hard: { constantId: 'random' },
    },
    fieldConfig: {
      constantId: {
        label: 'Constant',
        type: 'select',
        options: [
          { value: 'random', label: 'Random' },
          { value: 'balance', label: 'Balance (least watched)' },
          { value: 'pi', label: '\u03C0 Pi' },
          { value: 'e', label: "e Euler's Number" },
          { value: 'phi', label: '\u03C6 Golden Ratio' },
          { value: 'sqrt2', label: '\u221A2 Square Root of 2' },
          { value: 'sqrt3', label: '\u221A3 Square Root of 3' },
          { value: 'tau', label: '\u03C4 Tau' },
          { value: 'gamma', label: '\u03B3 Euler-Mascheroni' },
          { value: 'ln2', label: 'ln2 Natural Log of 2' },
          { value: 'ramanujan', label: '1/\u03C0 Ramanujan' },
          { value: 'feigenbaum', label: '\u03B4 Feigenbaum' },
        ],
      },
    },
  },
  coPlay: { mode: 'none' },
}

const defaultConfig: ConstantExplorerConfig = {
  constantId: 'random',
}

export const constantExplorerGame = defineGame<
  ConstantExplorerConfig,
  ConstantExplorerState,
  ConstantExplorerMove
>({
  manifest,
  Provider: ConstantExplorerProvider,
  GameComponent: ConstantExplorerGame,
  validator: constantExplorerValidator,
  defaultConfig,
})
