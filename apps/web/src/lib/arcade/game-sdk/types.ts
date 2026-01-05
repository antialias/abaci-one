/**
 * Type definitions for the Arcade Game SDK
 * These types define the contract that all games must implement
 */

import type { ReactNode } from "react";
import type { GameManifest } from "../manifest-schema";
import type {
  GameMove as BaseGameMove,
  GameValidator,
} from "../validation/types";

/**
 * Re-export base validation types from arcade system
 */
export type {
  GameMove,
  GameValidator,
  ValidationContext,
  ValidationResult,
} from "../validation/types";
export { TEAM_MOVE } from "../validation/types";
export type { TeamMoveSentinel } from "../validation/types";

/**
 * Generic game configuration
 * Each game defines its own specific config type
 */
export type GameConfig = Record<string, unknown>;

/**
 * Generic game state
 * Each game defines its own specific state type
 */
export type GameState = Record<string, unknown>;

/**
 * Provider component interface
 * Each game provides a React context provider that wraps the game UI
 */
export type GameProviderComponent = (props: {
  children: ReactNode;
}) => JSX.Element;

/**
 * Main game component interface
 * The root component that renders the game UI
 */
export type GameComponent = () => JSX.Element;

/**
 * Complete game definition
 * This is what games export after using defineGame()
 */
export interface GameDefinition<
  TConfig extends GameConfig = GameConfig,
  TState extends GameState = GameState,
  TMove extends BaseGameMove = BaseGameMove,
> {
  /** Parsed and validated manifest */
  manifest: GameManifest;

  /** React provider component */
  Provider: GameProviderComponent;

  /** Main game UI component */
  GameComponent: GameComponent;

  /** Server-side validator */
  validator: GameValidator<TState, TMove>;

  /** Default configuration */
  defaultConfig: TConfig;

  /**
   * Validate a config object at runtime
   * Returns true if config is valid for this game
   *
   * @param config - Configuration object to validate
   * @returns true if valid, false otherwise
   */
  validateConfig?: (config: unknown) => config is TConfig;
}
