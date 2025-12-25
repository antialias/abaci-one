import type { Server as HTTPServer, IncomingMessage } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import type { Server as SocketIOServerType } from 'socket.io'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  applyGameMove,
  createArcadeSession,
  deleteArcadeSession,
  getArcadeSession,
  getArcadeSessionByRoom,
  updateSessionActivity,
  updateSessionActivePlayers,
} from './lib/arcade/session-manager'
import { createRoom, getRoomById } from './lib/arcade/room-manager'
import { getRoomMembers, getUserRooms, setMemberOnline } from './lib/arcade/room-membership'
import { getRoomActivePlayers, getRoomPlayerIds } from './lib/arcade/player-manager'
import { getValidator, type GameName } from './lib/arcade/validators'
import type { GameMove } from './lib/arcade/validation/types'
import { getGameConfig } from './lib/arcade/game-config-helpers'

// Yjs server-side imports
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

// Use globalThis to store socket.io instance to avoid module isolation issues
// This ensures the same instance is accessible across dynamic imports
declare global {
  var __socketIO: SocketIOServerType | undefined
  var __yjsRooms: Map<string, any> | undefined // Map<roomId, RoomState>
}

/**
 * Get the socket.io server instance
 * Returns null if not initialized
 */
export function getSocketIO(): SocketIOServerType | null {
  return globalThis.__socketIO || null
}

/**
 * Initialize Yjs WebSocket server for real-time collaboration
 * Server-authoritative approach - maintains Y.Doc per arcade room, handles sync protocol
 *
 * IMPORTANT: Yjs rooms map 1:1 with arcade rooms (roomId === arcade room ID)
 */
