import type { GameValidator, ValidationResult } from '@/lib/arcade/validation/types'
import {
  YjsDemoStateSchema,
  type YjsDemoConfig,
  type YjsDemoMove,
  type YjsDemoState,
} from './types'

export class YjsDemoValidator implements GameValidator<YjsDemoState, YjsDemoMove> {
  // Zod schema for runtime validation of state loaded from database
  stateSchema = YjsDemoStateSchema

  validateMove(state: YjsDemoState, move: YjsDemoMove): ValidationResult {
    switch (move.type) {
      case 'START_GAME':
        return this.validateStartGame(state, move.data.activePlayers)
      case 'END_GAME':
        return this.validateEndGame(state)
      case 'GO_TO_SETUP':
        return this.validateGoToSetup(state)
      default:
        return { valid: false, error: 'Unknown move type' }
    }
  }

  private validateStartGame(state: YjsDemoState, activePlayers: string[]): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Game already started' }
    }

    if (activePlayers.length === 0) {
      return { valid: false, error: 'No players selected' }
    }

    const playerScores: Record<string, number> = {}
    for (const playerId of activePlayers) {
      playerScores[playerId] = 0
    }

    const newState: YjsDemoState = {
      ...state,
      gamePhase: 'playing',
      activePlayers,
      playerScores,
      startTime: Date.now(),
    }

    return { valid: true, newState }
  }

  private validateEndGame(state: YjsDemoState): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Game is not in progress' }
    }

    const newState: YjsDemoState = {
      ...state,
      gamePhase: 'results',
      endTime: Date.now(),
    }

    return { valid: true, newState }
  }

  private validateGoToSetup(state: YjsDemoState): ValidationResult {
    const newState: YjsDemoState = {
      ...state,
      gamePhase: 'setup',
      activePlayers: [],
      playerScores: {},
      startTime: undefined,
      endTime: undefined,
    }

    return { valid: true, newState }
  }

  isGameComplete(state: YjsDemoState): boolean {
    return state.gamePhase === 'results'
  }

  getInitialState(config: YjsDemoConfig): YjsDemoState {
    return {
      gamePhase: 'setup',
      gridSize: config.gridSize,
      duration: config.duration,
      activePlayers: [],
      playerScores: {},
    }
  }
}

export const yjsDemoValidator = new YjsDemoValidator()
