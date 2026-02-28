/**
 * Tool definitions for the Euclid voice session.
 */

import type { RealtimeTool } from '@/lib/voice/types'

export const TOOL_HANG_UP: RealtimeTool = {
  type: 'function',
  name: 'hang_up',
  description:
    'End the call. Use this when the student says goodbye, or when you need to end the conversation. ' +
    'Say a brief farewell in character before calling this.',
  parameters: {
    type: 'object',
    properties: {},
  },
}

export const TOOL_THINK_HARD: RealtimeTool = {
  type: 'function',
  name: 'think_hard',
  description:
    'Consult a powerful reasoning oracle for difficult geometric questions. ' +
    'Use this when the student asks something that requires deep geometric reasoning, ' +
    'visual analysis of the construction, or when you are unsure of the correct answer. ' +
    'The oracle can see the current construction and will reason carefully. ' +
    'Set effort based on difficulty: "low" for simple clarifications, "medium" for moderate questions, ' +
    '"high" for complex proofs, "xhigh" for the hardest problems.',
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description:
          'The geometric question to reason about, including any relevant context from the conversation.',
      },
      effort: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'xhigh'],
        description: 'How hard the oracle should think. Higher = slower but more thorough.',
      },
    },
    required: ['question', 'effort'],
  },
}
