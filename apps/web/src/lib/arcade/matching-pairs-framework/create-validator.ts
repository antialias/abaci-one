/**
 * Matching Pairs Framework - Validator Factory
 *
 * Creates a generic GameValidator from a MatchingPairsVariant.
 * Ported from arcade-games/matching/Validator.ts with variant hooks.
 */

import type {
  GameValidator,
  PracticeBreakOptions,
  ValidationResult,
} from '../validation/types'
import type { GameResultsReport, PlayerResult } from '../game-sdk/types'
import type {
  BaseMatchingCard,
  BaseMatchingConfig,
  MatchingPairsMove,
  MatchingPairsState,
  MatchingPairsVariant,
  Player,
} from './types'

/**
 * Format duration in milliseconds to a human-readable string
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  return `${seconds}s`
}

/**
 * Default canFlipCard check — used when variant doesn't override
 */
function defaultCanFlipCard<TCard extends BaseMatchingCard>(
  card: TCard,
  flippedCards: TCard[],
  isProcessingMove: boolean
): boolean {
  if (isProcessingMove) return false
  if (card.matched) return false
  if (flippedCards.some((c) => c.id === card.id)) return false
  if (flippedCards.length >= 2) return false
  return true
}

/**
 * Default results report generator — provides standard matching-pairs report.
 * Variants override only if they need custom stats/achievements.
 */
function defaultGetResultsReport<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
>(
  state: MatchingPairsState<TCard, TConfig> & TConfig,
  config: TConfig,
  gameName: string
): GameResultsReport {
  const startedAt = state.gameStartTime ?? Date.now()
  const endedAt = state.gameEndTime ?? Date.now()
  const durationMs = endedAt - startedAt

  const playerResults: PlayerResult[] = state.activePlayers
    .map((playerId) => {
      const meta = state.playerMetadata[playerId]
      const playerScore = state.scores[playerId] ?? 0
      const isSinglePlayer = state.activePlayers.length === 1
      const movesForAccuracy = isSinglePlayer ? state.moves : playerScore * 2
      const accuracy =
        movesForAccuracy > 0 ? Math.round(((playerScore * 2) / movesForAccuracy) * 100) : 0

      return {
        playerId,
        playerName: meta?.name ?? 'Player',
        playerEmoji: meta?.emoji ?? '👤',
        userId: meta?.userId ?? playerId,
        score: playerScore,
        rank: 0,
        isWinner: false,
        correctCount: playerScore,
        totalAttempts: isSinglePlayer ? state.moves : undefined,
        accuracy: isSinglePlayer ? accuracy : undefined,
        bestStreak: state.consecutiveMatches[playerId] ?? 0,
      }
    })
    .sort((a, b) => b.score - a.score)
    .map((p, idx) => ({ ...p, rank: idx + 1, isWinner: idx === 0 }))

  const winner = playerResults[0]
  const isSinglePlayer = playerResults.length === 1

  const overallAccuracy =
    isSinglePlayer && state.moves > 0
      ? Math.round(((state.matchedPairs * 2) / state.moves) * 100)
      : (winner?.accuracy ?? 0)

  let headline = 'Game Complete!'
  let resultTheme: GameResultsReport['resultTheme'] = 'neutral'
  let celebrationType: GameResultsReport['celebrationType'] = 'none'

  if (isSinglePlayer) {
    if (overallAccuracy >= 100) {
      headline = 'Perfect Memory!'
      resultTheme = 'success'
      celebrationType = 'confetti'
    } else if (overallAccuracy >= 80) {
      headline = 'Great Job!'
      resultTheme = 'good'
      celebrationType = 'stars'
    } else if (overallAccuracy >= 50) {
      headline = 'Nice Work!'
      resultTheme = 'neutral'
    } else {
      headline = 'Keep Practicing!'
      resultTheme = 'needs-practice'
    }
  } else {
    headline = `${winner?.playerName ?? 'Player'} Wins!`
    resultTheme = 'success'
    celebrationType = 'confetti'
  }

  const customStats: GameResultsReport['customStats'] = [
    {
      label: 'Pairs Found',
      value: `${state.matchedPairs}/${state.totalPairs}`,
      icon: '🎯',
      highlight: state.matchedPairs === state.totalPairs,
    },
    { label: 'Total Moves', value: state.moves, icon: '👆' },
    { label: 'Time', value: formatDuration(durationMs), icon: '⏱️' },
  ]

  if (isSinglePlayer) {
    customStats.push({
      label: 'Accuracy',
      value: `${overallAccuracy}%`,
      icon: '📊',
      highlight: overallAccuracy >= 80,
    })
  }

  const bestStreak = Math.max(...Object.values(state.consecutiveMatches), 0)
  if (bestStreak >= 3) {
    customStats.push({
      label: 'Best Streak',
      value: bestStreak,
      icon: '🔥',
      highlight: true,
    })
  }

  let difficultyLabel: string
  if (config.difficulty <= 6) {
    difficultyLabel = 'easy'
  } else if (config.difficulty <= 8) {
    difficultyLabel = 'medium'
  } else if (config.difficulty <= 12) {
    difficultyLabel = 'hard'
  } else {
    difficultyLabel = 'expert'
  }

  return {
    gameName,
    gameDisplayName: 'Matching Pairs Battle',
    gameIcon: '⚔️',
    durationMs,
    completedNormally: state.matchedPairs === state.totalPairs,
    startedAt,
    endedAt,
    gameMode: isSinglePlayer ? 'single-player' : 'competitive',
    playerCount: playerResults.length,
    playerResults,
    winnerId: isSinglePlayer ? null : (winner?.playerId ?? null),
    itemsCompleted: state.matchedPairs,
    itemsTotal: state.totalPairs,
    completionPercent: Math.round((state.matchedPairs / state.totalPairs) * 100),
    leaderboardEntry: {
      normalizedScore: isSinglePlayer ? overallAccuracy : (winner?.score ?? 0) * 10,
      category: 'memory',
      difficulty: difficultyLabel,
    },
    customStats,
    headline,
    subheadline: isSinglePlayer
      ? `${state.matchedPairs} pairs in ${formatDuration(durationMs)}`
      : `Final Score: ${winner?.score ?? 0} pairs`,
    resultTheme,
    celebrationType,
  }
}

