import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { GameMove } from "@/lib/arcade/validation";
import { useArcadeSocket } from "./useArcadeSocket";
import {
  type UseOptimisticGameStateOptions,
  useOptimisticGameState,
} from "./useOptimisticGameState";
import type { RetryState } from "@/lib/arcade/error-handling";
import { PreviewModeContext } from "@/contexts/PreviewModeContext";

export interface UseArcadeSessionOptions<TState>
  extends UseOptimisticGameStateOptions<TState> {
  /**
   * User ID for the session
   */
  userId: string;

  /**
   * Room ID for multi-user sync (optional)
   * If provided, game state will sync across all users in the room
   */
  roomId?: string;

  /**
   * Auto-join session on mount
   * @default true
   */
  autoJoin?: boolean;
}

export interface UseArcadeSessionReturn<TState> {
  /**
   * Current game state (with optimistic updates)
   */
  state: TState;

  /**
   * Server-confirmed version
   */
  version: number;

  /**
   * Whether socket is connected
   */
  connected: boolean;

  /**
   * Whether there are pending moves
   */
  hasPendingMoves: boolean;

  /**
   * Last error from server (move rejection)
   */
  lastError: string | null;

  /**
   * Current retry state (for showing UI indicators)
   */
  retryState: RetryState;

  /**
   * Send a game move (applies optimistically and sends to server)
   * Note: playerId must be provided by caller (not omitted)
   */
  sendMove: (move: Omit<GameMove, "timestamp">) => void;

  /**
   * Exit the arcade session
   */
  exitSession: () => void;

  /**
   * Clear the last error
   */
  clearError: () => void;

  /**
   * Manually sync with server (useful after reconnect)
   */
  refresh: () => void;

  /**
   * Other players' cursor positions (ephemeral, real-time)
   * Map of userId -> { x, y, playerId, hoveredRegionId } in SVG coordinates, or null if cursor left
   * Keyed by userId (session ID) to support multiple devices in coop mode
   */
  otherPlayerCursors: Record<
    string,
    {
      x: number;
      y: number;
      playerId: string;
      hoveredRegionId: string | null;
    } | null
  >;

