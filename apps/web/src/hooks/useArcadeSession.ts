import { useCallback, useEffect } from 'react'
import type { GameMove } from '@/lib/arcade/validation'
import { useArcadeSocket } from './useArcadeSocket'
import {
  type UseOptimisticGameStateOptions,
  useOptimisticGameState,
} from './useOptimisticGameState'

export interface UseArcadeSessionOptions<TState> extends UseOptimisticGameStateOptions<TState> {
  /**
   * User ID for the session
   */
  userId: string

  /**
   * Auto-join session on mount
   * @default true
   */
  autoJoin?: boolean
}

export interface UseArcadeSessionReturn<TState> {
  /**
   * Current game state (with optimistic updates)
   */
  state: TState

  /**
   * Server-confirmed version
   */
  version: number

  /**
   * Whether socket is connected
   */
  connected: boolean

  /**
   * Whether there are pending moves
   */
  hasPendingMoves: boolean

  /**
   * Send a game move (applies optimistically and sends to server)
   */
  sendMove: (move: Omit<GameMove, 'playerId' | 'timestamp'>) => void

  /**
   * Exit the arcade session
   */
  exitSession: () => void

  /**
   * Manually sync with server (useful after reconnect)
   */
  refresh: () => void
}

/**
 * Combined hook for arcade session management
 *
 * Handles WebSocket connection, optimistic updates, and server sync automatically.
 *
 * @example
 * ```tsx
 * const { state, sendMove, connected } = useArcadeSession({
 *   userId: user.id,
 *   initialState: { ... },
 *   applyMove: (state, move) => { ... }
 * })
 *
 * // Send a move
 * sendMove({ type: 'FLIP_CARD', data: { cardId: '123' } })
 * ```
 */
export function useArcadeSession<TState>(
  options: UseArcadeSessionOptions<TState>
): UseArcadeSessionReturn<TState> {
  const { userId, autoJoin = true, ...optimisticOptions } = options

  // Optimistic state management
  const optimistic = useOptimisticGameState<TState>(optimisticOptions)

  // WebSocket connection
  const {
    socket,
    connected,
    joinSession,
    sendMove: socketSendMove,
    exitSession: socketExitSession,
  } = useArcadeSocket({
    onSessionState: (data) => {
      console.log('[ArcadeSession] Syncing with server state')
      optimistic.syncWithServer(data.gameState as TState, data.version)
    },

    onMoveAccepted: (data) => {
      console.log('[ArcadeSession] Move accepted by server')
      optimistic.handleMoveAccepted(data.gameState as TState, data.version, data.move)
    },

    onMoveRejected: (data) => {
      console.log('[ArcadeSession] Move rejected by server:', data.error)
      optimistic.handleMoveRejected(data.error, data.move)
    },

    onSessionEnded: () => {
      console.log('[ArcadeSession] Session ended')
      optimistic.reset()
    },

    onNoActiveSession: () => {
      console.log('[ArcadeSession] No active session found')
    },

    onError: (data) => {
      console.error('[ArcadeSession] Error:', data.error)
      // Users can handle errors via the onMoveRejected callback
    },
  })

  // Auto-join session when connected
  useEffect(() => {
    if (connected && autoJoin && userId) {
      joinSession(userId)
    }
  }, [connected, autoJoin, userId, joinSession])

  // Send move with optimistic update
  const sendMove = useCallback(
    (move: Omit<GameMove, 'timestamp'>) => {
      // IMPORTANT: playerId must always be explicitly provided by caller
      // playerId is the database player ID (avatar), never the userId/viewerId
      if (!('playerId' in move) || !move.playerId) {
        throw new Error('playerId is required in all moves and must be a valid player ID')
      }

      const fullMove: GameMove = {
        ...move,
        timestamp: Date.now(),
      } as GameMove

      // Apply optimistically
      optimistic.applyOptimisticMove(fullMove)

      // Send to server
      socketSendMove(userId, fullMove)
    },
    [userId, optimistic, socketSendMove]
  )

  const exitSession = useCallback(() => {
    socketExitSession(userId)
    optimistic.reset()
  }, [userId, socketExitSession, optimistic])

  const refresh = useCallback(() => {
    if (connected && userId) {
      joinSession(userId)
    }
  }, [connected, userId, joinSession])

  return {
    state: optimistic.state,
    version: optimistic.version,
    connected,
    hasPendingMoves: optimistic.hasPendingMoves,
    sendMove,
    exitSession,
    refresh,
  }
}
