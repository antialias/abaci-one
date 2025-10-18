import type { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import type { Server as SocketIOServerType } from 'socket.io'
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
              const validator = getValidator(room.gameName as GameName)

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
          socket.emit('session-error', { error: 'Failed to fetch session' })
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
            const matchingValidator = getValidator('matching')
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
        socket.emit('room-error', { error: 'Failed to join room' })
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
        socket.emit('room-error', { error: 'Failed to update players' })
      }
    })

    socket.on('disconnect', () => {
      // Don't delete session on disconnect - it persists across devices
    })
  })

  // Store in globalThis to make accessible across module boundaries
  globalThis.__socketIO = io
  return io
}
