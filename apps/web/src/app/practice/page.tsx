import { getPlayersWithSkillData } from '@/lib/curriculum/server'
import { PracticeClient } from './PracticeClient'

/**
 * Practice page - Server Component
 *
 * Fetches player list on the server and passes to client component.
 * This provides instant rendering with no loading spinner.
 *
 * URL: /practice
 */
export default async function PracticePage() {
  // Fetch players with skill data directly on server - no HTTP round-trip
  // Returns players, viewerId, and userId in a single call to avoid redundant lookups
  const { players, viewerId, userId } = await getPlayersWithSkillData()

  return <PracticeClient initialPlayers={players} viewerId={viewerId} userId={userId} />
}
