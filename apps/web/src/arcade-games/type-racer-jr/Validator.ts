/**
 * Type Racer Jr. - Server-side Validator
 *
 * Validates all game moves and state transitions.
 * Runs on both client (optimistic) and server (authoritative).
 */

import type { GameValidator, PracticeBreakOptions, ValidationResult } from '@/lib/arcade/game-sdk'
import type { GameResultsReport, PlayerResult } from '@/lib/arcade/game-sdk/types'
import {
  TypeRacerJrStateSchema,
  type TypeRacerJrConfig,
  type TypeRacerJrState,
  type TypeRacerJrMove,
  type DifficultyLevel,
} from './types'
import { pickWords, type DifficultyLevel as WordDifficultyLevel } from './words'

const PRACTICE_BREAK_DEFAULTS: TypeRacerJrConfig = {
  gameMode: 'free-play',
  timeLimit: null,
  startingDifficulty: 'level1',
  wordCount: 5,
}

function difficultyToWordLevel(d: DifficultyLevel): WordDifficultyLevel {
  return d
}

export class TypeRacerJrValidator implements GameValidator<TypeRacerJrState, TypeRacerJrMove> {
  stateSchema = TypeRacerJrStateSchema as unknown as import('zod').ZodType<TypeRacerJrState>

  validateMove(
    state: TypeRacerJrState,
    move: TypeRacerJrMove,
    _context?: { userId?: string; playerOwnership?: Record<string, string> }
  ): ValidationResult {
    switch (move.type) {
      case 'START_GAME':
        return this.validateStartGame(state, move.data)
      case 'COMPLETE_WORD':
        return this.validateCompleteWord(state, move.data)
      case 'ADVANCE_DIFFICULTY':
        return this.validateAdvanceDifficulty(state, move.data)
      case 'END_GAME':
        return this.validateEndGame(state, move.data)
      case 'SET_CONFIG':
        return this.validateSetConfig(state, move.data.field, move.data.value)
      case 'RESET_GAME':
        return this.validateResetGame(state)
      default:
        return { valid: false, error: `Unknown move type: ${(move as TypeRacerJrMove).type}` }
    }
  }

  private validateStartGame(
    state: TypeRacerJrState,
    data: { wordQueue: typeof state.wordQueue; playerMetadata: typeof state.playerMetadata }
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only start from setup phase' }
    }

