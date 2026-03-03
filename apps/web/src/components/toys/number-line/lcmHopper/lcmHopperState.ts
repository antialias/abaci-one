/**
 * LCM Hopper types and utility functions.
 *
 * Pure types — no React, no side effects.
 */

// ── Guess state ────────────────────────────────────────────────────────

export type GuessResult = 'correct' | 'close' | 'wrong' | null

/** Evaluate a guess against the LCM */
export function evaluateGuess(guess: number, lcmVal: number): GuessResult {
  if (Math.abs(guess - lcmVal) <= 1) return 'correct'
  if (Math.abs(guess - lcmVal) / lcmVal <= 0.2) return 'close'
  return 'wrong'
}
