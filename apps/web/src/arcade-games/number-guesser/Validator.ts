/**
 * Server-side validator for Number Guesser game
 */

import type { GameValidator, ValidationResult } from '@/lib/arcade/game-sdk'
import type { NumberGuesserConfig, NumberGuesserMove, NumberGuesserState } from './types'

export class NumberGuesserValidator
  implements GameValidator<NumberGuesserState, NumberGuesserMove>
{
  validateMove(state: NumberGuesserState, move: NumberGuesserMove): ValidationResult {
    switch (move.type) {
      case 'START_GAME':
        return this.validateStartGame(state, move.data.activePlayers, move.data.playerMetadata)

      case 'CHOOSE_NUMBER':
        // Ensure secretNumber is a number (JSON deserialization can make it a string)
        return this.validateChooseNumber(state, Number(move.data.secretNumber), move.playerId)

      case 'MAKE_GUESS':
        // Ensure guess is a number (JSON deserialization can make it a string)
        return this.validateMakeGuess(
          state,
          Number(move.data.guess),
          move.playerId,
          move.data.playerName
        )

      case 'NEXT_ROUND':
        return this.validateNextRound(state)

      case 'GO_TO_SETUP':
        return this.validateGoToSetup(state)

      case 'SET_CONFIG':
        // Ensure value is a number (JSON deserialization can make it a string)
        return this.validateSetConfig(state, move.data.field, Number(move.data.value))

      default:
        return {
          valid: false,
          error: `Unknown move type: ${(move as { type: string }).type}`,
        }
    }
  }

  private validateStartGame(
    state: NumberGuesserState,
    activePlayers: string[],
    playerMetadata: Record<string, unknown>
  ): ValidationResult {
    if (!activePlayers || activePlayers.length < 2) {
      return { valid: false, error: 'Need at least 2 players' }
    }

    const newState: NumberGuesserState = {
      ...state,
      gamePhase: 'choosing',
      activePlayers,
      playerMetadata: playerMetadata as typeof state.playerMetadata,
      chooser: activePlayers[0],
      currentGuesser: '',
      secretNumber: null,
      guesses: [],
      roundNumber: 1,
      scores: activePlayers.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
      gameStartTime: Date.now(),
      gameEndTime: null,
      winner: null,
    }

    return { valid: true, newState }
  }

  private validateChooseNumber(
    state: NumberGuesserState,
    secretNumber: number,
    playerId: string
  ): ValidationResult {
    if (state.gamePhase !== 'choosing') {
      return { valid: false, error: 'Not in choosing phase' }
    }

    if (playerId !== state.chooser) {
      return { valid: false, error: 'Not your turn to choose' }
    }

    if (
      secretNumber < state.minNumber ||
      secretNumber > state.maxNumber ||
      !Number.isInteger(secretNumber)
    ) {
      return {
        valid: false,
        error: `Number must be between ${state.minNumber} and ${state.maxNumber}`,
      }
    }

    // Debug logging
    console.log('[NumberGuesser] Setting secret number:', {
      secretNumber,
      secretNumberType: typeof secretNumber,
    })

    // First guesser is the next player after chooser
    const chooserIndex = state.activePlayers.indexOf(state.chooser)
    const firstGuesserIndex = (chooserIndex + 1) % state.activePlayers.length
    const firstGuesser = state.activePlayers[firstGuesserIndex]

    const newState: NumberGuesserState = {
      ...state,
      gamePhase: 'guessing',
      secretNumber,
      currentGuesser: firstGuesser,
    }

    return { valid: true, newState }
  }

  private validateMakeGuess(
    state: NumberGuesserState,
    guess: number,
    playerId: string,
    playerName: string
  ): ValidationResult {
    if (state.gamePhase !== 'guessing') {
      return { valid: false, error: 'Not in guessing phase' }
    }

    if (playerId !== state.currentGuesser) {
      return { valid: false, error: 'Not your turn to guess' }
    }

    if (guess < state.minNumber || guess > state.maxNumber || !Number.isInteger(guess)) {
      return {
        valid: false,
        error: `Guess must be between ${state.minNumber} and ${state.maxNumber}`,
      }
    }

    if (!state.secretNumber) {
      return { valid: false, error: 'No secret number set' }
    }

    // Debug logging
    console.log('[NumberGuesser] Validating guess:', {
      guess,
      guessType: typeof guess,
      secretNumber: state.secretNumber,
      secretNumberType: typeof state.secretNumber,
    })

    const distance = Math.abs(guess - state.secretNumber)

    console.log('[NumberGuesser] Calculated distance:', distance)
    const newGuess = {
      playerId,
      playerName,
      guess,
      distance,
      timestamp: Date.now(),
    }

    const guesses = [...state.guesses, newGuess]

    // Check if guess is correct
    if (distance === 0) {
      // Correct guess! Award point and end round
      const newScores = {
        ...state.scores,
        [playerId]: (state.scores[playerId] || 0) + 1,
      }

      // Check if player won
      const winner = newScores[playerId] >= state.roundsToWin ? playerId : null

      const newState: NumberGuesserState = {
        ...state,
        guesses,
        scores: newScores,
        gamePhase: winner ? 'results' : 'guessing',
        gameEndTime: winner ? Date.now() : null,
        winner,
      }

      return { valid: true, newState }
    }

    // Incorrect guess, move to next guesser
    const guesserIndex = state.activePlayers.indexOf(state.currentGuesser)
    let nextGuesserIndex = (guesserIndex + 1) % state.activePlayers.length

    // Skip the chooser
    if (state.activePlayers[nextGuesserIndex] === state.chooser) {
      nextGuesserIndex = (nextGuesserIndex + 1) % state.activePlayers.length
    }

    const newState: NumberGuesserState = {
      ...state,
      guesses,
      currentGuesser: state.activePlayers[nextGuesserIndex],
    }

    return { valid: true, newState }
  }

  private validateNextRound(state: NumberGuesserState): ValidationResult {
    if (state.gamePhase !== 'guessing') {
      return { valid: false, error: 'Not in guessing phase' }
    }

    // Check if the round is complete (someone guessed correctly)
    const roundComplete =
      state.guesses.length > 0 && state.guesses[state.guesses.length - 1].distance === 0

    if (!roundComplete) {
      return { valid: false, error: 'Round not complete yet - no one has guessed the number' }
    }

    // Rotate chooser to next player
    const chooserIndex = state.activePlayers.indexOf(state.chooser)
    const nextChooserIndex = (chooserIndex + 1) % state.activePlayers.length
    const nextChooser = state.activePlayers[nextChooserIndex]

    const newState: NumberGuesserState = {
      ...state,
      gamePhase: 'choosing',
      chooser: nextChooser,
      currentGuesser: '',
      secretNumber: null,
      guesses: [],
      roundNumber: state.roundNumber + 1,
      winner: null,
    }

    return { valid: true, newState }
  }

  private validateGoToSetup(state: NumberGuesserState): ValidationResult {
    const newState: NumberGuesserState = {
      ...state,
      gamePhase: 'setup',
      secretNumber: null,
      chooser: '',
      currentGuesser: '',
      guesses: [],
      roundNumber: 0,
      scores: {},
      activePlayers: [],
      playerMetadata: {},
      gameStartTime: null,
      gameEndTime: null,
      winner: null,
    }

    return { valid: true, newState }
  }

  private validateSetConfig(
    state: NumberGuesserState,
    field: 'minNumber' | 'maxNumber' | 'roundsToWin',
    value: number
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only change config in setup' }
    }

    if (!Number.isInteger(value) || value < 1) {
      return { valid: false, error: 'Value must be a positive integer' }
    }

    if (field === 'minNumber' && value >= state.maxNumber) {
      return { valid: false, error: 'Min must be less than max' }
    }

    if (field === 'maxNumber' && value <= state.minNumber) {
      return { valid: false, error: 'Max must be greater than min' }
    }

    const newState: NumberGuesserState = {
      ...state,
      [field]: value,
    }

    return { valid: true, newState }
  }

  isGameComplete(state: NumberGuesserState): boolean {
    return state.gamePhase === 'results' && state.winner !== null
  }

  getInitialState(config: unknown): NumberGuesserState {
    const { minNumber, maxNumber, roundsToWin } = config as NumberGuesserConfig

    return {
      minNumber: minNumber || 1,
      maxNumber: maxNumber || 100,
      roundsToWin: roundsToWin || 3,
      gamePhase: 'setup',
      activePlayers: [],
      playerMetadata: {},
      secretNumber: null,
      chooser: '',
      currentGuesser: '',
      guesses: [],
      roundNumber: 0,
      scores: {},
      gameStartTime: null,
      gameEndTime: null,
      winner: null,
    }
  }
}

export const numberGuesserValidator = new NumberGuesserValidator()
