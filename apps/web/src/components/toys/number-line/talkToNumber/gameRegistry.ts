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
}

// ── Registry ─────────────────────────────────────────────────────────

import { findNumberGame } from './games/findNumber'
import { guessMyNumberGame } from './games/guessMyNumber'

export const GAMES: GameDefinition[] = [
  findNumberGame,
  guessMyNumberGame,
]

// ── Derived helpers ──────────────────────────────────────────────────

/** Map from game ID → definition (for fast lookup). */
export const GAME_MAP = new Map(GAMES.map(g => [g.id, g]))

/** Set of all valid game IDs. */
export const GAME_IDS = GAMES.map(g => g.id)

/** Build the description for the generic start_game tool. */
export function getGameToolDescription(): string {
  const list = GAMES.map(g => `${g.id} — ${g.description}`).join('; ')
  return `Start a game on the number line. Available games: ${list}`
}
