/**
 * Know Your World - Type Definitions
 *
 * This module uses Zod schemas as the single source of truth for types.
 * TypeScript types are inferred from Zod schemas using z.infer<>.
 *
 * This enables:
 * - Compile-time type checking (TypeScript)
 * - Runtime validation (Zod) for client-server state sync
 * - Automatic detection of schema mismatches when loading from database
 */

import { z } from 'zod'

// =============================================================================
// Shared Enums (Zod schemas that can be reused)
// =============================================================================

/**
 * Assistance level - controls gameplay features (hints, hot/cold, etc.)
 * Separate from region filtering
 */
export const AssistanceLevelSchema = z.enum(['learning', 'guided', 'helpful', 'standard', 'none'])
export type AssistanceLevel = z.infer<typeof AssistanceLevelSchema>

/**
 * Region size categories for filtering
 */
export const RegionSizeSchema = z.enum(['huge', 'large', 'medium', 'small', 'tiny'])
export type RegionSize = z.infer<typeof RegionSizeSchema>

/**
 * Continent identifiers for world map filtering
 */
export const ContinentIdSchema = z.enum([
  'africa',
  'asia',
  'europe',
  'north-america',
  'south-america',
  'oceania',
  'antarctica',
])
export type ContinentId = z.infer<typeof ContinentIdSchema>

/**
 * Map selection
 */
export const MapSelectionSchema = z.enum(['world', 'usa'])
export type MapSelection = z.infer<typeof MapSelectionSchema>

/**
 * Game mode
 */
export const GameModeSchema = z.enum(['cooperative', 'race', 'turn-based'])
export type GameMode = z.infer<typeof GameModeSchema>

/**
 * Game phase
 */
export const GamePhaseSchema = z.enum(['setup', 'playing', 'results'])
export type GamePhase = z.infer<typeof GamePhaseSchema>

// =============================================================================
// Game Configuration Schema
// =============================================================================

export const KnowYourWorldConfigSchema = z.object({
  selectedMap: MapSelectionSchema,
  gameMode: GameModeSchema,
  includeSizes: z.array(RegionSizeSchema),
  assistanceLevel: AssistanceLevelSchema,
  difficulty: z.string().optional(), // @deprecated - kept for backwards compatibility
  selectedContinent: z.union([ContinentIdSchema, z.literal('all')]),
  studyDuration: z.number().optional(), // Duration in seconds for study mode
})

/**
 * Game configuration type - inferred from Zod schema
 * Compatible with GameConfig (Record<string, unknown>)
 */
export type KnowYourWorldConfig = z.infer<typeof KnowYourWorldConfigSchema>

// =============================================================================
// Map Data Structures
// =============================================================================

/**
 * Basic region data from map
 */
export const MapRegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  center: z.tuple([z.number(), z.number()]), // SVG coordinates of region centroid
})
export type MapRegion = z.infer<typeof MapRegionSchema>

/**
 * Hints mode for difficulty levels
 */
export const HintsModeSchema = z.enum(['onRequest', 'limited', 'none'])
export type HintsMode = z.infer<typeof HintsModeSchema>

/**
 * Give up behavior mode
 */
export const GiveUpModeSchema = z.enum(['reaskSoon', 'reaskEnd', 'countsAgainst', 'skipEntirely'])
export type GiveUpMode = z.infer<typeof GiveUpModeSchema>

/**
 * Difficulty level configuration
 */
export const DifficultyLevelSchema = z.object({
  id: z.string(),
  label: z.string(),
  emoji: z.string().optional(),
  description: z.string().optional(),
  detailedDescription: z.string().optional(),
  includeSizes: z.array(RegionSizeSchema).optional(),
  excludeRegions: z.array(z.string()).optional(),
  keepPercentile: z.number().optional(),
  hotColdEnabled: z.boolean().optional(),
  hintsMode: HintsModeSchema.optional(),
  hintLimit: z.number().optional(),
  autoHintDefault: z.boolean().optional(),
  struggleHintEnabled: z.boolean().optional(),
  giveUpMode: GiveUpModeSchema.optional(),
  wrongClickShowsName: z.boolean().optional(),
})
export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>

/**
 * Per-map difficulty configuration
 */
export const MapDifficultyConfigSchema = z.object({
  levels: z.array(DifficultyLevelSchema),
  defaultLevel: z.string(),
})
export type MapDifficultyConfig = z.infer<typeof MapDifficultyConfigSchema>

/**
 * Map data structure containing all information about a map
 */
export const MapDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  viewBox: z.string(),
  originalViewBox: z.string(),
  customCrop: z.string().nullable(),
  regions: z.array(MapRegionSchema),
  difficultyConfig: MapDifficultyConfigSchema.optional(),
})
export type MapData = z.infer<typeof MapDataSchema>

// =============================================================================
// Game State Schema (synchronized across clients - NEEDS runtime validation)
// =============================================================================

/**
 * Individual guess record
 */
