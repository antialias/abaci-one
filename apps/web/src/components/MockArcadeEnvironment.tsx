"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { Player } from "@/contexts/GameModeContext";
import type { GameMove } from "@/lib/arcade/validation";
import type { RetryState } from "@/lib/arcade/error-handling";

// ============================================================================
// Mock ViewerId Context
// ============================================================================

const MockViewerIdContext = createContext<string>("demo-viewer-id");

export function useMockViewerId() {
  return useContext(MockViewerIdContext);
}

// ============================================================================
// Mock Room Data Context
// ============================================================================

interface MockRoomData {
  id: string;
  name: string;
  code: string;
  gameName: string;
  gameConfig: Record<string, unknown>;
}

const MockRoomDataContext = createContext<MockRoomData | null>(null);

export function useMockRoomData() {
  const room = useContext(MockRoomDataContext);
  if (!room)
    throw new Error("useMockRoomData must be used within MockRoomDataProvider");
  return room;
}

export function useMockUpdateGameConfig() {
  return useCallback((config: Record<string, unknown>) => {
    // Mock: do nothing in preview mode
    console.log("Mock updateGameConfig:", config);
  }, []);
}

// ============================================================================
// Mock Game Mode Context
// ============================================================================

type GameMode = "single" | "battle" | "tournament";

interface GameModeContextType {
  gameMode: GameMode;
  players: Map<string, Player>;
  activePlayers: Set<string>;
  activePlayerCount: number;
  addPlayer: (player?: Partial<Player>) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  removePlayer: (id: string) => void;
  setActive: (id: string, active: boolean) => void;
  getActivePlayers: () => Player[];
  getPlayer: (id: string) => Player | undefined;
  getAllPlayers: () => Player[];
  resetPlayers: () => void;
  isLoading: boolean;
}

const MockGameModeContextValue = createContext<GameModeContextType | null>(
  null,
);

export function useMockGameMode() {
  const ctx = useContext(MockGameModeContextValue);
  if (!ctx)
    throw new Error("useMockGameMode must be used within MockGameModeProvider");
  return ctx;
}

// ============================================================================
// Mock Arcade Session
// ============================================================================

interface MockArcadeSessionReturn<TState> {
  state: TState;
  version: number;
  connected: boolean;
  hasPendingMoves: boolean;
  lastError: string | null;
  retryState: RetryState;
  sendMove: (move: Omit<GameMove, "timestamp">) => void;
  exitSession: () => void;
  clearError: () => void;
  refresh: () => void;
}

export function createMockArcadeSession<TState>(
  initialState: TState,
): MockArcadeSessionReturn<TState> {
  const mockRetryState: RetryState = {
    isRetrying: false,
    retryCount: 0,
    move: null,
    timestamp: null,
  };

  return {
    state: initialState,
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
  };
}

// ============================================================================
// Mock Environment Provider
// ============================================================================

interface MockArcadeEnvironmentProps {
  children: ReactNode;
  gameName: string;
  gameConfig?: Record<string, unknown>;
}

export function MockArcadeEnvironment({
  children,
  gameName,
  gameConfig = {},
}: MockArcadeEnvironmentProps) {
  const mockPlayers = useMemo(
    (): Player[] => [
      {
        id: "demo-player-1",
        name: "Demo Player",
        emoji: "🎮",
        color: "#3b82f6",
        createdAt: Date.now(),
      },
    ],
    [],
  );

  const playersMap = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of mockPlayers) {
      map.set(p.id, p);
    }
    return map;
  }, [mockPlayers]);

  const activePlayers = useMemo(
    () => new Set(mockPlayers.map((p) => p.id)),
    [mockPlayers],
  );

  const mockGameModeCtx: GameModeContextType = useMemo(
    () => ({
      gameMode: "single",
      players: playersMap,
      activePlayers,
      activePlayerCount: activePlayers.size,
      addPlayer: () => {
        // Mock: do nothing
      },
      updatePlayer: () => {
        // Mock: do nothing
      },
      removePlayer: () => {
        // Mock: do nothing
      },
      setActive: () => {
        // Mock: do nothing
      },
      getActivePlayers: () => mockPlayers,
      getPlayer: (id: string) => playersMap.get(id),
      getAllPlayers: () => mockPlayers,
      resetPlayers: () => {
        // Mock: do nothing
      },
      isLoading: false,
    }),
    [mockPlayers, playersMap, activePlayers],
  );

  const mockRoomData: MockRoomData = useMemo(
    () => ({
      id: `demo-room-${gameName}`,
      name: "Demo Room",
      code: "DEMO",
      gameName,
      gameConfig,
    }),
    [gameName, gameConfig],
  );

  return (
    <MockViewerIdContext.Provider value="demo-viewer-id">
      <MockRoomDataContext.Provider value={mockRoomData}>
        <MockGameModeContextValue.Provider value={mockGameModeCtx}>
          {children}
        </MockGameModeContextValue.Provider>
      </MockRoomDataContext.Provider>
    </MockViewerIdContext.Provider>
  );
}
