/**
 * Euclid's GeometryVoiceConfig — assembles all Euclid-specific pieces
 * into a single config object consumed by the context provider.
 */

import type { GeometryVoiceConfig } from '../GeometryTeacherConfig'
import { EUCLID_CHARACTER_DEF } from '../euclidCharacterDef'
import { EUCLID_ENTITY_MARKERS } from '../euclidEntityMarkers'
import {
  buildCompletionContext,
  EUCLID_HECKLER_THINKING_METAPHORS,
  EUCLID_HECKLER_STALL_LINES,
} from '../euclidCharacter'
import { createGreetingMode } from '../agent/modes/greetingMode'
import { createConversingMode } from '../agent/modes/conversingMode'
import { createThinkingMode } from '../agent/modes/thinkingMode'
import { buildChatSystemPrompt, type ChatSystemPromptContext } from '../chat/buildChatSystemPrompt'
import { teacherAttitude } from '../agent/attitudes/teacher'
import { hecklerAttitude } from '../agent/attitudes/heckler'
import { authorAttitude } from '../agent/attitudes/author'
import type { AttitudeId } from '../agent/attitudes/types'

/** Shared voice config for Euclid (same endpoints, timing, entity markers). */
function buildEuclidVoiceBlock() {
  return {
    id: 'ash' as const,
    sessionEndpoint: '/api/realtime/euclid/session',
    chatEndpoint: '/api/realtime/euclid/chat',
    thinkHardEndpoint: '/api/realtime/euclid/think-hard',
    baseDurationMs: 3 * 60 * 1000,
    extensionMs: 2 * 60 * 1000,
  }
}

/** Euclid teacher config (the default). */
export const euclidConfig: GeometryVoiceConfig = {
  definition: EUCLID_CHARACTER_DEF,
  attitudeId: 'teacher',
  entityMarkers: EUCLID_ENTITY_MARKERS,

  voice: buildEuclidVoiceBlock(),

  modes: {
    greeting: createGreetingMode({ character: EUCLID_CHARACTER_DEF, attitude: teacherAttitude }),
    conversing: createConversingMode({
      character: EUCLID_CHARACTER_DEF,
      buildCompletionContext,
      attitude: teacherAttitude,
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
      attitude: teacherAttitude,
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

/** Euclid heckler config — same character, devastating commentary. */
export const euclidHecklerConfig: GeometryVoiceConfig = {
  definition: EUCLID_CHARACTER_DEF,
  attitudeId: 'heckler',
  entityMarkers: EUCLID_ENTITY_MARKERS,
  deferGreeting: true,
  stallLines: EUCLID_HECKLER_STALL_LINES,

  voice: buildEuclidVoiceBlock(),

  modes: {
    greeting: createGreetingMode({ character: EUCLID_CHARACTER_DEF, attitude: hecklerAttitude }),
    conversing: createConversingMode({
      character: EUCLID_CHARACTER_DEF,
      buildCompletionContext,
      attitude: hecklerAttitude,
    }),
    thinking: createThinkingMode({
      character: EUCLID_CHARACTER_DEF,
      metaphors: EUCLID_HECKLER_THINKING_METAPHORS,
      attitude: hecklerAttitude,
    }),
  },

  buildChatSystemPrompt: (ctx: ChatSystemPromptContext) =>
    buildChatSystemPrompt({ character: EUCLID_CHARACTER_DEF, buildCompletionContext }, ctx),
  buildCompletionContext,
  chatAssistantPriming:
    'I understand. I am Euclid of Alexandria, and I am watching with great displeasure. I will use {seg:AB}, {tri:ABC}, {ang:ABC}, {pt:A} markers for geometric references and {def:N}, {post:N}, {cn:N}, {prop:N} markers when citing foundations and propositions.',

  messages: {
    timeWarning:
      "[System: Only 15 seconds left. Deliver one final, devastating observation and leave. Do NOT mention timers or countdowns. You've seen enough.]",
    timeExpired:
      '[System: Time is up. Deliver a cutting exit line — something like "I have seen enough. When you are ready to do geometry properly, you know where to find my Elements." Then call hang_up.]',
    historyLabel: 'Euclid',
    thinkingLabel: 'Composing himself',
    thinkingFeedback: 'Processing the geometrical offense...',
    thinkingResultPrefix: 'After careful study',
  },
}

/** Euclid author config — collaborative proposition authoring. */
export const euclidAuthorConfig: GeometryVoiceConfig = {
  definition: EUCLID_CHARACTER_DEF,
  attitudeId: 'author',
  entityMarkers: EUCLID_ENTITY_MARKERS,

  voice: buildEuclidVoiceBlock(),

  modes: {
    greeting: createGreetingMode({ character: EUCLID_CHARACTER_DEF, attitude: authorAttitude }),
    conversing: createConversingMode({
      character: EUCLID_CHARACTER_DEF,
      buildCompletionContext,
      attitude: authorAttitude,
    }),
    thinking: createThinkingMode({
      character: EUCLID_CHARACTER_DEF,
      metaphors: {
        consulting: 'the proof structure',
        tool: 'the equality chain',
        ownership: 'this is standard axiomatic reasoning',
        framework: 'Euclidean axioms (postulates, definitions, common notions)',
        examples: [
          'Let me work through the equality chain.',
          'Checking if the construction is complete.',
          'Verifying the fact store covers all steps.',
          'Let me trace the citations.',
        ],
      },
      attitude: authorAttitude,
    }),
  },

  buildChatSystemPrompt: (ctx: ChatSystemPromptContext) =>
    buildChatSystemPrompt({ character: EUCLID_CHARACTER_DEF, buildCompletionContext }, ctx),
  buildCompletionContext,
  chatAssistantPriming:
    'I understand. I am ready to collaborate on proposition authoring. I will use construction tools (postulate_1, postulate_2, postulate_3, mark_intersection, apply_proposition) and fact store tools (declare_equality, declare_angle_equality) to build the proposition. I will use {seg:AB}, {tri:ABC}, {ang:ABC}, {pt:A} markers for geometric references and {def:N}, {post:N}, {cn:N}, {prop:N} markers for citations.',

  messages: {
    timeWarning:
      '[System: Only 15 seconds left. Wrap up the current step and summarize what remains to be done.]',
    timeExpired:
      '[System: Time is up. Summarize the current state of the construction and fact store, then hang up.]',
    historyLabel: 'Author',
    thinkingLabel: 'Analyzing proof',
    thinkingFeedback: 'Analyzing proof structure...',
    thinkingResultPrefix: 'Analysis',
  },
}

/** Get Euclid config for a given attitude. */
export function getEuclidConfig(attitudeId?: AttitudeId): GeometryVoiceConfig {
  if (attitudeId === 'heckler') return euclidHecklerConfig
  if (attitudeId === 'author') return euclidAuthorConfig
  return euclidConfig
}
