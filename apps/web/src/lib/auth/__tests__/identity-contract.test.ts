/**
 * @vitest-environment node
 *
 * Contract test: getUserId() always returns the database `users.id`,
 * never the `guestId`, regardless of viewer type.
 *
 * This is the single most important identity invariant. Breaking it
 * causes silent failures everywhere the client-provided userId is
 * compared to server-stored ownership records (host detection, turn
 * detection, player ownership, online status, etc.).
 *
 * Uses real DB — no mocked database layer.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Use the real database
vi.unmock('@/db')

import { db, schema } from '@/db'
import { ensureTestSchema } from './setupTestDb'

beforeAll(async () => {
  await ensureTestSchema()
})

// Mock next/headers (required by getViewer)
const mockHeadersGet = vi.fn()
const mockCookiesGet = vi.fn()

vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: mockHeadersGet,
    })
  ),
  cookies: vi.fn(() =>
    Promise.resolve({
      get: mockCookiesGet,
    })
  ),
}))

// Mock @/auth
const mockAuth = vi.fn()
vi.mock('@/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}))

// Mock guest-token (not exercised in these tests)
vi.mock('@/lib/guest-token', () => ({
  GUEST_COOKIE_NAME: 'guest',
  verifyGuestToken: vi.fn(),
}))

function uniqueGuestId() {
  return `contract-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

describe('identity contract: getUserId() always returns users.id', () => {
  let userId: string
  let guestId: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(null)
    mockHeadersGet.mockReturnValue(null)
    mockCookiesGet.mockReturnValue(undefined)

    guestId = uniqueGuestId()
    const [user] = await db.insert(schema.users).values({ guestId }).returning()
    userId = user.id
  })

  afterEach(async () => {
    await db
      .delete(schema.users)
      .where(eq(schema.users.id, userId))
      .catch(() => {})
  })

  it('returns users.id (not guestId) for guest viewers', async () => {
    // Simulate guest viewer via x-guest-id header
    mockHeadersGet.mockReturnValue(guestId)

    const { getUserId } = await import('@/lib/viewer')
    const result = await getUserId()

    // THE critical assertions
    expect(result).toBe(userId)
    expect(result).not.toBe(guestId)

    // Double-check: the returned ID is a real users.id in the database
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, result),
    })
    expect(user).toBeDefined()
    expect(user!.id).toBe(result)
  })

  it('returns users.id for authenticated viewers', async () => {
    // Simulate authenticated viewer
    mockAuth.mockResolvedValue({
      user: { id: userId },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })

    const { getUserId } = await import('@/lib/viewer')
    const result = await getUserId()

    expect(result).toBe(userId)

    // Verify it's a real users.id
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, result),
    })
    expect(user).toBeDefined()
  })

  it('getUserId() matches the userId stored on owned resources', async () => {
    // Create a player owned by this user
    const [player] = await db
      .insert(schema.players)
      .values({
        userId,
        name: 'Test Player',
        emoji: '🎮',
        color: '#ff0000',
      })
      .returning()

    // Simulate guest viewer
    mockHeadersGet.mockReturnValue(guestId)

    const { getUserId } = await import('@/lib/viewer')
    const result = await getUserId()

    // The userId from getUserId() must match the player's userId FK
    expect(result).toBe(player.userId)

    // This is the comparison that happens in player ownership checks,
    // host detection, turn detection, etc. If this fails, all of those break.
    const ownedPlayers = await db.query.players.findMany({
      where: eq(schema.players.userId, result),
    })
    expect(ownedPlayers).toHaveLength(1)
    expect(ownedPlayers[0].id).toBe(player.id)

    // Clean up
    await db.delete(schema.players).where(eq(schema.players.id, player.id))
  })

  it('guest and authenticated paths return the same users.id for the same user', async () => {
    const { getUserId } = await import('@/lib/viewer')

    // First: get userId as guest
    mockHeadersGet.mockReturnValue(guestId)
    const guestResult = await getUserId()

    // Then: get userId as authenticated user
    mockHeadersGet.mockReturnValue(null)
    mockAuth.mockResolvedValue({
      user: { id: userId },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
    const authResult = await getUserId()

    // Both paths must return the same users.id
    expect(guestResult).toBe(authResult)
    expect(guestResult).toBe(userId)
  })
})
