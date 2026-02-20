import type { Player } from '@/db/schema/players'
import { getPlayer } from '@/lib/arcade/player-manager'

/**
 * Get a player that is flagged as a practice student.
 * Returns undefined if the player doesn't exist or isn't a practice student.
 *
 * Use this instead of getPlayer() in practice routes to enforce the invariant
 * that only practice students can access the practice system.
 */
export async function getPracticeStudent(playerId: string): Promise<Player | undefined> {
  const player = await getPlayer(playerId)
  if (!player || !player.isPracticeStudent) return undefined
  return player
}
