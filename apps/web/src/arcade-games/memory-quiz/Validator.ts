/**
 * Server-side validator for memory-quiz game
 * Validates all game moves and state transitions
 */

import type { GameValidator, PracticeBreakOptions, ValidationResult } from '@/lib/arcade/game-sdk'
import type { GameResultsReport, PlayerResult } from '@/lib/arcade/game-sdk/types'
import {
  MemoryQuizStateSchema,
  DIFFICULTY_LEVELS,
  type DifficultyLevel,
  type MemoryQuizConfig,
  type MemoryQuizState,
  type MemoryQuizMove,
  type MemoryQuizSetConfigMove,
} from './types'

// Default config for practice breaks (quick games)
const PRACTICE_BREAK_DEFAULTS: MemoryQuizConfig = {
  selectedCount: 5,
  displayTime: 2.0,
  selectedDifficulty: 'easy',
  playMode: 'cooperative',
}

/**
 * Generate random numbers for the quiz based on difficulty
 */
function generateQuizNumbers(count: number, difficulty: DifficultyLevel): number[] {
  const { min, max } = DIFFICULTY_LEVELS[difficulty].range
  const numbers: number[] = []
  const used = new Set<number>()

  while (numbers.length < count) {
    const num = Math.floor(Math.random() * (max - min + 1)) + min
    if (!used.has(num)) {
      used.add(num)
      numbers.push(num)
    }
  }

  return numbers
}

export class MemoryQuizGameValidator implements GameValidator<MemoryQuizState, MemoryQuizMove> {
  // Zod schema for runtime validation of state loaded from database
  // Cast needed because MemoryQuizState includes runtime-only properties not in schema
  stateSchema = MemoryQuizStateSchema as unknown as import('zod').ZodType<MemoryQuizState>

  validateMove(
    state: MemoryQuizState,
    move: MemoryQuizMove,
    context?: { userId?: string; playerOwnership?: Record<string, string> }
  ): ValidationResult {
    switch (move.type) {
      case 'START_QUIZ':
        return this.validateStartQuiz(state, move.data)

      case 'NEXT_CARD':
        return this.validateNextCard(state)

      case 'SHOW_INPUT_PHASE':
        return this.validateShowInputPhase(state)

      case 'ACCEPT_NUMBER':
        return this.validateAcceptNumber(state, move.data.number, move.userId)

      case 'REJECT_NUMBER':
        return this.validateRejectNumber(state, move.userId)

      case 'SET_INPUT':
        return this.validateSetInput(state, move.data.input)

      case 'SHOW_RESULTS':
        return this.validateShowResults(state)

      case 'RESET_QUIZ':
        return this.validateResetQuiz(state)

      case 'SET_CONFIG': {
        const configMove = move as MemoryQuizSetConfigMove
        return this.validateSetConfig(state, configMove.data.field, configMove.data.value)
      }

      default:
        return {
          valid: false,
          error: `Unknown move type: ${(move as any).type}`,
        }
    }
  }

