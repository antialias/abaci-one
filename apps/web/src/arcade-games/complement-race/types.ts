/**
 * Complement Race - Type Definitions
 *
 * This module uses Zod schemas as the single source of truth for types.
 * TypeScript types are inferred from Zod schemas using z.infer<>.
 */

import { z } from 'zod'
import type { GameMove as BaseGameMove } from '@/lib/arcade/game-sdk'

// ============================================================================
// Question & Game Mechanic Types
// ============================================================================

export const ComplementQuestionSchema = z.object({
  id: z.string(),
  number: z.number(), // The visible number (e.g., 3 in "3 + ? = 5")
  targetSum: z.number(), // 5 or 10
  correctAnswer: z.number(), // The missing number
  showAsAbacus: z.boolean(), // Display as abacus visualization?
  timestamp: z.number(), // When question was generated
})
export type ComplementQuestion = z.infer<typeof ComplementQuestionSchema>

export const StationSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(), // 0-100% along track
  icon: z.string(),
  emoji: z.string(), // Alias for icon (for backward compatibility)
})
export type Station = z.infer<typeof StationSchema>

export const PassengerSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  originStationId: z.string(),
  destinationStationId: z.string(),
  isUrgent: z.boolean(), // Urgent passengers worth 2x points
  claimedBy: z.string().nullable(), // playerId who picked up this passenger (null = unclaimed)
  deliveredBy: z.string().nullable(), // playerId who delivered (null = not delivered yet)
  carIndex: z.number().nullable(), // Physical car index (0-N) where passenger is seated (null = not boarded)
  timestamp: z.number(), // When passenger spawned
})
export type Passenger = z.infer<typeof PassengerSchema>

// ============================================================================
// Player State
// ============================================================================

export const PlayerStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(), // For ghost train visualization

  // Scores
  score: z.number(),
  streak: z.number(),
  bestStreak: z.number(),
  correctAnswers: z.number(),
  totalQuestions: z.number(),

  // Position & Progress
  position: z.number(), // 0-100% for practice/survival only (sprint mode: client-side)

  // Current state
  isReady: z.boolean(),
  isActive: z.boolean(),
  currentAnswer: z.string().nullable(), // Their current typed answer (for "thinking" indicator)
  lastAnswerTime: z.number().nullable(),

  // Sprint mode: passengers currently on this player's train
  passengers: z.array(z.string()), // Array of passenger IDs (max 3)
  deliveredPassengers: z.number(), // Total count
})
export type PlayerState = z.infer<typeof PlayerStateSchema>

// ============================================================================
// AI Opponent
// ============================================================================

export const AIOpponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  personality: z.enum(['competitive', 'analytical']),
  position: z.number(),
  speed: z.number(),
  lastComment: z.string().nullable(),
  lastCommentTime: z.number(),
})
export type AIOpponent = z.infer<typeof AIOpponentSchema>

// ============================================================================
// Leaderboard Entry
// ============================================================================

export const LeaderboardEntrySchema = z.object({
  playerId: z.string(),
  score: z.number(),
  rank: z.number(),
})
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>

// ============================================================================
// Game Configuration Schema (mirrors ComplementRaceGameConfig from game-configs)
// ============================================================================

export const ComplementRaceGameConfigSchema = z.object({
  // Game Style
  style: z.enum(['practice', 'sprint', 'survival']),

  // Question Settings
  mode: z.enum(['friends5', 'friends10', 'mixed']),
  complementDisplay: z.enum(['number', 'abacus', 'random']),

  // Difficulty
  timeoutSetting: z.enum([
    'preschool',
    'kindergarten',
    'relaxed',
    'slow',
    'normal',
    'fast',
    'expert',
  ]),

  // AI Settings
  enableAI: z.boolean(),
  aiOpponentCount: z.number(), // 0-2 for multiplayer, 2 for single-player

  // Multiplayer Settings
  maxPlayers: z.number(), // 1-4

  // Sprint Mode Specific
  routeDuration: z.number(), // seconds per route (default 60)
  enablePassengers: z.boolean(),
  passengerCount: z.number(), // 6-8 passengers per route
  maxConcurrentPassengers: z.number(), // 3 per train

  // Practice/Survival Mode Specific
  raceGoal: z.number(), // questions to win practice mode (default 20)

  // Win Conditions
  winCondition: z.enum(['route-based', 'score-based', 'time-based', 'infinite']),
  targetScore: z.number().optional(), // for score-based (e.g., 100)
  timeLimit: z.number().optional(), // for time-based (e.g., 300 seconds)
  routeCount: z.number().optional(), // for route-based (e.g., 3 routes)
})

