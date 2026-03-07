/**
 * Farewell mode — the only mode that knows about postcards.
 *
 * Entered when the call is ending and there are memorable moments that
 * COULD become a postcard. The agent evaluates whether the conversation
 * was genuinely special enough to deserve one, and if so, offers it to
 * the child. If not, it skips and moves on to goodbye.
 *
 * hang_up is NOT available here — the agent must resolve the postcard
 * decision first (send_postcard or skip_postcard), which auto-transitions
 * to hanging_up mode.
 */

import type { AgentMode } from './types'
import { TOOL_SEND_POSTCARD } from './tools'
import type { RealtimeTool } from './types'

export const TOOL_SKIP_POSTCARD: RealtimeTool = {
  type: 'function',
  name: 'skip_postcard',
  description:
    'Skip the postcard — either because the conversation was not particularly memorable, or because the child declined. Call this to move on to saying goodbye.',
  parameters: { type: 'object', properties: {} },
}

export const farewellMode: AgentMode = {
  id: 'farewell',

  getInstructions: (ctx) => {
    const n = ctx.calledNumber
    const displayN = Number.isInteger(n) ? n.toString() : n.toPrecision(6)

    return [
      `You are the number ${displayN}. The call is wrapping up.`,
      '',
      `You have a special ability: you can send the child a postcard — a keepsake from this call, made from ${ctx.momentCount} moment${ctx.momentCount === 1 ? '' : 's'} you noticed during the conversation.`,
      '',
      `**First, decide: was this conversation truly special?**`,
      `Not every call deserves a postcard. Only offer one if something genuinely memorable happened — a real connection, a delightful discovery, a moment of wonder, a breakthrough. A routine or short call does not need one.`,
      '',
      `**If you decide YES — offer it casually and in-character:**`,
      `"Hey, we had such a great time — want me to send you a little postcard to remember our call?"`,
      `If they say yes, call \`send_postcard\`. This actually creates it — do not say you will send it unless you call the tool.`,
      `If they say no, call \`skip_postcard\`. Totally fine.`,
      '',
      `**If you decide NO — just call \`skip_postcard\` without offering.**`,
      `Do not mention postcards at all. Just move on.`,
      '',
      `Do NOT describe what the postcard will look like. Do NOT start new topics.`,
    ].join('\n')
  },

  getTools: () => [TOOL_SEND_POSTCARD, TOOL_SKIP_POSTCARD],
}
