/**
 * Type definitions for Number Guesser game
 */

import type { GameMove } from '@/lib/arcade/game-sdk'

/**
 * Game configuration
 */
export type NumberGuesserConfig = {
  minNumber: number
  maxNumber: number
  roundsToWin: number
}

/**
 * A single guess attempt
 */
export interface Guess {
  playerId: string
  playerName: string
  guess: number
  distance: number // How far from the secret number
  timestamp: number
}

/**
 * Game phases
 */
export type GamePhase = 'setup' | 'choosing' | 'guessing' | 'results'

/**
 * Game state
 */
export type NumberGuesserState = {
  // Configuration
  minNumber: number
  maxNumber: number
  roundsToWin: number

  // Game phase
  gamePhase: GamePhase

  // Players
  activePlayers: string[]
  playerMetadata: Record<string, { name: string; emoji: string; color: string; userId: string }>

  // Current round
  secretNumber: number | null
  chooser: string // Player ID who chose the number
  currentGuesser: string // Player ID whose turn it is to guess

  // Round history
  guesses: Guess[]
  roundNumber: number

  // Scores
  scores: Record<string, number>

  // Game state
  gameStartTime: number | null
  gameEndTime: number | null
  winner: string | null
}

/**
 * Game moves
 */
export interface StartGameMove extends GameMove {
  type: 'START_GAME'
  data: {
    activePlayers: string[]
    playerMetadata: Record<string, unknown>
  }
}

export interface ChooseNumberMove extends GameMove {
  type: 'CHOOSE_NUMBER'
  data: {
    secretNumber: number
  }
}

export interface MakeGuessMove extends GameMove {
  type: 'MAKE_GUESS'
  data: {
    guess: number
    playerName: string
  }
}

export interface NextRoundMove extends GameMove {
  type: 'NEXT_ROUND'
  data: Record<string, never>
}

export interface GoToSetupMove extends GameMove {
  type: 'GO_TO_SETUP'
  data: Record<string, never>
}

export interface SetConfigMove extends GameMove {
  type: 'SET_CONFIG'
  data: {
    field: 'minNumber' | 'maxNumber' | 'roundsToWin'
    value: number
  }
}

export type NumberGuesserMove =
  | StartGameMove
  | ChooseNumberMove
  | MakeGuessMove
  | NextRoundMove
  | GoToSetupMove
  | SetConfigMove
