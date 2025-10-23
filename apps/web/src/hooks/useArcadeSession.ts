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
   * Room ID for multi-user sync (optional)
   * If provided, game state will sync across all users in the room
   */
  roomId?: string

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
   * Last error from server (move rejection)
   */
  lastError: string | null

  /**
   * Send a game move (applies optimistically and sends to server)
   * Note: playerId must be provided by caller (not omitted)
   */
  sendMove: (move: Omit<GameMove, 'timestamp'>) => void

  /**
   * Exit the arcade session
   */
  exitSession: () => void

  /**
   * Clear the last error
   */
  clearError: () => void

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
  const { userId, roomId, autoJoin = true, ...optimisticOptions } = options

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
      optimistic.syncWithServer(data.gameState as TState, data.version)
    },

    onMoveAccepted: (data) => {
      optimistic.handleMoveAccepted(data.gameState as TState, data.version, data.move)
    },

    onMoveRejected: (data) => {
      // For version conflicts, automatically retry the move
      if (data.versionConflict) {
        // Wait a tiny bit for server state to propagate, then retry
        setTimeout(() => {
          socketSendMove(userId, data.move, roomId)
        }, 10)
      }

      optimistic.handleMoveRejected(data.error, data.move)
    },

    onSessionEnded: () => {
      optimistic.reset()
    },

    onNoActiveSession: () => {
      // Silent - normal state
    },

    onError: (data) => {
      console.error(`[ArcadeSession] Error: ${data.error}`)
    },
  })

  // Auto-join session when connected
  useEffect(() => {
    if (connected && autoJoin && userId) {
      joinSession(userId, roomId)
    }
  }, [connected, autoJoin, userId, roomId, joinSession])

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

      // Send to server with roomId for room-based games
      socketSendMove(userId, fullMove, roomId)
    },
    [userId, roomId, optimistic, socketSendMove]
  )

  const exitSession = useCallback(() => {
    socketExitSession(userId)
    optimistic.reset()
  }, [userId, socketExitSession, optimistic])

  const refresh = useCallback(() => {
    if (connected && userId) {
      joinSession(userId, roomId)
    }
  }, [connected, userId, roomId, joinSession])

  return {
    state: optimistic.state,
    version: optimistic.version,
    connected,
    hasPendingMoves: optimistic.hasPendingMoves,
    lastError: optimistic.lastError,
    sendMove,
    exitSession,
    clearError: optimistic.clearError,
    refresh,
  }
}
