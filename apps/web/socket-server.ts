import type { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import type { Server as SocketIOServerType } from 'socket.io'
import {
  applyGameMove,
  createArcadeSession,
  deleteArcadeSession,
  getArcadeSession,
  updateSessionActivity,
} from './src/lib/arcade/session-manager'
import { createRoom, getRoomById } from './src/lib/arcade/room-manager'
import { getRoomMembers, getUserRooms, setMemberOnline } from './src/lib/arcade/room-membership'
import { getRoomActivePlayers } from './src/lib/arcade/player-manager'
import type { GameMove, GameName } from './src/lib/arcade/validation'
import { matchingGameValidator } from './src/lib/arcade/validation/MatchingGameValidator'

// Use globalThis to store socket.io instance to avoid module isolation issues
// This ensures the same instance is accessible across dynamic imports
declare global {
  var __socketIO: SocketIOServerType | undefined
}

/**
 * Get the socket.io server instance
 * Returns null if not initialized
 */
export function getSocketIO(): SocketIOServerType | null {
  return globalThis.__socketIO || null
}

export function initializeSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id)
    let currentUserId: string | null = null

    // Join arcade session room
    socket.on(
      'join-arcade-session',
      async ({ userId, roomId }: { userId: string; roomId?: string }) => {
        currentUserId = userId
        socket.join(`arcade:${userId}`)
        console.log(`👤 User ${userId} joined arcade room`)

        // If this session is part of a room, also join the game room for multi-user sync
        if (roomId) {
          socket.join(`game:${roomId}`)
          console.log(`🎮 User ${userId} joined game room ${roomId}`)
        }

        // Send current session state if exists
        try {
          const session = await getArcadeSession(userId)
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
          socket.emit('session-error', { error: 'Failed to fetch session' })
        }
      }
    )

    // Handle game moves
    socket.on('game-move', async (data: { userId: string; move: GameMove }) => {
      console.log('🎮 Game move received:', {
        userId: data.userId,
        moveType: data.move.type,
        playerId: data.move.playerId,
        timestamp: data.move.timestamp,
        fullMove: JSON.stringify(data.move, null, 2),
      })

      try {
        // Special handling for START_GAME - create session if it doesn't exist
        if (data.move.type === 'START_GAME') {
          const existingSession = await getArcadeSession(data.userId)

          if (!existingSession) {
            console.log('🎯 Creating new session for START_GAME')

            // activePlayers must be provided in the START_GAME move data
            const activePlayers = (data.move.data as any)?.activePlayers
            if (!activePlayers || activePlayers.length === 0) {
              console.error('❌ START_GAME move missing activePlayers')
              socket.emit('move-rejected', {
                error: 'START_GAME requires at least one active player',
                move: data.move,
              })
              return
            }

            // Get initial state from validator
            const initialState = matchingGameValidator.getInitialState({
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
                console.log('🏠 Using existing room:', room.code)
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
              console.log('🏠 Created new room:', room.code)
            }

            // Now create the session linked to the room
            await createArcadeSession({
              userId: data.userId,
              gameName: 'matching',
              gameUrl: '/arcade/room', // Room-based sessions use /arcade/room
              initialState,
              activePlayers,
              roomId: room.id,
            })

            console.log('✅ Session created successfully with room association')

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
              console.log('📢 Emitted session-state to notify clients of new session')
            }
          }
        }

        const result = await applyGameMove(data.userId, data.move)

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
            console.log(`📢 Broadcasted move to game room ${result.session.roomId}`)
          }

          // Update activity timestamp
          await updateSessionActivity(data.userId)
        } else {
          // Send rejection only to the requesting socket
          socket.emit('move-rejected', {
            error: result.error,
            move: data.move,
            versionConflict: result.versionConflict,
          })
        }
      } catch (error) {
        console.error('Error processing move:', error)
        socket.emit('move-rejected', {
          error: 'Server error processing move',
          move: data.move,
        })
      }
    })

    // Handle session exit
    socket.on('exit-arcade-session', async ({ userId }: { userId: string }) => {
      console.log('🚪 User exiting arcade session:', userId)

      try {
        await deleteArcadeSession(userId)
        io!.to(`arcade:${userId}`).emit('session-ended')
      } catch (error) {
        console.error('Error ending session:', error)
        socket.emit('session-error', { error: 'Failed to end session' })
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
      console.log(`🏠 User ${userId} joining room ${roomId}`)

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

        console.log(`✅ User ${userId} joined room ${roomId}`)
      } catch (error) {
        console.error('Error joining room:', error)
        socket.emit('room-error', { error: 'Failed to join room' })
      }
    })

    // Room: Leave
    socket.on('leave-room', async ({ roomId, userId }: { roomId: string; userId: string }) => {
      console.log(`🚪 User ${userId} leaving room ${roomId}`)

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

        console.log(`✅ User ${userId} left room ${roomId}`)
      } catch (error) {
        console.error('Error leaving room:', error)
      }
    })

    // Room: Players updated
    socket.on('players-updated', async ({ roomId, userId }: { roomId: string; userId: string }) => {
      console.log(`🎯 Players updated for user ${userId} in room ${roomId}`)

      try {
        // Get updated player data
        const memberPlayers = await getRoomActivePlayers(roomId)

        // Convert memberPlayers Map to object
        const memberPlayersObj: Record<string, any[]> = {}
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players
        }

        // Broadcast to all members in the room (including sender)
        io!.to(`room:${roomId}`).emit('room-players-updated', {
          roomId,
          memberPlayers: memberPlayersObj,
        })

        console.log(`✅ Broadcasted player updates for room ${roomId}`)
      } catch (error) {
        console.error('Error updating room players:', error)
        socket.emit('room-error', { error: 'Failed to update players' })
      }
    })

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id)
      if (currentUserId) {
        // Don't delete session on disconnect - it persists across devices
        console.log(`👤 User ${currentUserId} disconnected but session persists`)
      }
    })
  })

  // Store in globalThis to make accessible across module boundaries
  globalThis.__socketIO = io
  console.log('✅ Socket.IO initialized on /api/socket')
  return io
}
