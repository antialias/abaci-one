import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { createSocket } from "@/lib/socket";
import { ArcadeErrorContext } from "@/contexts/ArcadeErrorContext";
import type { GameMove } from "@/lib/arcade/validation";

export interface ArcadeSocketEvents {
  onSessionState?: (data: {
    gameState: unknown;
    currentGame: string;
    gameUrl: string;
    activePlayers: number[];
    version: number;
  }) => void;
  onMoveAccepted?: (data: {
    gameState: unknown;
    version: number;
    move: GameMove;
  }) => void;
  onMoveRejected?: (data: {
    error: string;
    move: GameMove;
    versionConflict?: boolean;
  }) => void;
  onSessionEnded?: () => void;
  onNoActiveSession?: () => void;
  onError?: (error: { error: string }) => void;
  /** Cursor position update from another player (ephemeral, real-time) */
  onCursorUpdate?: (data: {
    playerId: string;
    userId: string; // Session ID that owns this cursor
    cursorPosition: { x: number; y: number } | null;
    hoveredRegionId: string | null; // Region being hovered (determined by sender's local hit-testing)
  }) => void;
  /** If true, errors will NOT show toasts (for cases where game handles errors directly) */
  suppressErrorToasts?: boolean;
}

export interface UseArcadeSocketReturn {
  socket: Socket | null;
  connected: boolean;
  joinSession: (userId: string, roomId?: string) => void;
  sendMove: (userId: string, move: GameMove, roomId?: string) => void;
  exitSession: (userId: string) => void;
  pingSession: (userId: string) => void;
  /** Send cursor position update to other players in the room (ephemeral, real-time) */
  sendCursorUpdate: (
    roomId: string,
    playerId: string,
    userId: string,
    cursorPosition: { x: number; y: number } | null,
    hoveredRegionId: string | null,
  ) => void;
}

/**
 * Hook for managing WebSocket connection to arcade sessions
 *
 * @param events - Event handlers for socket events
 * @returns Socket instance and helper methods
 */
export function useArcadeSocket(
  events: ArcadeSocketEvents = {},
): UseArcadeSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const eventsRef = useRef(events);

  // Get error context if available, but don't throw if it's not
  const errorContext = useContext(ArcadeErrorContext);
  const addError = errorContext?.addError || (() => {});

  // Update events ref when they change
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = createSocket({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketInstance.on("connect", () => {
      console.log("[ArcadeSocket] Connected");
      setConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("[ArcadeSocket] Disconnected");
      setConnected(false);

      // Show error toast unless suppressed
      if (!eventsRef.current.suppressErrorToasts) {
        addError(
          "Connection lost",
          "The connection to the game server was lost. Attempting to reconnect...",
        );
      }
    });

    socketInstance.on("connect_error", (error) => {
      console.error("[ArcadeSocket] Connection error", error);

      if (!eventsRef.current.suppressErrorToasts) {
        addError(
          "Connection error",
          `Failed to connect to the game server: ${error.message}\n\nPlease check your internet connection and try refreshing the page.`,
        );
      }
    });

    socketInstance.on("session-state", (data) => {
      eventsRef.current.onSessionState?.(data);
    });

    socketInstance.on("no-active-session", () => {
      // Show error toast unless suppressed
      if (!eventsRef.current.suppressErrorToasts) {
        addError(
          "No active session",
          "No game session was found. Please start a new game or join an existing room.",
        );
      }

      eventsRef.current.onNoActiveSession?.();
    });

    socketInstance.on("move-accepted", (data) => {
      eventsRef.current.onMoveAccepted?.(data);
    });

    socketInstance.on("move-rejected", (data) => {
      // Show error toast for move rejections unless suppressed or it's a version conflict
      if (!eventsRef.current.suppressErrorToasts && !data.versionConflict) {
        addError(
          "Move rejected",
          `Your move was not accepted: ${data.error}\n\nMove type: ${data.move.type}`,
        );
      }

      eventsRef.current.onMoveRejected?.(data);
    });

    socketInstance.on("session-ended", () => {
      console.log("[ArcadeSocket] Session ended");
      eventsRef.current.onSessionEnded?.();
    });

    socketInstance.on("session-error", (data) => {
      console.error("[ArcadeSocket] Session error", data);

      // Show error toast unless suppressed
      if (!eventsRef.current.suppressErrorToasts) {
        addError(
          "Game session error",
          `Error: ${data.error}\n\nThis usually means there was a problem loading or updating the game session. Please try refreshing the page or returning to the lobby.`,
        );
      }

      eventsRef.current.onError?.(data);
    });

    socketInstance.on("pong-session", () => {
      console.log("[ArcadeSocket] Pong received");
    });

    // Cursor position update from other players (ephemeral, real-time)
    socketInstance.on("cursor-update", (data) => {
      eventsRef.current.onCursorUpdate?.(data);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const joinSession = useCallback(
    (userId: string, roomId?: string) => {
      if (!socket) {
        console.warn(
          "[ArcadeSocket] Cannot join session - socket not connected",
        );
        return;
      }
      console.log(
        "[ArcadeSocket] Joining session for user:",
        userId,
        roomId ? `in room ${roomId}` : "(solo)",
      );
      socket.emit("join-arcade-session", { userId, roomId });
    },
    [socket],
  );

  const sendMove = useCallback(
    (userId: string, move: GameMove, roomId?: string) => {
      if (!socket) {
        console.warn("[ArcadeSocket] Cannot send move - socket not connected");
        return;
      }
      socket.emit("game-move", { userId, move, roomId });
    },
    [socket],
  );

  const exitSession = useCallback(
    (userId: string) => {
      if (!socket) {
        console.warn(
          "[ArcadeSocket] Cannot exit session - socket not connected",
        );
        return;
      }
      console.log("[ArcadeSocket] Exiting session for user:", userId);
      socket.emit("exit-arcade-session", { userId });
    },
    [socket],
  );

  const pingSession = useCallback(
    (userId: string) => {
      if (!socket) return;
      socket.emit("ping-session", { userId });
    },
    [socket],
  );

  const sendCursorUpdate = useCallback(
    (
      roomId: string,
      playerId: string,
      userId: string,
      cursorPosition: { x: number; y: number } | null,
      hoveredRegionId: string | null,
    ) => {
      if (!socket) return;
      socket.emit("cursor-update", {
        roomId,
        playerId,
        userId,
        cursorPosition,
        hoveredRegionId,
      });
    },
    [socket],
  );

  return {
    socket,
    connected,
    joinSession,
    sendMove,
    exitSession,
    pingSession,
    sendCursorUpdate,
  };
}
