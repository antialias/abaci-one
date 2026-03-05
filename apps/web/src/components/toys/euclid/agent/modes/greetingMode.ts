/**
 * Greeting mode — the character picks up the phone (or initiates contact).
 *
 * Uses the attitude's greeting directive to frame the opening. The teacher
 * takes charge of the lesson; the heckler opens with a devastating observation.
 */

import type { CharacterDefinition } from '@/lib/character/types'
import type { VoiceMode } from '@/lib/voice/types'
import type { GeometryModeContext } from '../types'
import type { AttitudeDefinition } from '../attitudes/types'
import { teacherAttitude } from '../attitudes/teacher'
import { EUCLID_CHARACTER_DEF } from '../../euclidCharacterDef'

export interface CreateGreetingModeOptions {
  character: CharacterDefinition
  attitude?: AttitudeDefinition
}

/** Create a greeting mode for a given character and attitude. */
export function createGreetingMode(
  characterOrOpts: CharacterDefinition | CreateGreetingModeOptions
): VoiceMode<GeometryModeContext> {
  const opts: CreateGreetingModeOptions =
    'personality' in characterOrOpts ? { character: characterOrOpts } : characterOrOpts
  const { character, attitude = teacherAttitude } = opts

  return {
    id: 'greeting',

    getInstructions(ctx) {
      const directive = attitude.greeting.buildDirective(character, ctx)

      return `You are ${character.displayName}${character.nativeDisplayName ? ` (${character.nativeDisplayName})` : ''}.

${character.personality.character}

${directive}
`
    },

    getTools() {
      return [attitude.tools.hangUp]
    },
  }
}

/** Default Euclid greeting mode (backward compat). */
export const greetingMode = createGreetingMode(EUCLID_CHARACTER_DEF)
