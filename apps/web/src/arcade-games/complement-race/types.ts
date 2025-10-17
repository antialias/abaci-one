/**
 * Type definitions for Complement Race multiplayer game
 */

import type { GameMove as BaseGameMove } from '@/lib/arcade/game-sdk'
import type { ComplementRaceGameConfig } from '@/lib/arcade/game-configs'

// ============================================================================
// Configuration Types
// ============================================================================

export type { ComplementRaceGameConfig as ComplementRaceConfig } from '@/lib/arcade/game-configs'

// ============================================================================
// Question & Game Mechanic Types
// ============================================================================

export interface ComplementQuestion {
  id: string
  number: number // The visible number (e.g., 3 in "3 + ? = 5")
  targetSum: number // 5 or 10
  correctAnswer: number // The missing number
  showAsAbacus: boolean // Display as abacus visualization?
  timestamp: number // When question was generated
}

export interface Station {
  id: string
  name: string
  position: number // 0-100% along track
  icon: string
  emoji: string // Alias for icon (for backward compatibility)
}

export interface Passenger {
  id: string
  name: string
  avatar: string
  originStationId: string
  destinationStationId: string
  isUrgent: boolean // Urgent passengers worth 2x points
  claimedBy: string | null // playerId who picked up this passenger (null = unclaimed)
  deliveredBy: string | null // playerId who delivered (null = not delivered yet)
  carIndex: number | null // Physical car index (0-N) where passenger is seated (null = not boarded)
  timestamp: number // When passenger spawned
}

// ============================================================================
// Player State
// ============================================================================

export interface PlayerState {
  id: string
  name: string
  color: string // For ghost train visualization

  // Scores
  score: number
  streak: number
  bestStreak: number
  correctAnswers: number
  totalQuestions: number

  // Position & Progress
  position: number // 0-100% for practice/survival only (sprint mode: client-side)

  // Current state
  isReady: boolean
  isActive: boolean
  currentAnswer: string | null // Their current typed answer (for "thinking" indicator)
  lastAnswerTime: number | null

  // Sprint mode: passengers currently on this player's train
  passengers: string[] // Array of passenger IDs (max 3)
  deliveredPassengers: number // Total count
}

// ============================================================================
// Multiplayer Game State
// ============================================================================

export interface ComplementRaceState {
  // Configuration (from room settings)
  config: ComplementRaceGameConfig

  // Game Phase
  gamePhase: 'setup' | 'lobby' | 'countdown' | 'playing' | 'results'

  // Players
  activePlayers: string[] // Array of player IDs
  playerMetadata: Record<string, { name: string; color: string }> // playerId -> metadata
  players: Record<string, PlayerState> // playerId -> state

  // Current Question (shared for competitive, individual for each player)
  currentQuestions: Record<string, ComplementQuestion> // playerId -> question
  questionStartTime: number // When current question batch started

  // Sprint Mode: Shared passenger pool
  stations: Station[]
  passengers: Passenger[] // All passengers (claimed and unclaimed)
  currentRoute: number
  routeStartTime: number | null

  // Race Progress
  raceStartTime: number | null
  raceEndTime: number | null
  winner: string | null // playerId of winner
  leaderboard: Array<{ playerId: string; score: number; rank: number }>

  // AI Opponents (optional)
  aiOpponents: Array<{
    id: string
    name: string
    personality: 'competitive' | 'analytical'
    position: number
    speed: number
    lastComment: string | null
    lastCommentTime: number
  }>

  // Timing
  gameStartTime: number | null
  gameEndTime: number | null

  // Index signature to satisfy GameState constraint
  [key: string]: unknown
}

// ============================================================================
// Move Types (Player Actions)
// ============================================================================

export type ComplementRaceMove = BaseGameMove &
  // Setup phase
  (
    | {
        type: 'START_GAME'
        data: { activePlayers: string[]; playerMetadata: Record<string, unknown> }
      }
    | { type: 'SET_READY'; data: { ready: boolean } }
    | { type: 'SET_CONFIG'; data: { field: keyof ComplementRaceGameConfig; value: unknown } }

    // Playing phase
    | { type: 'SUBMIT_ANSWER'; data: { answer: number; responseTime: number } }
    | { type: 'UPDATE_INPUT'; data: { input: string } } // Show "thinking" indicator
    | { type: 'CLAIM_PASSENGER'; data: { passengerId: string; carIndex: number } } // Sprint mode: pickup
    | { type: 'DELIVER_PASSENGER'; data: { passengerId: string } } // Sprint mode: delivery

    // Game flow
    | { type: 'NEXT_QUESTION'; data: Record<string, never> }
    | { type: 'END_GAME'; data: Record<string, never> }
    | { type: 'PLAY_AGAIN'; data: Record<string, never> }
    | { type: 'GO_TO_SETUP'; data: Record<string, never> }

    // Sprint mode route progression
    | { type: 'START_NEW_ROUTE'; data: { routeNumber: number } }
  )

// ============================================================================
// Helper Types
// ============================================================================

export interface AnswerValidation {
  correct: boolean
  responseTime: number
  speedBonus: number
  streakBonus: number
  totalPoints: number
  newStreak: number
}

export interface PassengerAction {
  type: 'claim' | 'deliver'
  passengerId: string
  playerId: string
  station: Station
  points: number
  timestamp: number
}
