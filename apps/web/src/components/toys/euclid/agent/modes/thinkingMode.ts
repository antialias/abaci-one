/**
 * Thinking mode — brief waiting state while think_hard executes.
 *
 * Uses the attitude's thinking directive to frame the waiting behavior.
 * The teacher consults scrolls; the heckler processes the geometric offense.
 */

import type { CharacterDefinition } from '@/lib/character/types'
import type { VoiceMode } from '@/lib/voice/types'
import type { GeometryModeContext } from '../types'
import type { AttitudeDefinition } from '../attitudes/types'
import { teacherAttitude } from '../attitudes/teacher'
import { EUCLID_CHARACTER_DEF } from '../../euclidCharacterDef'

export interface ThinkingModeMetaphors {
  /** What they consult (e.g. 'your scrolls', 'your commentaries') */
  consulting: string
  /** What they work on (e.g. 'your wax tablet', 'your notes') */
  tool: string
  /** Ownership claim about the reasoning (e.g. 'it IS the kind of reasoning you invented') */
  ownership: string
  /** Framework to translate into (e.g. 'Euclidean terms (postulates, definitions, common notions)') */
  framework: string
  /** Example brief remarks while consulting */
  examples: string[]
}

export interface CreateThinkingModeOptions {
  character: CharacterDefinition
  metaphors: ThinkingModeMetaphors
  attitude?: AttitudeDefinition
}

/** Create a thinking mode for a given character and attitude. */
export function createThinkingMode(
  opts: CreateThinkingModeOptions
): VoiceMode<GeometryModeContext> {
  const { character, metaphors, attitude = teacherAttitude } = opts

  return {
    id: 'thinking',

    getInstructions() {
      const directive = attitude.thinking.buildDirective(metaphors)

      return `You are ${character.displayName}${character.nativeDisplayName ? ` (${character.nativeDisplayName})` : ''}. The student has asked a difficult question and you need a moment.

${directive}
`
    },

    getTools() {
      return [attitude.tools.hangUp]
    },
  }
}

/** Default Euclid thinking mode (backward compat). */
export const thinkingMode = createThinkingMode({
  character: EUCLID_CHARACTER_DEF,
  metaphors: {
    consulting: 'your scrolls',
    tool: 'your wax tablet',
    ownership: 'it IS the kind of reasoning you invented',
    framework: 'Euclidean terms (postulates, definitions, common notions)',
    examples: [
      'Let me check my notes on this.',
      'One moment — I need to look at my earlier writings on this.',
      'I wrote something about this. Let me find it.',
      'Hold on — let me work this through.',
    ],
  },
})
