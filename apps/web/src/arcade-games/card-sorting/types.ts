import type { GameConfig, GameState } from '@/lib/arcade/game-sdk/types'

// ============================================================================
// Player Metadata
// ============================================================================

export interface PlayerMetadata {
  id: string // Player ID (UUID)
  name: string
  emoji: string
  userId: string
}

// ============================================================================
// Configuration
// ============================================================================

export interface CardSortingConfig extends GameConfig {
  cardCount: 5 | 8 | 12 | 15 // Difficulty (number of cards)
  showNumbers: boolean // Allow reveal numbers button
  timeLimit: number | null // Optional time limit (seconds), null = unlimited
}

// ============================================================================
// Core Data Types
// ============================================================================

export type GamePhase = 'setup' | 'playing' | 'results'

export interface SortingCard {
  id: string // Unique ID for this card instance
  number: number // The abacus value (0-99+)
  svgContent: string // Serialized AbacusReact SVG
}

export interface CardPosition {
  cardId: string
  x: number // % of viewport width (0-100)
  y: number // % of viewport height (0-100)
  rotation: number // degrees (-15 to 15)
  zIndex: number
}

export interface PlacedCard {
  card: SortingCard // The card data
  position: number // Which slot it's in (0-indexed)
}

export interface ScoreBreakdown {
  finalScore: number // 0-100 weighted average
  exactMatches: number // Cards in exactly correct position
  lcsLength: number // Longest common subsequence length
  inversions: number // Number of out-of-order pairs
  relativeOrderScore: number // 0-100 based on LCS
  exactPositionScore: number // 0-100 based on exact matches
  inversionScore: number // 0-100 based on inversions
  elapsedTime: number // Seconds taken
  numbersRevealed: boolean // Whether player used reveal
}

// ============================================================================
// Game State
// ============================================================================

export interface CardSortingState extends GameState {
  // Configuration
  cardCount: 5 | 8 | 12 | 15
  showNumbers: boolean
  timeLimit: number | null

  // Game phase
  gamePhase: GamePhase

  // Player & timing
  playerId: string // Single player ID
  playerMetadata: PlayerMetadata // Player display info
  gameStartTime: number | null
  gameEndTime: number | null

  // Cards
  selectedCards: SortingCard[] // The N cards for this game
  correctOrder: SortingCard[] // Sorted by number (answer key)
  availableCards: SortingCard[] // Cards not yet placed
  placedCards: (SortingCard | null)[] // Array of N slots (null = empty)
  cardPositions: CardPosition[] // Viewport-relative positions for all cards

  // UI state (client-only, not in server state)
  selectedCardId: string | null // Currently selected card
  numbersRevealed: boolean // If player revealed numbers

  // Results
  scoreBreakdown: ScoreBreakdown | null // Final score details

  // Pause/Resume (standard pattern)
  originalConfig?: CardSortingConfig
  pausedGamePhase?: GamePhase
  pausedGameState?: {
    selectedCards: SortingCard[]
    availableCards: SortingCard[]
    placedCards: (SortingCard | null)[]
    cardPositions: CardPosition[]
    gameStartTime: number
    numbersRevealed: boolean
  }
}

// ============================================================================
// Game Moves
// ============================================================================

export type CardSortingMove =
  | {
      type: 'START_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: {
        playerMetadata: PlayerMetadata
        selectedCards: SortingCard[] // Pre-selected random cards
      }
    }
  | {
      type: 'PLACE_CARD'
      playerId: string
      userId: string
      timestamp: number
      data: {
        cardId: string // Which card to place
        position: number // Which slot (0-indexed)
      }
    }
  | {
      type: 'INSERT_CARD'
      playerId: string
      userId: string
      timestamp: number
      data: {
        cardId: string // Which card to insert
        insertPosition: number // Where to insert (0-indexed, can be 0 to cardCount)
      }
    }
  | {
      type: 'REMOVE_CARD'
      playerId: string
      userId: string
      timestamp: number
      data: {
        position: number // Which slot to remove from
      }
    }
  | {
      type: 'REVEAL_NUMBERS'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'CHECK_SOLUTION'
      playerId: string
      userId: string
      timestamp: number
      data: {
        finalSequence?: SortingCard[] // Optional - if provided, use this as the final placement
      }
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
      data: {
        field: 'cardCount' | 'showNumbers' | 'timeLimit'
        value: unknown
      }
    }
  | {
      type: 'RESUME_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: Record<string, never>
    }
  | {
      type: 'UPDATE_CARD_POSITIONS'
      playerId: string
      userId: string
      timestamp: number
      data: {
        positions: CardPosition[]
      }
    }

// ============================================================================
// Component Props
// ============================================================================

export interface SortingCardProps {
  card: SortingCard
  isSelected: boolean
  isPlaced: boolean
  isCorrect?: boolean // After checking solution
  onClick: () => void
  showNumber: boolean // If revealed
}

export interface PositionSlotProps {
  position: number
  card: SortingCard | null
  isActive: boolean // If slot is clickable
  isCorrect?: boolean // After checking solution
  gradientStyle: React.CSSProperties
  onClick: () => void
}

export interface ScoreDisplayProps {
  breakdown: ScoreBreakdown
  correctOrder: SortingCard[]
  userOrder: SortingCard[]
  onNewGame: () => void
  onExit: () => void
}
