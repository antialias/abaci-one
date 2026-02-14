/**
 * Practice-Approved Games
 *
 * Determines which games are available for practice session game breaks.
 *
 * A game is available for practice breaks when BOTH conditions are met:
 * 1. The game has `practiceBreakReady: true` in its manifest (game opts in)
 * 2. The game is in the PRACTICE_APPROVED_GAMES whitelist (manual approval)
 *
 * This two-layer approach ensures:
 * - Games must explicitly declare readiness via their manifest
 * - Admins can still control which ready games are actually offered
 */

import { getAvailableGames, getGame } from './game-registry'
import type { GameDefinition } from './game-sdk/types'
import { PRACTICE_APPROVED_GAMES } from './practice-approved-game-list'
import type { PracticeApprovedGameName } from './practice-approved-game-list'

export { PRACTICE_APPROVED_GAMES, type PracticeApprovedGameName }

/**
 * Check if a game name is in the practice whitelist
 */
export function isInPracticeWhitelist(gameName: string): gameName is PracticeApprovedGameName {
  return PRACTICE_APPROVED_GAMES.includes(gameName as PracticeApprovedGameName)
}

/**
 * Check if a game is fully approved for practice breaks.
 * Requires BOTH whitelist inclusion AND practiceBreakReady manifest flag.
 */
export function isPracticeApprovedGame(gameName: string): boolean {
  if (!isInPracticeWhitelist(gameName)) return false

  const game = getGame(gameName)
  if (!game) return false

  return game.manifest.practiceBreakReady === true
}

/**
 * Get practice-approved games from the registry.
 * Returns only games that are both whitelisted AND have practiceBreakReady: true.
 */
export function getPracticeApprovedGames(): GameDefinition<any, any, any>[] {
  return getAvailableGames().filter(
    (game) => isInPracticeWhitelist(game.manifest.name) && game.manifest.practiceBreakReady === true
  )
}

/**
 * Get a random practice-approved game
 */
export function getRandomPracticeApprovedGame(): GameDefinition<any, any, any> | undefined {
  const games = getPracticeApprovedGames()
  if (games.length === 0) return undefined
  return games[Math.floor(Math.random() * games.length)]
}

/**
 * Get a specific practice-approved game by name
 * Returns undefined if game is not practice-approved
 */
export function getPracticeApprovedGame(
  gameName: string
): GameDefinition<any, any, any> | undefined {
  if (!isPracticeApprovedGame(gameName)) return undefined
  return getGame(gameName)
}
