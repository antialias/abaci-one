/**
 * Default mode — open conversation with the child.
 *
 * Full tool set. Uses generateNumberPersonality for instructions (which
 * includes the scenario, child profile, tool guide, primes, etc.).
 */

import type { AgentMode } from './types'
import { generateNumberPersonality } from '../generateNumberPersonality'
import { getDefaultTools } from './tools'

export const defaultMode: AgentMode = {
  id: 'default',

  getInstructions: (ctx) =>
    generateNumberPersonality(
      ctx.calledNumber,
      ctx.scenario,
      ctx.childProfile,
      ctx.profileFailed,
      ctx.availablePlayers.length > 0 ? ctx.availablePlayers : undefined,
      ctx.sessionActivity
    ),

  getTools: getDefaultTools,
}
