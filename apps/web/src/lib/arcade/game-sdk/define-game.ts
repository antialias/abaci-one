/**
 * Game definition helper
 * Provides type-safe game registration
 */

import type {
  GameComponent,
  GameConfig,
  GameDefinition,
  GameMove,
  GameProviderComponent,
  GameState,
  GameValidator,
} from './types'
import type { GameManifest } from '../manifest-schema'

/**
 * Options for defining a game
 */
export interface DefineGameOptions<
  TConfig extends GameConfig,
  TState extends GameState,
  TMove extends GameMove,
> {
  /** Game manifest (loaded from game.yaml) */
  manifest: GameManifest

  /** React provider component */
  Provider: GameProviderComponent

  /** Main game UI component */
  GameComponent: GameComponent

  /** Server-side validator */
  validator: GameValidator<TState, TMove>

  /** Default configuration for the game */
  defaultConfig: TConfig
}

/**
 * Define a game with full type safety
 *
 * This helper ensures all required parts of a game are provided
 * and returns a properly typed GameDefinition.
 *
 * @example
 * ```typescript
 * export const myGame = defineGame({
 *   manifest: loadManifest('./game.yaml'),
 *   Provider: MyGameProvider,
 *   GameComponent: MyGameComponent,
 *   validator: myGameValidator,
 *   defaultConfig: {
 *     difficulty: 'easy',
 *     maxTime: 60
 *   }
 * })
 * ```
 */
export function defineGame<
  TConfig extends GameConfig,
  TState extends GameState,
  TMove extends GameMove,
>(options: DefineGameOptions<TConfig, TState, TMove>): GameDefinition<TConfig, TState, TMove> {
  const { manifest, Provider, GameComponent, validator, defaultConfig } = options

  // Validate that manifest.name matches the game identifier
  if (!manifest.name) {
    throw new Error('Game manifest must have a "name" field')
  }

  return {
    manifest,
    Provider,
    GameComponent,
    validator,
    defaultConfig,
  }
}
