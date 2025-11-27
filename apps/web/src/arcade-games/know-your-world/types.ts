import type { GameConfig, GameMove, GameState } from '@/lib/arcade/game-sdk'
import type { ContinentId } from './continents'
import type { MapDifficultyConfig, RegionSize } from './maps'

/**
 * Assistance level - controls gameplay features (hints, hot/cold, etc.)
 * Separate from region filtering
 */
export type AssistanceLevel = 'guided' | 'helpful' | 'standard' | 'none'

// Game configuration (persisted to database)
export interface KnowYourWorldConfig extends GameConfig {
  selectedMap: 'world' | 'usa'
  gameMode: 'cooperative' | 'race' | 'turn-based'
  // Region filtering (which regions to include by size)
  includeSizes: RegionSize[] // e.g., ['huge', 'large'] for major regions only
  // Assistance level (gameplay features)
  assistanceLevel: AssistanceLevel
  // Legacy field - kept for backwards compatibility
  difficulty?: string // @deprecated Use includeSizes + assistanceLevel instead
  studyDuration: 0 | 30 | 60 | 120 // seconds (0 = skip study mode)
  selectedContinent: ContinentId | 'all' // continent filter for world map ('all' = no filter)
}

// Map data structures
export interface MapRegion {
  id: string // Unique identifier (e.g., "france", "california")
  name: string // Display name (e.g., "France", "California")
  path: string // SVG path data for the region boundary
  center: [number, number] // [x, y] coordinates for label placement
}

export interface MapData {
  id: string // "world" or "usa"
  name: string // "World" or "USA States"
  viewBox: string // SVG viewBox attribute - may be cropped (e.g., "346.40 53.73 247.56 360.70" for Europe)
  originalViewBox: string // Original full map viewBox (e.g., "0 0 1000 500") - used for fit-crop-with-fill
  customCrop: string | null // Custom crop region if any, null if no custom crop applied
  regions: MapRegion[]
  difficultyConfig?: MapDifficultyConfig // Optional per-map difficulty config (uses global default if not provided)
}

// Individual guess record
export interface GuessRecord {
  playerId: string
  regionId: string
  regionName: string
  correct: boolean
  attempts: number // How many tries before getting it right
  timestamp: number
}

// Game state (synchronized across clients)
export interface KnowYourWorldState extends GameState {
  gamePhase: 'setup' | 'studying' | 'playing' | 'results'

  // Setup configuration
  selectedMap: 'world' | 'usa'
  gameMode: 'cooperative' | 'race' | 'turn-based'
  // Region filtering (which regions to include by size)
  includeSizes: RegionSize[] // e.g., ['huge', 'large'] for major regions only
  // Assistance level (gameplay features)
  assistanceLevel: AssistanceLevel
  // Legacy field - kept for backwards compatibility during migration
  difficulty?: string // @deprecated Use includeSizes + assistanceLevel instead
  studyDuration: 0 | 30 | 60 | 120 // seconds (0 = skip study mode)
  selectedContinent: ContinentId | 'all' // continent filter for world map ('all' = no filter)

  // Study phase
  studyTimeRemaining: number // seconds remaining in study phase
  studyStartTime: number // timestamp when study phase started

  // Game progression
  currentPrompt: string | null // Region name to find (e.g., "France")
  regionsToFind: string[] // Queue of region IDs still to find
  regionsFound: string[] // Region IDs already found
  regionsGivenUp: string[] // Region IDs that were given up (for re-asking and scoring)
  currentPlayer: string // For turn-based mode

  // Scoring
  scores: Record<string, number> // playerId -> points
  attempts: Record<string, number> // playerId -> total wrong clicks
  guessHistory: GuessRecord[] // Complete history of all guesses

  // Timing
  startTime: number
  endTime?: number

  // Multiplayer
  activePlayers: string[]
  activeUserIds: string[] // Unique session/viewer IDs participating in the game
  playerMetadata: Record<string, any>

  // Give up reveal state (for animation)
  giveUpReveal: {
    regionId: string
    regionName: string
    timestamp: number // For animation timing key
  } | null

  // Unanimous give-up voting (for cooperative multiplayer)
  giveUpVotes: string[] // Session/viewer IDs (userIds) who have voted to give up on current prompt

  // Hint system
  hintsUsed: number // Total hints used this game
  hintActive: {
    regionId: string
    timestamp: number // For animation timing
  } | null
}

// Move types
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
        includeSizes: RegionSize[] // Which region sizes to include
        assistanceLevel: AssistanceLevel // Gameplay assistance level
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
        includeSizes: RegionSize[] // Which region sizes to include
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
      type: 'SET_STUDY_DURATION'
      playerId: string
      userId: string
      timestamp: number
      data: {
        studyDuration: 0 | 30 | 60 | 120
      }
    }
  | {
      type: 'END_STUDY'
      playerId: string
      userId: string
      timestamp: number
      data: {}
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
