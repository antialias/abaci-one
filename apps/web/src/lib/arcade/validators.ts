/**
 * Unified Validator Registry (Isomorphic - runs on client AND server)
 *
 * This is the single source of truth for game validators.
 * Both client and server import validators from here.
 *
 * IMPORTANT: Uses lazy loading to avoid importing ES modules at module load time.
 * This allows the registry to be loaded on the server without causing ES module errors.
 *
 * To add a new game:
 * 1. Add the lazy loader function
 * 2. Add to validatorLoaders Map
 * 3. GameName type will auto-update
 */

import type { GameValidator } from './validation/types'

/**
 * Lazy validator loaders - import validators only when needed
 */
const validatorLoaders = {
  matching: async () => (await import('@/arcade-games/matching/Validator')).matchingGameValidator,
  'memory-quiz': async () =>
    (await import('@/arcade-games/memory-quiz/Validator')).memoryQuizGameValidator,
  'complement-race': async () =>
    (await import('@/arcade-games/complement-race/Validator')).complementRaceValidator,
  'card-sorting': async () =>
    (await import('@/arcade-games/card-sorting/Validator')).cardSortingValidator,
  'yjs-demo': async () => (await import('@/arcade-games/yjs-demo/Validator')).yjsDemoValidator,
  rithmomachia: async () =>
    (await import('@/arcade-games/rithmomachia/Validator')).rithmomachiaValidator,
  'know-your-world': async () =>
    (await import('@/arcade-games/know-your-world/Validator')).knowYourWorldValidator,
  'music-matching': async () =>
    (await import('@/arcade-games/music-matching/Validator')).musicMatchingValidator,
  'type-racer-jr': async () =>
    (await import('@/arcade-games/type-racer-jr/Validator')).typeRacerJrValidator,
  // Add new games here - GameName type will auto-update
} as const

/**
 * Cache for loaded validators
 */
const validatorCache = new Map<GameName, GameValidator>()

/**
 * Auto-derived game name type from registry
 * No need to manually update this!
 */
export type GameName = keyof typeof validatorLoaders

/**
 * Get validator for a game (async - lazy loads validator)
 * @throws Error if game not found (fail fast)
 */
export async function getValidator(gameName: string): Promise<GameValidator> {
  const gameNameTyped = gameName as GameName

  // Check cache first
  if (validatorCache.has(gameNameTyped)) {
    return validatorCache.get(gameNameTyped)!
  }

  const loader = validatorLoaders[gameNameTyped]
  if (!loader) {
    throw new Error(
      `No validator found for game: ${gameName}. ` +
        `Available games: ${Object.keys(validatorLoaders).join(', ')}`
    )
  }

  // Load and cache
  const validator = await loader()
  validatorCache.set(gameNameTyped, validator)
  return validator
}

/**
 * Check if a game has a registered validator
 */
export function hasValidator(gameName: string): gameName is GameName {
  return gameName in validatorLoaders
}

/**
 * Get all registered game names
 */
export function getRegisteredGameNames(): GameName[] {
  return Object.keys(validatorLoaders) as GameName[]
}

/**
 * Validate a game name at runtime
 * Use this instead of TypeScript enums to check if a game is valid
 *
 * @param gameName - Game name to validate
 * @returns true if game has a registered validator
 */
export function isValidGameName(gameName: unknown): gameName is GameName {
  return typeof gameName === 'string' && hasValidator(gameName)
}

/**
 * Assert that a game name is valid, throw if not
 *
 * @param gameName - Game name to validate
 * @throws Error if game name is invalid
 */
export function assertValidGameName(gameName: unknown): asserts gameName is GameName {
  if (!isValidGameName(gameName)) {
    throw new Error(
      `Invalid game name: ${gameName}. Must be one of: ${getRegisteredGameNames().join(', ')}`
    )
  }
}
