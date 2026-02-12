/**
 * Matching Pairs Framework
 *
 * A factory for building matching-pairs games with just a thin variant definition.
 * See MatchingPairsVariant for the extension interface.
 *
 * @example
 * ```typescript
 * import { defineMatchingPairsGame } from '@/lib/arcade/matching-pairs-framework'
 *
 * const { game, useMatchingPairs } = defineMatchingPairsGame({
 *   manifest: { ... },
 *   variant: {
 *     gameName: 'music-notes',
 *     defaultConfig: { difficulty: 6, turnTimer: 30, instrument: 'piano' },
 *     generateCards: (config) => [...],
 *     validateMatch: (card1, card2) => ({ isValid: card1.note === card2.note, type: 'note' }),
 *     CardFront: ({ card }) => <NoteDisplay note={card.note} />,
 *     // ... other variant methods
 *   },
 * })
 * ```
 */

// Top-level factory
export { defineMatchingPairsGame } from './define-matching-pairs-game'
export type { DefineMatchingPairsGameOptions } from './define-matching-pairs-game'

// Validator factory
export { createMatchingPairsValidator } from './create-validator'

// Provider factory
export { createMatchingPairsProvider } from './create-provider'

// Generic components
export { FlipCard } from './components/FlipCard'
export type { FlipCardProps } from './components/FlipCard'
export { GenericSetupPhase } from './components/GenericSetupPhase'
export type { GenericSetupPhaseProps } from './components/GenericSetupPhase'
export { GenericGamePhase } from './components/GenericGamePhase'
export type { GenericGamePhaseProps } from './components/GenericGamePhase'
export { GenericResultsPhase, formatGameTime, getPerformanceAnalysis } from './components/GenericResultsPhase'
export type { GenericResultsPhaseProps } from './components/GenericResultsPhase'
export { createMatchingPairsGameComponent } from './components/GenericGameComponent'

// Types
export type {
  BaseMatchingCard,
  BaseMatchingConfig,
  CardBackStyle,
  Difficulty,
  GameMode,
  GamePhase,
  GameStatistics,
  MatchingPairsContextValue,
  MatchingPairsGameBundle,
  MatchingPairsMove,
  MatchingPairsState,
  MatchingPairsVariant,
  MatchValidationResult,
  NavInfo,
  PausedGameState,
  Player,
  PlayerMetadata,
  SetupContentProps,
} from './types'
