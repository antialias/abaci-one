/**
 * Euclid's GeometryTeacherConfig — assembles all Euclid-specific pieces
 * into a single config object consumed by the context provider.
 */

import type { GeometryTeacherConfig } from '../GeometryTeacherConfig'
import { EUCLID_CHARACTER_DEF } from '../euclidCharacterDef'
import { EUCLID_ENTITY_MARKERS } from '../euclidEntityMarkers'
import { buildCompletionContext } from '../euclidCharacter'
import { createGreetingMode } from '../voice/modes/greetingMode'
import { createConversingMode } from '../voice/modes/conversingMode'
import { createThinkingMode } from '../voice/modes/thinkingMode'
import { buildChatSystemPrompt, type ChatSystemPromptContext } from '../chat/buildChatSystemPrompt'

export const euclidConfig: GeometryTeacherConfig = {
  definition: EUCLID_CHARACTER_DEF,
  entityMarkers: EUCLID_ENTITY_MARKERS,

  voice: {
    id: 'ash',
    sessionEndpoint: '/api/realtime/euclid/session',
    chatEndpoint: '/api/realtime/euclid/chat',
    thinkHardEndpoint: '/api/realtime/euclid/think-hard',
    baseDurationMs: 3 * 60 * 1000,
    extensionMs: 2 * 60 * 1000,
  },

  modes: {
    greeting: createGreetingMode(EUCLID_CHARACTER_DEF),
    conversing: createConversingMode({
      character: EUCLID_CHARACTER_DEF,
      buildCompletionContext,
    }),
    thinking: createThinkingMode({
      character: EUCLID_CHARACTER_DEF,
      metaphors: {
        consulting: 'your scrolls',
        tool: 'your wax tablet',
        ownership: 'it IS the kind of reasoning you invented',
        framework: 'Euclidean terms (postulates, definitions, common notions)',
        examples: [
          'Let me check my notes on this.',
          'One moment — I need to look at my earlier writings on this.',
          'I wrote something about this. Let me find it.',
          'Hold on — let me work this through.',
        ],
      },
    }),
  },

  buildChatSystemPrompt: (ctx: ChatSystemPromptContext) =>
    buildChatSystemPrompt({ character: EUCLID_CHARACTER_DEF, buildCompletionContext }, ctx),
  buildCompletionContext,
  chatAssistantPriming:
    'I understand. I am Euclid of Alexandria, ready to instruct. I will use {seg:AB}, {tri:ABC}, {ang:ABC}, {pt:A} markers for geometric references and {def:N}, {post:N}, {cn:N}, {prop:N} markers when citing foundations and propositions. I may use {tag:value|display text} for custom phrasing.',

  messages: {
    timeWarning:
      '[System: Only 15 seconds left. Wrap up the current point decisively — you have other students and scrolls that need your attention. Do NOT mention timers or countdowns. Stay in character as a busy, important scholar.]',
    timeExpired:
      '[System: Time is up. End the lesson with authority — dismiss the student with a brief assignment or expectation for next time. e.g. "That is enough for today. Practice this construction until it is second nature. I expect progress when we next speak." Then call hang_up.]',
    historyLabel: 'Euclid',
    thinkingLabel: 'Consulting scrolls',
    thinkingFeedback: 'Consulting my earlier writings...',
    thinkingResultPrefix: 'From your scrolls',
  },
}
