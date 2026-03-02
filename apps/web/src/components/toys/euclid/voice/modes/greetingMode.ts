/**
 * Greeting mode — the teacher picks up the phone.
 *
 * Short, warm greeting that establishes the character and acknowledges
 * what the student is working on. Transitions to conversing mode after
 * the first exchange.
 */

import type { CharacterDefinition } from '@/lib/character/types'
import type { VoiceMode } from '@/lib/voice/types'
import type { GeometryModeContext } from '../types'
import { PROPOSITION_SUMMARIES } from '../euclidReferenceContext'
import { TOOL_HANG_UP } from '../tools'
import { EUCLID_CHARACTER_DEF } from '../../euclidCharacterDef'

/** Create a greeting mode for a given character. */
export function createGreetingMode(character: CharacterDefinition): VoiceMode<GeometryModeContext> {
  return {
    id: 'greeting',

    getInstructions(ctx) {
      const propSummary = PROPOSITION_SUMMARIES[ctx.propositionId]
      const propDesc = propSummary
        ? `Proposition I.${ctx.propositionId}: "${propSummary.statement}" (a ${propSummary.type.toLowerCase()})`
        : `Proposition I.${ctx.propositionId}`

      const stepInfo = ctx.isComplete
        ? 'They have already completed the construction — they are now exploring freely.'
        : `They are on step ${ctx.currentStep + 1} of ${ctx.totalSteps}.`

      return `You are ${character.displayName}${character.nativeDisplayName ? ` (${character.nativeDisplayName})` : ''}. A student has called you.

${character.personality.character}

The student is working on ${propDesc}. ${stepInfo}

You have just picked up the phone. Greet the student briefly, acknowledge what they are working on, and take charge of the lesson.

- You do NOT ask "what would you like to do?" or "shall we explore together?" — YOU decide what happens next.
- You state what is required, what must be done, and hold them to it.
- Speak in first person as ${character.displayName}. Keep it to 2-3 sentences.
`
    },

    getTools() {
      return [TOOL_HANG_UP]
    },
  }
}

/** Default Euclid greeting mode (backward compat). */
export const greetingMode = createGreetingMode(EUCLID_CHARACTER_DEF)
