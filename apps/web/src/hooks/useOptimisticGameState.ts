import { useCallback, useEffect, useRef, useState } from "react";
import type { GameMove } from "@/lib/arcade/validation";

export interface PendingMove<TState> {
  move: GameMove;
  optimisticState: TState;
  timestamp: number;
}

export interface UseOptimisticGameStateOptions<TState> {
  /**
   * Initial game state
   */
  initialState: TState;

  /**
   * Apply a move to the state optimistically (client-side)
   * This should be the same logic that runs on the server
   */
  applyMove: (state: TState, move: GameMove) => TState;

  /**
   * Called when server accepts a move
   */
  onMoveAccepted?: (state: TState, move: GameMove) => void;

  /**
   * Called when server rejects a move
   */
  onMoveRejected?: (error: string, move: GameMove) => void;
}

export interface UseOptimisticGameStateReturn<TState> {
  /**
   * Current game state (includes optimistic updates)
   */
  state: TState;

  /**
   * Server-confirmed version number
   */
  version: number;

  /**
   * Whether there are pending moves awaiting server confirmation
   */
  hasPendingMoves: boolean;

  /**
   * Last error from server (move rejection)
   */
  lastError: string | null;

  /**
   * Apply a move optimistically and send to server
   */
  applyOptimisticMove: (move: GameMove) => void;

  /**
   * Handle server accepting a move
   */
  handleMoveAccepted: (
    serverState: TState,
    serverVersion: number,
    acceptedMove: GameMove,
  ) => void;

  /**
   * Handle server rejecting a move
   */
  handleMoveRejected: (error: string, rejectedMove: GameMove) => void;

  /**
   * Sync state with server (on reconnect or initial load)
   */
  syncWithServer: (serverState: TState, serverVersion: number) => void;

  /**
   * Clear the last error
   */
  clearError: () => void;

  /**
   * Reset to initial state
   */
  reset: () => void;
}

/**
 * Hook for managing game state with optimistic updates
 *
 * This hook maintains both server state and optimistic client state,
 * applying moves immediately on the client while waiting for server confirmation.
 * If the server rejects a move, the state is rolled back.
 *
 * @param options - Configuration options
 * @returns Game state and update methods
 */
export function useOptimisticGameState<TState>(
  options: UseOptimisticGameStateOptions<TState>,
): UseOptimisticGameStateReturn<TState> {
  const { initialState, applyMove, onMoveAccepted, onMoveRejected } = options;

  // Server-confirmed state and version
  const [serverState, setServerState] = useState<TState>(initialState);
  const [serverVersion, setServerVersion] = useState(1);

  // Pending moves that haven't been confirmed by server yet
  const [pendingMoves, setPendingMoves] = useState<PendingMove<TState>[]>([]);

  // Last error from move rejection
  const [lastError, setLastError] = useState<string | null>(null);

  // Ref for callbacks to avoid stale closures
  const callbacksRef = useRef({ onMoveAccepted, onMoveRejected });
  useEffect(() => {
    callbacksRef.current = { onMoveAccepted, onMoveRejected };
  }, [onMoveAccepted, onMoveRejected]);

  // Current state = server state + all pending moves applied
  const currentState = pendingMoves.reduce(
    (_state, pending) => pending.optimisticState,
    serverState,
  );

  const applyOptimisticMove = useCallback(
    (move: GameMove) => {
      setPendingMoves((prev) => {
        const baseState =
          prev.length > 0 ? prev[prev.length - 1].optimisticState : serverState;
        const optimisticState = applyMove(baseState, move);

        return [
          ...prev,
          {
            move,
            optimisticState,
            timestamp: Date.now(),
          },
        ];
      });
    },
    [serverState, applyMove],
  );

  const handleMoveAccepted = useCallback(
    (
      newServerState: TState,
      newServerVersion: number,
      acceptedMove: GameMove,
    ) => {
      // Update server state
      setServerState(newServerState);
      setServerVersion(newServerVersion);

      // Remove the accepted move from pending queue
      setPendingMoves((prev) => {
        const index = prev.findIndex(
          (p) =>
            p.move.type === acceptedMove.type &&
            p.move.timestamp === acceptedMove.timestamp,
        );

        if (index !== -1) {
          return prev.slice(index + 1);
        }

        // Move not found in pending queue - might be from another tab
        // Clear all pending moves since server state is now authoritative
        return [];
      });

      callbacksRef.current.onMoveAccepted?.(newServerState, acceptedMove);
    },
    [],
  );

  const handleMoveRejected = useCallback(
    (error: string, rejectedMove: GameMove) => {
      // Set the error for UI display
      console.warn(
        `[ErrorState] SET_ERROR error="${error}" move=${rejectedMove.type}`,
      );
      setLastError(error);

      // Remove the rejected move and all subsequent moves from pending queue
      setPendingMoves((prev) => {
        const index = prev.findIndex(
          (p) =>
            p.move.type === rejectedMove.type &&
            p.move.timestamp === rejectedMove.timestamp,
        );

        if (index !== -1) {
          // Rollback: remove rejected move and everything after it
          return prev.slice(0, index);
        }

        return prev;
      });

      callbacksRef.current.onMoveRejected?.(error, rejectedMove);
    },
    [],
  );

  const syncWithServer = useCallback(
    (newServerState: TState, newServerVersion: number) => {
      console.log(`[ErrorState] SYNC_WITH_SERVER version=${newServerVersion}`);
      setServerState(newServerState);
      setServerVersion(newServerVersion);
      // Clear pending moves on sync (new authoritative state from server)
      setPendingMoves([]);
    },
    [],
  );

  const clearError = useCallback(() => {
    console.log("[ErrorState] CLEAR_ERROR");
    setLastError(null);
  }, []);

  const reset = useCallback(() => {
    setServerState(initialState);
    setServerVersion(1);
    setPendingMoves([]);
    setLastError(null);
  }, [initialState]);

  return {
    state: currentState,
    version: serverVersion,
    hasPendingMoves: pendingMoves.length > 0,
    lastError,
    applyOptimisticMove,
    handleMoveAccepted,
    handleMoveRejected,
    syncWithServer,
    clearError,
    reset,
  };
}