function initializeYjsServer(io: SocketIOServerType) {
  // Room state storage (keyed by arcade room ID)
  interface RoomState {
    doc: Y.Doc
    awareness: awarenessProtocol.Awareness
    connections: Set<string> // Socket IDs
  }

  const rooms = new Map<string, RoomState>() // Map<arcadeRoomId, RoomState>
  const socketToRoom = new Map<string, string>() // Map<socketId, roomId>

  // Store rooms globally for persistence access
  globalThis.__yjsRooms = rooms

  function getOrCreateRoom(roomName: string): RoomState {
    if (!rooms.has(roomName)) {
      const doc = new Y.Doc()
      const awareness = new awarenessProtocol.Awareness(doc)

      // Broadcast document updates to all clients via Socket.IO
      doc.on('update', (update: Uint8Array, origin: any) => {
        // Origin is the socket ID that sent the update, don't echo back to sender
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, 0) // messageSync
        syncProtocol.writeUpdate(encoder, update)
        const message = encoding.toUint8Array(encoder)

        // Broadcast to all sockets in this room except origin
        io.to(`yjs:${roomName}`)
          .except(origin as string)
          .emit('yjs-update', Array.from(message))
      })

      // Broadcast awareness updates to all clients via Socket.IO
      awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
        const changedClients = added.concat(updated).concat(removed)
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, 1) // messageAwareness
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
        )
        const message = encoding.toUint8Array(encoder)

        // Broadcast to all sockets in this room except origin
        io.to(`yjs:${roomName}`)
          .except(origin as string)
          .emit('yjs-awareness', Array.from(message))
      })

      const roomState: RoomState = {
        doc,
        awareness,
        connections: new Set(),
      }
      rooms.set(roomName, roomState)
      console.log(`✅ Created Y.Doc for room: ${roomName}`)

      // Load persisted state asynchronously (don't block connection)
      void loadPersistedYjsState(roomName).catch((err) => {
        console.error(`Failed to load persisted state for room ${roomName}:`, err)
      })
    }
    return rooms.get(roomName)!
  }

  // Handle Yjs connections via Socket.IO
  io.on('connection', (socket) => {
    // Join Yjs room
    socket.on('yjs-join', async (roomId: string) => {
      const room = getOrCreateRoom(roomId)

      // Join Socket.IO room
      await socket.join(`yjs:${roomId}`)
      room.connections.add(socket.id)
      socketToRoom.set(socket.id, roomId)

      console.log(`🔗 Client connected to Yjs room: ${roomId} (${room.connections.size} clients)`)

      // Send initial sync (SyncStep1)
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, 0) // messageSync
      syncProtocol.writeSyncStep1(encoder, room.doc)
      socket.emit('yjs-sync', Array.from(encoding.toUint8Array(encoder)))

      // Send current awareness state
      const awarenessStates = room.awareness.getStates()
      if (awarenessStates.size > 0) {
        const awarenessEncoder = encoding.createEncoder()
        encoding.writeVarUint(awarenessEncoder, 1) // messageAwareness
        encoding.writeVarUint8Array(
          awarenessEncoder,
          awarenessProtocol.encodeAwarenessUpdate(
            room.awareness,
            Array.from(awarenessStates.keys())
          )
        )
        socket.emit('yjs-awareness', Array.from(encoding.toUint8Array(awarenessEncoder)))
      }
    })

    // Handle Yjs sync messages
    socket.on('yjs-update', (data: number[]) => {
      const roomId = socketToRoom.get(socket.id)
      if (!roomId) return

      const room = rooms.get(roomId)
      if (!room) return

      const uint8Data = new Uint8Array(data)
      const decoder = decoding.createDecoder(uint8Data)
      const messageType = decoding.readVarUint(decoder)

      if (messageType === 0) {
        // Sync protocol
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, 0)
        syncProtocol.readSyncMessage(decoder, encoder, room.doc, socket.id)

        // Send response if there's content
        if (encoding.length(encoder) > 1) {
          socket.emit('yjs-sync', Array.from(encoding.toUint8Array(encoder)))
        }
      }
    })

    // Handle awareness updates
    socket.on('yjs-awareness', (data: number[]) => {
      const roomId = socketToRoom.get(socket.id)
      if (!roomId) return

      const room = rooms.get(roomId)
      if (!room) return

      const uint8Data = new Uint8Array(data)
      const decoder = decoding.createDecoder(uint8Data)
      const messageType = decoding.readVarUint(decoder)

      if (messageType === 1) {
        awarenessProtocol.applyAwarenessUpdate(
          room.awareness,
          decoding.readVarUint8Array(decoder),
          socket.id
        )
      }
    })

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      const roomId = socketToRoom.get(socket.id)
      if (roomId) {
        const room = rooms.get(roomId)
        if (room) {
          room.connections.delete(socket.id)
          console.log(
            `🔌 Client disconnected from Yjs room: ${roomId} (${room.connections.size} remain)`
          )

          // Clean up empty rooms after grace period
          if (room.connections.size === 0) {
            setTimeout(() => {
              if (room.connections.size === 0) {
                room.awareness.destroy()
                room.doc.destroy()
                rooms.delete(roomId)
                console.log(`🗑️  Cleaned up room: ${roomId}`)
              }
            }, 30000)
          }
        }
        socketToRoom.delete(socket.id)
      }
    })
  })

  console.log('✅ Yjs over Socket.IO initialized')

  // Periodic persistence: sync Y.Doc state to arcade_sessions every 30 seconds
  setInterval(async () => {
    await persistAllYjsRooms()
  }, 30000)
}

/**
 * Get Y.Doc for a specific room (for persistence)
 * Returns null if room doesn't exist
 */
export function getYjsDoc(roomId: string): Y.Doc | null {
  const rooms = globalThis.__yjsRooms
  if (!rooms) return null

  const room = rooms.get(roomId)
  return room ? room.doc : null
}

/**
 * Load persisted cells into a Y.Doc
 * Should be called when creating a new room that has persisted state
 */
export async function loadPersistedYjsState(roomId: string): Promise<void> {
  const { extractCellsFromDoc, populateDocWithCells } = await import('./lib/arcade/yjs-persistence')

  const doc = getYjsDoc(roomId)
  if (!doc) return

  // Get the arcade session for this room
  const session = await getArcadeSessionByRoom(roomId)
  if (!session) return

  const gameState = session.gameState as any
  if (gameState.cells && Array.isArray(gameState.cells)) {
    console.log(`📥 Loading ${gameState.cells.length} persisted cells for room: ${roomId}`)
    populateDocWithCells(doc, gameState.cells)
  }
}

/**
 * Persist Y.Doc cells for a specific room to arcade_sessions
 */
