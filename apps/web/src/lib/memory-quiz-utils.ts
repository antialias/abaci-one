/**
 * Utility functions for memory quiz input validation and prefix handling
 */

/**
 * Check if an input string is a prefix of any numbers in the target list,
 * excluding already found numbers
 */
export function isPrefix(input: string, targetNumbers: number[], foundNumbers: number[]): boolean {
  // Original logic: check if input is a prefix of any unfound numbers
  return targetNumbers
    .filter((n) => !foundNumbers.includes(n)) // Only consider unfound numbers
    .some((n) => n.toString().startsWith(input) && n.toString() !== input)
}

/**
 * Check if an input could be a valid prefix of any target numbers
 */
export function couldBePrefix(input: string, targetNumbers: number[]): boolean {
  return targetNumbers.some((n) => n.toString().startsWith(input))
}

/**
 * Validate if an input represents a complete wrong number
 */
export function isCompleteWrongNumber(
  input: string,
  targetNumbers: number[],
  _minLengthForWrong: number = 2
): boolean {
  const number = parseInt(input, 10)
  if (Number.isNaN(number)) return false

  const isNotTarget = !targetNumbers.includes(number)
  const cannotBePrefix = !couldBePrefix(input, targetNumbers)

  // It's a complete wrong number if it's not a target AND it cannot be a prefix of any target
  return isNotTarget && cannotBePrefix
}

/**
 * Determine if input should trigger an incorrect guess
 */
export function shouldTriggerIncorrectGuess(
  input: string,
  targetNumbers: number[],
  _foundNumbers: number[],
  hasGuessesRemaining: boolean = true
): boolean {
  if (!hasGuessesRemaining) return false

  const number = parseInt(input, 10)
  if (Number.isNaN(number)) return false

  // Don't trigger if it's a correct answer (even if already found)
  if (targetNumbers.includes(number)) return false

  const couldBeValidPrefix = couldBePrefix(input, targetNumbers)

  // Trigger if it clearly cannot be a valid prefix, OR if it's a multi-digit partial input
  return !couldBeValidPrefix || (input.length >= 2 && !targetNumbers.includes(number))
}

/**
 * Check if a number is correct and available to be guessed
 */
export function isCorrectAndAvailable(
  number: number,
  targetNumbers: number[],
  foundNumbers: number[]
): boolean {
  return targetNumbers.includes(number) && !foundNumbers.includes(number)
}
