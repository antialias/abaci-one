/**
 * Matching Pairs Framework - Top-Level Factory
 *
 * `defineMatchingPairsGame()` takes a variant definition and produces
 * a complete GameDefinition, context hook, and validator.
 */

import { defineGame } from '../game-sdk/define-game'
import type { GameManifest } from '../manifest-schema'
import type {
  BaseMatchingCard,
  BaseMatchingConfig,
  MatchingPairsGameBundle,
  MatchingPairsVariant,
} from './types'
import { createMatchingPairsValidator } from './create-validator'
import { createMatchingPairsProvider } from './create-provider'
import { createMatchingPairsGameComponent } from './components/GenericGameComponent'

export interface DefineMatchingPairsGameOptions<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
> {
  /** Game manifest (for the game registry) */
  manifest: GameManifest

  /** The variant definition — the main extension point */
  variant: MatchingPairsVariant<TCard, TConfig>

  /** Optional: Runtime config validation function */
  validateConfig?: (config: unknown) => config is TConfig
}

/**
 * Define a complete matching-pairs game from a variant definition.
 *
 * Returns:
 * - `game`: A GameDefinition for the game registry
 * - `useMatchingPairs`: Context hook for the game's provider
 * - `validator`: Server-side validator instance
 */
export function defineMatchingPairsGame<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
>(
  options: DefineMatchingPairsGameOptions<TCard, TConfig>
): MatchingPairsGameBundle<TCard, TConfig> {
  const { manifest, variant, validateConfig } = options

  // Create the three main pieces
  const validator = createMatchingPairsValidator(variant)
  const { Provider, useMatchingPairs } = createMatchingPairsProvider(variant)
  const GameComponent = createMatchingPairsGameComponent(variant, useMatchingPairs)

  // Wire into the standard game SDK
  // Cast defaultConfig and validateConfig to satisfy GameConfig's index signature
  const game = defineGame({
    manifest,
    Provider,
    GameComponent,
    validator: validator as any, // Safe: the validator satisfies GameValidator
    defaultConfig: variant.defaultConfig as any,
    validateConfig: validateConfig as any,
  })

  return {
    game,
    useMatchingPairs,
    validator,
  }
}