export async function persistYjsRoom(roomId: string): Promise<void> {
  const { extractCellsFromDoc } = await import('./lib/arcade/yjs-persistence')
  const { db, schema } = await import('@/db')
  const { eq } = await import('drizzle-orm')

  const doc = getYjsDoc(roomId)
  if (!doc) return

  const session = await getArcadeSessionByRoom(roomId)
  if (!session) return

  // Extract cells from Y.Doc
  const cells = extractCellsFromDoc(doc, 'cells')

  // Update the gameState with current cells
  const currentState = session.gameState as Record<string, any>
  const updatedGameState = {
    ...currentState,
    cells,
  }

  // Save to database
  try {
    await db
      .update(schema.arcadeSessions)
      .set({
        gameState: updatedGameState as any,
        lastActivityAt: new Date(),
      })
      .where(eq(schema.arcadeSessions.roomId, roomId))
  } catch (error) {
    console.error(`Error persisting Yjs room ${roomId}:`, error)
  }
}

/**
 * Persist all active Yjs rooms
 */
export async function persistAllYjsRooms(): Promise<void> {
  const rooms = globalThis.__yjsRooms
  if (!rooms || rooms.size === 0) return

  const roomIds = Array.from(rooms.keys())
  for (const roomId of roomIds) {
    // Only persist rooms with active connections
    const room = rooms.get(roomId)
    if (room && room.connections.size > 0) {
      await persistYjsRoom(roomId)
    }
  }
}