export const GuessRecordSchema = z.object({
  playerId: z.string(),
  regionId: z.string(),
  regionName: z.string(),
  correct: z.boolean(),
  attempts: z.number(),
  timestamp: z.number(),
})
export type GuessRecord = z.infer<typeof GuessRecordSchema>

/**
 * Give up reveal state (for animation)
 */
export const GiveUpRevealSchema = z
  .object({
    regionId: z.string(),
    regionName: z.string(),
    timestamp: z.number(),
  })
  .nullable()

/**
 * Hint active state
 */
export const HintActiveSchema = z
  .object({
    regionId: z.string(),
    timestamp: z.number(),
  })
  .nullable()

/**
 * Player metadata schema - flexible record for player info
 */
export const PlayerMetadataSchema = z.record(z.string(), z.any())

/**
 * Game state schema - the main synchronized state
 * This is the single source of truth for what KnowYourWorldState contains
 */
export const KnowYourWorldStateSchema = z.object({
  // Game phase
  gamePhase: GamePhaseSchema,

  // Setup configuration
  selectedMap: MapSelectionSchema,
  gameMode: GameModeSchema,
  includeSizes: z.array(RegionSizeSchema),
  assistanceLevel: AssistanceLevelSchema,
  difficulty: z.string().optional(), // @deprecated
  selectedContinent: z.union([ContinentIdSchema, z.literal('all')]),

  // Game progression
  currentPrompt: z.string().nullable(),
  regionsToFind: z.array(z.string()),
  regionsFound: z.array(z.string()),
  regionsGivenUp: z.array(z.string()),
  currentPlayer: z.string(),

  // Scoring
  scores: z.record(z.string(), z.number()),
  attempts: z.record(z.string(), z.number()),
  guessHistory: z.array(GuessRecordSchema),

  // Timing
  startTime: z.number(),
  endTime: z.number().optional(),

  // Multiplayer
  activePlayers: z.array(z.string()),
  activeUserIds: z.array(z.string()),
  playerMetadata: PlayerMetadataSchema,

  // Give up reveal state
  giveUpReveal: GiveUpRevealSchema,

  // Unanimous give-up voting
  giveUpVotes: z.array(z.string()),

  // Hint system
  hintsUsed: z.number(),
  hintActive: HintActiveSchema,

  // Name confirmation progress (learning mode)
  nameConfirmationProgress: z.number(),
})

/**
 * Game state type - inferred from schema
 * Use this type for compile-time checking
 */
export type KnowYourWorldState = z.infer<typeof KnowYourWorldStateSchema>

// =============================================================================
// Move Types (could also be validated, but less critical than state)
// =============================================================================

// For now, keep moves as TypeScript types. They could be converted to Zod later
// if we want to validate incoming moves on the server.

export type KnowYourWorldMove =
  | {
      type: 'START_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: {
        activePlayers: string[]
        playerMetadata: Record<string, any>
        selectedMap: 'world' | 'usa'
        gameMode: 'cooperative' | 'race' | 'turn-based'
        includeSizes: RegionSize[]
        assistanceLevel: AssistanceLevel
      }
    }
  | {
      type: 'CLICK_REGION'
      playerId: string
      userId: string
      timestamp: number
      data: {
        regionId: string
        regionName: string
      }
    }
  | {
      type: 'NEXT_ROUND'
      playerId: string
      userId: string
      timestamp: number
      data: {}
    }
  | {
      type: 'END_GAME'
      playerId: string
      userId: string
      timestamp: number
      data: {}
    }
  | {
      type: 'SET_MAP'
      playerId: string
      userId: string
      timestamp: number
      data: {
        selectedMap: 'world' | 'usa'
      }
    }
  | {
      type: 'SET_MODE'
      playerId: string
      userId: string
      timestamp: number
      data: {
        gameMode: 'cooperative' | 'race' | 'turn-based'
      }
    }
  | {
      type: 'SET_REGION_SIZES'
      playerId: string
      userId: string
      timestamp: number
      data: {
        includeSizes: RegionSize[]
      }
    }
  | {
      type: 'SET_ASSISTANCE_LEVEL'
      playerId: string
      userId: string
      timestamp: number
      data: {
        assistanceLevel: AssistanceLevel
      }
    }
  | {
      type: 'RETURN_TO_SETUP'
      playerId: string
      userId: string
      timestamp: number
      data: {}
    }
  | {
      type: 'SET_CONTINENT'
      playerId: string
      userId: string
      timestamp: number
      data: {
        selectedContinent: ContinentId | 'all'
      }
    }
  | {
      type: 'GIVE_UP'
      playerId: string
      userId: string
      timestamp: number
      data: {}
    }
  | {
      type: 'REQUEST_HINT'
      playerId: string
      userId: string
      timestamp: number
      data: {}
    }
  | {
      type: 'CONFIRM_LETTER'
      playerId: string
      userId: string
      timestamp: number
      data: {
        letter: string
        letterIndex: number
      }
    }
