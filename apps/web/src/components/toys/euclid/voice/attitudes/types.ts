/**
 * Attitude system types.
 *
 * An attitude provides the structural framing for each voice mode —
 * the boilerplate that shapes HOW a character engages. The same character
 * can adopt different attitudes (teacher, heckler) without being forked.
 *
 * Character voice behavior = core identity (shared) + attitude personality
 * (per character per attitude) + attitude framing (shared structural template).
 */

import type { CharacterDefinition, CharacterAttitudePersonality } from '@/lib/character/types'
import type { RealtimeTool } from '@/lib/voice/types'
import type { GeometryModeContext } from '../types'
import type { ThinkingModeMetaphors } from '../modes/thinkingMode'

export type AttitudeId = 'teacher' | 'heckler'

export interface AttitudeDefinition {
  id: AttitudeId
  label: string // 'Teacher' | 'Peanut Gallery'

  /** Structural framing for greeting mode (character-agnostic). */
  greeting: {
    /** Build the attitude-specific greeting directive. */
    buildDirective: (character: CharacterDefinition, ctx: GeometryModeContext) => string
  }

  /** Structural framing for conversing mode (character-agnostic). */
  conversing: {
    /** Role introduction line (e.g. "You are teaching..." vs "You are observing...") */
    roleIntro: string
    /**
     * Build step guidance block. Null means no step guidance (e.g. heckler doesn't guide).
     * When provided, receives the context and the character's buildCompletionContext function.
     */
    buildStepGuidance:
      | ((ctx: GeometryModeContext, buildCompletionContext: (propId: number) => string) => string)
      | null
    /** Instructions for the highlight tool usage. */
    highlightInstructions: string
    /** Instructions for the think_hard tool usage. */
    thinkHardInstructions: string
    /** Instructions for responding to live construction updates. */
    liveUpdateInstructions: string
    /** Response style guidelines (conciseness, tone). */
    responseGuidelines: string
  }

  /** Structural framing for thinking mode (character-agnostic). */
  thinking: {
    /** Build the attitude-specific thinking directive. */
    buildDirective: (metaphors: ThinkingModeMetaphors) => string
  }

  /** Attitude-specific tool descriptions (same tools, different framing). */
  tools: {
    highlight: RealtimeTool
    thinkHard: RealtimeTool
    hangUp: RealtimeTool
  }
}

/**
 * Resolve the attitude personality for a character.
 * Falls back to teacher if the requested attitude isn't defined.
 */
export function getAttitudePersonality(
  character: CharacterDefinition,
  attitudeId: AttitudeId
): CharacterAttitudePersonality {
  return character.personality.attitudes[attitudeId] ?? character.personality.attitudes.teacher
}
