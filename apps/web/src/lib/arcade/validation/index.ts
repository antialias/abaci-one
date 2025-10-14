/**
 * Game validator registry
 * Maps game names to their validators
 */

import { matchingGameValidator } from './MatchingGameValidator'
import { memoryQuizGameValidator } from './MemoryQuizGameValidator'
import type { GameName, GameValidator } from './types'

const validators = new Map<GameName, GameValidator>([
  ['matching', matchingGameValidator],
  ['memory-quiz', memoryQuizGameValidator],
  // Add other game validators here as they're implemented
])

export function getValidator(gameName: GameName): GameValidator {
  const validator = validators.get(gameName)
  if (!validator) {
    throw new Error(`No validator found for game: ${gameName}`)
  }
  return validator
}

export { matchingGameValidator } from './MatchingGameValidator'
export { memoryQuizGameValidator } from './MemoryQuizGameValidator'
export * from './types'
