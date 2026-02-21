import { getPlayersWithSkillData } from '@/lib/curriculum/server'
import { getUserId } from '@/lib/viewer'
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
  const players = await getPlayersWithSkillData()

  // Get database user ID for parent socket notifications and session observation
  const userId = await getUserId()

  return <PracticeClient initialPlayers={players} viewerId={userId} userId={userId} />
}
