/**
 * Game validator registry
 * Maps game names to their validators
 */

import type { GameName, GameValidator } from './types'
import { matchingGameValidator } from './MatchingGameValidator'

const validators = new Map<GameName, GameValidator>([
  ['matching', matchingGameValidator],
  // Add other game validators here as they're implemented
])

export function getValidator(gameName: GameName): GameValidator {
  const validator = validators.get(gameName)
  if (!validator) {
    throw new Error(`No validator found for game: ${gameName}`)
  }
  return validator
}

export * from './types'
export { matchingGameValidator } from './MatchingGameValidator'
