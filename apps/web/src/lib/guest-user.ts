import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'

/**
 * The `users` row of a guest, created on first sight.
 *
 * The one get-or-create for a verified guest id: `getUserId()` on the HTTP
 * side and the socket handshake (`resolveSocketViewer`) both map a guest to
 * its user id here, so a guest is the same user on both. A page opens
 * several sockets at once, so two first sightings can race: the insert
 * ignores the unique-key conflict and the row is read back.
 */
export async function getOrCreateUserFromGuestId(guestId: string) {
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.guestId, guestId),
  })
  if (existing) return existing

  const [created] = await db
    .insert(schema.users)
    .values({ guestId })
    .onConflictDoNothing({ target: schema.users.guestId })
    .returning()
  if (created) return created

  const raced = await db.query.users.findFirst({
    where: eq(schema.users.guestId, guestId),
  })
  if (!raced) throw new Error('Guest user could not be created')
  return raced
}
