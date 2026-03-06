import type { GameConfig, GameState, GameMove } from '@/lib/arcade/game-sdk/types'

export interface ConstantExplorerConfig extends GameConfig {
  constantId: string // 'random' or specific constant ID (e.g. 'pi', 'phi')
}

export interface ConstantExplorerState extends GameState {
  constantId: string | null
  phase: 'idle' | 'playing' | 'complete'
}

export interface ConstantExplorerMove extends GameMove {
  type: 'NOOP'
  data: Record<string, never>
}
