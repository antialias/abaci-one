"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useGameMode } from "@/contexts/GameModeContext";
import {
  TEAM_MOVE,
  useArcadeSession,
  useRoomData,
  useUpdateGameConfig,
  useViewerId,
} from "@/lib/arcade/game-sdk";
import type {
  AmbushContext,
  Color,
  HarmonyType,
  RelationKind,
  RithmomachiaConfig,
  RithmomachiaState,
} from "./types";
import { useToast } from "@/components/common/ToastContext";
import {
  parseError,
  shouldShowToast,
  getToastType,
  getMoveActionName,
  type EnhancedError,
  type RetryState,
} from "@/lib/arcade/error-handling";

/**
 * Context value for Rithmomachia game.
 */
export type RithmomachiaRosterStatus =
  | { status: "ok"; activePlayerCount: number; localPlayerCount: number }
  | {
      status: "tooFew";
      activePlayerCount: number;
      localPlayerCount: number;
      missingWhite: boolean;
      missingBlack: boolean;
    }
  | {
      status: "noLocalControl";
      activePlayerCount: number;
      localPlayerCount: number;
    };

interface RithmomachiaContextValue {
  // State
  state: RithmomachiaState;
  lastError: string | null;
  retryState: RetryState;

  // Player info
  viewerId: string | null;
  playerColor: Color | null;
  isMyTurn: boolean;
  rosterStatus: RithmomachiaRosterStatus;
  localActivePlayerIds: string[];
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  localTurnPlayerId: string | null;
  isSpectating: boolean;
  localPlayerColor: Color | null;

  // Game actions
  startGame: () => void;
  makeMove: (
    from: string,
    to: string,
    pieceId: string,
    pyramidFace?: number,
    capture?: CaptureData,
    ambush?: AmbushContext,
  ) => void;
  declareHarmony: (
    pieceIds: string[],
    harmonyType: HarmonyType,
    params: Record<string, string>,
  ) => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  claimRepetition: () => void;
  claimFiftyMove: () => void;

  // Config actions
  setConfig: (field: keyof RithmomachiaConfig, value: any) => void;

  // Player assignment actions
  assignWhitePlayer: (playerId: string | null) => void;
  assignBlackPlayer: (playerId: string | null) => void;
  swapSides: () => void;

  // Game control actions
  resetGame: () => void;
  goToSetup: () => void;
  exitSession: () => void;

  // Error handling
  clearError: () => void;
}

interface CaptureData {
  relation: RelationKind;
  targetPieceId: string;
  helperPieceId?: string;
}

const RithmomachiaContext = createContext<RithmomachiaContextValue | null>(
  null,
);

/**
 * Hook to access Rithmomachia game context.
 */
export function useRithmomachia(): RithmomachiaContextValue {
  const context = useContext(RithmomachiaContext);
  if (!context) {
    throw new Error("useRithmomachia must be used within RithmomachiaProvider");
  }
  return context;
}

/**
 * Provider for Rithmomachia game state and actions.
 */
