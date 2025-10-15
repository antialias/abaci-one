/**
 * Game Registry
 *
 * Central registry for all arcade games.
 * Games are explicitly registered here after being defined.
 */

import type { GameDefinition } from './game-sdk/types'

/**
 * Global game registry
 * Maps game name to game definition
 */
const registry = new Map<string, GameDefinition>()

/**
 * Register a game in the registry
 *
 * @param game - Game definition to register
 * @throws Error if game with same name already registered
 */
export function registerGame(game: GameDefinition): void {
  const { name } = game.manifest

  if (registry.has(name)) {
    throw new Error(`Game "${name}" is already registered`)
  }

  registry.set(name, game)
  console.log(`✅ Registered game: ${name}`)
}

/**
 * Get a game from the registry
 *
 * @param gameName - Internal game identifier
 * @returns Game definition or undefined if not found
 */
export function getGame(gameName: string): GameDefinition | undefined {
  return registry.get(gameName)
}

/**
 * Get all registered games
 *
 * @returns Array of all game definitions
 */
export function getAllGames(): GameDefinition[] {
  return Array.from(registry.values())
}

/**
 * Get all available games (where available: true)
 *
 * @returns Array of available game definitions
 */
export function getAvailableGames(): GameDefinition[] {
  return getAllGames().filter((game) => game.manifest.available)
}

/**
 * Check if a game is registered
 *
 * @param gameName - Internal game identifier
 * @returns true if game is registered
 */
export function hasGame(gameName: string): boolean {
  return registry.has(gameName)
}

/**
 * Clear all games from registry (used for testing)
 */
export function clearRegistry(): void {
  registry.clear()
}
