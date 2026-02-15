/**
 * Game Registry
 *
 * Central registry for all arcade games.
 * Games are explicitly registered here after being defined.
 */

import type { GameConfig, GameDefinition, GameMove, GameState } from './game-sdk/types'

/**
 * Global game registry
 * Maps game name to game definition
 * Using `any` for generics to allow different game types
 */
const registry = new Map<string, GameDefinition<any, any, any>>()

/**
 * Register a game in the registry
 *
 * @param game - Game definition to register
 * @throws Error if game with same name already registered
 */
export function registerGame<
  TConfig extends GameConfig,
  TState extends GameState,
  TMove extends GameMove,
>(game: GameDefinition<TConfig, TState, TMove>): void {
  const { name } = game.manifest

  if (registry.has(name)) {
    throw new Error(`Game "${name}" is already registered`)
  }

  // Verify validator is also registered server-side
  try {
    const { hasValidator, getValidator } = require('./validators')
    if (!hasValidator(name)) {
      console.error(
        `⚠️  Game "${name}" registered but validator not found in server registry!` +
          `\n   Add to src/lib/arcade/validators.ts to enable multiplayer.`
      )
    } else {
      const serverValidator = getValidator(name)
      if (serverValidator !== game.validator) {
        console.warn(
          `⚠️  Game "${name}" has different validator instances (client vs server).` +
            `\n   This may cause issues. Ensure both use the same import.`
        )
      }
    }
  } catch (error) {
    // If validators.ts can't be imported (e.g., in browser), skip check
    // This is expected - validator registry is isomorphic but check only runs server-side
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
export function getGame(gameName: string): GameDefinition<any, any, any> | undefined {
  return registry.get(gameName)
}

/**
 * Get all registered games
 *
 * @returns Array of all game definitions
 */
export function getAllGames(): GameDefinition<any, any, any>[] {
  return Array.from(registry.values())
}

/**
 * Get all available games (where available: true)
 *
 * @returns Array of available game definitions
 */
export function getAvailableGames(): GameDefinition<any, any, any>[] {
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

// ============================================================================
// Game Registrations
//
// Only practice-break-ready games are statically imported so the practice
// page bundle stays small.  All other games are lazy-loaded via
// ensureAllGamesRegistered().
// ============================================================================

import { matchingGame } from '@/arcade-games/matching'
import { musicMatchingGame } from '@/arcade-games/music-matching'

registerGame(matchingGame)
registerGame(musicMatchingGame)

// All other games are loaded on demand — only pages that need the full
// registry (arcade, home, games list) call ensureAllGamesRegistered().
let _allGamesPromise: Promise<void> | null = null

/**
 * Ensure all games (including heavy/non-practice ones) are registered.
 * Call this on pages that need the full game registry (e.g. arcade listing).
 * Safe to call multiple times — only loads once.
 */
export function ensureAllGamesRegistered(): Promise<void> {
  if (!_allGamesPromise) {
    _allGamesPromise = Promise.all([
      import('@/arcade-games/memory-quiz'),
      import('@/arcade-games/complement-race/index'),
      import('@/arcade-games/card-sorting'),
      import('@/arcade-games/yjs-demo'),
      import('@/arcade-games/rithmomachia'),
      import('@/arcade-games/know-your-world'),
    ]).then((modules) => {
      const games: GameDefinition<any, any, any>[] = [
        modules[0].memoryQuizGame,
        modules[1].complementRaceGame,
        modules[2].cardSortingGame,
        modules[3].yjsDemoGame,
        modules[4].rithmomachiaGame,
        modules[5].knowYourWorldGame,
      ]
      for (const game of games) {
        if (!registry.has(game.manifest.name)) {
          registerGame(game)
        }
      }
    })
  }
  return _allGamesPromise
}
