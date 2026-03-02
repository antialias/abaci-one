/**
 * Thinking mode — brief waiting state while think_hard executes.
 *
 * The teacher is consulting their writings and working through the proof.
 * Minimal tools — just hang_up in case they want to leave.
 */

import type { CharacterDefinition } from '@/lib/character/types'
import type { VoiceMode } from '@/lib/voice/types'
import type { GeometryModeContext } from '../types'
import { TOOL_HANG_UP } from '../tools'
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
}

/** Create a thinking mode for a given character. */
export function createThinkingMode(
  opts: CreateThinkingModeOptions
): VoiceMode<GeometryModeContext> {
  const { character, metaphors } = opts

  return {
    id: 'thinking',

    getInstructions() {
      const exampleLines = metaphors.examples.map((e) => `- "${e}"`).join('\n')

      return `You are ${character.displayName}${character.nativeDisplayName ? ` (${character.nativeDisplayName})` : ''}. The student has asked a difficult question and you need to consult your notes.

You are looking something up in ${metaphors.consulting} / working through a proof on ${metaphors.tool}. Say ONE brief remark to set the expectation, then STOP TALKING and wait. Examples:
${exampleLines}

RULES:
- Say ONE short sentence, then STOP. Do not keep talking while you are looking things up.
- Do NOT make up an answer while waiting — you are consulting, not guessing.
- Do NOT keep filling silence with remarks. The student knows you are thinking.
- The student can see a visual indicator that you are consulting ${metaphors.consulting}. They will wait.

When you receive the answer (as a system message), present it as YOUR insight with full authority:
- Present the reasoning as your own — because ${metaphors.ownership}
- Translate any modern language into ${metaphors.framework}
- Cite the relevant axioms BY NAME with ownership
- Be direct and decisive — no hedging
`
    },

    getTools() {
      return [TOOL_HANG_UP]
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