/**
 * Create a GameValidator for a matching-pairs variant.
 */
export function createMatchingPairsValidator<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
>(
  variant: MatchingPairsVariant<TCard, TConfig>
): GameValidator<MatchingPairsState<TCard, TConfig> & TConfig, MatchingPairsMove<TCard>> {
  type State = MatchingPairsState<TCard, TConfig> & TConfig
  type Move = MatchingPairsMove<TCard>

  const canFlip = variant.canFlipCard ?? defaultCanFlipCard

  function validateFlipCard(
    state: State,
    cardId: string,
    playerId: string,
    context?: { userId?: string; playerOwnership?: Record<string, string> }
  ): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Cannot flip cards outside of playing phase' }
    }

    if (state.activePlayers.length > 1 && state.currentPlayer !== playerId) {
      return { valid: false, error: 'Not your turn' }
    }

    if (context?.userId && context?.playerOwnership) {
      const playerOwner = context.playerOwnership[playerId]
      if (playerOwner && playerOwner !== context.userId) {
        return { valid: false, error: 'You can only move your own players' }
      }
    }

    const card = state.gameCards.find((c) => c.id === cardId)
    if (!card) {
      return { valid: false, error: 'Card not found' }
    }

    if (!canFlip(card, state.flippedCards, state.isProcessingMove)) {
      return { valid: false, error: 'Cannot flip this card' }
    }

    const newFlippedCards = [...state.flippedCards, card]
    let newState: State = {
      ...state,
      flippedCards: newFlippedCards,
      isProcessingMove: newFlippedCards.length === 2,
      showMismatchFeedback: false,
    }

    if (newFlippedCards.length === 2) {
      const [card1, card2] = newFlippedCards
      const matchResult = variant.validateMatch(card1, card2)

      if (matchResult.isValid) {
        newState = {
          ...newState,
          gameCards: newState.gameCards.map((c) =>
            c.id === card1.id || c.id === card2.id
              ? { ...c, matched: true, matchedBy: state.currentPlayer }
              : c
          ) as TCard[],
          matchedPairs: state.matchedPairs + 1,
          scores: {
            ...state.scores,
            [state.currentPlayer]: (state.scores[state.currentPlayer] || 0) + 1,
          },
          consecutiveMatches: {
            ...state.consecutiveMatches,
            [state.currentPlayer]: (state.consecutiveMatches[state.currentPlayer] || 0) + 1,
          },
          moves: state.moves + 1,
          flippedCards: [],
          isProcessingMove: false,
        }

        if (newState.matchedPairs === newState.totalPairs) {
          newState = {
            ...newState,
            gamePhase: 'results',
            gameEndTime: Date.now(),
          }
        }
      } else {
        const shouldSwitchPlayer = state.activePlayers.length > 1
        const nextPlayerIndex = shouldSwitchPlayer
          ? (state.activePlayers.indexOf(state.currentPlayer) + 1) % state.activePlayers.length
          : 0
        const nextPlayer = shouldSwitchPlayer
          ? state.activePlayers[nextPlayerIndex]
          : state.currentPlayer

        newState = {
          ...newState,
          currentPlayer: nextPlayer,
          consecutiveMatches: {
            ...state.consecutiveMatches,
            [state.currentPlayer]: 0,
          },
          moves: state.moves + 1,
          flippedCards: newFlippedCards,
          isProcessingMove: true,
          showMismatchFeedback: true,
          playerHovers: {
            ...state.playerHovers,
            [state.currentPlayer]: null,
          },
        }
      }
    }

    return { valid: true, newState }
  }

  function validateStartGame(
    state: State,
    activePlayers: Player[],
    cards?: TCard[],
    playerMetadata?: { [playerId: string]: any }
  ): ValidationResult {
    if (!activePlayers || activePlayers.length === 0) {
      return { valid: false, error: 'Must have at least one player' }
    }

    const configFromState = extractConfig(state)
    const gameCards = cards || variant.generateCards(configFromState)

    const newState: State = {
      ...state,
      gameCards,
      cards: gameCards,
      activePlayers,
      playerMetadata: playerMetadata || {},
      gamePhase: 'playing',
      gameStartTime: Date.now(),
      currentPlayer: activePlayers[0],
      flippedCards: [],
      matchedPairs: 0,
      moves: 0,
      scores: activePlayers.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
      consecutiveMatches: activePlayers.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
      originalConfig: variant.getOriginalConfig(configFromState),
      pausedGamePhase: undefined,
      pausedGameState: undefined,
      playerHovers: {},
    }

    return { valid: true, newState }
  }

  function validateClearMismatch(state: State): ValidationResult {
    if (!state.showMismatchFeedback || state.flippedCards.length === 0) {
      return { valid: true, newState: state }
    }

    const clearedHovers = { ...state.playerHovers }
    for (const playerId of state.activePlayers) {
      if (playerId !== state.currentPlayer) {
        clearedHovers[playerId] = null
      }
    }

    return {
      valid: true,
      newState: {
        ...state,
        flippedCards: [],
        showMismatchFeedback: false,
        isProcessingMove: false,
        playerHovers: clearedHovers,
      },
    }
  }

  function validateGoToSetup(state: State): ValidationResult {
    const isPausingGame = state.gamePhase === 'playing' || state.gamePhase === 'results'

    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: 'setup',
        pausedGamePhase: isPausingGame ? state.gamePhase : undefined,
        pausedGameState: isPausingGame
          ? {
              gameCards: state.gameCards,
              currentPlayer: state.currentPlayer,
              matchedPairs: state.matchedPairs,
              moves: state.moves,
              scores: state.scores,
              activePlayers: state.activePlayers,
              playerMetadata: state.playerMetadata,
              consecutiveMatches: state.consecutiveMatches,
              gameStartTime: state.gameStartTime,
            }
          : undefined,
        gameCards: [] as unknown as TCard[],
        cards: [] as unknown as TCard[],
        flippedCards: [] as unknown as TCard[],
        currentPlayer: '',
        matchedPairs: 0,
        moves: 0,
        scores: {},
        activePlayers: [],
        playerMetadata: {},
        consecutiveMatches: {},
        gameStartTime: null,
        gameEndTime: null,
        currentMoveStartTime: null,
        celebrationAnimations: [],
        isProcessingMove: false,
        showMismatchFeedback: false,
        lastMatchedPair: null,
        playerHovers: {},
      },
    }
  }

  function validateSetConfig(
    state: State,
    field: string,
    value: any
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Cannot change configuration outside of setup phase' }
    }

    const error = variant.validateConfigField(field, value)
    if (error) {
      return { valid: false, error }
    }

    const clearPausedGame = !!state.pausedGamePhase

    // Build new config to compute totalPairs
    const configUpdate: Record<string, any> = { [field]: value }
    const newConfigState = { ...state, ...configUpdate } as TConfig
    const newTotalPairs = variant.getTotalPairs(newConfigState)

    return {
      valid: true,
      newState: {
        ...state,
        [field]: value,
        totalPairs: newTotalPairs,
        ...(clearPausedGame
          ? {
              pausedGamePhase: undefined,
              pausedGameState: undefined,
              originalConfig: undefined,
            }
          : {}),
      },
    }
  }

  function validateResumeGame(state: State): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only resume from setup phase' }
    }

    if (!state.pausedGamePhase || !state.pausedGameState) {
      return { valid: false, error: 'No paused game to resume' }
    }

    if (state.originalConfig) {
      const configFromState = extractConfig(state)
      if (variant.hasConfigChangedFrom(configFromState, state.originalConfig)) {
        return { valid: false, error: 'Cannot resume - configuration has changed' }
      }
    }

    return {
      valid: true,
      newState: {
        ...state,
        gamePhase: state.pausedGamePhase,
        gameCards: state.pausedGameState.gameCards,
        cards: state.pausedGameState.gameCards,
        currentPlayer: state.pausedGameState.currentPlayer,
        matchedPairs: state.pausedGameState.matchedPairs,
        moves: state.pausedGameState.moves,
        scores: state.pausedGameState.scores,
        activePlayers: state.pausedGameState.activePlayers,
        playerMetadata: state.pausedGameState.playerMetadata,
        consecutiveMatches: state.pausedGameState.consecutiveMatches,
        gameStartTime: state.pausedGameState.gameStartTime,
        pausedGamePhase: undefined,
        pausedGameState: undefined,
      },
    }
  }

  function validateHoverCard(
    state: State,
    cardId: string | null,
    playerId: string
  ): ValidationResult {
    return {
      valid: true,
      newState: {
        ...state,
        playerHovers: {
          ...state.playerHovers,
          [playerId]: cardId,
        },
      },
    }
  }

  /**
   * Extract TConfig from the full state.
   * The state is State = MatchingPairsState & TConfig,
   * so variant config fields are top-level.
   */
  function extractConfig(state: State): TConfig {
    // We reconstruct from defaultConfig keys
    const config = {} as any
    for (const key of Object.keys(variant.defaultConfig)) {
      config[key] = (state as any)[key]
    }
    return config as TConfig
  }

  function buildInitialState(config: TConfig): State {
    const totalPairs = variant.getTotalPairs(config)
    const baseState: MatchingPairsState<TCard, TConfig> = {
      cards: [] as unknown as TCard[],
      gameCards: [] as unknown as TCard[],
      flippedCards: [] as unknown as TCard[],
      difficulty: config.difficulty,
      turnTimer: config.turnTimer,
      gamePhase: 'setup',
      currentPlayer: '',
      matchedPairs: 0,
      totalPairs,
      moves: 0,
      scores: {},
      activePlayers: [],
      playerMetadata: {},
      consecutiveMatches: {},
      gameStartTime: null,
      gameEndTime: null,
      currentMoveStartTime: null,
      celebrationAnimations: [],
      isProcessingMove: false,
      showMismatchFeedback: false,
      lastMatchedPair: null,
      originalConfig: undefined,
      pausedGamePhase: undefined,
      pausedGameState: undefined,
      playerHovers: {},
    }

    // Merge variant config fields into state
    return { ...baseState, ...config } as State
  }

  const validator: GameValidator<State, Move> = {
    stateSchema: variant.stateSchema,

    validateMove(
      state: State,
      move: Move,
      context?: { userId?: string; playerOwnership?: Record<string, string> }
    ): ValidationResult {
      switch (move.type) {
        case 'FLIP_CARD':
          return validateFlipCard(state, move.data.cardId, move.playerId, context)
        case 'START_GAME':
          return validateStartGame(
            state,
            move.data.activePlayers,
            move.data.cards,
            move.data.playerMetadata
          )
        case 'CLEAR_MISMATCH':
          return validateClearMismatch(state)
        case 'GO_TO_SETUP':
          return validateGoToSetup(state)
        case 'SET_CONFIG':
          return validateSetConfig(state, move.data.field, move.data.value)
        case 'RESUME_GAME':
          return validateResumeGame(state)
        case 'HOVER_CARD':
          return validateHoverCard(state, move.data.cardId, move.playerId)
        default:
          return { valid: false, error: `Unknown move type: ${(move as any).type}` }
      }
    },

    isGameComplete(state: State): boolean {
      return state.gamePhase === 'results' || state.matchedPairs === state.totalPairs
    },

    getInitialState(config: unknown): State {
      const typedConfig = config as TConfig

      if (typedConfig.skipSetupPhase) {
        const gameCards = variant.generateCards(typedConfig)
        const state = buildInitialState(typedConfig)
        return {
          ...state,
          gameCards,
          cards: gameCards,
          gamePhase: 'playing',
          gameStartTime: Date.now(),
          originalConfig: variant.getOriginalConfig(typedConfig),
        }
      }

      return buildInitialState(typedConfig)
    },

    getInitialStateForPracticeBreak(
      config: unknown,
      options: PracticeBreakOptions
    ): State {
      const defaults = variant.practiceBreakDefaults ?? variant.defaultConfig
      let fullConfig: TConfig = { ...defaults, ...(config as Partial<TConfig>) }

      if (variant.adjustConfigForBreak) {
        fullConfig = variant.adjustConfigForBreak(fullConfig, options.maxDurationMinutes)
      } else if (options.maxDurationMinutes <= 3 && fullConfig.difficulty > 6) {
        fullConfig = { ...fullConfig, difficulty: 6 as any }
      }

      const gameCards = variant.generateCards(fullConfig)
      const playerId = options.playerId
      const playerMetadata = {
        [playerId]: {
          id: playerId,
          name: options.playerName || 'Player',
          emoji: '🎮',
          userId: playerId,
        },
      }

      const state = buildInitialState(fullConfig)
      return {
        ...state,
        cards: gameCards,
        gameCards,
        gamePhase: 'playing',
        currentPlayer: playerId,
        scores: { [playerId]: 0 },
        activePlayers: [playerId],
        playerMetadata,
        consecutiveMatches: { [playerId]: 0 },
        gameStartTime: Date.now(),
        originalConfig: variant.getOriginalConfig(fullConfig),
      }
    },
  }

  // Attach getResultsReport as a non-interface method
  ;(validator as any).getResultsReport = (state: State, config: TConfig): GameResultsReport => {
    if (variant.getResultsReport) {
      return variant.getResultsReport(state, config)
    }
    return defaultGetResultsReport(state, config, variant.gameName)
  }

  return validator
}
