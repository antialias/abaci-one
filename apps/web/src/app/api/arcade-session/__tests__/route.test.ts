import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, schema } from '@/db'
import { deleteArcadeSession } from '@/lib/arcade/session-manager'
import { DELETE, GET, POST } from '../route'

describe('Arcade Session API Routes', () => {
  const testUserId = 'test-user-for-api-routes'
  const testGuestId = 'test-guest-id-api-routes'
  const testRoomId = 'test-room-for-api-routes'
  const baseUrl = 'http://localhost:3000'

  beforeEach(async () => {
    // Create test user
    await db
      .insert(schema.users)
      .values({
        id: testUserId,
        guestId: testGuestId,
        createdAt: new Date(),
      })
      .onConflictDoNothing()

    // Create test room (required for session creation and retrieval)
    await db
      .insert(schema.arcadeRooms)
      .values({
        id: testRoomId,
        code: 'TSTRT',
        createdBy: testGuestId,
        creatorName: 'Test User',
        gameName: 'matching',
        gameConfig: { difficulty: 6 },
      })
      .onConflictDoNothing()
  })

  afterEach(async () => {
    // Clean up sessions first (FK constraint), then rooms, then users
    await db.delete(schema.arcadeSessions).where(eq(schema.arcadeSessions.roomId, testRoomId))
    await db.delete(schema.arcadeRooms).where(eq(schema.arcadeRooms.id, testRoomId))
    await db.delete(schema.users).where(eq(schema.users.id, testUserId))
  })

  describe('POST /api/arcade-session', () => {
    it('should create a new session', async () => {
      const request = new NextRequest(`${baseUrl}/api/arcade-session`, {
        method: 'POST',
        body: JSON.stringify({
          userId: testUserId,
          gameName: 'matching',
          gameUrl: '/arcade/matching',
          initialState: { test: 'state' },
          activePlayers: [1],
          roomId: testRoomId,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.session).toBeDefined()
      expect(data.session.currentGame).toBe('matching')
      expect(data.session.version).toBe(1)
    })

    it('should return 400 for missing fields', async () => {
      const request = new NextRequest(`${baseUrl}/api/arcade-session`, {
        method: 'POST',
        body: JSON.stringify({
          userId: testUserId,
          // Missing required fields
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe(
        'Missing required fields (userId, gameName, gameUrl, initialState, activePlayers, roomId)'
      )
    })

    it('should auto-create user and session for non-existent user', async () => {
      const nonExistentGuestId = 'non-existent-user-' + Date.now()
      const request = new NextRequest(`${baseUrl}/api/arcade-session`, {
        method: 'POST',
        body: JSON.stringify({
          userId: nonExistentGuestId,
          gameName: 'matching',
          gameUrl: '/arcade/matching',
          initialState: {},
          activePlayers: [1],
          roomId: testRoomId,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      // createArcadeSession auto-creates users, so this succeeds
      expect(response.status).toBe(200)
      expect(data.session).toBeDefined()

      // Clean up auto-created user
      const autoUser = await db.query.users.findFirst({
        where: eq(schema.users.guestId, nonExistentGuestId),
      })
      if (autoUser) {
        await db.delete(schema.arcadeSessions).where(eq(schema.arcadeSessions.userId, autoUser.id))
        await db.delete(schema.users).where(eq(schema.users.id, autoUser.id))
      }
    })
  })

  describe('GET /api/arcade-session', () => {
    it('should retrieve an existing session', async () => {
      // Create session first
      const createRequest = new NextRequest(`${baseUrl}/api/arcade-session`, {
        method: 'POST',
        body: JSON.stringify({
          userId: testUserId,
          gameName: 'matching',
          gameUrl: '/arcade/matching',
          initialState: { test: 'state' },
          activePlayers: [1],
          roomId: testRoomId,
        }),
      })
      await POST(createRequest)

      // Now retrieve it
      const request = new NextRequest(`${baseUrl}/api/arcade-session?userId=${testUserId}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.session).toBeDefined()
      expect(data.session.currentGame).toBe('matching')
    })

    it('should return 404 for non-existent session', async () => {
      const request = new NextRequest(`${baseUrl}/api/arcade-session?userId=non-existent`)

      const response = await GET(request)

      expect(response.status).toBe(404)
    })

    it('should return 400 for missing userId', async () => {
      const request = new NextRequest(`${baseUrl}/api/arcade-session`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('userId required')
    })
  })

  describe('DELETE /api/arcade-session', () => {
    it('should delete an existing session', async () => {
      // Create session first
      const createRequest = new NextRequest(`${baseUrl}/api/arcade-session`, {
        method: 'POST',
        body: JSON.stringify({
          userId: testUserId,
          gameName: 'matching',
          gameUrl: '/arcade/matching',
          initialState: {},
          activePlayers: [1],
          roomId: testRoomId,
        }),
      })
      await POST(createRequest)

      // Now delete it
      const request = new NextRequest(`${baseUrl}/api/arcade-session?userId=${testUserId}`, {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify it's deleted
      const getRequest = new NextRequest(`${baseUrl}/api/arcade-session?userId=${testUserId}`)
      const getResponse = await GET(getRequest)
      expect(getResponse.status).toBe(404)
    })

    it('should return 400 for missing userId', async () => {
      const request = new NextRequest(`${baseUrl}/api/arcade-session`, {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('userId required')
    })
  })
})