  /**
   * Send cursor position update to other players (ephemeral, real-time)
   * @param playerId - The player ID sending the cursor update
   * @param userId - The session/viewer ID that owns this cursor
   * @param cursorPosition - SVG coordinates, or null when cursor leaves the map
   * @param hoveredRegionId - Region being hovered (from local hit-testing), or null
   */
  sendCursorUpdate: (
    playerId: string,
    userId: string,
    cursorPosition: { x: number; y: number } | null,
    hoveredRegionId: string | null,
  ) => void;
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
  options: UseArcadeSessionOptions<TState>,
): UseArcadeSessionReturn<TState> {
  const { userId, roomId, autoJoin = true, ...optimisticOptions } = options;

  // Check if we're in preview mode
  const previewMode = useContext(PreviewModeContext);

  // If in preview mode, return mock session immediately
  if (previewMode?.isPreview && previewMode?.mockState) {
    const mockRetryState: RetryState = {
      isRetrying: false,
      retryCount: 0,
      move: null,
      timestamp: null,
    };

    return {
      state: previewMode.mockState as TState,
      version: 1,
      connected: true,
      hasPendingMoves: false,
      lastError: null,
      retryState: mockRetryState,
      sendMove: () => {
        // Mock: do nothing in preview
      },
      exitSession: () => {
        // Mock: do nothing in preview
      },
      clearError: () => {
        // Mock: do nothing in preview
      },
      refresh: () => {
        // Mock: do nothing in preview
      },
      otherPlayerCursors: {},
      sendCursorUpdate: () => {
        // Mock: do nothing in preview
      },
    };
  }

  // Optimistic state management
  const optimistic = useOptimisticGameState<TState>(optimisticOptions);

  // Track retry state (exposed to UI for indicators)
  const [retryState, setRetryState] = useState<RetryState>({
    isRetrying: false,
    retryCount: 0,
    move: null,
    timestamp: null,
  });

  // Track other players' cursor positions (ephemeral, real-time)
  // Keyed by userId (session ID) to support multiple devices in coop mode
  const [otherPlayerCursors, setOtherPlayerCursors] = useState<
    Record<
      string,
      {
        x: number;
        y: number;
        playerId: string;
        hoveredRegionId: string | null;
      } | null
    >
  >({});

  // WebSocket connection
  const {
    socket,
    connected,
    joinSession,
    sendMove: socketSendMove,
    exitSession: socketExitSession,
    sendCursorUpdate: socketSendCursorUpdate,
  } = useArcadeSocket({
    onSessionState: (data) => {
      optimistic.syncWithServer(data.gameState as TState, data.version);
    },

    onMoveAccepted: (data) => {
      const isRetry = retryState.move?.timestamp === data.move.timestamp;
      console.log(
        `[AutoRetry] ACCEPTED move=${data.move.type} ts=${data.move.timestamp} isRetry=${isRetry} retryCount=${retryState.retryCount || 0}`,
      );

      // Check if this was a retried move
      if (isRetry && retryState.isRetrying) {
        console.log(
          `[AutoRetry] SUCCESS after ${retryState.retryCount} retries move=${data.move.type}`,
        );
        // Clear retry state
        setRetryState({
          isRetrying: false,
          retryCount: 0,
          move: null,
          timestamp: null,
        });
      }
      optimistic.handleMoveAccepted(
        data.gameState as TState,
        data.version,
        data.move,
      );
    },

    onMoveRejected: (data) => {
      const isRetry = retryState.move?.timestamp === data.move.timestamp;
      console.warn(
        `[AutoRetry] REJECTED move=${data.move.type} ts=${data.move.timestamp} isRetry=${isRetry} versionConflict=${!!data.versionConflict} error="${data.error}"`,
      );

      // For version conflicts, automatically retry the move
      if (data.versionConflict) {
        const retryCount =
          isRetry && retryState.isRetrying ? retryState.retryCount + 1 : 1;

        if (retryCount > 5) {
          console.error(
            `[AutoRetry] FAILED after 5 retries move=${data.move.type}`,
          );
          // Clear retry state and show error
          setRetryState({
            isRetrying: false,
            retryCount: 0,
            move: null,
            timestamp: null,
          });
          optimistic.handleMoveRejected(data.error, data.move);
          return;
        }

        console.warn(
          `[AutoRetry] SCHEDULE_RETRY_${retryCount} room=${roomId || "none"} move=${data.move.type} ts=${data.move.timestamp} delay=${10 * retryCount}ms`,
        );

        // Update retry state
        setRetryState({
          isRetrying: true,
          retryCount,
          move: data.move,
          timestamp: data.move.timestamp,
        });

        // Wait a tiny bit for server state to propagate, then retry
        setTimeout(() => {
          console.warn(
            `[AutoRetry] SENDING_RETRY_${retryCount} move=${data.move.type} ts=${data.move.timestamp}`,
          );
          socketSendMove(userId, data.move, roomId);
        }, 10 * retryCount);

        // Don't show error to user - we're handling it automatically
        return;
      }

      // Non-version-conflict errors: show to user
      optimistic.handleMoveRejected(data.error, data.move);
    },

    onSessionEnded: () => {
      optimistic.reset();
    },

    onNoActiveSession: () => {
      // Silent - normal state
    },

    onError: (data) => {
      console.error(`[ArcadeSession] Error: ${data.error}`);
    },

    onCursorUpdate: (data) => {
      // Key by userId (session ID) to support multiple devices in coop mode
      // Each device has a unique userId, even if they're playing as the same player
      setOtherPlayerCursors((prev) => {
        const newState = {
          ...prev,
          [data.userId]: data.cursorPosition
            ? {
                ...data.cursorPosition,
                playerId: data.playerId,
                hoveredRegionId: data.hoveredRegionId,
              }
            : null,
        };
        return newState;
      });
    },
  });

  // Auto-join session when connected
  useEffect(() => {
    if (connected && autoJoin && userId) {
      joinSession(userId, roomId);
    }
  }, [connected, autoJoin, userId, roomId, joinSession]);

  // Send move with optimistic update
  const sendMove = useCallback(
    (move: Omit<GameMove, "timestamp">) => {
      // IMPORTANT: playerId must always be explicitly provided by caller
      // playerId is the database player ID (avatar), never the userId/viewerId
      if (!("playerId" in move) || !move.playerId) {
        throw new Error(
          "playerId is required in all moves and must be a valid player ID",
        );
      }

      const fullMove: GameMove = {
        ...move,
        timestamp: Date.now(),
      } as GameMove;

      // Apply optimistically
      optimistic.applyOptimisticMove(fullMove);

      // Send to server with roomId for room-based games
      socketSendMove(userId, fullMove, roomId);
    },
    [userId, roomId, optimistic.applyOptimisticMove, socketSendMove],
  );

  const exitSession = useCallback(() => {
    socketExitSession(userId);
    optimistic.reset();
  }, [userId, socketExitSession, optimistic.reset]);

  const refresh = useCallback(() => {
    if (connected && userId) {
      joinSession(userId, roomId);
    }
  }, [connected, userId, roomId, joinSession]);

  // Send cursor position update to other players (ephemeral, real-time)
  const sendCursorUpdate = useCallback(
    (
      playerId: string,
      sessionUserId: string,
      cursorPosition: { x: number; y: number } | null,
      hoveredRegionId: string | null,
    ) => {
      if (!roomId) return; // Only works in room-based games
      socketSendCursorUpdate(
        roomId,
        playerId,
        sessionUserId,
        cursorPosition,
        hoveredRegionId,
      );
    },
    [roomId, socketSendCursorUpdate],
  );

  return {
    state: optimistic.state,
    version: optimistic.version,
    connected,
    hasPendingMoves: optimistic.hasPendingMoves,
    lastError: optimistic.lastError,
    retryState,
    sendMove,
    exitSession,
    clearError: optimistic.clearError,
    refresh,
    otherPlayerCursors,
    sendCursorUpdate,
  };
}
