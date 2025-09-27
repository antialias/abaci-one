// TypeScript interfaces for Memory Pairs Challenge game

export type GameMode = 'single' | 'two-player'
export type GameType = 'abacus-numeral' | 'complement-pairs'
export type GamePhase = 'setup' | 'playing' | 'results'
export type CardType = 'abacus' | 'number' | 'complement'
export type Difficulty = 6 | 8 | 12 | 15 // Number of pairs
export type Player = 1 | 2
export type TargetSum = 5 | 10

export interface GameCard {
  id: string
  type: CardType
  number: number
  complement?: number // For complement pairs
  targetSum?: TargetSum // For complement pairs
  matched: boolean
  matchedBy?: Player // For two-player mode
  element?: HTMLElement | null // For animations
}

export interface PlayerScore {
  player1: number
  player2: number
}

export interface CelebrationAnimation {
  id: string
  type: 'match' | 'win' | 'confetti'
  x: number
  y: number
  timestamp: number
}

export interface GameStatistics {
  totalMoves: number
  matchedPairs: number
  totalPairs: number
  gameTime: number
  accuracy: number // Percentage of successful matches
  averageTimePerMove: number
}

export interface MemoryPairsState {
  // Core game data
  cards: GameCard[]
  gameCards: GameCard[]
  flippedCards: GameCard[]

  // Game configuration
  gameMode: GameMode
  gameType: GameType
  difficulty: Difficulty
  turnTimer: number // Seconds for two-player mode

  // Game progression
  gamePhase: GamePhase
  currentPlayer: Player
  matchedPairs: number
  totalPairs: number
  moves: number
  scores: PlayerScore

  // Timing
  gameStartTime: number | null
  gameEndTime: number | null
  currentMoveStartTime: number | null
  timerInterval: NodeJS.Timeout | null

  // UI state
  celebrationAnimations: CelebrationAnimation[]
  isProcessingMove: boolean
  showMismatchFeedback: boolean
  lastMatchedPair: [string, string] | null
}

export type MemoryPairsAction =
  | { type: 'SET_GAME_MODE'; mode: GameMode }
  | { type: 'SET_GAME_TYPE'; gameType: GameType }
  | { type: 'SET_DIFFICULTY'; difficulty: Difficulty }
  | { type: 'SET_TURN_TIMER'; timer: number }
  | { type: 'START_GAME'; cards: GameCard[] }
  | { type: 'FLIP_CARD'; cardId: string }
  | { type: 'MATCH_FOUND'; cardIds: [string, string] }
  | { type: 'MATCH_FAILED'; cardIds: [string, string] }
  | { type: 'SWITCH_PLAYER' }
  | { type: 'ADD_CELEBRATION'; animation: CelebrationAnimation }
  | { type: 'REMOVE_CELEBRATION'; animationId: string }
  | { type: 'SHOW_RESULTS' }
  | { type: 'RESET_GAME' }
  | { type: 'SET_PROCESSING'; processing: boolean }
  | { type: 'SET_MISMATCH_FEEDBACK'; show: boolean }
  | { type: 'UPDATE_TIMER' }

export interface MemoryPairsContextValue {
  state: MemoryPairsState
  dispatch: React.Dispatch<MemoryPairsAction>

  // Computed values
  isGameActive: boolean
  canFlipCard: (cardId: string) => boolean
  currentGameStatistics: GameStatistics

  // Actions
  startGame: () => void
  flipCard: (cardId: string) => void
  resetGame: () => void
  setGameMode: (mode: GameMode) => void
  setGameType: (type: GameType) => void
  setDifficulty: (difficulty: Difficulty) => void
}

// Utility types for component props
export interface GameCardProps {
  card: GameCard
  isFlipped: boolean
  isMatched: boolean
  onClick: () => void
  disabled?: boolean
}

export interface PlayerIndicatorProps {
  player: Player
  isActive: boolean
  score: number
  name?: string
}

export interface GameGridProps {
  cards: GameCard[]
  onCardClick: (cardId: string) => void
  disabled?: boolean
}

// Configuration interfaces
export interface GameConfiguration {
  gameMode: GameMode
  gameType: GameType
  difficulty: Difficulty
  turnTimer: number
}

export interface MatchValidationResult {
  isValid: boolean
  reason?: string
  type: 'abacus-numeral' | 'complement' | 'invalid'
}