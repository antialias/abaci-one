/**
 * Type definitions for the session mode state machine.
 *
 * Every voice session mode controls both the agent's instructions and tools
 * via `session.update`. These types define the interface for mode definitions,
 * context passed to modes, and the tool format expected by the OpenAI Realtime API.
 */

import type { GeneratedScenario } from '../generateScenario'
import type { ChildProfile } from '../childProfile'

/** All possible mode identifiers in the session state machine. */
export type ModeId =
  | 'answering'
  | 'familiarizing'
  | 'default'
  | 'conference'
  | 'exploration'
  | 'game'
  | 'winding_down'
  | 'hanging_up'

/** Tool definition for the OpenAI Realtime API (JSON Schema format). */
export interface RealtimeTool {
  type: 'function'
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/** Tracks what the child has done this session (across all calls). */
export interface SessionActivity {
  /** Game IDs played this session (may include duplicates). */
  gamesPlayed: string[]
  /** Exploration IDs launched this session. */
  explorationsLaunched: string[]
}

/** Context available to every mode for building instructions and tools. */
export interface ModeContext {
  calledNumber: number
  scenario: GeneratedScenario | null
  childProfile: ChildProfile | undefined
  profileFailed: boolean
  conferenceNumbers: number[]
  currentSpeaker: number | null
  activeGameId: string | null
  gameState: unknown
  availablePlayers: Array<{ id: string; name: string; emoji: string }>
  currentInstructions: string | null
  sessionActivity: SessionActivity
  /** Whether the agent can request more time (false after first extension). */
  extensionAvailable: boolean
}

/** A session mode definition — controls instructions + tools for a phase of the call. */
export interface AgentMode {
  id: ModeId
  getInstructions: (ctx: ModeContext) => string
  getTools: (ctx: ModeContext) => RealtimeTool[]
}
