import type { GameConfig, GameState } from '@/lib/arcade/game-sdk/types'

export interface YjsDemoConfig extends GameConfig {
  gridSize: 8 | 12 | 16
  duration: 60 | 120 | 180
  [key: string]: unknown
}

export interface YjsDemoState extends GameState {
  gamePhase: 'setup' | 'playing' | 'results'
  gridSize: number
  duration: number
  startTime?: number
  endTime?: number
  activePlayers: string[]
  playerScores: Record<string, number>
  // Cells array for persistence (synced from Y.Doc)
  cells?: GridCell[]
}

// For Yjs synchronization
export interface GridCell {
  id: string
  x: number
  y: number
  playerId: string
  timestamp: number
  color: string
}

// Moves are not used in Yjs demo (everything goes through Y.Doc)
// but we need this for arcade compatibility
export type YjsDemoMove =
  | {
      type: 'START_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: { activePlayers: string[] }
    }
  | {
      type: 'END_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'GO_TO_SETUP'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
