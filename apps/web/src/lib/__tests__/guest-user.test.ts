/**
 * @vitest-environment node
 *
 * `getOrCreateUserFromGuestId` on a real database: the first sighting of a
 * guest creates its `users` row, and sightings at the same moment (a page's
 * sockets handshake together, alongside its HTTP requests) agree on one row.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { getOrCreateUserFromGuestId } from '@/lib/guest-user'
import {
  createEphemeralDatabase,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from '@/test/journey-simulator/EphemeralDatabase'

vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

describe('getOrCreateUserFromGuestId', () => {
  let eph: EphemeralDbResult
  beforeEach(() => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
  })
  afterEach(() => {
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it('five concurrent first sightings make one row, and all get its id', async () => {
    const users = await Promise.all(
      Array.from({ length: 5 }, () => getOrCreateUserFromGuestId('race-guest'))
    )
    expect(new Set(users.map((u) => u.id)).size).toBe(1)
    const rows = await eph.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.guestId, 'race-guest'))
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(users[0].id)
  })

  it('a known guest gets its existing row', async () => {
    await eph.db.insert(schema.users).values({ id: 'known-user', guestId: 'known-guest' })
    await expect(getOrCreateUserFromGuestId('known-guest')).resolves.toMatchObject({
      id: 'known-user',
    })
  })
})
