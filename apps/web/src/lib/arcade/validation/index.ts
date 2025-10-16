/**
 * Game validator registry
 * Maps game names to their validators
 */

import { matchingGameValidator } from './MatchingGameValidator'
import { memoryQuizGameValidator } from './MemoryQuizGameValidator'
import { numberGuesserValidator } from '@/arcade-games/number-guesser/Validator'
import type { GameName, GameValidator } from './types'

const validators = new Map<GameName, GameValidator>([
  ['matching', matchingGameValidator],
  ['memory-quiz', memoryQuizGameValidator],
  ['number-guesser', numberGuesserValidator],
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
export { numberGuesserValidator } from '@/arcade-games/number-guesser/Validator'
export * from './types'
