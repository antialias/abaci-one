/**
 * Complement Race - Modular Game Definition
 * Complete integration into the arcade system with multiplayer support
 */

import { defineGame, getGameTheme } from '@/lib/arcade/game-sdk'
import type { GameManifest } from '@/lib/arcade/game-sdk'
import { complementRaceValidator } from './Validator'
import { ComplementRaceProvider } from './Provider'
import { GameComponent } from './components/GameComponent'
import type { ComplementRaceConfig, ComplementRaceState, ComplementRaceMove } from './types'

// Game manifest
const manifest: GameManifest = {
  name: 'complement-race',
  displayName: 'Speed Complement Race 🏁',
  description: 'Race against opponents while solving complement problems',
  longDescription:
    'Battle AI opponents or real players in an epic math race! Find complement numbers (friends of 5 and 10) to build momentum and speed ahead. Choose from three exciting modes: Practice (linear race), Sprint (train journey with passengers), or Survival (infinite laps). Perfect for multiplayer competition!',
  maxPlayers: 4,
  icon: '🏁',
  chips: ['👥 1-4 Players', '🚂 Sprint Mode', '🤖 AI Opponents', '🔥 Speed Challenge'],
  ...getGameTheme('blue'),
  difficulty: 'Intermediate',
  available: true,
}

// Default configuration
const defaultConfig: ComplementRaceConfig = {
  style: 'practice',
  mode: 'mixed',
  complementDisplay: 'random',
  timeoutSetting: 'normal',
  enableAI: true,
  aiOpponentCount: 2,
  maxPlayers: 4,
  routeDuration: 60,
  enablePassengers: true,
  passengerCount: 6,
  maxConcurrentPassengers: 3,
  raceGoal: 20,
  winCondition: 'infinite', // Sprint mode is infinite by default (Steam Sprint)
  routeCount: 3,
  targetScore: 100,
  timeLimit: 300,
}

// Config validation function
function validateComplementRaceConfig(config: unknown): config is ComplementRaceConfig {
  const c = config as any
  return (
    typeof c === 'object' &&
    c !== null &&
    ['practice', 'sprint', 'survival'].includes(c.style) &&
    ['friends5', 'friends10', 'mixed'].includes(c.mode) &&
    typeof c.maxPlayers === 'number' &&
    c.maxPlayers >= 1 &&
    c.maxPlayers <= 4
  )
}

// Export game definition with proper generics
export const complementRaceGame = defineGame<
  ComplementRaceConfig,
  ComplementRaceState,
  ComplementRaceMove
>({
  manifest,
  Provider: ComplementRaceProvider,
  GameComponent,
  validator: complementRaceValidator,
  defaultConfig,
  validateConfig: validateComplementRaceConfig,
})

// Re-export types for convenience
export type { ComplementRaceConfig, ComplementRaceState, ComplementRaceMove } from './types'
export { complementRaceValidator } from './Validator'
