/**
 * Matching Pairs Framework - Type Definitions
 *
 * Base types and the MatchingPairsVariant interface for building
 * matching-pairs games with just a thin variant definition.
 */

import { z } from 'zod'
import type { ComponentType } from 'react'
import type { GameMove, GameValidator, PracticeBreakOptions } from '../validation/types'
import type { GameResultsReport, PlayerResult, GameDefinition } from '../game-sdk/types'

// ============================================================================
// Base Schemas & Types
// ============================================================================

export const GamePhaseSchema = z.enum(['setup', 'playing', 'results'])
export type GamePhase = z.infer<typeof GamePhaseSchema>

export const DifficultySchema = z.union([z.literal(6), z.literal(8), z.literal(12), z.literal(15)])
export type Difficulty = z.infer<typeof DifficultySchema>

/** Minimal base card interface — variants extend this */
export interface BaseMatchingCard {
  id: string
  type: string
  matched: boolean
  matchedBy?: string
}

/** Base config that all matching-pairs games share */
export interface BaseMatchingConfig {
  difficulty: Difficulty
  turnTimer: number
  skipSetupPhase?: boolean
}

// Player is just a string (Player ID / UUID)
export type Player = string

// ============================================================================
// Player Metadata (shared across all variants)
// ============================================================================

export const PlayerMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  userId: z.string(),
  color: z.string().optional(),
})
export type PlayerMetadata = z.infer<typeof PlayerMetadataSchema>

export const PlayerScoreSchema = z.record(z.string(), z.number())

// ============================================================================
// Paused Game State
// ============================================================================

export interface PausedGameState<TCard extends BaseMatchingCard> {
  gameCards: TCard[]
  currentPlayer: string
  matchedPairs: number
  moves: number
  scores: Record<string, number>
  activePlayers: string[]
  playerMetadata: Record<string, PlayerMetadata>
  consecutiveMatches: Record<string, number>
  gameStartTime: number | null
}

// ============================================================================
// Game State (generic over TCard and TConfig)
// ============================================================================

/**
 * The full game state type. Variant config fields are merged in via intersection.
 * E.g. for abacus matching: MatchingPairsState<AbacusCard, AbacusConfig> & { gameType: ... }
 */
export interface MatchingPairsState<
  TCard extends BaseMatchingCard = BaseMatchingCard,
  TConfig extends BaseMatchingConfig = BaseMatchingConfig,
> {
  // Core game data
  cards: TCard[]
  gameCards: TCard[]
  flippedCards: TCard[]

  // Base config fields (always present)
  difficulty: Difficulty
  turnTimer: number

  // Game progression
  gamePhase: GamePhase
  currentPlayer: string
  matchedPairs: number
  totalPairs: number
  moves: number
  scores: Record<string, number>
  activePlayers: string[]
  playerMetadata: Record<string, PlayerMetadata>
  consecutiveMatches: Record<string, number>

  // Timing
  gameStartTime: number | null
  gameEndTime: number | null
  currentMoveStartTime: number | null

  // UI state
  celebrationAnimations: Array<{
    id: string
    type: string
    x: number
    y: number
    timestamp: number
  }>
  isProcessingMove: boolean
  showMismatchFeedback: boolean
  lastMatchedPair: [string, string] | null

  // Pause/Resume
  originalConfig?: Partial<TConfig>
  pausedGamePhase?: GamePhase
  pausedGameState?: PausedGameState<TCard>

  // Hover: Networked hover state
  playerHovers: Record<string, string | null>
}

// ============================================================================
// Moves
// ============================================================================

