/**
 * Practice-Approved Game List (Server-Safe)
 *
 * Static list of game names approved for practice breaks.
 * This module has NO dependencies on the game registry or React hooks,
 * so it can be safely imported in server-side code (API routes, etc.).
 */

export const PRACTICE_APPROVED_GAMES = [
  'memory-quiz', // Quick memory rounds, soroban-focused
  'complement-race', // Fast-paced complement practice
  'card-sorting', // Single-player sorting challenge
  'matching', // Can be played solo, pairs matching
  'music-matching', // Sight-reading practice, solo-friendly
] as const

export type PracticeApprovedGameName = (typeof PRACTICE_APPROVED_GAMES)[number]
