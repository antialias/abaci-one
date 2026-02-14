/**
 * Music Note Matching Game - Variant-Specific Type Definitions
 *
 * Base types (GamePhase, Difficulty, BaseMatchingCard, etc.) live in the
 * matching-pairs-framework. This file defines only the music-specific
 * extensions.
 */

import { z } from 'zod'
import type { BaseMatchingCard, BaseMatchingConfig } from '@/lib/arcade/matching-pairs-framework'

// ============================================================================
// Variant-Specific Schemas & Types
// ============================================================================

export const MusicCardTypeSchema = z.enum(['staff-note', 'note-name'])
export type MusicCardType = z.infer<typeof MusicCardTypeSchema>

export const MusicGameTypeSchema = z.enum(['staff-to-name', 'treble-to-bass'])
export type MusicGameType = z.infer<typeof MusicGameTypeSchema>

export const ClefSchema = z.enum(['treble', 'bass', 'both'])
export type ClefOption = z.infer<typeof ClefSchema>

export const DifficultySchema = z.union([z.literal(6), z.literal(8), z.literal(12), z.literal(15)])
export type Difficulty = z.infer<typeof DifficultySchema>

// ============================================================================
// MusicCard — extends BaseMatchingCard
// ============================================================================

export const MusicCardSchema = z.object({
  id: z.string(),
  type: MusicCardTypeSchema,
  pitchClass: z.string(),
  octave: z.number(),
  midiNote: z.number(),
  clef: z.enum(['treble', 'bass']).optional(),
  accidental: z.enum(['sharp', 'flat', 'natural', 'none']).optional(),
  displayName: z.string(),
  friendlyName: z.string().optional(),
  matched: z.boolean(),
  matchedBy: z.string().optional(),
})

export type MusicCard = z.infer<typeof MusicCardSchema>

// Verify MusicCard extends BaseMatchingCard at the type level
const _cardCheck: BaseMatchingCard = {} as MusicCard
void _cardCheck

// ============================================================================
// MusicConfig — extends BaseMatchingConfig
// ============================================================================

export const MusicConfigSchema = z.object({
  gameType: MusicGameTypeSchema,
  clef: ClefSchema,
  difficulty: DifficultySchema,
  turnTimer: z.number(),
  skipSetupPhase: z.boolean().optional(),
})

export type MusicConfig = z.infer<typeof MusicConfigSchema>

// Verify MusicConfig extends BaseMatchingConfig at the type level
const _configCheck: BaseMatchingConfig = {} as MusicConfig
void _configCheck

// ============================================================================
// Match Validation Result
// ============================================================================

export interface MusicMatchValidationResult {
  isValid: boolean
  reason?: string
  type: 'staff-to-name' | 'treble-to-bass' | 'invalid'
}
