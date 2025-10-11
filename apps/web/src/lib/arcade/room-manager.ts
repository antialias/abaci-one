/**
 * Arcade room manager
 * Handles database operations for arcade rooms
 */

import { and, desc, eq, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import { generateRoomCode } from './room-code'
import type { GameName } from './validation'

export interface CreateRoomOptions {
  name: string
  createdBy: string // User/guest ID
  creatorName: string
  gameName: GameName
  gameConfig: unknown
  ttlMinutes?: number // Default: 60
}

export interface UpdateRoomOptions {
  name?: string
  isLocked?: boolean
  status?: 'lobby' | 'playing' | 'finished'
  currentSessionId?: string | null
  totalGamesPlayed?: number
}

/**
 * Create a new arcade room
 * Generates a unique room code and creates the room in the database
 */
export async function createRoom(options: CreateRoomOptions): Promise<schema.ArcadeRoom> {
  const now = new Date()

  // Generate unique room code (retry up to 5 times if collision)
  let code = generateRoomCode()
  let attempts = 0
  const MAX_ATTEMPTS = 5

  while (attempts < MAX_ATTEMPTS) {
    const existing = await getRoomByCode(code)
    if (!existing) break
    code = generateRoomCode()
    attempts++
  }

  if (attempts === MAX_ATTEMPTS) {
    throw new Error('Failed to generate unique room code')
  }

  const newRoom: schema.NewArcadeRoom = {
    code,
    name: options.name,
    createdBy: options.createdBy,
    creatorName: options.creatorName,
    createdAt: now,
    lastActivity: now,
    ttlMinutes: options.ttlMinutes || 60,
    isLocked: false,
    gameName: options.gameName,
    gameConfig: options.gameConfig as any,
    status: 'lobby',
    currentSessionId: null,
    totalGamesPlayed: 0,
  }

  const [room] = await db.insert(schema.arcadeRooms).values(newRoom).returning()
  console.log('[Room Manager] Created room:', room.id, 'code:', room.code)
  return room
}

/**
 * Get a room by ID
 */
export async function getRoomById(roomId: string): Promise<schema.ArcadeRoom | undefined> {
  return await db.query.arcadeRooms.findFirst({
    where: eq(schema.arcadeRooms.id, roomId),
  })
}

/**
 * Get a room by code
 */
export async function getRoomByCode(code: string): Promise<schema.ArcadeRoom | undefined> {
  return await db.query.arcadeRooms.findFirst({
    where: eq(schema.arcadeRooms.code, code.toUpperCase()),
  })
}

/**
 * Update a room
 */
export async function updateRoom(
  roomId: string,
  updates: UpdateRoomOptions
): Promise<schema.ArcadeRoom | undefined> {
  const now = new Date()

  // Always update lastActivity on any room update
  const updateData = {
    ...updates,
    lastActivity: now,
  }

  const [updated] = await db
    .update(schema.arcadeRooms)
    .set(updateData)
    .where(eq(schema.arcadeRooms.id, roomId))
    .returning()

  return updated
}

/**
 * Update room activity timestamp
 * Call this on any room activity to refresh TTL
 */
export async function touchRoom(roomId: string): Promise<void> {
  await db
    .update(schema.arcadeRooms)
    .set({ lastActivity: new Date() })
    .where(eq(schema.arcadeRooms.id, roomId))
}

/**
 * Delete a room
 * Cascade deletes all room members
 */
export async function deleteRoom(roomId: string): Promise<void> {
  await db.delete(schema.arcadeRooms).where(eq(schema.arcadeRooms.id, roomId))
  console.log('[Room Manager] Deleted room:', roomId)
}

/**
 * List active rooms
 * Returns rooms ordered by most recently active
 */
export async function listActiveRooms(gameName?: GameName): Promise<schema.ArcadeRoom[]> {
  const whereConditions = []

  // Filter by game if specified
  if (gameName) {
    whereConditions.push(eq(schema.arcadeRooms.gameName, gameName))
  }

  // Only return non-locked rooms in lobby or playing status
  whereConditions.push(
    eq(schema.arcadeRooms.isLocked, false),
    or(eq(schema.arcadeRooms.status, 'lobby'), eq(schema.arcadeRooms.status, 'playing'))
  )

  return await db.query.arcadeRooms.findMany({
    where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
    orderBy: [desc(schema.arcadeRooms.lastActivity)],
    limit: 50, // Limit to 50 most recent rooms
  })
}

/**
 * Clean up expired rooms
 * Delete rooms that have exceeded their TTL
 */
export async function cleanupExpiredRooms(): Promise<number> {
  const now = new Date()

  // Find rooms where lastActivity + ttlMinutes < now
  const expiredRooms = await db.query.arcadeRooms.findMany({
    columns: { id: true, ttlMinutes: true, lastActivity: true },
  })

  const toDelete = expiredRooms.filter((room) => {
    const expiresAt = new Date(room.lastActivity.getTime() + room.ttlMinutes * 60 * 1000)
    return expiresAt < now
  })

  if (toDelete.length > 0) {
    const ids = toDelete.map((r) => r.id)
    await db.delete(schema.arcadeRooms).where(or(...ids.map((id) => eq(schema.arcadeRooms.id, id))))
    console.log(`[Room Manager] Cleaned up ${toDelete.length} expired rooms`)
  }

  return toDelete.length
}

/**
 * Check if a user is the creator of a room
 */
export async function isRoomCreator(roomId: string, userId: string): Promise<boolean> {
  const room = await getRoomById(roomId)
  return room?.createdBy === userId
}
