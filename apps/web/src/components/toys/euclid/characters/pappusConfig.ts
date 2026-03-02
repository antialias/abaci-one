/**
 * Pappus's GeometryTeacherConfig — assembles all Pappus-specific pieces
 * into a single config object consumed by the context provider.
 */

import type { GeometryTeacherConfig } from '../GeometryTeacherConfig'
import { PAPPUS_CHARACTER_DEF } from '../pappusCharacterDef'
import { EUCLID_ENTITY_MARKERS } from '../euclidEntityMarkers'
import { buildPappusCompletionContext } from '../pappusCharacter'
import { createGreetingMode } from '../voice/modes/greetingMode'
import { createConversingMode } from '../voice/modes/conversingMode'
import { createThinkingMode } from '../voice/modes/thinkingMode'
import { buildChatSystemPrompt, type ChatSystemPromptContext } from '../chat/buildChatSystemPrompt'

export const pappusConfig: GeometryTeacherConfig = {
  definition: PAPPUS_CHARACTER_DEF,
  entityMarkers: EUCLID_ENTITY_MARKERS,

  voice: {
    id: 'echo',
    sessionEndpoint: '/api/realtime/euclid/session',
    chatEndpoint: '/api/realtime/euclid/chat',
    thinkHardEndpoint: '/api/realtime/euclid/think-hard',
    baseDurationMs: 3 * 60 * 1000,
    extensionMs: 2 * 60 * 1000,
  },

  modes: {
    greeting: createGreetingMode(PAPPUS_CHARACTER_DEF),
    conversing: createConversingMode({
      character: PAPPUS_CHARACTER_DEF,
      buildCompletionContext: buildPappusCompletionContext,
    }),
    thinking: createThinkingMode({
      character: PAPPUS_CHARACTER_DEF,
      metaphors: {
        consulting: 'your Collection',
        tool: 'your notes',
        ownership: 'it is the kind of reasoning you have studied deeply',
        framework:
          "the established geometric principles (Euclid's postulates, definitions, common notions)",
        examples: [
          'Let me consult my notes on this.',
          'One moment — I need to check what I wrote about this.',
          'I studied this carefully. Let me recall.',
          'Hold on — let me think this through.',
        ],
      },
    }),
  },

  buildChatSystemPrompt: (ctx: ChatSystemPromptContext) =>
    buildChatSystemPrompt(
      { character: PAPPUS_CHARACTER_DEF, buildCompletionContext: buildPappusCompletionContext },
      ctx
    ),
  buildCompletionContext: buildPappusCompletionContext,
  chatAssistantPriming:
    'I understand. I am Pappus of Alexandria, ready to guide you. I will use {seg:AB}, {tri:ABC}, {ang:ABC}, {pt:A} markers for geometric references and {def:N}, {post:N}, {cn:N}, {prop:N} markers when citing foundations and propositions. I may use {tag:value|display text} for custom phrasing.',

  messages: {
    timeWarning:
      '[System: Only 15 seconds left. Wrap up the current point — you have other students and your Collection to attend to. Do NOT mention timers or countdowns. Stay in character as a busy, dedicated scholar.]',
    timeExpired:
      '[System: Time is up. End the lesson warmly but firmly — give the student something to think about for next time. e.g. "That is enough for today. Consider what we discussed — the insight will deepen with reflection. We will continue next time." Then call hang_up.]',
    historyLabel: 'Pappus',
    thinkingLabel: 'Consulting the Collection',
    thinkingFeedback: 'Let me consult my Collection...',
    thinkingResultPrefix: 'From your Collection',
  },
}
