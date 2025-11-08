"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type * as Y from "yjs";
import { useArcadeSession } from "@/hooks/useArcadeSession";
import { useArcadeSocket } from "@/hooks/useArcadeSocket";
import { useGameMode } from "@/contexts/GameModeContext";
import { useRoomData } from "@/hooks/useRoomData";
import { useViewerId } from "@/hooks/useViewerId";
import type { GridCell, YjsDemoState } from "./types";

interface YjsDemoContextValue {
  state: YjsDemoState;
  yjsState: {
    cells: Y.Array<GridCell> | null;
    awareness: any;
  };
  addCell: (x: number, y: number) => void;
  startGame: () => void;
  endGame: () => void;
  goToSetup: () => void;
  exitSession: () => void;
  lastError: string | null;
  clearError: () => void;
}

const YjsDemoContext = createContext<YjsDemoContextValue | null>(null);

export function useYjsDemo() {
  const context = useContext(YjsDemoContext);
  if (!context) {
    throw new Error("useYjsDemo must be used within YjsDemoProvider");
  }
  return context;
}

export function YjsDemoProvider({ children }: { children: React.ReactNode }) {
  const { data: viewerId } = useViewerId();
  const { roomData } = useRoomData();
  const { activePlayers: activePlayerIds } = useGameMode();
  const [forceUpdate, setForceUpdate] = useState(0);

  // Initial state for arcade session
  const initialState: YjsDemoState = {
    gamePhase: "setup",
    gridSize: 8,
    duration: 60,
    activePlayers: [],
    playerScores: {},
  };

  // Use arcade session for phase transitions
  const { state, sendMove, exitSession, lastError, clearError } =
    useArcadeSession<YjsDemoState>({
      userId: viewerId || "",
      roomId: roomData?.id,
      initialState,
      applyMove: (currentState) => currentState, // Server handles state
    });

  // Yjs setup - Socket.IO based sync
  const docRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<any>(null);
  const cellsRef = useRef<Y.Array<GridCell> | null>(null);

  // Get socket from arcade socket hook
  const { socket } = useArcadeSocket();

  useEffect(() => {
    if (!roomData?.id || !socket) return;

    let doc: Y.Doc;
    let awareness: any;
    let cells: Y.Array<GridCell>;

    // Dynamic import to avoid loading Yjs in server bundle
    const initYjs = async () => {
      const Y = await import("yjs");
      const awarenessProtocol = await import("y-protocols/awareness");
      const syncProtocol = await import("y-protocols/sync");
      const encoding = await import("lib0/encoding");
      const decoding = await import("lib0/decoding");

      doc = new Y.Doc();
      docRef.current = doc;

      // Create awareness
      awareness = new awarenessProtocol.Awareness(doc);
      awarenessRef.current = awareness;

      cells = doc.getArray<GridCell>("cells");
      cellsRef.current = cells;

      // Listen for changes in cells array to trigger re-renders
      const observer = () => {
        setForceUpdate((n) => n + 1);
      };
      cells.observe(observer);

      // Set up Socket.IO handlers for Yjs sync

      // Handle incoming sync/update messages from server
      const handleYjsMessage = (data: number[]) => {
        const message = new Uint8Array(data);
        const decoder = decoding.createDecoder(message);
        const messageType = decoding.readVarUint(decoder);

        if (messageType === 0) {
          // Sync protocol message (sync step or update)
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, 0);
          syncProtocol.readSyncMessage(decoder, encoder, doc, socket.id);

          // Send response if there's content
          if (encoding.length(encoder) > 1) {
            socket.emit(
              "yjs-update",
              Array.from(encoding.toUint8Array(encoder)),
            );
          }
        }
      };

      // Handle incoming awareness updates
      const handleYjsAwareness = (data: number[]) => {
        const message = new Uint8Array(data);
        const decoder = decoding.createDecoder(message);
        const messageType = decoding.readVarUint(decoder);

        if (messageType === 0) {
          // Read the awareness update from the message
          const awarenessUpdate = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(
            awareness,
            awarenessUpdate,
            socket.id,
          );
        }
      };

      // Register Socket.IO event handlers
      // Both sync and update events use the same handler since readSyncMessage handles both
      socket.on("yjs-sync", handleYjsMessage);
      socket.on("yjs-update", handleYjsMessage);
      socket.on("yjs-awareness", handleYjsAwareness);

      // Send updates to server when document changes
      const updateHandler = (update: Uint8Array, origin: any) => {
        // Don't send updates that came from the server
        if (origin === socket.id) return;

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 0); // Message type: sync
        syncProtocol.writeUpdate(encoder, update);
        const message = encoding.toUint8Array(encoder);

        socket.emit("yjs-update", Array.from(message));
      };
      doc.on("update", updateHandler);

      // Send awareness updates to server
      const awarenessUpdateHandler = ({ added, updated, removed }: any) => {
        const changedClients = added.concat(updated).concat(removed);
        const update = awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          changedClients,
        );
        socket.emit("yjs-awareness", Array.from(update));
      };
      awareness.on("update", awarenessUpdateHandler);

      // Set local awareness state
      if (viewerId) {
        awareness.setLocalStateField("user", {
          id: viewerId,
          timestamp: Date.now(),
        });
      }

      // Join the Yjs room
      console.log("[YjsDemo] Joining Yjs room:", roomData.id);
      socket.emit("yjs-join", roomData.id);

      // Cleanup function stored for later
      return () => {
        socket.off("yjs-sync", handleYjsMessage);
        socket.off("yjs-update", handleYjsMessage);
        socket.off("yjs-awareness", handleYjsAwareness);
        doc.off("update", updateHandler);
        awareness.off("update", awarenessUpdateHandler);
      };
    };

    let cleanup: (() => void) | undefined;

    void initYjs().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
      if (awarenessRef.current) {
        awarenessRef.current.setLocalState(null);
        awarenessRef.current.destroy();
      }
      if (docRef.current) {
        docRef.current.destroy();
      }
      docRef.current = null;
      awarenessRef.current = null;
      cellsRef.current = null;
    };
  }, [roomData?.id, viewerId, socket]);

  // Player colors
  const playerColors = useMemo(() => {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#FFA07A",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E2",
    ];
    const playerList = Array.from(activePlayerIds);
    const colorMap: Record<string, string> = {};
    for (let i = 0; i < playerList.length; i++) {
      colorMap[playerList[i]] = colors[i % colors.length];
    }
    return colorMap;
  }, [activePlayerIds]);

  // Actions
  const addCell = useCallback(
    (x: number, y: number) => {
      if (!cellsRef.current || !viewerId || !docRef.current) return;
      if (state.gamePhase !== "playing") return;

      const cell: GridCell = {
        id: `${viewerId}-${Date.now()}`,
        x,
        y,
        playerId: viewerId,
        timestamp: Date.now(),
        color: playerColors[viewerId] || "#999999",
      };

      docRef.current.transact(() => {
        cellsRef.current?.push([cell]);
      });

      // Update score in local state (this would be synced via Yjs in a real impl)
      // For now, we're just showing the concept
    },
    [viewerId, state.gamePhase, playerColors],
  );

  const startGame = useCallback(() => {
    const players = Array.from(activePlayerIds);
    sendMove({
      type: "START_GAME",
      playerId: players[0] || viewerId || "",
      userId: viewerId || "",
      data: { activePlayers: players },
    });
  }, [activePlayerIds, viewerId, sendMove]);

  const endGame = useCallback(() => {
    sendMove({
      type: "END_GAME",
      playerId: viewerId || "",
      userId: viewerId || "",
      data: {},
    });
  }, [viewerId, sendMove]);

  const goToSetup = useCallback(() => {
    sendMove({
      type: "GO_TO_SETUP",
      playerId: viewerId || "",
      userId: viewerId || "",
      data: {},
    });
  }, [viewerId, sendMove]);

  const yjsState = {
    cells: cellsRef.current,
    awareness: awarenessRef.current || null,
  };

  return (
    <YjsDemoContext.Provider
      value={{
        state,
        yjsState,
        addCell,
        startGame,
        endGame,
        goToSetup,
        exitSession,
        lastError,
        clearError,
      }}
    >
      {children}
    </YjsDemoContext.Provider>
  );
}
