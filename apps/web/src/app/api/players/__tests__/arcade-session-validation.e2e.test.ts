/**
 * @vitest-environment node
 */

import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, schema } from '../../../../db'
import { PATCH } from '../[id]/route'

/**
 * Arcade Session Validation E2E Tests
 *
 * These tests verify that the PATCH /api/players/[id] endpoint
 * correctly prevents isActive changes when user has an active arcade session.
 */

describe('PATCH /api/players/[id] - Arcade Session Validation', () => {
  let testUserId: string
  let testGuestId: string
  let testPlayerId: string

  beforeEach(async () => {
    // Create a test user with unique guest ID
    testGuestId = `test-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const [user] = await db.insert(schema.users).values({ guestId: testGuestId }).returning()
    testUserId = user.id

    // Create a test player
    const [player] = await db
      .insert(schema.players)
      .values({
        userId: testUserId,
        name: 'Test Player',
        emoji: '😀',
        color: '#3b82f6',
        isActive: false,
      })
      .returning()
    testPlayerId = player.id
  })

  afterEach(async () => {
    // Clean up: delete test arcade session (if exists)
    await db.delete(schema.arcadeSessions).where(eq(schema.arcadeSessions.userId, testGuestId))
    // Clean up: delete test user (cascade deletes players)
    await db.delete(schema.users).where(eq(schema.users.id, testUserId))
  })

  it('should return 403 when trying to change isActive with active arcade session', async () => {
    // Create an active arcade session
    const now = new Date()
    await db.insert(schema.arcadeSessions).values({
      userId: testGuestId,
      currentGame: 'matching',
      gameUrl: '/arcade/matching',
      gameState: JSON.stringify({}),
      activePlayers: JSON.stringify([testPlayerId]),
      startedAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + 3600000), // 1 hour from now
      version: 1,
    })

    // Mock request to change isActive
    const mockRequest = new NextRequest(`http://localhost:3000/api/players/${testPlayerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `guest_id=${testGuestId}`,
      },
      body: JSON.stringify({ isActive: true }),
    })

    // Mock getViewerId by setting cookie
    const response = await PATCH(mockRequest, { params: { id: testPlayerId } })
    const data = await response.json()

    // Should be rejected with 403
    expect(response.status).toBe(403)
    expect(data.error).toContain('Cannot modify active players during an active game session')
    expect(data.activeGame).toBe('matching')
    expect(data.gameUrl).toBe('/arcade/matching')

    // Verify player isActive was NOT changed
    const player = await db.query.players.findFirst({
      where: eq(schema.players.id, testPlayerId),
    })
    expect(player?.isActive).toBe(false) // Still false
  })

  it('should allow isActive change when no active arcade session', async () => {
    // No arcade session created

    // Mock request to change isActive
    const mockRequest = new NextRequest(`http://localhost:3000/api/players/${testPlayerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `guest_id=${testGuestId}`,
      },
      body: JSON.stringify({ isActive: true }),
    })

    const response = await PATCH(mockRequest, { params: { id: testPlayerId } })
    const data = await response.json()

    // Should succeed
    expect(response.status).toBe(200)
    expect(data.player.isActive).toBe(true)

    // Verify player isActive was changed
    const player = await db.query.players.findFirst({
      where: eq(schema.players.id, testPlayerId),
    })
    expect(player?.isActive).toBe(true)
  })

  it('should allow non-isActive changes even with active arcade session', async () => {
    // Create an active arcade session
    const now = new Date()
    await db.insert(schema.arcadeSessions).values({
      userId: testGuestId,
      currentGame: 'matching',
      gameUrl: '/arcade/matching',
      gameState: JSON.stringify({}),
      activePlayers: JSON.stringify([testPlayerId]),
      startedAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + 3600000), // 1 hour from now
      version: 1,
    })

    // Mock request to change name/emoji/color (NOT isActive)
    const mockRequest = new NextRequest(`http://localhost:3000/api/players/${testPlayerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `guest_id=${testGuestId}`,
      },
      body: JSON.stringify({
        name: 'Updated Name',
        emoji: '🎉',
        color: '#ff0000',
      }),
    })

    const response = await PATCH(mockRequest, { params: { id: testPlayerId } })
    const data = await response.json()

    // Should succeed
    expect(response.status).toBe(200)
    expect(data.player.name).toBe('Updated Name')
    expect(data.player.emoji).toBe('🎉')
    expect(data.player.color).toBe('#ff0000')

    // Verify changes were applied
    const player = await db.query.players.findFirst({
      where: eq(schema.players.id, testPlayerId),
    })
    expect(player?.name).toBe('Updated Name')
    expect(player?.emoji).toBe('🎉')
    expect(player?.color).toBe('#ff0000')
  })

  it('should allow isActive change after arcade session ends', async () => {
    // Create an active arcade session
    const now = new Date()
    await db.insert(schema.arcadeSessions).values({
      userId: testGuestId,
      currentGame: 'matching',
      gameUrl: '/arcade/matching',
      gameState: JSON.stringify({}),
      activePlayers: JSON.stringify([testPlayerId]),
      startedAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + 3600000), // 1 hour from now
      version: 1,
    })

    // End the session
    await db.delete(schema.arcadeSessions).where(eq(schema.arcadeSessions.userId, testGuestId))

    // Mock request to change isActive
    const mockRequest = new NextRequest(`http://localhost:3000/api/players/${testPlayerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `guest_id=${testGuestId}`,
      },
      body: JSON.stringify({ isActive: true }),
    })

    const response = await PATCH(mockRequest, { params: { id: testPlayerId } })
    const data = await response.json()

    // Should succeed
    expect(response.status).toBe(200)
    expect(data.player.isActive).toBe(true)
  })

  it('should handle multiple players with different isActive states', async () => {
    // Create additional players
    const [player2] = await db
      .insert(schema.players)
      .values({
        userId: testUserId,
        name: 'Player 2',
        emoji: '😎',
        color: '#8b5cf6',
        isActive: true,
      })
      .returning()

    // Create arcade session
    const now2 = new Date()
    await db.insert(schema.arcadeSessions).values({
      userId: testGuestId,
      currentGame: 'matching',
      gameUrl: '/arcade/matching',
      gameState: JSON.stringify({}),
      activePlayers: JSON.stringify([testPlayerId, player2.id]),
      startedAt: now2,
      lastActivityAt: now2,
      expiresAt: new Date(now2.getTime() + 3600000), // 1 hour from now
      version: 1,
    })

    // Try to toggle player1 (inactive -> active) - should fail
    const request1 = new NextRequest(`http://localhost:3000/api/players/${testPlayerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `guest_id=${testGuestId}`,
      },
      body: JSON.stringify({ isActive: true }),
    })

    const response1 = await PATCH(request1, { params: { id: testPlayerId } })
    expect(response1.status).toBe(403)

    // Try to toggle player2 (active -> inactive) - should also fail
    const request2 = new NextRequest(`http://localhost:3000/api/players/${player2.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `guest_id=${testGuestId}`,
      },
      body: JSON.stringify({ isActive: false }),
    })

    const response2 = await PATCH(request2, { params: { id: player2.id } })
    expect(response2.status).toBe(403)
  })
})
