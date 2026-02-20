/**
 * Conference mode — multiple numbers on the same call.
 *
 * Uses generateConferencePrompt for instructions. Tools include
 * switch_speaker for character switching and standard conference tools.
 */

import type { AgentMode } from './types'
import { generateConferencePrompt } from '../generateNumberPersonality'
import { getConferenceTools } from './tools'

export const conferenceMode: AgentMode = {
  id: 'conference',

  getInstructions: (ctx) =>
    generateConferencePrompt(
      ctx.conferenceNumbers,
      ctx.currentSpeaker ?? undefined,
      ctx.childProfile
    ),

  getTools: () => getConferenceTools(),
}
