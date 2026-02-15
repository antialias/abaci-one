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

export interface GameDefinition {
  /** Unique identifier used in start_game tool calls. */
  id: string
  /** Human-readable name (for agent context). */
  name: string
  /** Short description shown in the start_game tool description. */
  description: string

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
  sessionTools?: Array<{ type: 'function'; name: string; description: string; parameters: Record<string, unknown> }>
  /** Focused instructions for the agent during this game (replaces the full personality prompt). */
  sessionInstructions?: string
  /** Handle a session-mode tool call. Dispatched when the agent calls one of sessionTools. */
  onToolCall?: (state: unknown, toolName: string, args: Record<string, unknown>) => GameToolCallResult
}

// ── Registry ─────────────────────────────────────────────────────────

import { findNumberGame } from './games/findNumber'
import { guessMyNumberGame } from './games/guessMyNumber'
import { nimGame } from './games/nim'

export const GAMES: GameDefinition[] = [
  findNumberGame,
  guessMyNumberGame,
  nimGame,
]

// ── Derived helpers ──────────────────────────────────────────────────

/** Map from game ID → definition (for fast lookup). */
export const GAME_MAP = new Map(GAMES.map(g => [g.id, g]))

/** Set of all valid game IDs. */
export const GAME_IDS = GAMES.map(g => g.id)

/** Build the description for the generic start_game tool. */
export function getGameToolDescription(): string {
  const list = GAMES.map(g => `${g.id} — ${g.description}`).join('; ')
  return `Start a game on the number line. You MUST call this tool before playing any game — it sets up the visual display (viewport, indicators, labels). Never play a game ad-hoc without calling start_game first, even if you already know the rules. Available games: ${list}`
}