export function initializeSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
      credentials: true,
    },
  })

  // Initialize Yjs server over Socket.IO
  initializeYjsServer(io)

  io.on('connection', (socket) => {
    let currentUserId: string | null = null

    // Join arcade session room
    socket.on(
      'join-arcade-session',
      async ({ userId, roomId }: { userId: string; roomId?: string }) => {
        currentUserId = userId
        socket.join(`arcade:${userId}`)

        // If this session is part of a room, also join the game room for multi-user sync
        if (roomId) {
          socket.join(`game:${roomId}`)
        }

        // Send current session state if exists
        // For room-based games, look up shared room session
        try {
          let session = roomId
            ? await getArcadeSessionByRoom(roomId)
            : await getArcadeSession(userId)

          // If no session exists for this room, create one in setup phase
          // This allows users to send SET_CONFIG moves before starting the game
          if (!session && roomId) {
            // Get the room to determine game type and config
            const room = await getRoomById(roomId)
            if (room) {
              // Fetch all active player IDs from room members (respects isActive flag)
              const roomPlayerIds = await getRoomPlayerIds(roomId)

              // Get initial state from the correct validator based on game type
              const validator = await getValidator(room.gameName as GameName)

              // Get game-specific config from database (type-safe)
              const gameConfig = await getGameConfig(roomId, room.gameName as GameName)
              const initialState = validator.getInitialState(gameConfig)

              session = await createArcadeSession({
                userId,
                gameName: room.gameName as GameName,
                gameUrl: '/arcade',
                initialState,
                activePlayers: roomPlayerIds, // Include all room members' active players
                roomId: room.id,
              })
            }
          }

          if (session) {
            socket.emit('session-state', {
              gameState: session.gameState,
              currentGame: session.currentGame,
              gameUrl: session.gameUrl,
              activePlayers: session.activePlayers,
              version: session.version,
            })
          } else {
            socket.emit('no-active-session')
          }
        } catch (error) {
          console.error('Error fetching session:', error)
          socket.emit('session-error', {
            error: error instanceof Error ? error.message : 'Failed to fetch session',
          })
        }
      }
    )

    // Handle game moves
    socket.on('game-move', async (data: { userId: string; move: GameMove; roomId?: string }) => {
      try {
        // Special handling for START_GAME - create session if it doesn't exist
        if (data.move.type === 'START_GAME') {
          // For room-based games, check if room session exists
          const existingSession = data.roomId
            ? await getArcadeSessionByRoom(data.roomId)
            : await getArcadeSession(data.userId)

          if (!existingSession) {
            // activePlayers must be provided in the START_GAME move data
            const activePlayers = (data.move.data as any)?.activePlayers
            if (!activePlayers || activePlayers.length === 0) {
              socket.emit('move-rejected', {
                error: 'START_GAME requires at least one active player',
                move: data.move,
              })
              return
            }

            // Get initial state from validator (this code path is matching-game specific)
            const matchingValidator = await getValidator('matching')
            const initialState = matchingValidator.getInitialState({
              difficulty: 6,
              gameType: 'abacus-numeral',
              turnTimer: 30,
            })

            // Check if user is already in a room for this game
            const userRoomIds = await getUserRooms(data.userId)
            let room = null

            // Look for an existing active room for this game
            for (const roomId of userRoomIds) {
              const existingRoom = await getRoomById(roomId)
              if (
                existingRoom &&
                existingRoom.gameName === 'matching' &&
                existingRoom.status !== 'finished'
              ) {
                room = existingRoom
                break
              }
            }

            // If no suitable room exists, create a new one
            if (!room) {
              room = await createRoom({
                name: 'Auto-generated Room',
                createdBy: data.userId,
                creatorName: 'Player',
                gameName: 'matching' as GameName,
                gameConfig: {
                  difficulty: 6,
                  gameType: 'abacus-numeral',
                  turnTimer: 30,
                },
                ttlMinutes: 60,
              })
            }

            // Now create the session linked to the room
            await createArcadeSession({
              userId: data.userId,
              gameName: 'matching',
              gameUrl: '/arcade', // Room-based sessions use /arcade
              initialState,
              activePlayers,
              roomId: room.id,
            })

            // Notify all connected clients about the new session
            const newSession = await getArcadeSession(data.userId)
            if (newSession) {
              io!.to(`arcade:${data.userId}`).emit('session-state', {
                gameState: newSession.gameState,
                currentGame: newSession.currentGame,
                gameUrl: newSession.gameUrl,
                activePlayers: newSession.activePlayers,
                version: newSession.version,
              })
            }
          }
        }

        // Apply game move - use roomId for room-based games to access shared session
        const result = await applyGameMove(data.userId, data.move, data.roomId)

        if (result.success && result.session) {
          const moveAcceptedData = {
            gameState: result.session.gameState,
            version: result.session.version,
            move: data.move,
          }

          // Broadcast the updated state to all devices for this user
          io!.to(`arcade:${data.userId}`).emit('move-accepted', moveAcceptedData)

          // If this is a room-based session, ALSO broadcast to all users in the room
          if (result.session.roomId) {
            io!.to(`game:${result.session.roomId}`).emit('move-accepted', moveAcceptedData)
          }

          // Update activity timestamp
          await updateSessionActivity(data.userId)
        } else {
          // Send rejection only to the requesting socket
          if (result.versionConflict) {
            console.warn(
              `[SocketServer] VERSION_CONFLICT_REJECTED room=${data.roomId} move=${data.move.type} user=${data.userId} socket=${socket.id}`
            )
          }
          socket.emit('move-rejected', {
            error: result.error,
            move: data.move,
            versionConflict: result.versionConflict,
          })
        }
      } catch (error) {
        console.error('Error processing move:', error)
        socket.emit('move-rejected', {
          error: error instanceof Error ? error.message : 'Server error processing move',
          move: data.move,
        })
      }
    })

    // Handle session exit
    socket.on('exit-arcade-session', async ({ userId }: { userId: string }) => {
      try {
        await deleteArcadeSession(userId)
        io!.to(`arcade:${userId}`).emit('session-ended')
      } catch (error) {
        console.error('Error ending session:', error)
        socket.emit('session-error', {
          error: error instanceof Error ? error.message : 'Failed to end session',
        })
      }
    })

    // Keep-alive ping
    socket.on('ping-session', async ({ userId }: { userId: string }) => {
      try {
        await updateSessionActivity(userId)
        socket.emit('pong-session')
      } catch (error) {
        console.error('Error updating activity:', error)
      }
    })

    // Room: Join
    socket.on('join-room', async ({ roomId, userId }: { roomId: string; userId: string }) => {
      try {
        // Join the socket room
        socket.join(`room:${roomId}`)

        // Mark member as online
        await setMemberOnline(roomId, userId, true)

        // Get room data
        const members = await getRoomMembers(roomId)
        const memberPlayers = await getRoomActivePlayers(roomId)

        // Convert memberPlayers Map to object for JSON serialization
        const memberPlayersObj: Record<string, any[]> = {}
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players
        }

        // Update session's activePlayers if game hasn't started yet
        // This ensures new members' players are included in the session
        const roomPlayerIds = await getRoomPlayerIds(roomId)
        const sessionUpdated = await updateSessionActivePlayers(roomId, roomPlayerIds)

        if (sessionUpdated) {
          // Broadcast updated session state to all users in the game room
          const updatedSession = await getArcadeSessionByRoom(roomId)
          if (updatedSession) {
            io!.to(`game:${roomId}`).emit('session-state', {
              gameState: updatedSession.gameState,
              currentGame: updatedSession.currentGame,
              gameUrl: updatedSession.gameUrl,
              activePlayers: updatedSession.activePlayers,
              version: updatedSession.version,
            })
          }
        }

        // Send current room state to the joining user
        socket.emit('room-joined', {
          roomId,
          members,
          memberPlayers: memberPlayersObj,
        })

        // Notify all other members in the room
        socket.to(`room:${roomId}`).emit('member-joined', {
          roomId,
          userId,
          members,
          memberPlayers: memberPlayersObj,
        })
      } catch (error) {
        console.error('Error joining room:', error)
        socket.emit('room-error', {
          error: error instanceof Error ? error.message : 'Failed to join room',
        })
      }
    })

    // User Channel: Join (for moderation events)
    socket.on('join-user-channel', async ({ userId }: { userId: string }) => {
      try {
        // Join user-specific channel for moderation notifications
        socket.join(`user:${userId}`)
      } catch (error) {
        console.error('Error joining user channel:', error)
      }
    })

    // Room: Leave
    socket.on('leave-room', async ({ roomId, userId }: { roomId: string; userId: string }) => {
      try {
        // Leave the socket room
        socket.leave(`room:${roomId}`)

        // Mark member as offline
        await setMemberOnline(roomId, userId, false)

        // Get updated members
        const members = await getRoomMembers(roomId)
        const memberPlayers = await getRoomActivePlayers(roomId)

        // Convert memberPlayers Map to object
        const memberPlayersObj: Record<string, any[]> = {}
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players
        }

        // Notify remaining members
        io!.to(`room:${roomId}`).emit('member-left', {
          roomId,
          userId,
          members,
          memberPlayers: memberPlayersObj,
        })
      } catch (error) {
        console.error('Error leaving room:', error)
      }
    })

    // Room: Players updated
    socket.on('players-updated', async ({ roomId, userId }: { roomId: string; userId: string }) => {
      try {
        // Get updated player data
        const memberPlayers = await getRoomActivePlayers(roomId)

        // Convert memberPlayers Map to object
        const memberPlayersObj: Record<string, any[]> = {}
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players
        }

        // Update session's activePlayers if game hasn't started yet
        const roomPlayerIds = await getRoomPlayerIds(roomId)
        const sessionUpdated = await updateSessionActivePlayers(roomId, roomPlayerIds)

        if (sessionUpdated) {
          // Broadcast updated session state to all users in the game room
          const updatedSession = await getArcadeSessionByRoom(roomId)
          if (updatedSession) {
            io!.to(`game:${roomId}`).emit('session-state', {
              gameState: updatedSession.gameState,
              currentGame: updatedSession.currentGame,
              gameUrl: updatedSession.gameUrl,
              activePlayers: updatedSession.activePlayers,
              version: updatedSession.version,
            })
          }
        }

        // Broadcast to all members in the room (including sender)
        io!.to(`room:${roomId}`).emit('room-players-updated', {
          roomId,
          memberPlayers: memberPlayersObj,
        })
      } catch (error) {
        console.error('Error updating room players:', error)
        socket.emit('room-error', {
          error: error instanceof Error ? error.message : 'Failed to update players',
        })
      }
    })

    // Cursor position update (ephemeral, not persisted)
    // Used for showing other players' cursors in real-time games
    socket.on(
      'cursor-update',
      ({
        roomId,
        playerId,
        userId,
        cursorPosition,
        hoveredRegionId,
      }: {
        roomId: string
        playerId: string
        userId: string // Session ID that owns this cursor
        cursorPosition: { x: number; y: number } | null // SVG coordinates, null when cursor leaves
        hoveredRegionId: string | null // Region being hovered (determined by sender's local hit-testing)
      }) => {
        // Broadcast to all other sockets in the game room (exclude sender)
        socket.to(`game:${roomId}`).emit('cursor-update', {
          playerId,
          userId,
          cursorPosition,
          hoveredRegionId,
        })
      }
    )

    // Classroom: Join classroom channel (for teachers to receive presence updates)
    socket.on('join-classroom', async ({ classroomId }: { classroomId: string }) => {
      try {
        await socket.join(`classroom:${classroomId}`)
        console.log(`🏫 User joined classroom channel: ${classroomId}`)
      } catch (error) {
        console.error('Error joining classroom channel:', error)
      }
    })

    // Classroom: Leave classroom channel
    socket.on('leave-classroom', async ({ classroomId }: { classroomId: string }) => {
      try {
        await socket.leave(`classroom:${classroomId}`)
        console.log(`🏫 User left classroom channel: ${classroomId}`)
      } catch (error) {
        console.error('Error leaving classroom channel:', error)
      }
    })

    // Player: Join player channel (for students to receive their own presence updates)
    socket.on('join-player', async ({ playerId }: { playerId: string }) => {
      try {
        await socket.join(`player:${playerId}`)
        console.log(`👤 User joined player channel: ${playerId}`)
      } catch (error) {
        console.error('Error joining player channel:', error)
      }
    })

    // Player: Leave player channel
    socket.on('leave-player', async ({ playerId }: { playerId: string }) => {
      try {
        await socket.leave(`player:${playerId}`)
        console.log(`👤 User left player channel: ${playerId}`)
      } catch (error) {
        console.error('Error leaving player channel:', error)
      }
    })

    // Session Observation: Join session channel (for students to receive observer-joined events)
    socket.on('join-session', async ({ sessionId }: { sessionId: string }) => {
      try {
        await socket.join(`session:${sessionId}`)
        console.log(`📝 Student joined session channel: ${sessionId}`)
      } catch (error) {
        console.error('Error joining session channel:', error)
      }
    })

    // Session Observation: Start observing a practice session
    socket.on(
      'observe-session',
      async ({ sessionId, observerId }: { sessionId: string; observerId: string }) => {
        try {
          await socket.join(`session:${sessionId}`)
          console.log(`👁️ Observer ${observerId} started watching session: ${sessionId}`)

          // Notify session that an observer joined
          socket.to(`session:${sessionId}`).emit('observer-joined', { observerId })
        } catch (error) {
          console.error('Error starting session observation:', error)
        }
      }
    )

    // Session Observation: Stop observing a practice session
    socket.on('stop-observing', async ({ sessionId }: { sessionId: string }) => {
      try {
        await socket.leave(`session:${sessionId}`)
        console.log(`👁️ Observer stopped watching session: ${sessionId}`)
      } catch (error) {
        console.error('Error stopping session observation:', error)
      }
    })

    // Session Observation: Broadcast practice state (from student's client)
    socket.on(
      'practice-state',
      (data: {
        sessionId: string
        currentProblem: unknown
        phase: 'problem' | 'feedback' | 'tutorial'
        studentAnswer: number | null
        isCorrect: boolean | null
        timing: { startedAt: number; elapsed: number }
      }) => {
        // Broadcast to all observers in the session channel
        socket.to(`session:${data.sessionId}`).emit('practice-state', data)
      }
    )

    // Session Observation: Broadcast tutorial state (from student's client)
    socket.on(
      'tutorial-state',
      (data: { sessionId: string; currentStep: number; totalSteps: number; content: unknown }) => {
        // Broadcast to all observers in the session channel
        socket.to(`session:${data.sessionId}`).emit('tutorial-state', data)
      }
    )

    // Session Observation: Tutorial control from observer
    socket.on(
      'tutorial-control',
      (data: { sessionId: string; action: 'skip' | 'next' | 'previous' }) => {
        // Send control command to student's client
        io!.to(`session:${data.sessionId}`).emit('tutorial-control', data)
      }
    )

    // Session Observation: Abacus control from observer
    socket.on(
      'abacus-control',
      (data: {
        sessionId: string
        target: 'help' | 'hero'
        action: 'show' | 'hide' | 'set-value'
        value?: number
      }) => {
        // Send control command to student's client
        io!.to(`session:${data.sessionId}`).emit('abacus-control', data)
      }
    )

    socket.on('disconnect', () => {
      // Don't delete session on disconnect - it persists across devices
    })
  })

  // Store in globalThis to make accessible across module boundaries
  globalThis.__socketIO = io
  return io
}