export function RithmomachiaProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useViewerId();
  const { roomData } = useRoomData();
  const { activePlayers: activePlayerIds, players } = useGameMode();
  const { mutate: updateGameConfig } = useUpdateGameConfig();
  const { showToast } = useToast();

  const activePlayerList = useMemo(
    () => Array.from(activePlayerIds),
    [activePlayerIds],
  );

  const localActivePlayerIds = useMemo(
    () =>
      activePlayerList.filter((id) => {
        const player = players.get(id);
        return player?.isLocal !== false;
      }),
    [activePlayerList, players],
  );

  // Merge saved config from room data
  const mergedInitialState = useMemo(() => {
    const gameConfig = roomData?.gameConfig as Record<string, unknown> | null;
    const savedConfig = gameConfig?.rithmomachia as
      | Partial<RithmomachiaConfig>
      | undefined;

    // Use validator to create initial state with config
    const config: RithmomachiaConfig = {
      pointWinEnabled: savedConfig?.pointWinEnabled ?? false,
      pointWinThreshold: savedConfig?.pointWinThreshold ?? 30,
      repetitionRule: savedConfig?.repetitionRule ?? true,
      fiftyMoveRule: savedConfig?.fiftyMoveRule ?? true,
      allowAnySetOnRecheck: savedConfig?.allowAnySetOnRecheck ?? true,
      timeControlMs: savedConfig?.timeControlMs ?? null,
      whitePlayerId: savedConfig?.whitePlayerId ?? null,
      blackPlayerId: savedConfig?.blackPlayerId ?? null,
    };

    // Import validator dynamically to get initial state
    return {
      ...require("./Validator").rithmomachiaValidator.getInitialState(config),
    };
  }, [roomData?.gameConfig]);

  // Use arcade session hook
  const { state, sendMove, lastError, clearError, retryState } =
    useArcadeSession<RithmomachiaState>({
      userId: viewerId || "",
      roomId: roomData?.id,
      initialState: mergedInitialState,
      applyMove: (state) => state, // No optimistic updates for v1 - rely on server validation
    });

  // Get player assignments from config (with fallback to auto-assignment)
  const whitePlayerId = useMemo(() => {
    const configWhite = state.whitePlayerId;
    // If explicitly set in config and still valid, use it
    if (configWhite !== undefined && configWhite !== null) {
      return activePlayerList.includes(configWhite) ? configWhite : null;
    }
    // Fallback to auto-assignment: first active player
    return activePlayerList[0] ?? null;
  }, [state.whitePlayerId, activePlayerList]);

  const blackPlayerId = useMemo(() => {
    const configBlack = state.blackPlayerId;
    // If explicitly set in config and still valid, use it
    if (configBlack !== undefined && configBlack !== null) {
      return activePlayerList.includes(configBlack) ? configBlack : null;
    }
    // Fallback to auto-assignment: second active player
    return activePlayerList[1] ?? null;
  }, [state.blackPlayerId, activePlayerList]);

  // Compute roster status based on white/black assignments (not player count)
  const rosterStatus = useMemo<RithmomachiaRosterStatus>(() => {
    const activeCount = activePlayerList.length;
    const localCount = localActivePlayerIds.length;

    // Check if white and black are assigned
    const hasWhitePlayer = whitePlayerId !== null;
    const hasBlackPlayer = blackPlayerId !== null;

    // Status is 'tooFew' only if white or black is missing
    if (!hasWhitePlayer || !hasBlackPlayer) {
      return {
        status: "tooFew",
        activePlayerCount: activeCount,
        localPlayerCount: localCount,
        missingWhite: !hasWhitePlayer,
        missingBlack: !hasBlackPlayer,
      };
    }

    // Check if current user has control over either white or black
    const localControlsWhite = localActivePlayerIds.includes(whitePlayerId);
    const localControlsBlack = localActivePlayerIds.includes(blackPlayerId);

    if (!localControlsWhite && !localControlsBlack) {
      return {
        status: "noLocalControl", // Observer mode
        activePlayerCount: activeCount,
        localPlayerCount: localCount,
      };
    }

    // All good - white and black assigned, and user controls at least one
    return {
      status: "ok",
      activePlayerCount: activeCount,
      localPlayerCount: localCount,
    };
  }, [
    activePlayerList.length,
    localActivePlayerIds,
    whitePlayerId,
    blackPlayerId,
  ]);

  const localTurnPlayerId = useMemo(() => {
    const currentId = state.turn === "W" ? whitePlayerId : blackPlayerId;
    if (!currentId) return null;
    return localActivePlayerIds.includes(currentId) ? currentId : null;
  }, [state.turn, whitePlayerId, blackPlayerId, localActivePlayerIds]);

  const playerColor = useMemo((): Color | null => {
    if (localTurnPlayerId) {
      return state.turn;
    }

    if (localActivePlayerIds.length === 1) {
      const soleLocalId = localActivePlayerIds[0];
      if (soleLocalId === whitePlayerId) return "W";
      if (soleLocalId === blackPlayerId) return "B";
    }

    return null;
  }, [
    localTurnPlayerId,
    localActivePlayerIds,
    whitePlayerId,
    blackPlayerId,
    state.turn,
  ]);

  // Check if it's my turn
  const isMyTurn = useMemo(() => {
    if (rosterStatus.status !== "ok") return false;
    return localTurnPlayerId !== null;
  }, [rosterStatus.status, localTurnPlayerId]);

  // Action: Start game
  const startGame = useCallback(() => {
    // Block observers from starting game
    const localColor =
      whitePlayerId && localActivePlayerIds.includes(whitePlayerId)
        ? "W"
        : blackPlayerId && localActivePlayerIds.includes(blackPlayerId)
          ? "B"
          : null;
    if (!localColor) return;

    if (!viewerId || !localTurnPlayerId) return;

    sendMove({
      type: "START_GAME",
      playerId: localTurnPlayerId,
      userId: viewerId,
      data: {
        playerColor: playerColor || "W",
        activePlayers: activePlayerList,
      },
    });
  }, [
    sendMove,
    viewerId,
    localTurnPlayerId,
    playerColor,
    activePlayerList,
    whitePlayerId,
    blackPlayerId,
    localActivePlayerIds,
  ]);

  // Action: Make a move
  const makeMove = useCallback(
    (
      from: string,
      to: string,
      pieceId: string,
      pyramidFace?: number,
      capture?: CaptureData,
      ambush?: AmbushContext,
    ) => {
      // Block observers from making moves
      const localColor =
        whitePlayerId && localActivePlayerIds.includes(whitePlayerId)
          ? "W"
          : blackPlayerId && localActivePlayerIds.includes(blackPlayerId)
            ? "B"
            : null;
      if (!localColor) return;

      if (!viewerId || !localTurnPlayerId) return;

      sendMove({
        type: "MOVE",
        playerId: localTurnPlayerId,
        userId: viewerId,
        data: {
          from,
          to,
          pieceId,
          pyramidFaceUsed: pyramidFace ?? null,
          capture: capture
            ? {
                relation: capture.relation,
                targetPieceId: capture.targetPieceId,
                helperPieceId: capture.helperPieceId,
              }
            : undefined,
          ambush,
        },
      });
    },
    [
      sendMove,
      viewerId,
      localTurnPlayerId,
      whitePlayerId,
      blackPlayerId,
      localActivePlayerIds,
    ],
  );

  // Action: Declare harmony
  const declareHarmony = useCallback(
    (
      pieceIds: string[],
      harmonyType: HarmonyType,
      params: Record<string, string>,
    ) => {
      // Block observers from declaring harmony
      const localColor =
        whitePlayerId && localActivePlayerIds.includes(whitePlayerId)
          ? "W"
          : blackPlayerId && localActivePlayerIds.includes(blackPlayerId)
            ? "B"
            : null;
      if (!localColor) return;

      if (!viewerId || !localTurnPlayerId) return;

      sendMove({
        type: "DECLARE_HARMONY",
        playerId: localTurnPlayerId,
        userId: viewerId,
        data: {
          pieceIds,
          harmonyType,
          params,
        },
      });
    },
    [
      sendMove,
      viewerId,
      localTurnPlayerId,
      whitePlayerId,
      blackPlayerId,
      localActivePlayerIds,
    ],
  );

  // Action: Resign
  const resign = useCallback(() => {
    // Block observers from resigning
    const localColor =
      whitePlayerId && localActivePlayerIds.includes(whitePlayerId)
        ? "W"
        : blackPlayerId && localActivePlayerIds.includes(blackPlayerId)
          ? "B"
          : null;
    if (!localColor) return;

    if (!viewerId || !localTurnPlayerId) return;

    sendMove({
      type: "RESIGN",
      playerId: localTurnPlayerId,
      userId: viewerId,
      data: {},
    });
  }, [
    sendMove,
    viewerId,
    localTurnPlayerId,
    whitePlayerId,
    blackPlayerId,
    localActivePlayerIds,
  ]);

  // Action: Offer draw
  const offerDraw = useCallback(() => {
    // Block observers from offering draw
    const localColor =
      whitePlayerId && localActivePlayerIds.includes(whitePlayerId)
        ? "W"
        : blackPlayerId && localActivePlayerIds.includes(blackPlayerId)
          ? "B"
          : null;
    if (!localColor) return;

    if (!viewerId || !localTurnPlayerId) return;

    sendMove({
      type: "OFFER_DRAW",
      playerId: localTurnPlayerId,
      userId: viewerId,
      data: {},
    });
  }, [
    sendMove,
    viewerId,
    localTurnPlayerId,
    whitePlayerId,
    blackPlayerId,
    localActivePlayerIds,
  ]);

  // Action: Accept draw
  const acceptDraw = useCallback(() => {
    // Block observers from accepting draw
    const localColor =
      whitePlayerId && localActivePlayerIds.includes(whitePlayerId)
        ? "W"
        : blackPlayerId && localActivePlayerIds.includes(blackPlayerId)
          ? "B"
          : null;
    if (!localColor) return;

    if (!viewerId || !localTurnPlayerId) return;

    sendMove({
      type: "ACCEPT_DRAW",
      playerId: localTurnPlayerId,
      userId: viewerId,
      data: {},
    });
  }, [
    sendMove,
    viewerId,
    localTurnPlayerId,
    whitePlayerId,
    blackPlayerId,
    localActivePlayerIds,
  ]);

  // Action: Claim repetition
  const claimRepetition = useCallback(() => {
    // Block observers from claiming repetition
    const localColor =
      whitePlayerId && localActivePlayerIds.includes(whitePlayerId)
        ? "W"
        : blackPlayerId && localActivePlayerIds.includes(blackPlayerId)
          ? "B"
          : null;
    if (!localColor) return;

    if (!viewerId || !localTurnPlayerId) return;

    sendMove({
      type: "CLAIM_REPETITION",
      playerId: localTurnPlayerId,
      userId: viewerId,
      data: {},
    });
  }, [
    sendMove,
    viewerId,
    localTurnPlayerId,
    whitePlayerId,
    blackPlayerId,
    localActivePlayerIds,
  ]);

  // Action: Claim fifty-move rule
  const claimFiftyMove = useCallback(() => {
    // Block observers from claiming fifty-move
    const localColor =
      whitePlayerId && localActivePlayerIds.includes(whitePlayerId)
        ? "W"
        : blackPlayerId && localActivePlayerIds.includes(blackPlayerId)
          ? "B"
          : null;
    if (!localColor) return;

    if (!viewerId || !localTurnPlayerId) return;

    sendMove({
      type: "CLAIM_FIFTY_MOVE",
      playerId: localTurnPlayerId,
      userId: viewerId,
      data: {},
    });
  }, [
    sendMove,
    viewerId,
    localTurnPlayerId,
    whitePlayerId,
    blackPlayerId,
    localActivePlayerIds,
  ]);

  // Action: Set config
  const setConfig = useCallback(
    (field: keyof RithmomachiaConfig, value: any) => {
      // During gameplay, restrict config changes
      if (state.gamePhase === "playing") {
        // Allow host to change player assignments at any time
        const isHost = roomData?.members.some(
          (m) => m.userId === viewerId && m.isCreator,
        );
        const isPlayerAssignment =
          field === "whitePlayerId" || field === "blackPlayerId";

        if (isPlayerAssignment && isHost) {
          // Host can always reassign players
        } else {
          // Other config changes require being an active player
          const localColor =
            whitePlayerId && localActivePlayerIds.includes(whitePlayerId)
              ? "W"
              : blackPlayerId && localActivePlayerIds.includes(blackPlayerId)
                ? "B"
                : null;
          if (!localColor) return;
        }
      }

      // Send move to update state immediately
      sendMove({
        type: "SET_CONFIG",
        playerId: TEAM_MOVE,
        userId: viewerId || "",
        data: { field, value },
      });

      // Persist to database (room mode only)
      if (roomData?.id) {
        const currentGameConfig =
          (roomData.gameConfig as Record<string, any>) || {};
        const currentConfig =
          (currentGameConfig.rithmomachia as Record<string, any>) || {};

        updateGameConfig(
          {
            roomId: roomData.id,
            gameConfig: {
              ...currentGameConfig,
              rithmomachia: {
                ...currentConfig,
                [field]: value,
              },
            },
          },
          {
            onError: (error) => {
              console.error(
                "[Rithmomachia] Failed to update game config:",
                error,
              );
              // Surface 403 errors specifically
              if (error.message.includes("Only the host can change")) {
                console.warn(
                  "[Rithmomachia] 403 Forbidden: Only host can change room settings",
                );
                // The error will be visible in console - in the future, we could add toast notifications
              }
            },
          },
        );
      }
    },
    [
      viewerId,
      sendMove,
      roomData,
      updateGameConfig,
      state.gamePhase,
      whitePlayerId,
      blackPlayerId,
      localActivePlayerIds,
    ],
  );

  // Action: Reset game (start new game with same config)
  const resetGame = useCallback(() => {
    if (!viewerId) return;

    sendMove({
      type: "RESET_GAME",
      playerId: TEAM_MOVE,
      userId: viewerId,
      data: {},
    });
  }, [sendMove, viewerId]);

  // Action: Go to setup (return to setup phase)
  const goToSetup = useCallback(() => {
    if (!viewerId) return;

    sendMove({
      type: "GO_TO_SETUP",
      playerId: TEAM_MOVE,
      userId: viewerId,
      data: {},
    });
  }, [sendMove, viewerId]);

  // Action: Exit session (no-op for now, handled by PageWithNav)
  const exitSession = useCallback(() => {
    // PageWithNav handles the actual navigation
    // This is here for API compatibility
  }, []);

  // Action: Assign white player
  const assignWhitePlayer = useCallback(
    (playerId: string | null) => {
      setConfig("whitePlayerId", playerId);
    },
    [setConfig],
  );

  // Action: Assign black player
  const assignBlackPlayer = useCallback(
    (playerId: string | null) => {
      setConfig("blackPlayerId", playerId);
    },
    [setConfig],
  );

  // Action: Swap white and black assignments
  const swapSides = useCallback(() => {
    const currentWhite = whitePlayerId;
    const currentBlack = blackPlayerId;
    setConfig("whitePlayerId", currentBlack);
    setConfig("blackPlayerId", currentWhite);
  }, [whitePlayerId, blackPlayerId, setConfig]);

  // Observer detection
  const isSpectating = useMemo(() => {
    return rosterStatus.status === "noLocalControl";
  }, [rosterStatus.status]);

  const localPlayerColor = useMemo<Color | null>(() => {
    if (!whitePlayerId || !blackPlayerId) return null;
    if (localActivePlayerIds.includes(whitePlayerId)) return "W";
    if (localActivePlayerIds.includes(blackPlayerId)) return "B";
    return null;
  }, [localActivePlayerIds, whitePlayerId, blackPlayerId]);

  // Auto-assign players when they join and a color is missing
  useEffect(() => {
    // Only auto-assign if we have active players
    if (activePlayerList.length === 0) return;

    // Check if we're missing white or black
    const missingWhite = !whitePlayerId;
    const missingBlack = !blackPlayerId;

    // Only auto-assign if at least one color is missing
    if (!missingWhite && !missingBlack) return;

    if (missingWhite && missingBlack) {
      // Both missing - auto-assign first two players
      if (activePlayerList.length >= 2) {
        // Assign both at once to avoid double render
        setConfig("whitePlayerId", activePlayerList[0]);
        // Use setTimeout to batch the second assignment
        setTimeout(() => setConfig("blackPlayerId", activePlayerList[1]), 0);
      } else if (activePlayerList.length === 1) {
        // Only one player - assign to white by default
        setConfig("whitePlayerId", activePlayerList[0]);
      }
      return;
    }

    // One color is missing - find an unassigned player
    const assignedPlayers = [whitePlayerId, blackPlayerId].filter(
      Boolean,
    ) as string[];
    const unassignedPlayer = activePlayerList.find(
      (id) => !assignedPlayers.includes(id),
    );

    if (unassignedPlayer) {
      if (missingWhite) {
        setConfig("whitePlayerId", unassignedPlayer);
      } else {
        setConfig("blackPlayerId", unassignedPlayer);
      }
    }
  }, [activePlayerList, whitePlayerId, blackPlayerId]);
  // Note: setConfig is intentionally NOT in dependencies to avoid infinite loop
  // setConfig is stable (defined with useCallback) so this is safe

  // Toast notifications for errors
  useEffect(() => {
    if (!lastError) return;

    // Parse the error to get enhanced information
    const enhancedError: EnhancedError = parseError(
      lastError,
      retryState.move ?? undefined,
      retryState.retryCount,
    );

    // Show toast if appropriate
    if (shouldShowToast(enhancedError)) {
      const toastType = getToastType(enhancedError.severity);
      const actionName = retryState.move
        ? getMoveActionName(retryState.move)
        : "performing action";

      showToast({
        type: toastType,
        title: enhancedError.userMessage,
        description: enhancedError.suggestion
          ? `${enhancedError.suggestion} (${actionName})`
          : `Error while ${actionName}`,
        duration: enhancedError.severity === "fatal" ? 10000 : 7000,
      });
    }
  }, [lastError, retryState, showToast]);

  // Toast for retry state changes (progressive feedback)
  useEffect(() => {
    if (!retryState.isRetrying || !retryState.move) return;

    // Parse the error as a version conflict
    const enhancedError: EnhancedError = parseError(
      "version conflict",
      retryState.move,
      retryState.retryCount,
    );

    // Show toast for 3+ retries (progressive disclosure)
    if (retryState.retryCount >= 3 && shouldShowToast(enhancedError)) {
      const actionName = getMoveActionName(retryState.move);
      showToast({
        type: "info",
        title: enhancedError.userMessage,
        description: `Retrying ${actionName}... (attempt ${retryState.retryCount})`,
        duration: 3000,
      });
    }
  }, [retryState, showToast]);

  const value: RithmomachiaContextValue = {
    state,
    lastError,
    retryState,
    viewerId: viewerId ?? null,
    playerColor,
    isMyTurn,
    rosterStatus,
    localActivePlayerIds,
    whitePlayerId,
    blackPlayerId,
    localTurnPlayerId,
    isSpectating,
    localPlayerColor,
    startGame,
    makeMove,
    declareHarmony,
    resign,
    offerDraw,
    acceptDraw,
    claimRepetition,
    claimFiftyMove,
    setConfig,
    assignWhitePlayer,
    assignBlackPlayer,
    swapSides,
    resetGame,
    goToSetup,
    exitSession,
    clearError,
  };

  return (
    <RithmomachiaContext.Provider value={value}>
      {children}
    </RithmomachiaContext.Provider>
  );
}
