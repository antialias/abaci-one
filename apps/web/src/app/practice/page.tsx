import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getPlayersWithSkillData } from '@/lib/curriculum/server'
import { getViewerId } from '@/lib/viewer'
import { PracticeClient } from './PracticeClient'

/**
 * Get or create user record for a viewerId (guestId)
 */
async function getOrCreateUser(viewerId: string) {
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  })

  if (!user) {
    const [newUser] = await db.insert(schema.users).values({ guestId: viewerId }).returning()
    user = newUser
  }

  return user
}

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

  // Get viewer ID for session observation
  const viewerId = await getViewerId()

  // Get database user ID for parent socket notifications
  const user = await getOrCreateUser(viewerId)

  return <PracticeClient initialPlayers={players} viewerId={viewerId} userId={user.id} />
}
