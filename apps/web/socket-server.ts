import { Server as SocketIOServer } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import {
  getArcadeSession,
  applyGameMove,
  updateSessionActivity,
  deleteArcadeSession,
  createArcadeSession,
} from './src/lib/arcade/session-manager'
import type { GameMove } from './src/lib/arcade/validation'
import { matchingGameValidator } from './src/lib/arcade/validation/MatchingGameValidator'

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
    socket.on('join-arcade-session', async ({ userId }: { userId: string }) => {
      currentUserId = userId
      socket.join(`arcade:${userId}`)
      console.log(`👤 User ${userId} joined arcade room`)

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
    })

    // Handle game moves
    socket.on('game-move', async (data: { userId: string; move: GameMove }) => {
      console.log('🎮 Game move:', data.userId, data.move.type)

      try {
        // Special handling for START_GAME - create session if it doesn't exist
        if (data.move.type === 'START_GAME') {
          const existingSession = await getArcadeSession(data.userId)

          if (!existingSession) {
            console.log('🎯 Creating new session for START_GAME')

            // Get initial state from validator
            const initialState = matchingGameValidator.getInitialState({
              difficulty: 6,
              gameType: 'abacus-numeral',
              turnTimer: 30,
            })

            await createArcadeSession({
              userId: data.userId,
              gameName: 'matching',
              gameUrl: '/arcade/matching',
              initialState,
              activePlayers: (data.move.data as any)?.activePlayers || [1],
            })

            console.log('✅ Session created successfully')

            // Notify all connected clients about the new session
            const newSession = await getArcadeSession(data.userId)
            if (newSession) {
              io.to(`arcade:${data.userId}`).emit('session-state', {
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
          // Broadcast the updated state to all devices for this user
          io.to(`arcade:${data.userId}`).emit('move-accepted', {
            gameState: result.session.gameState,
            version: result.session.version,
            move: data.move,
          })

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
        io.to(`arcade:${userId}`).emit('session-ended')
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

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id)
      if (currentUserId) {
        // Don't delete session on disconnect - it persists across devices
        console.log(`👤 User ${currentUserId} disconnected but session persists`)
      }
    })
  })

  console.log('✅ Socket.IO initialized on /api/socket')
  return io
}