    if (!Array.isArray(data.wordQueue) || data.wordQueue.length === 0) {
      return { valid: false, error: 'Word queue is required' }
    }

    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: 'playing',
        wordQueue: data.wordQueue,
        currentWordIndex: 0,
        completedWords: [],
        totalStars: 0,
        bestStreak: 0,
        consecutiveCleanWords: 0,
        usedWords: data.wordQueue.map((w) => w.word),
        gameStartTime: Date.now(),
        currentWordStartTime: Date.now(),
        playerMetadata: data.playerMetadata,
        endReason: null,
      },
    }
  }

  private validateCompleteWord(
    state: TypeRacerJrState,
    data: { word: string; stars: number; mistakeCount: number; durationMs: number }
  ): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Can only complete words during playing phase' }
    }

    const currentWord = state.wordQueue[state.currentWordIndex]
    if (!currentWord || currentWord.word !== data.word) {
      return { valid: false, error: 'Word does not match current word' }
    }

    const completedWord = {
      word: data.word,
      emoji: currentWord.emoji,
      stars: data.stars,
      mistakeCount: data.mistakeCount,
      durationMs: data.durationMs,
    }

    const newConsecutiveClean =
      data.mistakeCount === 0 ? state.consecutiveCleanWords + 1 : 0
    const newBestStreak = Math.max(state.bestStreak, newConsecutiveClean)
    const nextWordIndex = state.currentWordIndex + 1

    // Check if all words done (free-play mode)
    const allWordsDone = nextWordIndex >= state.wordQueue.length

    const newState: TypeRacerJrState = {
      ...state,
      completedWords: [...state.completedWords, completedWord],
      currentWordIndex: nextWordIndex,
      totalStars: state.totalStars + data.stars,
      consecutiveCleanWords: newConsecutiveClean,
      bestStreak: newBestStreak,
      currentWordStartTime: allWordsDone ? null : Date.now(),
    }

    // Auto-end if all words completed
    if (allWordsDone) {
      return {
        valid: true,
        newState: {
          ...newState,
          gamePhase: 'results',
          endReason: 'all-words-done',
        },
      }
    }

    return { valid: true, newState }
  }

  private validateAdvanceDifficulty(
    state: TypeRacerJrState,
    data: { newDifficulty: DifficultyLevel; newWords: typeof state.wordQueue }
  ): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Can only advance difficulty during playing phase' }
    }

    // Append new words to queue
    const newQueue = [...state.wordQueue, ...data.newWords]

    return {
      valid: true,
      newState: {
        ...state,
        currentDifficulty: data.newDifficulty,
        wordQueue: newQueue,
        usedWords: [...state.usedWords, ...data.newWords.map((w) => w.word)],
        consecutiveCleanWords: 0,
      },
    }
  }

  private validateEndGame(
    state: TypeRacerJrState,
    data: { reason: 'timer-expired' | 'all-words-done' | 'player-quit' }
  ): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Can only end game during playing phase' }
    }

    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: 'results',
        endReason: data.reason,
      },
    }
  }

  private validateSetConfig(
    state: TypeRacerJrState,
    field: string,
    value: unknown
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only change config in setup phase' }
    }

    switch (field) {
      case 'gameMode':
        if (!['free-play', 'beat-the-clock'].includes(value as string)) {
          return { valid: false, error: 'Invalid game mode' }
        }
        return {
          valid: true,
          newState: {
            ...state,
            gameMode: value as TypeRacerJrState['gameMode'],
            // Set default time limit for beat-the-clock
            timeLimit: value === 'beat-the-clock' ? (state.timeLimit ?? 60) : null,
            // Set default word count for free-play
            wordCount: value === 'free-play' ? (state.wordCount ?? 5) : null,
          },
        }

      case 'timeLimit':
        if (value !== null && ![60, 90, 120].includes(value as number)) {
          return { valid: false, error: 'Invalid time limit' }
        }
        return { valid: true, newState: { ...state, timeLimit: value as TypeRacerJrState['timeLimit'] } }

      case 'startingDifficulty':
        if (!['level1', 'level2', 'level3'].includes(value as string)) {
          return { valid: false, error: 'Invalid difficulty level' }
        }
        return {
          valid: true,
          newState: {
            ...state,
            currentDifficulty: value as DifficultyLevel,
          },
        }

      case 'wordCount':
        if (value !== null && (typeof value !== 'number' || value < 1 || value > 20)) {
          return { valid: false, error: 'Invalid word count' }
        }
        return { valid: true, newState: { ...state, wordCount: value as number | null } }

      default:
        return { valid: false, error: `Unknown config field: ${field}` }
    }
  }

  private validateResetGame(state: TypeRacerJrState): ValidationResult {
    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: 'setup',
        wordQueue: [],
        currentWordIndex: 0,
        completedWords: [],
        totalStars: 0,
        bestStreak: 0,
        consecutiveCleanWords: 0,
        usedWords: [],
        gameStartTime: null,
        currentWordStartTime: null,
        endReason: null,
      },
    }
  }

  isGameComplete(state: TypeRacerJrState): boolean {
    return state.gamePhase === 'results'
  }

  getInitialState(config: TypeRacerJrConfig): TypeRacerJrState {
    return {
      gamePhase: 'setup',
      gameMode: config.gameMode,
      timeLimit: config.timeLimit,
      wordCount: config.wordCount,
      currentDifficulty: config.startingDifficulty,
      consecutiveCleanWords: 0,
      wordQueue: [],
      currentWordIndex: 0,
      completedWords: [],
      usedWords: [],
      totalStars: 0,
      bestStreak: 0,
      gameStartTime: null,
      currentWordStartTime: null,
      playerId: '',
      playerMetadata: {},
      endReason: null,
    }
  }

  getInitialStateForPracticeBreak(
    config: Partial<TypeRacerJrConfig>,
    options: PracticeBreakOptions
  ): TypeRacerJrState {
    const fullConfig: TypeRacerJrConfig = {
      ...PRACTICE_BREAK_DEFAULTS,
      ...config,
    }

    const wordCount = fullConfig.wordCount ?? 5
    const words = pickWords(difficultyToWordLevel(fullConfig.startingDifficulty), wordCount)

    const playerId = options.playerId
    const playerMetadata = {
      [playerId]: {
        id: playerId,
        name: options.playerName || 'Player',
        emoji: '⌨️',
        userId: playerId,
      },
    }

    return {
      gamePhase: 'playing',
      gameMode: fullConfig.gameMode,
      timeLimit: fullConfig.timeLimit,
      wordCount: wordCount,
      currentDifficulty: fullConfig.startingDifficulty,
      consecutiveCleanWords: 0,
      wordQueue: words,
      currentWordIndex: 0,
      completedWords: [],
      usedWords: words.map((w) => w.word),
      totalStars: 0,
      bestStreak: 0,
      gameStartTime: Date.now(),
      currentWordStartTime: Date.now(),
      playerId,
      playerMetadata,
      endReason: null,
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

// Create validator instance
const validator = new TypeRacerJrValidator()

// Attach getResultsReport as a non-interface method (same pattern as memory-quiz)
;(validator as any).getResultsReport = (
  state: TypeRacerJrState,
  _config: TypeRacerJrConfig
): GameResultsReport => {
  const startedAt = state.gameStartTime ?? Date.now()
  const endedAt = Date.now()
  const durationMs = endedAt - startedAt

  const wordsTyped = state.completedWords.length
  const totalMistakes = state.completedWords.reduce((sum, w) => sum + w.mistakeCount, 0)
  const totalLetters = state.completedWords.reduce((sum, w) => sum + w.word.length, 0)
  const accuracy = totalLetters > 0
    ? Math.round(((totalLetters - totalMistakes) / totalLetters) * 100)
    : 0

  const playerResults: PlayerResult[] = [{
    playerId: state.playerId || 'player',
    playerName: Object.values(state.playerMetadata)[0]?.name ?? 'Player',
    playerEmoji: '⌨️',
    userId: state.playerId || 'player',
    score: state.totalStars,
    rank: 1,
    isWinner: true,
    correctCount: wordsTyped,
    incorrectCount: totalMistakes,
    totalAttempts: wordsTyped,
    accuracy,
    bestStreak: state.bestStreak,
  }]

  let headline: string
  let resultTheme: GameResultsReport['resultTheme']
  let celebrationType: GameResultsReport['celebrationType']

  if (accuracy >= 95 && wordsTyped >= 5) {
    headline = 'Perfect Typing!'
    resultTheme = 'success'
    celebrationType = 'confetti'
  } else if (accuracy >= 80) {
    headline = 'Great Typing!'
    resultTheme = 'good'
    celebrationType = 'stars'
  } else if (wordsTyped >= 3) {
    headline = 'Nice Try!'
    resultTheme = 'neutral'
    celebrationType = 'none'
  } else {
    headline = 'Keep Practicing!'
    resultTheme = 'needs-practice'
    celebrationType = 'none'
  }

  const customStats: GameResultsReport['customStats'] = [
    { label: 'Words', value: wordsTyped, icon: '📝', highlight: wordsTyped >= 5 },
    { label: 'Stars', value: `${state.totalStars}`, icon: '⭐', highlight: state.totalStars >= wordsTyped * 2 },
    { label: 'Accuracy', value: `${accuracy}%`, icon: '🎯', highlight: accuracy >= 90 },
    { label: 'Time', value: formatDuration(durationMs), icon: '⏱️' },
  ]

  if (state.bestStreak > 1) {
    customStats.push({ label: 'Best Streak', value: state.bestStreak, icon: '🔥', highlight: true })
  }

  return {
    gameName: 'type-racer-jr',
    gameDisplayName: 'Type Racer Jr.',
    gameIcon: '⌨️',
    durationMs,
    completedNormally: state.endReason === 'all-words-done' || state.endReason === 'timer-expired',
    startedAt,
    endedAt,
    gameMode: 'single-player',
    playerCount: 1,
    playerResults,
    winnerId: null,
    itemsCompleted: wordsTyped,
    itemsTotal: state.wordQueue.length,
    completionPercent: state.wordQueue.length > 0 ? Math.round((wordsTyped / state.wordQueue.length) * 100) : 0,
    leaderboardEntry: {
      normalizedScore: accuracy,
      category: 'speed',
      difficulty: state.currentDifficulty,
    },
    customStats,
    headline,
    subheadline: `${wordsTyped} words in ${formatDuration(durationMs)}`,
    resultTheme,
    celebrationType,
  }
}

export const typeRacerJrValidator = validator
