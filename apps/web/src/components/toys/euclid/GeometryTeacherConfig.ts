/**
 * Configuration interface for a geometry voice character.
 *
 * Abstracts everything character-specific (personality, voice, prompts,
 * messages) so the same construction engine, proof system, and UI can
 * host different characters in different attitudes (Euclid teacher,
 * Euclid heckler, Pappus teacher, etc.).
 */

import type { CharacterDefinition, EntityMarkerConfig } from '@/lib/character/types'
import type { VoiceMode } from '@/lib/voice/types'
import type { GeometryModeContext } from './voice/types'
import type { EuclidEntityRef } from './chat/parseGeometricEntities'
import type { ChatSystemPromptContext } from './chat/buildChatSystemPrompt'
import type { AttitudeId } from './voice/attitudes/types'

export interface GeometryVoiceConfig {
  /** Static character identity (personality blocks, profile image, chat UI strings) */
  definition: CharacterDefinition
  /** Which attitude this config uses ('teacher' | 'heckler') */
  attitudeId: AttitudeId
  /** Entity marker config for parsing inline markers in chat text */
  entityMarkers: EntityMarkerConfig<EuclidEntityRef>

  voice: {
    /** OpenAI voice ID (e.g. 'ash') */
    id: string
    /** TTS narration voice override — defaults to `id` when omitted. */
    ttsVoice?: string
    /** API endpoint for creating a voice session token */
    sessionEndpoint: string
    /** API endpoint for text chat streaming */
    chatEndpoint: string
    /** API endpoint for the think_hard reasoning tool */
    thinkHardEndpoint: string
    /** Base call duration in ms */
    baseDurationMs: number
    /** Extension duration in ms */
    extensionMs: number
  }

  /** Voice modes keyed by mode ID */
  modes: {
    greeting: VoiceMode<GeometryModeContext>
    conversing: VoiceMode<GeometryModeContext>
    thinking: VoiceMode<GeometryModeContext>
  }

  /** Build the full system prompt for text chat */
  buildChatSystemPrompt: (params: ChatSystemPromptContext) => string
  /** Build the post-completion context block for a given proposition */
  buildCompletionContext: (propositionId: number) => string
  /** Priming assistant message for the chat route (acknowledges entity marker syntax) */
  chatAssistantPriming: string

  /** Skip ring tone + min ring time when dialing; caller uses activateSession() to start. */
  deferGreeting?: boolean
  /** Character-specific stalling lines for pre-connected calls.
   *  Falls back to generic defaults if not provided. */
  stallLines?: string[]

  messages: {
    /** Injected into voice session at 15s remaining */
    timeWarning: string
    /** Injected when time runs out */
    timeExpired: string
    /** Used in chat history formatting fallback (e.g. 'Euclid') */
    historyLabel: string
    /** Shown in UI chip during think_hard (e.g. 'Consulting scrolls') */
    thinkingLabel: string
    /** Tool output when think_hard starts (e.g. 'Consulting my earlier writings...') */
    thinkingFeedback: string
    /** Wraps the think_hard answer in a system message (e.g. 'From your scrolls') */
    thinkingResultPrefix: string
  }
}

/** @deprecated Use GeometryVoiceConfig instead. */
export type GeometryTeacherConfig = GeometryVoiceConfig