  private validateStartQuiz(state: MemoryQuizState, data: any): ValidationResult {
    // Can start quiz from setup or results phase
    if (state.gamePhase !== 'setup' && state.gamePhase !== 'results') {
      return {
        valid: false,
        error: 'Can only start quiz from setup or results phase',
      }
    }

    // Accept either numbers array (from network) or quizCards (from client)
    const numbers = data.numbers || data.quizCards?.map((c: any) => c.number)

    if (!numbers || numbers.length === 0) {
      return {
        valid: false,
        error: 'Quiz numbers are required',
      }
    }

    // Create minimal quiz cards from numbers (server-side doesn't need React components)
    const quizCards = numbers.map((number: number) => ({
      number,
      svgComponent: null, // Not needed server-side
      element: null,
    }))

    // Extract multiplayer data from move
    const activePlayers = data.activePlayers || state.activePlayers || []
    const playerMetadata = data.playerMetadata || state.playerMetadata || {}

    // Initialize player scores for all active players (by userId)
    const uniqueUserIds = new Set<string>()
    for (const playerId of activePlayers) {
      const metadata = playerMetadata[playerId]
      if (metadata?.userId) {
        uniqueUserIds.add(metadata.userId)
      }
    }

    const playerScores = Array.from(uniqueUserIds).reduce((acc: any, userId: string) => {
      acc[userId] = { correct: 0, incorrect: 0 }
      return acc
    }, {})

    const newState: MemoryQuizState = {
      ...state,
      quizCards,
      correctAnswers: numbers,
      currentCardIndex: 0,
      foundNumbers: [],
      guessesRemaining: numbers.length + Math.floor(numbers.length / 2),
      gamePhase: 'display',
      gameStartTime: Date.now(),
      incorrectGuesses: 0,
      currentInput: '',
      wrongGuessAnimations: [],
      prefixAcceptanceTimeout: null,
      // Multiplayer state
      activePlayers,
      playerMetadata,
      playerScores,
      numberFoundBy: {},
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateNextCard(state: MemoryQuizState): ValidationResult {
    // Must be in display phase
    if (state.gamePhase !== 'display') {
      return {
        valid: false,
        error: 'NEXT_CARD only valid in display phase',
      }
    }

    const newState: MemoryQuizState = {
      ...state,
      currentCardIndex: state.currentCardIndex + 1,
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateShowInputPhase(state: MemoryQuizState): ValidationResult {
    // Must have shown all cards
    if (state.currentCardIndex < state.quizCards.length) {
      return {
        valid: false,
        error: 'All cards must be shown before input phase',
      }
    }

    const newState: MemoryQuizState = {
      ...state,
      gamePhase: 'input',
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateAcceptNumber(
    state: MemoryQuizState,
    number: number,
    userId?: string
  ): ValidationResult {
    // Must be in input phase
    if (state.gamePhase !== 'input') {
      return {
        valid: false,
        error: 'ACCEPT_NUMBER only valid in input phase',
      }
    }

    // Number must be in correct answers
    if (!state.correctAnswers.includes(number)) {
      return {
        valid: false,
        error: 'Number is not a correct answer',
      }
    }

    // Number must not be already found
    if (state.foundNumbers.includes(number)) {
      return {
        valid: false,
        error: 'Number already found',
      }
    }

    // Update player scores (track by userId)
    const playerScores = state.playerScores || {}
    const newPlayerScores = { ...playerScores }
    const numberFoundBy = state.numberFoundBy || {}
    const newNumberFoundBy = { ...numberFoundBy }

    if (userId) {
      const currentScore = newPlayerScores[userId] || {
        correct: 0,
        incorrect: 0,
      }
      newPlayerScores[userId] = {
        ...currentScore,
        correct: currentScore.correct + 1,
      }
      // Track who found this number
      newNumberFoundBy[number] = userId
    }

    const newState: MemoryQuizState = {
      ...state,
      foundNumbers: [...state.foundNumbers, number],
      currentInput: '',
      playerScores: newPlayerScores,
      numberFoundBy: newNumberFoundBy,
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateRejectNumber(state: MemoryQuizState, userId?: string): ValidationResult {
    // Must be in input phase
    if (state.gamePhase !== 'input') {
      return {
        valid: false,
        error: 'REJECT_NUMBER only valid in input phase',
      }
    }

    // Must have guesses remaining
    if (state.guessesRemaining <= 0) {
      return {
        valid: false,
        error: 'No guesses remaining',
      }
    }

    // Update player scores (track by userId)
    const playerScores = state.playerScores || {}
    const newPlayerScores = { ...playerScores }
    if (userId) {
      const currentScore = newPlayerScores[userId] || {
        correct: 0,
        incorrect: 0,
      }
      newPlayerScores[userId] = {
        ...currentScore,
        incorrect: currentScore.incorrect + 1,
      }
    }

    const newState: MemoryQuizState = {
      ...state,
      guessesRemaining: state.guessesRemaining - 1,
      incorrectGuesses: state.incorrectGuesses + 1,
      currentInput: '',
      playerScores: newPlayerScores,
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateSetInput(state: MemoryQuizState, input: string): ValidationResult {
    // Must be in input phase
    if (state.gamePhase !== 'input') {
      return {
        valid: false,
        error: 'SET_INPUT only valid in input phase',
      }
    }

    // Input must be numeric
    if (input && !/^\d+$/.test(input)) {
      return {
        valid: false,
        error: 'Input must be numeric',
      }
    }

    const newState: MemoryQuizState = {
      ...state,
      currentInput: input,
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateShowResults(state: MemoryQuizState): ValidationResult {
    // Can show results from input phase
    if (state.gamePhase !== 'input') {
      return {
        valid: false,
        error: 'SHOW_RESULTS only valid from input phase',
      }
    }

    const newState: MemoryQuizState = {
      ...state,
      gamePhase: 'results',
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateResetQuiz(state: MemoryQuizState): ValidationResult {
    // Can reset from any phase
    const newState: MemoryQuizState = {
      ...state,
      gamePhase: 'setup',
      quizCards: [],
      correctAnswers: [],
      currentCardIndex: 0,
      foundNumbers: [],
      guessesRemaining: 0,
      currentInput: '',
      incorrectGuesses: 0,
      wrongGuessAnimations: [],
      prefixAcceptanceTimeout: null,
      finishButtonsBound: false,
    }

    return {
      valid: true,
      newState,
    }
  }

  private validateSetConfig(
    state: MemoryQuizState,
    field: 'selectedCount' | 'displayTime' | 'selectedDifficulty' | 'playMode',
    value: any
  ): ValidationResult {
    // Can only change config during setup phase
    if (state.gamePhase !== 'setup') {
      return {
        valid: false,
        error: 'Cannot change configuration outside of setup phase',
      }
    }

    // Validate field-specific values
    switch (field) {
      case 'selectedCount':
        if (![2, 5, 8, 12, 15].includes(value)) {
          return { valid: false, error: `Invalid selectedCount: ${value}` }
        }
        break

      case 'displayTime':
        if (typeof value !== 'number' || value < 0.5 || value > 10) {
          return { valid: false, error: `Invalid displayTime: ${value}` }
        }
        break

      case 'selectedDifficulty':
        if (!['beginner', 'easy', 'medium', 'hard', 'expert'].includes(value)) {
          return {
            valid: false,
            error: `Invalid selectedDifficulty: ${value}`,
          }
        }
        break

      case 'playMode':
        if (!['cooperative', 'competitive'].includes(value)) {
          return { valid: false, error: `Invalid playMode: ${value}` }
        }
        break

      default:
        return { valid: false, error: `Unknown config field: ${field}` }
    }

    // Apply the configuration change
    return {
      valid: true,
      newState: {
        ...state,
        [field]: value,
      },
    }
  }

  isGameComplete(state: MemoryQuizState): boolean {
    return state.gamePhase === 'results'
  }

  getInitialState(config: MemoryQuizConfig): MemoryQuizState {
    const typedConfig = config as MemoryQuizConfig & { skipSetupPhase?: boolean }

    // Practice break: skip setup, generate cards, start in display phase
    if (typedConfig.skipSetupPhase) {
      const numbers = generateQuizNumbers(typedConfig.selectedCount, typedConfig.selectedDifficulty)
      const quizCards = numbers.map((number) => ({
        number,
        svgComponent: null,
        element: null,
      }))

      return {
        cards: quizCards,
        quizCards,
        correctAnswers: numbers,
        currentCardIndex: 0,
        displayTime: typedConfig.displayTime,
        selectedCount: typedConfig.selectedCount,
        selectedDifficulty: typedConfig.selectedDifficulty,
        foundNumbers: [],
        guessesRemaining: numbers.length + Math.floor(numbers.length / 2),
        currentInput: '',
        incorrectGuesses: 0,
        activePlayers: [],
        playerMetadata: {},
        playerScores: {},
        playMode: typedConfig.playMode || 'cooperative',
        numberFoundBy: {},
        gamePhase: 'display',
        gameStartTime: Date.now(),
        prefixAcceptanceTimeout: null,
        finishButtonsBound: false,
        wrongGuessAnimations: [],
        hasPhysicalKeyboard: null,
        testingMode: false,
        showOnScreenKeyboard: false,
      }
    }

    return {
      cards: [],
      quizCards: [],
      correctAnswers: [],
      currentCardIndex: 0,
      displayTime: config.displayTime,
      selectedCount: config.selectedCount,
      selectedDifficulty: config.selectedDifficulty,
      foundNumbers: [],
      guessesRemaining: 0,
      currentInput: '',
      incorrectGuesses: 0,
      // Multiplayer state
      activePlayers: [],
      playerMetadata: {},
      playerScores: {},
      playMode: config.playMode || 'cooperative',
      numberFoundBy: {},
      // UI state
      gamePhase: 'setup',
      gameStartTime: null,
      prefixAcceptanceTimeout: null,
      finishButtonsBound: false,
      wrongGuessAnimations: [],
      hasPhysicalKeyboard: null,
      testingMode: false,
      showOnScreenKeyboard: false,
    }
  }

  /**
   * Get initial state for practice break mode.
   * Skips setup phase and starts directly in 'display' phase with generated numbers.
   *
   * @param config Partial config to merge with practice break defaults
   * @param options Practice break options including player info
   * @returns Game state ready to display cards immediately
   */
  getInitialStateForPracticeBreak(
    config: Partial<MemoryQuizConfig>,
    options: PracticeBreakOptions
  ): MemoryQuizState {
    // Merge with practice break defaults
    const fullConfig: MemoryQuizConfig = {
      ...PRACTICE_BREAK_DEFAULTS,
      ...config,
    }

    // Adjust card count based on break duration
    if (options.maxDurationMinutes <= 2 && fullConfig.selectedCount > 5) {
      fullConfig.selectedCount = 5
    }

    // Generate quiz numbers
    const numbers = generateQuizNumbers(fullConfig.selectedCount, fullConfig.selectedDifficulty)

    // Create quiz cards (minimal - no React components needed)
    const quizCards = numbers.map((number) => ({
      number,
      svgComponent: null,
      element: null,
    }))

    // Set up single player
    const playerId = options.playerId
    const playerMetadata = {
      [playerId]: {
        id: playerId,
        name: options.playerName || 'Player',
        emoji: '🎮',
        userId: playerId,
        color: '#8b5cf6',
      },
    }

    return {
      cards: quizCards,
      quizCards,
      correctAnswers: numbers,
      currentCardIndex: 0,
      displayTime: fullConfig.displayTime,
      selectedCount: fullConfig.selectedCount,
      selectedDifficulty: fullConfig.selectedDifficulty,
      foundNumbers: [],
      guessesRemaining: numbers.length + Math.floor(numbers.length / 2),
      currentInput: '',
      incorrectGuesses: 0,
      // Single player setup
      activePlayers: [playerId],
      playerMetadata,
      playerScores: { [playerId]: { correct: 0, incorrect: 0 } },
      playMode: 'cooperative',
      numberFoundBy: {},
      // Start in display phase - skip setup!
      gamePhase: 'display',
      gameStartTime: Date.now(),
      prefixAcceptanceTimeout: null,
      finishButtonsBound: false,
      wrongGuessAnimations: [],
      hasPhysicalKeyboard: null,
      testingMode: false,
      showOnScreenKeyboard: false,
    }
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  return `${seconds}s`
}

// Singleton instance
const validator = new MemoryQuizGameValidator()

// Attach getResultsReport as a non-interface method (same pattern as matching-pairs)
;(validator as any).getResultsReport = (
  state: MemoryQuizState,
  _config: MemoryQuizConfig
): GameResultsReport => {
  const startedAt = state.gameStartTime ?? Date.now()
  const endedAt = Date.now()
  const durationMs = endedAt - startedAt

  const totalCards = state.correctAnswers.length
  const found = state.foundNumbers.length
  const totalGuesses = found + state.incorrectGuesses
  const accuracy = totalGuesses > 0 ? Math.round((found / totalGuesses) * 100) : 0

  const playerResults: PlayerResult[] = state.activePlayers.map((playerId, idx) => {
    const meta = state.playerMetadata[playerId]
    const scores = state.playerScores[meta?.userId ?? playerId] ??
      state.playerScores[playerId] ?? { correct: 0, incorrect: 0 }
    return {
      playerId,
      playerName: meta?.name ?? 'Player',
      playerEmoji: meta?.emoji ?? '🧠',
      userId: meta?.userId ?? playerId,
      score: scores.correct,
      rank: idx + 1,
      isWinner: idx === 0,
      correctCount: scores.correct,
      incorrectCount: scores.incorrect,
      totalAttempts: scores.correct + scores.incorrect,
      accuracy:
        scores.correct + scores.incorrect > 0
          ? Math.round((scores.correct / (scores.correct + scores.incorrect)) * 100)
          : 0,
    }
  })

  let headline: string
  let resultTheme: GameResultsReport['resultTheme']
  let celebrationType: GameResultsReport['celebrationType']

  if (found === totalCards) {
    headline = 'Perfect Recall!'
    resultTheme = 'success'
    celebrationType = 'confetti'
  } else if (accuracy >= 80) {
    headline = 'Great Memory!'
    resultTheme = 'good'
    celebrationType = 'stars'
  } else if (accuracy >= 50) {
    headline = 'Nice Try!'
    resultTheme = 'neutral'
    celebrationType = 'none'
  } else {
    headline = 'Keep Practicing!'
    resultTheme = 'needs-practice'
    celebrationType = 'none'
  }

  const customStats: GameResultsReport['customStats'] = [
    {
      label: 'Recalled',
      value: `${found}/${totalCards}`,
      icon: '🧠',
      highlight: found === totalCards,
    },
    {
      label: 'Accuracy',
      value: `${accuracy}%`,
      icon: '🎯',
      highlight: accuracy >= 80,
    },
    { label: 'Time', value: formatDuration(durationMs), icon: '⏱️' },
  ]

  if (state.incorrectGuesses > 0) {
    customStats.push({
      label: 'Wrong Guesses',
      value: state.incorrectGuesses,
      icon: '❌',
    })
  }

  return {
    gameName: 'memory-quiz',
    gameDisplayName: 'Memory Lightning',
    gameIcon: '🧠',
    durationMs,
    completedNormally: found === totalCards || state.guessesRemaining <= 0,
    startedAt,
    endedAt,
    gameMode: 'single-player',
    playerCount: playerResults.length,
    playerResults,
    winnerId: null,
    itemsCompleted: found,
    itemsTotal: totalCards,
    completionPercent: totalCards > 0 ? Math.round((found / totalCards) * 100) : 0,
    leaderboardEntry: {
      normalizedScore: accuracy,
      category: 'memory',
      difficulty: state.selectedDifficulty,
    },
    customStats,
    headline,
    subheadline: `${found} of ${totalCards} numbers in ${formatDuration(durationMs)}`,
    resultTheme,
    celebrationType,
  }
}

export const memoryQuizGameValidator = validator
