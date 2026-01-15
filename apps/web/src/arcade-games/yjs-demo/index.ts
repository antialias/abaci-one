/**
 * Yjs Demo Game Definition
 *
 * A demonstration of real-time multiplayer synchronization using Yjs CRDTs.
 * Players collaborate on a shared grid, with state synchronized via Yjs WebSockets.
 */

import { defineGame, getGameTheme } from '@/lib/arcade/game-sdk'
import type { GameManifest } from '@/lib/arcade/game-sdk'
import { YjsDemoGame } from './components/YjsDemoGame'
import { YjsDemoProvider } from './Provider'
import type { YjsDemoConfig, YjsDemoMove, YjsDemoState } from './types'
import { yjsDemoValidator } from './Validator'

const manifest: GameManifest = {
  name: 'yjs-demo',
  displayName: 'Yjs Sync Demo',
  icon: '🔄',
  description: 'Real-time collaboration demo with Yjs',
  longDescription:
    'Experience the power of Yjs CRDTs in action! This demo shows how multiple players can interact with a shared grid in real-time. ' +
    'Click on cells to claim them, and watch as other players do the same. Yjs handles all the conflict resolution automatically, ' +
    'ensuring everyone sees a consistent view of the game state without traditional server validation.',
  maxPlayers: 8,
  difficulty: 'Beginner',
  chips: ['🤝 Collaborative', '⚡ Real-time', '🔬 Demo'],
  ...getGameTheme('teal'),
  available: true,
  practiceBreakReady: false,
}

const defaultConfig: YjsDemoConfig = {
  gridSize: 8,
  duration: 60,
}

// Config validation function
function validateYjsDemoConfig(config: unknown): config is YjsDemoConfig {
  if (typeof config !== 'object' || config === null) {
    return false
  }

  const c = config as any

  // Validate gridSize
  if (!('gridSize' in c) || ![8, 12, 16].includes(c.gridSize)) {
    return false
  }

  // Validate duration
  if (!('duration' in c) || ![60, 120, 180].includes(c.duration)) {
    return false
  }

  return true
}

export const yjsDemoGame = defineGame<YjsDemoConfig, YjsDemoState, YjsDemoMove>({
  manifest,
  Provider: YjsDemoProvider,
  GameComponent: YjsDemoGame,
  validator: yjsDemoValidator,
  defaultConfig,
  validateConfig: validateYjsDemoConfig,
})
