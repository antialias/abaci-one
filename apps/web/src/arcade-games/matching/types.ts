/**
 * Abacus Matching Game - Variant-Specific Type Definitions
 *
 * Base types (GamePhase, Difficulty, BaseMatchingCard, etc.) live in the
 * matching-pairs-framework. This file defines only the abacus-specific
 * extensions and re-exports for backwards compatibility.
 */

import { z } from 'zod'
import type { BaseMatchingCard, BaseMatchingConfig } from '@/lib/arcade/matching-pairs-framework'

// ============================================================================
// Variant-Specific Schemas & Types
// ============================================================================

export const GameTypeSchema = z.enum(['abacus-numeral', 'complement-pairs'])
export type GameType = z.infer<typeof GameTypeSchema>

export const CardTypeSchema = z.enum(['abacus', 'number', 'complement'])
export type CardType = z.infer<typeof CardTypeSchema>

export const TargetSumSchema = z.union([z.literal(5), z.literal(10), z.literal(20)])
export type TargetSum = z.infer<typeof TargetSumSchema>

export const DifficultySchema = z.union([z.literal(6), z.literal(8), z.literal(12), z.literal(15)])
export type Difficulty = z.infer<typeof DifficultySchema>

// ============================================================================
// AbacusCard — extends BaseMatchingCard
// ============================================================================

export const AbacusCardSchema = z.object({
  id: z.string(),
  type: CardTypeSchema,
  number: z.number(),
  complement: z.number().optional(),
  targetSum: TargetSumSchema.optional(),
  matched: z.boolean(),
  matchedBy: z.string().optional(),
})

export type AbacusCard = z.infer<typeof AbacusCardSchema> & {
  element?: HTMLElement | null // runtime-only
}

// Verify AbacusCard extends BaseMatchingCard at the type level
const _cardCheck: BaseMatchingCard = {} as AbacusCard
void _cardCheck

// ============================================================================
// AbacusConfig — extends BaseMatchingConfig
// ============================================================================

export const AbacusConfigSchema = z.object({
  gameType: GameTypeSchema,
  difficulty: DifficultySchema,
  turnTimer: z.number(),
  skipSetupPhase: z.boolean().optional(),
})

export type AbacusConfig = z.infer<typeof AbacusConfigSchema>

// Verify AbacusConfig extends BaseMatchingConfig at the type level
const _configCheck: BaseMatchingConfig = {} as AbacusConfig
void _configCheck

// ============================================================================
// Match Validation Result
// ============================================================================

export interface MatchValidationResult {
  isValid: boolean
  reason?: string
  type: 'abacus-numeral' | 'complement' | 'invalid'
}

// ============================================================================
// Backwards Compatibility Aliases
// ============================================================================

// GameCard is the old name for AbacusCard
export type GameCard = AbacusCard
export const GameCardSchema = AbacusCardSchema

// MatchingConfig is the old name for AbacusConfig
export type MatchingConfig = AbacusConfig
export const MatchingConfigSchema = AbacusConfigSchema

// Re-export framework types under old names for external consumers
// IMPORTANT: Use concrete type aliases (not bare re-exports) so that
// AbacusConfig fields (e.g. gameType) appear on the state type.
import type {
  MatchingPairsState as _MatchingPairsState,
  MatchingPairsMove as _MatchingPairsMove,
} from '@/lib/arcade/matching-pairs-framework'

export type MatchingState = _MatchingPairsState<AbacusCard, AbacusConfig> & AbacusConfig
export type MemoryPairsState = MatchingState
export type MatchingMove = _MatchingPairsMove<AbacusCard>

export type {
  GamePhase,
  GameMode,
  PlayerMetadata,
  GameStatistics,
} from '@/lib/arcade/matching-pairs-framework'

// Player is just a string
export type Player = string
