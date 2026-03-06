import type { GameConfig, GameState, GameMove } from '@/lib/arcade/game-sdk/types'

export interface ConstantExplorerConfig extends GameConfig {
  constantId: string // 'random', 'balance', or specific constant ID (e.g. 'pi', 'phi')
}

export interface ConstantExplorerState extends GameState {
  constantId: string | null
  phase: 'idle' | 'playing' | 'complete'
  playerId?: string
  playerName?: string
  startedAt?: number
}

export interface ConstantExplorerMove extends GameMove {
  type: 'NOOP'
  data: Record<string, never>
}
