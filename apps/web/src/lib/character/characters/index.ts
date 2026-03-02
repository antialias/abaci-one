/**
 * Character registry — maps character IDs to their data providers.
 *
 * Each character implements CharacterDataProvider to supply identity,
 * personality, prompts, tools, and mode transitions to the admin panel.
 *
 * Future characters (Plato, numbers, etc.) register here.
 */

import type { PromptBreakdown } from '../promptBreakdown'
import type { ProfileSize, ProfileTheme, ProfileState } from '../../profile-variants'
import { euclidProvider } from './euclid'
import { pappusProvider } from './pappus'

/** Summary for character list view. */
export interface CharacterSummary {
  id: string
  displayName: string
  nativeDisplayName?: string
  profileImage: string
  type: 'historical-figure' | 'number'
}

/** A personality block with metadata. */
export interface PersonalityBlock {
  key: string
  label: string
  text: string
  tokenEstimate: number
  sourceFile: string
  sourceExport: string
}

/** Mode definition with full prompt and breakdown. */
export interface ModeData {
  id: string
  label: string
  trigger: string
  exit: string
  tools: string[]
  prompt: string
  promptBreakdown: PromptBreakdown
  sourceFile: string
  api?: string
}

/** Tool definition with admin metadata. */
export interface ToolData {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, unknown>
    required?: string[]
  }
  modes: string[]
  behavior: string
  promptResponse: boolean
}

/** Mode transition edge. */
export interface ModeTransition {
  from: string
  to: string
  trigger: string
}

/** Variant path entry for the size×theme×state matrix. */
export interface ProfileVariantPath {
  size: ProfileSize
  theme: ProfileTheme
  state: ProfileState
  path: string
}

/** Voice configuration for admin display. */
export interface VoiceConfig {
  realtimeVoice: string
  ttsVoice: string
  baseDurationMs: number
  extensionMs: number
  sessionEndpoint: string
  chatEndpoint: string
  thinkHardEndpoint: string
}

/** Full character data for detail view. */
export interface CharacterData {
  identity: CharacterSummary & {
    profilePrompt: string
    profileVariants: ProfileVariantPath[]
  }
  voiceConfig?: VoiceConfig
  personalityBlocks: PersonalityBlock[]
  chatConfig: {
    placeholder: string
    emptyPrompt: string
    streamingLabel: string
    sourceFile: string
  }
  modes: Record<string, ModeData>
  modeTransitions: ModeTransition[]
  tools: ToolData[]
  availablePropositions: Array<{ id: number; title: string; type: string }>
  currentPropositionId: number
  currentStep: number
}

/** Provider interface for character data. */
export interface CharacterDataProvider {
  id: string
  getSummary(): CharacterSummary
  getFullData(opts?: { propositionId?: number; step?: number }): CharacterData
}

/** Registry of all character providers. */
export const CHARACTER_PROVIDERS: Record<string, CharacterDataProvider> = {
  euclid: euclidProvider,
  pappus: pappusProvider,
}

/** Get all character summaries. */
export function getAllCharacterSummaries(): CharacterSummary[] {
  return Object.values(CHARACTER_PROVIDERS).map((p) => p.getSummary())
}
