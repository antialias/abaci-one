import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { GameMove } from '@/lib/arcade/validation'

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
}

export interface UseArcadeSocketReturn {
  socket: Socket | null
  connected: boolean
  joinSession: (userId: string) => void
  sendMove: (userId: string, move: GameMove) => void
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
    })

    socketInstance.on('session-state', (data) => {
      console.log('[ArcadeSocket] Received session state', data)
      eventsRef.current.onSessionState?.(data)
    })

    socketInstance.on('no-active-session', () => {
      console.log('[ArcadeSocket] No active session')
      eventsRef.current.onNoActiveSession?.()
    })

    socketInstance.on('move-accepted', (data) => {
      console.log('[ArcadeSocket] Move accepted', data)
      eventsRef.current.onMoveAccepted?.(data)
    })

    socketInstance.on('move-rejected', (data) => {
      console.log('[ArcadeSocket] Move rejected', data)
      eventsRef.current.onMoveRejected?.(data)
    })

    socketInstance.on('session-ended', () => {
      console.log('[ArcadeSocket] Session ended')
      eventsRef.current.onSessionEnded?.()
    })

    socketInstance.on('session-error', (data) => {
      console.error('[ArcadeSocket] Session error', data)
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
    (userId: string) => {
      if (!socket) {
        console.warn('[ArcadeSocket] Cannot join session - socket not connected')
        return
      }
      console.log('[ArcadeSocket] Joining session for user:', userId)
      socket.emit('join-arcade-session', { userId })
    },
    [socket]
  )

  const sendMove = useCallback(
    (userId: string, move: GameMove) => {
      if (!socket) {
        console.warn('[ArcadeSocket] Cannot send move - socket not connected')
        return
      }
      const payload = { userId, move }
      console.log(
        '[ArcadeSocket] Sending game-move event with payload:',
        JSON.stringify(payload, null, 2)
      )
      socket.emit('game-move', payload)
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
