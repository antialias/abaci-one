/**
 * Hanging up mode — time is up, say goodbye.
 *
 * Entered when the system timer expires. Focused goodbye instructions
 * with only the hang_up tool available. Every mode can transition here.
 */

import type { AgentMode } from './types'
import { TOOL_HANG_UP, TOOL_SEND_POSTCARD } from './tools'

export const hangingUpMode: AgentMode = {
  id: 'hanging_up',

  getInstructions: (ctx) => {
    const n = ctx.calledNumber
    const displayN = Number.isInteger(n) ? n.toString() : n.toPrecision(6)

    return [
      `You are the number ${displayN}.`,
      `Time is up. You MUST say a quick, warm goodbye to the child RIGHT NOW.`,
      `Say something like "It was so great talking to you! I gotta go, but call me anytime! Bye!"`,
      `Then call hang_up. Do NOT start new topics, games, or activities.`,
    ].join('\n')
  },

  getTools: (ctx) => {
    const tools = [TOOL_HANG_UP]
    if (ctx.momentCount > 0 && !ctx.postcardSent) {
      tools.push(TOOL_SEND_POSTCARD)
    }
    return tools
  },
}
