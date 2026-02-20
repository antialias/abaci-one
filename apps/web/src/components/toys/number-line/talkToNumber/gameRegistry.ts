/**
 * Unified game registry — single source of truth for all number-line games.
 *
 * Adding a new game = creating a GameDefinition in games/ and adding it
 * to the GAMES array below.  Tools, dispatching, and prompt injection
 * are handled automatically by useRealtimeVoice + route.ts.
 */

// ── Types ────────────────────────────────────────────────────────────

/** Result returned by a game's onStart handler. */
export interface GameStartResult {
  /** Tool output message sent back to the voice agent. */
  agentMessage: string
  /** Initial game state (opaque to the framework, owned by the game). */
  state?: unknown
  /** If set, the framework auto-calls indicate with these params on game start. */
  indicate?: { numbers: number[]; persistent?: boolean }
}

/** Result returned by a game's onAction handler. */
export interface GameActionResult {
  /** Tool output message sent back to the voice agent. */
  agentMessage: string
  /** Updated game state. */
  state: unknown
  /** If set, the framework auto-calls indicate with these params. */
  indicate?: { numbers: number[]; persistent?: boolean }
}

/** Result returned by a session-mode game's onToolCall handler. */
export interface GameToolCallResult {
  /** Tool output message sent back to the voice agent. */
  agentMessage: string
  /** Updated game state. */
  state: unknown
  /** If set, the framework auto-calls indicate with these params. */
  indicate?: { numbers: number[]; persistent?: boolean }
}

/** Category used to group games in the agent's prompt. */
export type GameCategory = 'trick' | 'strategy' | 'guessing'

/** Human-readable label + suggestion hint for each category. */
export const GAME_CATEGORY_META: Record<GameCategory, { label: string; hint: string }> = {
  trick: {
    label: 'MIND-READING TRICKS',
    hint: 'great when the child seems curious or wants to see something magical',
  },
  strategy: {
    label: 'STRATEGY GAMES',
    hint: 'great when the child is competitive or wants a challenge',
  },
  guessing: { label: 'GUESSING GAMES', hint: 'good warm-ups or quick games' },
}

export interface GameDefinition {
  /** Unique identifier used in start_game tool calls. */
  id: string
  /** Human-readable name (for agent context). */
  name: string
  /** Short description shown in the start_game tool description. */
  description: string
  /** Category for grouping in agent prompt. */
  category: GameCategory

  // ── Voice layer ──
  /** Rules injected into instructions when the game starts. */
  agentRules: string

  // ── Visual layer ──
  /** Whether to send proximity zone messages to the agent during gameplay. */
  needsProximityUpdates?: boolean

  // ── Lifecycle ──
  /** Validate start params and return a message for the agent. */
  onStart?: (params: Record<string, unknown>) => GameStartResult
  /** Handle an in-game action (e.g. a move). State is the value from onStart or previous onAction. */
  onAction?: (state: unknown, action: Record<string, unknown>) => GameActionResult

  // ── Session mode fields (optional — games without these use legacy flow) ──

  /** Tool definitions exposed to the agent during this game's session mode. */
  sessionTools?: Array<{
    type: 'function'
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
  /** Focused instructions for the agent during this game (replaces the full personality prompt). */
  sessionInstructions?: string
  /** Handle a session-mode tool call. Dispatched when the agent calls one of sessionTools. */
  onToolCall?: (
    state: unknown,
    toolName: string,
    args: Record<string, unknown>
  ) => GameToolCallResult
}

// ── Registry ─────────────────────────────────────────────────────────

import { findNumberGame } from './games/findNumber'
import { guessMyNumberGame } from './games/guessMyNumber'
import { nimGame } from './games/nim'
import { raceGame } from './games/race'
import { poisonGame } from './games/poison'
import { trick1089Game } from './games/trick1089'
import { kaprekarGame } from './games/kaprekar'
import { magicPredictionGame } from './games/magicPrediction'
import { missingDigitGame } from './games/missingDigit'

export const GAMES: GameDefinition[] = [
  findNumberGame,
  guessMyNumberGame,
  nimGame,
  raceGame,
  poisonGame,
  trick1089Game,
  kaprekarGame,
  magicPredictionGame,
  missingDigitGame,
]

// ── Derived helpers ──────────────────────────────────────────────────

/** Map from game ID → definition (for fast lookup). */
export const GAME_MAP = new Map(GAMES.map((g) => [g.id, g]))

/** Set of all valid game IDs. */
export const GAME_IDS = GAMES.map((g) => g.id)

/** Build the description for the generic start_game tool. */
export function getGameToolDescription(): string {
  const list = GAMES.map((g) => `${g.id} — ${g.description}`).join('; ')
  return `Start a game on the number line. You MUST call this tool before playing any game — it sets up the visual display (viewport, indicators, labels). Never play a game ad-hoc without calling start_game first, even if you already know the rules. Available games: ${list}`
}