/**
 * Configuration type for complement-race game
 * Inferred from Zod schema - this is the single source of truth
 */
export type ComplementRaceGameConfig = z.infer<typeof ComplementRaceGameConfigSchema> & {
  [key: string]: unknown // Index signature to satisfy GameConfig constraint
}

// Alias for backward compatibility
export type ComplementRaceConfig = ComplementRaceGameConfig

// ============================================================================
// Game Phase
// ============================================================================

export const GamePhaseSchema = z.enum(['setup', 'lobby', 'countdown', 'playing', 'results'])
export type GamePhase = z.infer<typeof GamePhaseSchema>

// ============================================================================
// Multiplayer Game State
// ============================================================================

export const ComplementRaceStateSchema = z.object({
  // Configuration (from room settings)
  config: ComplementRaceGameConfigSchema,

  // Game Phase
  gamePhase: GamePhaseSchema,

  // Players
  activePlayers: z.array(z.string()), // Array of player IDs
  playerMetadata: z.record(z.string(), z.object({ name: z.string(), color: z.string() })), // playerId -> metadata
  players: z.record(z.string(), PlayerStateSchema), // playerId -> state

  // Current Question (shared for competitive, individual for each player)
  currentQuestions: z.record(z.string(), ComplementQuestionSchema), // playerId -> question
  questionStartTime: z.number(), // When current question batch started

  // Sprint Mode: Shared passenger pool
  stations: z.array(StationSchema),
  passengers: z.array(PassengerSchema), // All passengers (claimed and unclaimed)
  currentRoute: z.number(),
  routeStartTime: z.number().nullable(),

  // Race Progress
  raceStartTime: z.number().nullable(),
  raceEndTime: z.number().nullable(),
  winner: z.string().nullable(), // playerId of winner
  leaderboard: z.array(LeaderboardEntrySchema),

  // AI Opponents (optional)
  aiOpponents: z.array(AIOpponentSchema),

  // Timing
  gameStartTime: z.number().nullable(),
  gameEndTime: z.number().nullable(),
})

/**
 * Core game state type - inferred from Zod schema
 * Note: Index signature added to satisfy GameState constraint
 */
export type ComplementRaceState = z.infer<typeof ComplementRaceStateSchema> & {
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
        data: {
          activePlayers: string[]
          playerMetadata: Record<string, unknown>
        }
      }
    | { type: 'SET_READY'; data: { ready: boolean } }
    | {
        type: 'SET_CONFIG'
        data: { field: keyof ComplementRaceGameConfig; value: unknown }
      }

    // Playing phase
    | { type: 'SUBMIT_ANSWER'; data: { answer: number; responseTime: number } }
    | { type: 'UPDATE_INPUT'; data: { input: string } } // Show "thinking" indicator
    | { type: 'UPDATE_POSITION'; data: { position: number } } // Sprint mode: sync train position
    | {
        type: 'CLAIM_PASSENGER'
        data: { passengerId: string; carIndex: number }
      } // Sprint mode: pickup
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

export const AnswerValidationSchema = z.object({
  correct: z.boolean(),
  responseTime: z.number(),
  speedBonus: z.number(),
  streakBonus: z.number(),
  totalPoints: z.number(),
  newStreak: z.number(),
})
export type AnswerValidation = z.infer<typeof AnswerValidationSchema>

export const PassengerActionSchema = z.object({
  type: z.enum(['claim', 'deliver']),
  passengerId: z.string(),
  playerId: z.string(),
  station: StationSchema,
  points: z.number(),
  timestamp: z.number(),
})
export type PassengerAction = z.infer<typeof PassengerActionSchema>
