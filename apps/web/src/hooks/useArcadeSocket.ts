import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { GameMove } from '@/lib/arcade/validation'
import { useArcadeError } from '@/contexts/ArcadeErrorContext'

export interface ArcadeSocketEvents {
  onSessionState?: (data: {
    gameState: unknown
    currentGame: string
    gameUrl: string
    activePlayers: number[]
    version: number
  }) => void
  onMoveAccepted?: (data: { gameState: unknown; version: number; move: GameMove }) => void
  onMoveRejected?: (data: { error: string; move: GameMove; versionConflict?: boolean }) => void
  onSessionEnded?: () => void
  onNoActiveSession?: () => void
  onError?: (error: { error: string }) => void
  /** If true, errors will NOT show toasts (for cases where game handles errors directly) */
  suppressErrorToasts?: boolean
}

export interface UseArcadeSocketReturn {
  socket: Socket | null
  connected: boolean
  joinSession: (userId: string, roomId?: string) => void
  sendMove: (userId: string, move: GameMove, roomId?: string) => void
  exitSession: (userId: string) => void
  pingSession: (userId: string) => void
}

/**
 * Hook for managing WebSocket connection to arcade sessions
 *
 * @param events - Event handlers for socket events
 * @returns Socket instance and helper methods
 */
export function useArcadeSocket(events: ArcadeSocketEvents = {}): UseArcadeSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const eventsRef = useRef(events)
  const { addError } = useArcadeError()

  // Update events ref when they change
  useEffect(() => {
    eventsRef.current = events
  }, [events])

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io({
      path: '/api/socket',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socketInstance.on('connect', () => {
      console.log('[ArcadeSocket] Connected')
      setConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('[ArcadeSocket] Disconnected')
      setConnected(false)

      // Show error toast unless suppressed
      if (!eventsRef.current.suppressErrorToasts) {
        addError(
          'Connection lost',
          'The connection to the game server was lost. Attempting to reconnect...'
        )
      }
    })

    socketInstance.on('connect_error', (error) => {
      console.error('[ArcadeSocket] Connection error', error)

      if (!eventsRef.current.suppressErrorToasts) {
        addError(
          'Connection error',
          `Failed to connect to the game server: ${error.message}\n\nPlease check your internet connection and try refreshing the page.`
        )
      }
    })

    socketInstance.on('session-state', (data) => {
      eventsRef.current.onSessionState?.(data)
    })

    socketInstance.on('no-active-session', () => {
      // Show error toast unless suppressed
      if (!eventsRef.current.suppressErrorToasts) {
        addError(
          'No active session',
          'No game session was found. Please start a new game or join an existing room.'
        )
      }

      eventsRef.current.onNoActiveSession?.()
    })

    socketInstance.on('move-accepted', (data) => {
      eventsRef.current.onMoveAccepted?.(data)
    })

    socketInstance.on('move-rejected', (data) => {
      console.log(`[ArcadeSocket] Move rejected: ${data.error}`)

      // Show error toast for move rejections unless suppressed or it's a version conflict
      if (!eventsRef.current.suppressErrorToasts && !data.versionConflict) {
        addError(
          'Move rejected',
          `Your move was not accepted: ${data.error}\n\nMove type: ${data.move.type}`
        )
      }

      eventsRef.current.onMoveRejected?.(data)
    })

    socketInstance.on('session-ended', () => {
      console.log('[ArcadeSocket] Session ended')
      eventsRef.current.onSessionEnded?.()
    })

    socketInstance.on('session-error', (data) => {
      console.error('[ArcadeSocket] Session error', data)

      // Show error toast unless suppressed
      if (!eventsRef.current.suppressErrorToasts) {
        addError(
          'Game session error',
          `Error: ${data.error}\n\nThis usually means there was a problem loading or updating the game session. Please try refreshing the page or returning to the lobby.`
        )
      }

      eventsRef.current.onError?.(data)
    })

    socketInstance.on('pong-session', () => {
      console.log('[ArcadeSocket] Pong received')
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  const joinSession = useCallback(
    (userId: string, roomId?: string) => {
      if (!socket) {
        console.warn('[ArcadeSocket] Cannot join session - socket not connected')
        return
      }
      console.log(
        '[ArcadeSocket] Joining session for user:',
        userId,
        roomId ? `in room ${roomId}` : '(solo)'
      )
      socket.emit('join-arcade-session', { userId, roomId })
    },
    [socket]
  )

  const sendMove = useCallback(
    (userId: string, move: GameMove, roomId?: string) => {
      if (!socket) {
        console.warn('[ArcadeSocket] Cannot send move - socket not connected')
        return
      }
      socket.emit('game-move', { userId, move, roomId })
    },
    [socket]
  )

  const exitSession = useCallback(
    (userId: string) => {
      if (!socket) {
        console.warn('[ArcadeSocket] Cannot exit session - socket not connected')
        return
      }
      console.log('[ArcadeSocket] Exiting session for user:', userId)
      socket.emit('exit-arcade-session', { userId })
    },
    [socket]
  )

  const pingSession = useCallback(
    (userId: string) => {
      if (!socket) return
      socket.emit('ping-session', { userId })
    },
    [socket]
  )

  return {
    socket,
    connected,
    joinSession,
    sendMove,
    exitSession,
    pingSession,
  }
}