export type MatchingPairsMove<TCard extends BaseMatchingCard = BaseMatchingCard> =
  | {
      type: 'FLIP_CARD'
      playerId: string
      userId: string
      timestamp: number
      data: { cardId: string }
    }
  | {
      type: 'START_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: {
        cards: TCard[]
        activePlayers: string[]
        playerMetadata: Record<string, PlayerMetadata>
      }
    }
  | {
      type: 'CLEAR_MISMATCH'
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
  | {
      type: 'SET_CONFIG'
      playerId: string
      userId: string
      timestamp: number
      data: { field: string; value: any }
    }
  | {
      type: 'RESUME_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'HOVER_CARD'
      playerId: string
      userId: string
      timestamp: number
      data: { cardId: string | null }
    }

// ============================================================================
// Match Validation Result
// ============================================================================

export interface MatchValidationResult {
  isValid: boolean
  reason?: string
  type: string
}

// ============================================================================
// Context Value
// ============================================================================

export type GameMode = 'single' | 'multiplayer'

export interface GameStatistics {
  totalMoves: number
  matchedPairs: number
  totalPairs: number
  gameTime: number
  accuracy: number
  averageTimePerMove: number
}

export interface MatchingPairsContextValue<
  TCard extends BaseMatchingCard = BaseMatchingCard,
  TConfig extends BaseMatchingConfig = BaseMatchingConfig,
> {
  state: MatchingPairsState<TCard, TConfig> & { gameMode: GameMode } & TConfig
  dispatch: React.Dispatch<any>

  // Computed values
  isGameActive: boolean
  canFlipCard: (cardId: string) => boolean
  currentGameStatistics: GameStatistics
  gameMode: GameMode
  activePlayers: Player[]

  // Pause/Resume
  hasConfigChanged: boolean
  canResumeGame: boolean

  // Actions
  startGame: () => void
  flipCard: (cardId: string) => void
  resetGame: () => void
  setConfig: <K extends string>(field: K, value: any) => void
  setTurnTimer: (timer: number) => void
  goToSetup: () => void
  resumeGame: () => void
  hoverCard: (cardId: string | null) => void
  exitSession: () => void
}

// ============================================================================
// Setup Content Props
// ============================================================================

export interface SetupContentProps<TConfig extends BaseMatchingConfig = BaseMatchingConfig> {
  config: TConfig
  setConfig: <K extends string>(field: K, value: any) => void
  isCompact: boolean
}

// ============================================================================
// Card Back Style
// ============================================================================

export interface CardBackStyle {
  gradient: string
  icon: string
}

// ============================================================================
// Nav Info
// ============================================================================

export interface NavInfo {
  title: string
  emoji: string
}

// ============================================================================
// The Variant Interface — the main extension point
// ============================================================================

export interface MatchingPairsVariant<
  TCard extends BaseMatchingCard = BaseMatchingCard,
  TConfig extends BaseMatchingConfig = BaseMatchingConfig,
> {
  /** Unique game name (used for persistence, registry, etc.) */
  gameName: string

  /** Default configuration */
  defaultConfig: TConfig

  /** Zod schema for the card type */
  cardSchema: z.ZodType<TCard>

  /**
   * Zod schema for the full state.
   * Framework provides a helper, but variants can override.
   */
  stateSchema?: z.ZodType<MatchingPairsState<TCard, TConfig> & TConfig>

  /** Generate cards for a given config */
  generateCards: (config: TConfig) => TCard[]

  /** Validate whether two cards form a match */
  validateMatch: (card1: TCard, card2: TCard) => MatchValidationResult

  /** Validate a config field value. Return error string or null if valid. */
  validateConfigField: (field: string, value: any) => string | null

  /** Get total pairs for a given config */
  getTotalPairs: (config: TConfig) => number

  /** Get the config fields that should be saved in originalConfig for pause/resume */
  getOriginalConfig: (config: TConfig) => Partial<TConfig>

  /** Check if current config has changed from original (for pause/resume) */
  hasConfigChangedFrom: (current: TConfig, original: Partial<TConfig>) => boolean

  /**
   * Card front rendering component.
   * A named component (not inline arrow) so hooks can be used inside.
   */
  CardFront: ComponentType<{ card: TCard }>

  /** Get card back style (gradient + icon) based on card and state */
  getCardBackStyle: (card: TCard, isMatched: boolean) => CardBackStyle

  /** Smart card dimming (optional) — e.g. dim wrong-type cards after first flip */
  shouldDimCard?: (card: TCard, firstFlippedCard: TCard) => boolean

  /** Setup phase content component */
  SetupContent: ComponentType<SetupContentProps<TConfig>>

  /** Grid configuration for a given config */
  getGridConfig: (config: TConfig) => any

  /** Custom results report (optional — framework provides a good default) */
  getResultsReport?: (
    state: MatchingPairsState<TCard, TConfig> & TConfig,
    config: TConfig
  ) => GameResultsReport

  /** Nav info for PageWithNav (optional) */
  getNavInfo?: (config: TConfig) => NavInfo

  /** Quick tip shown at game start (optional) */
  getQuickTip?: (config: TConfig) => string

  /** Practice break defaults (optional) */
  practiceBreakDefaults?: TConfig

  /** Adjust config for practice break duration (optional) */
  adjustConfigForBreak?: (config: TConfig, maxMinutes: number) => TConfig

  /** Can the card be flipped? Framework provides default, variant can override. */
  canFlipCard?: (card: TCard, flippedCards: TCard[], isProcessingMove: boolean) => boolean
}

// ============================================================================
// Factory Return Type
// ============================================================================

export interface MatchingPairsGameBundle<
  TCard extends BaseMatchingCard = BaseMatchingCard,
  TConfig extends BaseMatchingConfig = BaseMatchingConfig,
> {
  game: GameDefinition
  useMatchingPairs: () => MatchingPairsContextValue<TCard, TConfig>
  validator: GameValidator<MatchingPairsState<TCard, TConfig> & TConfig, MatchingPairsMove<TCard>>
}
