/**
 * Session mode registry and resolver.
 *
 * All modes are registered here. resolveMode() returns both instructions
 * and tools for a given mode + context, ready to send via session.update.
 */

export type { ModeId, ModeContext, RealtimeTool, AgentMode, SessionActivity } from './types'

import type { ModeId, ModeContext, AgentMode, RealtimeTool } from './types'
import { answeringMode } from './answeringMode'
import { familiarizingMode } from './familiarizingMode'
import { defaultMode } from './defaultMode'
import { conferenceMode } from './conferenceMode'
import { explorationMode } from './explorationMode'
import { gameMode } from './gameMode'
import { windingDownMode } from './windingDownMode'
import { hangingUpMode } from './hangingUpMode'

export const MODE_MAP: Record<ModeId, AgentMode> = {
  answering: answeringMode,
  familiarizing: familiarizingMode,
  default: defaultMode,
  conference: conferenceMode,
  exploration: explorationMode,
  game: gameMode,
  winding_down: windingDownMode,
  hanging_up: hangingUpMode,
}

/** Resolve a mode's instructions and tools for the given context. */
export function resolveMode(
  modeId: ModeId,
  ctx: ModeContext
): { instructions: string; tools: RealtimeTool[] } {
  const mode = MODE_MAP[modeId]
  return {
    instructions: mode.getInstructions(ctx),
    tools: mode.getTools(ctx),
  }
}

// Re-export individual modes for direct access
export { answeringMode } from './answeringMode'
export { familiarizingMode } from './familiarizingMode'
export { defaultMode } from './defaultMode'
export { conferenceMode } from './conferenceMode'
export { explorationMode } from './explorationMode'
export { gameMode } from './gameMode'
export { windingDownMode } from './windingDownMode'
export { hangingUpMode } from './hangingUpMode'
