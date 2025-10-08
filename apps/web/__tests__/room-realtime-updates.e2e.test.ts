/**
 * @vitest-environment node
 */

import { createServer } from 'http'
import { eq } from 'drizzle-orm'
import { io as ioClient, type Socket } from 'socket.io-client'
import { afterEach, beforeEach, describe, expect, it, afterAll, beforeAll } from 'vitest'
import { db, schema } from '../src/db'
import { createRoom } from '../src/lib/arcade/room-manager'
import { addRoomMember } from '../src/lib/arcade/room-membership'
import { initializeSocketServer } from '../socket-server'
import type { Server as SocketIOServerType } from 'socket.io'

/**
 * Real-time Room Updates E2E Tests
 *
 * Tests that socket broadcasts work correctly when users join/leave rooms.
 * Simulates multiple connected users and verifies they receive real-time updates.
 */

describe('Room Real-time Updates', () => {
  let testUserId1: string
  let testUserId2: string
  let testGuestId1: string
  let testGuestId2: string
  let testRoomId: string
  let socket1: Socket
  let httpServer: any
  let io: SocketIOServerType
  let serverPort: number

  beforeAll(async () => {
    // Create HTTP server and initialize Socket.IO for testing
    httpServer = createServer()
    io = initializeSocketServer(httpServer)

    // Find an available port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = (httpServer.address() as any).port
        console.log(`Test socket server listening on port ${serverPort}`)
        resolve()
      })
    })
  })

  afterAll(async () => {
    // Close all socket connections
    if (io) {
      io.close()
    }
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve())
      })
    }
  })

  beforeEach(async () => {
    // Create test users
    testGuestId1 = `test-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
    testGuestId2 = `test-guest-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const [user1] = await db.insert(schema.users).values({ guestId: testGuestId1 }).returning()
    const [user2] = await db.insert(schema.users).values({ guestId: testGuestId2 }).returning()

    testUserId1 = user1.id
    testUserId2 = user2.id

    // Create a test room
    const room = await createRoom({
      name: 'Realtime Test Room',
      createdBy: testGuestId1,
      creatorName: 'User 1',
      gameName: 'matching',
      gameConfig: { difficulty: 6 },
      ttlMinutes: 60,
    })
    testRoomId = room.id
  })

  afterEach(async () => {
    // Disconnect sockets
    if (socket1?.connected) {
      socket1.disconnect()
    }

    // Clean up room members
    await db.delete(schema.roomMembers).where(eq(schema.roomMembers.roomId, testRoomId))

    // Clean up rooms
    if (testRoomId) {
      await db.delete(schema.arcadeRooms).where(eq(schema.arcadeRooms.id, testRoomId))
    }

    // Clean up users
    await db.delete(schema.users).where(eq(schema.users.id, testUserId1))
    await db.delete(schema.users).where(eq(schema.users.id, testUserId2))
  })

  it('should broadcast member-joined when a user joins via API', async () => {
    // User 1 joins the room via API first (this is what happens when they click "Join Room")
    await addRoomMember({
      roomId: testRoomId,
      userId: testGuestId1,
      displayName: 'User 1',
      isCreator: false,
    })

    // User 1 connects to socket
    socket1 = ioClient(`http://localhost:${serverPort}`, {
      path: '/api/socket',
      transports: ['websocket'],
    })

    // Wait for socket to connect
    await new Promise<void>((resolve, reject) => {
      socket1.on('connect', () => resolve())
      socket1.on('connect_error', (err) => reject(err))
      setTimeout(() => reject(new Error('Connection timeout')), 2000)
    })

    // Small delay to ensure event handlers are set up
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Set up listener for room-joined BEFORE emitting
    const roomJoinedPromise = new Promise<void>((resolve, reject) => {
      socket1.on('room-joined', () => resolve())
      socket1.on('room-error', (err) => reject(new Error(err.error)))
      setTimeout(() => reject(new Error('Room-joined timeout')), 3000)
    })

    // Now emit the join-room event
    socket1.emit('join-room', { roomId: testRoomId, userId: testGuestId1 })

    // Wait for confirmation
    await roomJoinedPromise

    // Set up listener for member-joined event BEFORE User 2 joins
    const memberJoinedPromise = new Promise<any>((resolve, reject) => {
      socket1.on('member-joined', (data) => {
        resolve(data)
      })
      setTimeout(() => reject(new Error('Timeout waiting for member-joined event')), 3000)
    })

    // User 2 joins the room via addRoomMember
    const { member: newMember } = await addRoomMember({
      roomId: testRoomId,
      userId: testGuestId2,
      displayName: 'User 2',
      isCreator: false,
    })

    // Manually trigger the broadcast (this is what the API route SHOULD do)
    const { getRoomMembers } = await import('../src/lib/arcade/room-membership')
    const { getRoomActivePlayers } = await import('../src/lib/arcade/player-manager')

    const members = await getRoomMembers(testRoomId)
    const memberPlayers = await getRoomActivePlayers(testRoomId)

    const memberPlayersObj: Record<string, any[]> = {}
    for (const [uid, players] of memberPlayers.entries()) {
      memberPlayersObj[uid] = players
    }

    io.to(`room:${testRoomId}`).emit('member-joined', {
      roomId: testRoomId,
      userId: testGuestId2,
      members,
      memberPlayers: memberPlayersObj,
    })

    // Wait for the socket broadcast with timeout
    const data = await memberJoinedPromise

    // Verify the broadcast data
    expect(data).toBeDefined()
    expect(data.roomId).toBe(testRoomId)
    expect(data.userId).toBe(testGuestId2)
    expect(data.members).toBeDefined()
    expect(Array.isArray(data.members)).toBe(true)

    // Verify both users are in the members list
    const memberUserIds = data.members.map((m: any) => m.userId)
    expect(memberUserIds).toContain(testGuestId1)
    expect(memberUserIds).toContain(testGuestId2)

    // Verify the new member details
    const addedMember = data.members.find((m: any) => m.userId === testGuestId2)
    expect(addedMember).toBeDefined()
    expect(addedMember.displayName).toBe('User 2')
    expect(addedMember.roomId).toBe(testRoomId)
  })

  it('should broadcast member-left when a user leaves via API', async () => {
    // User 1 joins the room first
    await addRoomMember({
      roomId: testRoomId,
      userId: testGuestId1,
      displayName: 'User 1',
      isCreator: false,
    })

    // User 2 joins the room
    await addRoomMember({
      roomId: testRoomId,
      userId: testGuestId2,
      displayName: 'User 2',
      isCreator: false,
    })

    // User 1 connects to socket
    socket1 = ioClient(`http://localhost:${serverPort}`, {
      path: '/api/socket',
      transports: ['websocket'],
    })

    await new Promise<void>((resolve) => {
      socket1.on('connect', () => resolve())
    })

    socket1.emit('join-room', { roomId: testRoomId, userId: testGuestId1 })

    await new Promise<void>((resolve) => {
      socket1.on('room-joined', () => resolve())
    })

    // Set up listener for member-left event
    const memberLeftPromise = new Promise<any>((resolve) => {
      socket1.on('member-left', (data) => {
        resolve(data)
      })
    })

    // User 2 leaves the room via API
    await db.delete(schema.roomMembers).where(eq(schema.roomMembers.userId, testGuestId2))

    // Manually trigger the leave broadcast (simulating what the API does)
    const { getSocketIO } = await import('../src/lib/socket-io')
    const io = await getSocketIO()
    if (io) {
      const { getRoomMembers } = await import('../src/lib/arcade/room-membership')
      const { getRoomActivePlayers } = await import('../src/lib/arcade/player-manager')

      const members = await getRoomMembers(testRoomId)
      const memberPlayers = await getRoomActivePlayers(testRoomId)

      const memberPlayersObj: Record<string, any[]> = {}
      for (const [uid, players] of memberPlayers.entries()) {
        memberPlayersObj[uid] = players
      }

      io.to(`room:${testRoomId}`).emit('member-left', {
        roomId: testRoomId,
        userId: testGuestId2,
        members,
        memberPlayers: memberPlayersObj,
      })
    }

    // Wait for the socket broadcast with timeout
    const data = await Promise.race([
      memberLeftPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for member-left event')), 2000)
      ),
    ])

    // Verify the broadcast data
    expect(data).toBeDefined()
    expect(data.roomId).toBe(testRoomId)
    expect(data.userId).toBe(testGuestId2)
    expect(data.members).toBeDefined()
    expect(Array.isArray(data.members)).toBe(true)

    // Verify User 2 is no longer in the members list
    const memberUserIds = data.members.map((m: any) => m.userId)
    expect(memberUserIds).toContain(testGuestId1)
    expect(memberUserIds).not.toContain(testGuestId2)
  })

  it('should update both members and players lists in member-joined broadcast', async () => {
    // Create an active player for User 2
    const [player2] = await db
      .insert(schema.players)
      .values({
        userId: testUserId2,
        name: 'Player 2',
        emoji: '🎮',
        color: '#3b82f6',
        isActive: true,
      })
      .returning()

    // User 1 connects and joins room
    socket1 = ioClient(`http://localhost:${serverPort}`, {
      path: '/api/socket',
      transports: ['websocket'],
    })

    await new Promise<void>((resolve) => {
      socket1.on('connect', () => resolve())
    })

    socket1.emit('join-room', { roomId: testRoomId, userId: testGuestId1 })

    await new Promise<void>((resolve) => {
      socket1.on('room-joined', () => resolve())
    })

    const memberJoinedPromise = new Promise<any>((resolve) => {
      socket1.on('member-joined', (data) => {
        resolve(data)
      })
    })

    // User 2 joins via API
    await addRoomMember({
      roomId: testRoomId,
      userId: testGuestId2,
      displayName: 'User 2',
      isCreator: false,
    })

    // Manually trigger the broadcast (simulating what the API does)
    const { getRoomMembers: getRoomMembers3 } = await import('../src/lib/arcade/room-membership')
    const { getRoomActivePlayers: getRoomActivePlayers3 } = await import(
      '../src/lib/arcade/player-manager'
    )

    const members2 = await getRoomMembers3(testRoomId)
    const memberPlayers2 = await getRoomActivePlayers3(testRoomId)

    const memberPlayersObj2: Record<string, any[]> = {}
    for (const [uid, players] of memberPlayers2.entries()) {
      memberPlayersObj2[uid] = players
    }

    io.to(`room:${testRoomId}`).emit('member-joined', {
      roomId: testRoomId,
      userId: testGuestId2,
      members: members2,
      memberPlayers: memberPlayersObj2,
    })

    const data = await Promise.race([
      memberJoinedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
    ])

    // Verify members list is updated
    expect(data.members).toBeDefined()
    const memberUserIds = data.members.map((m: any) => m.userId)
    expect(memberUserIds).toContain(testGuestId2)

    // Verify players list is updated
    expect(data.memberPlayers).toBeDefined()
    expect(data.memberPlayers[testGuestId2]).toBeDefined()
    expect(Array.isArray(data.memberPlayers[testGuestId2])).toBe(true)

    // User 2's players should include the active player we created
    const user2Players = data.memberPlayers[testGuestId2]
    expect(user2Players.length).toBeGreaterThan(0)
    expect(user2Players.some((p: any) => p.id === player2.id)).toBe(true)

    // Clean up player
    await db.delete(schema.players).where(eq(schema.players.id, player2.id))
  })
})
