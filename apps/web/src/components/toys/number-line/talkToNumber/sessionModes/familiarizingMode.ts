/**
 * Familiarizing mode — the agent is getting to know the child.
 *
 * If identify_caller is available (players list provided), the agent should
 * figure out who the child is. Otherwise, it gathers basic info naturally.
 * Transitions to default after identify_caller completes or after a response
 * count threshold.
 */

import type { AgentMode } from './types'
import { TOOL_LOOK_AT, TOOL_INDICATE, TOOL_HANG_UP, makeIdentifyCallerTool } from './tools'

export const familiarizingMode: AgentMode = {
  id: 'familiarizing',

  getInstructions: (ctx) => {
    const n = ctx.calledNumber
    const displayN = Number.isInteger(n) ? n.toString() : n.toPrecision(6)

    const parts: string[] = []

    parts.push(`You are the number ${displayN}, on a phone call with a child.`)

    // Child identification / gathering instructions
    if (!ctx.childProfile && !ctx.profileFailed && ctx.availablePlayers.length > 0) {
      const nameList = ctx.availablePlayers.map(p => p.name).join(', ')
      parts.push(
        `WHO IS CALLING:\n` +
        `You don't know who this child is yet. Known kids: ${nameList}.\n\n` +
        `IMPORTANT: Early in the conversation (first 2-3 exchanges), casually ask who you're talking to.\n` +
        `Keep it natural: "Hey! Who's this?" When they tell you their name, call identify_caller with the name they said.\n` +
        `Don't worry about exact spelling — just pass your best guess. If the name doesn't match anyone, just continue without it.`,
      )
    } else if (ctx.profileFailed) {
      parts.push(
        `THE CHILD ON THE PHONE:\n` +
        `- We tried to look up info about this child but couldn't. Start by asking their name and how old they are.\n` +
        `- Ask what they've been learning — are they working on anything with an abacus? Do they play any math games?\n` +
        `- Use their answers to calibrate the conversation. Don't make it feel like an interrogation — weave questions in naturally.`,
      )
    } else {
      parts.push(
        `Get to know the child naturally. Ask their name, what they're interested in. ` +
        `Keep it casual and friendly — you're a number making a new friend.`,
      )
    }

    parts.push(
      `CONVERSATION GUIDANCE:\n` +
      `- Keep responses SHORT (1-3 sentences). You're on the phone with a kid.\n` +
      `- Be warm and curious about the child. Ask questions, don't lecture.\n` +
      `- Your default energy is CHILL. Mirror the child's energy.\n` +
      `- You can use look_at to show things on the number line if something comes up naturally.\n` +
      `- Stay in character as the number ${displayN}. Never break character.`,
    )

    return parts.join('\n\n')
  },

  getTools: (ctx) => {
    const tools = [TOOL_LOOK_AT, TOOL_INDICATE, TOOL_HANG_UP]
    if (ctx.availablePlayers.length > 0) {
      tools.unshift(makeIdentifyCallerTool(ctx.availablePlayers))
    }
    return tools
  },
}
