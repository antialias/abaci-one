/**
 * Unit test for player ownership bug in RoomMemoryPairsProvider
 *
 * Bug: playerMetadata[playerId].userId is set to the LOCAL viewerId for ALL players,
 * including remote players from other room members. This causes "Your turn" to show
 * even when it's a remote player's turn.
 *
 * Fix: Use player.isLocal from GameModeContext to determine correct userId ownership.
 */

import { describe, expect, it } from "vitest";

describe("Player Metadata userId Assignment", () => {
  it("should assign local userId to local players only", () => {
    const viewerId = "local-user-id";
    const players = new Map([
      [
        "local-player-1",
        {
          id: "local-player-1",
          name: "Local Player",
          emoji: "😀",
          color: "#3b82f6",
          isLocal: true,
        },
      ],
      [
        "remote-player-1",
        {
          id: "remote-player-1",
          name: "Remote Player",
          emoji: "🤠",
          color: "#10b981",
          isLocal: false,
        },
      ],
    ]);

    const activePlayers = ["local-player-1", "remote-player-1"];

    // CURRENT BUGGY IMPLEMENTATION (from RoomMemoryPairsProvider.tsx:378-390)
    const buggyPlayerMetadata: Record<string, any> = {};
    for (const playerId of activePlayers) {
      const playerData = players.get(playerId);
      if (playerData) {
        buggyPlayerMetadata[playerId] = {
          id: playerId,
          name: playerData.name,
          emoji: playerData.emoji,
          userId: viewerId, // BUG: Always uses local viewerId!
          color: playerData.color,
        };
      }
    }

    // BUG MANIFESTATION: Both players have local userId
    expect(buggyPlayerMetadata["local-player-1"].userId).toBe("local-user-id");
    expect(buggyPlayerMetadata["remote-player-1"].userId).toBe("local-user-id"); // WRONG!

    // CORRECT IMPLEMENTATION
    const correctPlayerMetadata: Record<string, any> = {};
    for (const playerId of activePlayers) {
      const playerData = players.get(playerId);
      if (playerData) {
        correctPlayerMetadata[playerId] = {
          id: playerId,
          name: playerData.name,
          emoji: playerData.emoji,
          // FIX: Only use local viewerId for local players
          // For remote players, we don't know their userId from this context,
          // but we can mark them as NOT belonging to local user
          userId: playerData.isLocal ? viewerId : `remote-user-${playerId}`,
          color: playerData.color,
          isLocal: playerData.isLocal, // Also include isLocal for clarity
        };
      }
    }

    // CORRECT BEHAVIOR: Each player has correct userId
    expect(correctPlayerMetadata["local-player-1"].userId).toBe(
      "local-user-id",
    );
    expect(correctPlayerMetadata["remote-player-1"].userId).not.toBe(
      "local-user-id",
    );
  });

  it('reproduces "Your turn" bug when checking current player', () => {
    const viewerId = "local-user-id";
    const currentPlayer = "remote-player-1"; // Remote player's turn

    // Buggy playerMetadata (all players have local userId)
    const buggyPlayerMetadata = {
      "local-player-1": {
        id: "local-player-1",
        userId: "local-user-id",
      },
      "remote-player-1": {
        id: "remote-player-1",
        userId: "local-user-id", // BUG!
      },
    };

    // PlayerStatusBar logic (line 31 in PlayerStatusBar.tsx)
    const buggyIsLocalPlayer =
      buggyPlayerMetadata[currentPlayer]?.userId === viewerId;

    // BUG: Shows "Your turn" even though it's remote player's turn!
    expect(buggyIsLocalPlayer).toBe(true); // WRONG!
    expect(buggyIsLocalPlayer ? "Your turn" : "Their turn").toBe("Your turn"); // WRONG!

    // Correct playerMetadata (each player has correct userId)
    const correctPlayerMetadata = {
      "local-player-1": {
        id: "local-player-1",
        userId: "local-user-id",
      },
      "remote-player-1": {
        id: "remote-player-1",
        userId: "remote-user-id", // CORRECT!
      },
    };

    // PlayerStatusBar logic with correct data
    const correctIsLocalPlayer =
      correctPlayerMetadata[currentPlayer]?.userId === viewerId;

    // CORRECT: Shows "Their turn" because it's remote player's turn
    expect(correctIsLocalPlayer).toBe(false); // CORRECT!
    expect(correctIsLocalPlayer ? "Your turn" : "Their turn").toBe(
      "Their turn",
    ); // CORRECT!
  });

  it("reproduces hover avatar bug when filtering by current player", () => {
    const viewerId = "local-user-id";
    const currentPlayer = "remote-player-1"; // Remote player's turn

    // Buggy playerMetadata
    const buggyPlayerMetadata = {
      "remote-player-1": {
        id: "remote-player-1",
        userId: "local-user-id", // BUG!
      },
    };

    // OLD WRONG logic from MemoryGrid.tsx (showed remote players)
    const oldWrongFilter =
      buggyPlayerMetadata[currentPlayer]?.userId !== viewerId;
    expect(oldWrongFilter).toBe(false); // Would hide avatar incorrectly

    // CURRENT logic in MemoryGrid.tsx (shows only current player)
    // This is actually correct - show avatar for whoever's turn it is
    const currentLogic = currentPlayer === "remote-player-1";
    expect(currentLogic).toBe(true); // Shows avatar for current player

    // The REAL issue is in PlayerStatusBar showing "Your turn"
    // when it should show "Their turn"
  });
});
