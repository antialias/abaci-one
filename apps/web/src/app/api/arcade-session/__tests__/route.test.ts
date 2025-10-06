import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GET, POST, DELETE } from '../route'
import { NextRequest } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { deleteArcadeSession } from '@/lib/arcade/session-manager'

describe('Arcade Session API Routes', () => {
  const testUserId = 'test-user-for-api-routes'
  const testGuestId = 'test-guest-id-api-routes'
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
  })

  afterEach(async () => {
    // Clean up
    await deleteArcadeSession(testUserId)
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
      expect(data.error).toBe('Missing required fields')
    })

    it('should return 500 for non-existent user (foreign key constraint)', async () => {
      const request = new NextRequest(`${baseUrl}/api/arcade-session`, {
        method: 'POST',
        body: JSON.stringify({
          userId: 'non-existent-user',
          gameName: 'matching',
          gameUrl: '/arcade/matching',
          initialState: {},
          activePlayers: [1],
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
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
        }),
      })
      await POST(createRequest)

      // Now retrieve it
      const request = new NextRequest(
        `${baseUrl}/api/arcade-session?userId=${testUserId}`
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.session).toBeDefined()
      expect(data.session.currentGame).toBe('matching')
    })

    it('should return 404 for non-existent session', async () => {
      const request = new NextRequest(
        `${baseUrl}/api/arcade-session?userId=non-existent`
      )

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
        }),
      })
      await POST(createRequest)

      // Now delete it
      const request = new NextRequest(
        `${baseUrl}/api/arcade-session?userId=${testUserId}`,
        { method: 'DELETE' }
      )

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify it's deleted
      const getRequest = new NextRequest(
        `${baseUrl}/api/arcade-session?userId=${testUserId}`
      )
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
