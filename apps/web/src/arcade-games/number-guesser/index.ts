/**
 * Number Guesser Game Definition
 * Exports the complete game using the Arcade SDK
 */

import { defineGame } from '@/lib/arcade/game-sdk'
import type { GameManifest } from '@/lib/arcade/game-sdk'
import { GameComponent } from './components/GameComponent'
import { NumberGuesserProvider } from './Provider'
import type { NumberGuesserConfig, NumberGuesserMove, NumberGuesserState } from './types'
import { numberGuesserValidator } from './Validator'

// Game manifest (matches game.yaml)
const manifest: GameManifest = {
  name: 'number-guesser',
  displayName: 'Number Guesser',
  icon: '🎯',
  description: 'Classic turn-based number guessing game',
  longDescription:
    'One player thinks of a number, others take turns guessing. Get hot/cold feedback to narrow down your guesses. First to guess wins the round!',
  maxPlayers: 4,
  difficulty: 'Beginner',
  chips: ['👥 Multiplayer', '🎲 Turn-Based', '🧠 Logic Puzzle'],
  color: 'orange',
  gradient: 'linear-gradient(135deg, #fed7aa, #fdba74)',
  borderColor: 'orange.200',
  available: true,
}

// Default configuration
const defaultConfig: NumberGuesserConfig = {
  minNumber: 1,
  maxNumber: 100,
  roundsToWin: 3,
}

// Export game definition
export const numberGuesserGame = defineGame<
  NumberGuesserConfig,
  NumberGuesserState,
  NumberGuesserMove
>({
  manifest,
  Provider: NumberGuesserProvider,
  GameComponent,
  validator: numberGuesserValidator,
  defaultConfig,
})
