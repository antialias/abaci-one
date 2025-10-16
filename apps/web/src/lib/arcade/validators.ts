/**
 * Unified Validator Registry (Isomorphic - runs on client AND server)
 *
 * This is the single source of truth for game validators.
 * Both client and server import validators from here.
 *
 * To add a new game:
 * 1. Import the validator
 * 2. Add to validatorRegistry Map
 * 3. GameName type will auto-update
 */

import { matchingGameValidator } from './validation/MatchingGameValidator'
import { memoryQuizGameValidator } from '@/arcade-games/memory-quiz/Validator'
import { numberGuesserValidator } from '@/arcade-games/number-guesser/Validator'
import { mathSprintValidator } from '@/arcade-games/math-sprint/Validator'
import type { GameValidator } from './validation/types'

/**
 * Central registry of all game validators
 * Key: game name (matches manifest.name)
 * Value: validator instance
 */
export const validatorRegistry = {
  matching: matchingGameValidator,
  'memory-quiz': memoryQuizGameValidator,
  'number-guesser': numberGuesserValidator,
  'math-sprint': mathSprintValidator,
  // Add new games here - GameName type will auto-update
} as const

/**
 * Auto-derived game name type from registry
 * No need to manually update this!
 */
export type GameName = keyof typeof validatorRegistry

/**
 * Get validator for a game
 * @throws Error if game not found (fail fast)
 */
export function getValidator(gameName: string): GameValidator {
  const validator = validatorRegistry[gameName as GameName]
  if (!validator) {
    throw new Error(
      `No validator found for game: ${gameName}. ` +
        `Available games: ${Object.keys(validatorRegistry).join(', ')}`
    )
  }
  return validator
}

/**
 * Check if a game has a registered validator
 */
export function hasValidator(gameName: string): gameName is GameName {
  return gameName in validatorRegistry
}

/**
 * Get all registered game names
 */
export function getRegisteredGameNames(): GameName[] {
  return Object.keys(validatorRegistry) as GameName[]
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

/**
 * Re-export validators for backwards compatibility
 */
export {
  matchingGameValidator,
  memoryQuizGameValidator,
  numberGuesserValidator,
  mathSprintValidator,
}
