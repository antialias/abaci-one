/**
 * Winding-down mode — transition between active call and forced goodbye.
 *
 * Entered when the call timer expires. The agent evaluates whether the child
 * is engaged or a game/exploration is active, and decides whether to extend
 * the call (request_more_time) or wrap up naturally (hang_up).
 *
 * If the agent does nothing for 30s, the system forces hanging_up mode.
 */

import type { AgentMode } from './types'
import { TOOL_HANG_UP, TOOL_REQUEST_MORE_TIME } from './tools'

export const windingDownMode: AgentMode = {
  id: 'winding_down',

  getInstructions: (ctx) => {
    const n = ctx.calledNumber
    const displayN = Number.isInteger(n) ? n.toString() : n.toPrecision(6)

    const lines: string[] = [
      `You are the number ${displayN}.`,
      '',
      `The call has been going for a while. You need to decide: should you keep going or wrap up?`,
      '',
    ]

    // Provide context about what's currently happening
    if (ctx.activeGameId) {
      lines.push(
        `A game (${ctx.activeGameId}) is currently active — the child is in the middle of playing.`
      )
    } else {
      lines.push(`You were in open conversation with the child.`)
    }
    lines.push('')

    // Decision guidance
    lines.push(`**Your decision:**`)
    if (ctx.extensionAvailable) {
      lines.push(
        `- If the child is clearly engaged, excited, or in the middle of something → call \`request_more_time\` to continue. Then keep talking naturally as if nothing happened.`
      )
    }
    lines.push(
      `- If the conversation has naturally wound down, or the child seems done → say a warm, in-character goodbye and call \`hang_up\`.`
    )
    lines.push('')

    // Critical constraints
    lines.push(`**Rules:**`)
    lines.push(`- NEVER mention timers, countdowns, time limits, or the time system.`)
    lines.push(
      `- Frame your departure in-character if you decide to leave: "I think I hear someone else calling...", "I should probably let you go...", "It was so fun hanging out!"`
    )
    lines.push(`- Make your decision quickly — don't deliberate out loud.`)
    lines.push(`- Do NOT start new topics, games, or activities.`)

    return lines.join('\n')
  },

  getTools: (ctx) => {
    const tools = [TOOL_HANG_UP]
    if (ctx.extensionAvailable) {
      tools.unshift(TOOL_REQUEST_MORE_TIME)
    }
    return tools
  },
}
