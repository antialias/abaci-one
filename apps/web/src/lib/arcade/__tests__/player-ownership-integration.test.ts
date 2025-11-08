/**
 * Integration tests for player ownership in multiplayer scenarios
 *
 * These tests verify that ownership logic works correctly across
 * the full stack: database → utilities → client state
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { RoomData } from "@/hooks/useRoomData";
import {
  buildPlayerMetadata,
  buildPlayerOwnershipFromRoomData,
  filterPlayersByOwner,
  getPlayerOwner,
  getUniqueOwners,
  groupPlayersByOwner,
  isPlayerOwnedByUser,
  type PlayerOwnershipMap,
} from "../player-ownership";

describe("Player Ownership Integration Tests", () => {
  // Simulate a real multiplayer room scenario
  let mockRoomData: RoomData;
  let playerIds: string[];
  let playersMap: Map<string, { name: string; emoji: string; color: string }>;

  beforeEach(() => {
    // Setup: 3 users in a room, each with different number of players
    mockRoomData = {
      id: "room-integration-test",
      name: "Test Multiplayer Room",
      code: "TEST",
      gameName: "memory-pairs",
      members: [
        {
          id: "member-1",
          userId: "user-alice",
          displayName: "Alice",
          isOnline: true,
          isCreator: true,
        },
        {
          id: "member-2",
          userId: "user-bob",
          displayName: "Bob",
          isOnline: true,
          isCreator: false,
        },
        {
          id: "member-3",
          userId: "user-charlie",
          displayName: "Charlie",
          isOnline: true,
          isCreator: false,
        },
      ],
      memberPlayers: {
        "user-alice": [
          { id: "player-a1", name: "Alice P1", emoji: "🐶", color: "#ff0000" },
          { id: "player-a2", name: "Alice P2", emoji: "🐱", color: "#ff4444" },
        ],
        "user-bob": [
          { id: "player-b1", name: "Bob P1", emoji: "🐭", color: "#00ff00" },
        ],
        "user-charlie": [
          {
            id: "player-c1",
            name: "Charlie P1",
            emoji: "🦊",
            color: "#0000ff",
          },
          {
            id: "player-c2",
            name: "Charlie P2",
            emoji: "🐻",
            color: "#4444ff",
          },
          {
            id: "player-c3",
            name: "Charlie P3",
            emoji: "🐼",
            color: "#8888ff",
          },
        ],
      },
    };

    playerIds = [
      "player-a1",
      "player-a2",
      "player-b1",
      "player-c1",
      "player-c2",
      "player-c3",
    ];

    playersMap = new Map([
      ["player-a1", { name: "Alice P1", emoji: "🐶", color: "#ff0000" }],
      ["player-a2", { name: "Alice P2", emoji: "🐱", color: "#ff4444" }],
      ["player-b1", { name: "Bob P1", emoji: "🐭", color: "#00ff00" }],
      ["player-c1", { name: "Charlie P1", emoji: "🦊", color: "#0000ff" }],
      ["player-c2", { name: "Charlie P2", emoji: "🐻", color: "#4444ff" }],
      ["player-c3", { name: "Charlie P3", emoji: "🐼", color: "#8888ff" }],
    ]);
  });

  describe("Full multiplayer ownership flow", () => {
    it("should correctly identify ownership across all players", () => {
      const ownership = buildPlayerOwnershipFromRoomData(mockRoomData);

      // Alice owns 2 players
      expect(isPlayerOwnedByUser("player-a1", "user-alice", ownership)).toBe(
        true,
      );
      expect(isPlayerOwnedByUser("player-a2", "user-alice", ownership)).toBe(
        true,
      );

      // Bob owns 1 player
      expect(isPlayerOwnedByUser("player-b1", "user-bob", ownership)).toBe(
        true,
      );

      // Charlie owns 3 players
      expect(isPlayerOwnedByUser("player-c1", "user-charlie", ownership)).toBe(
        true,
      );
      expect(isPlayerOwnedByUser("player-c2", "user-charlie", ownership)).toBe(
        true,
      );
      expect(isPlayerOwnedByUser("player-c3", "user-charlie", ownership)).toBe(
        true,
      );

      // Cross-ownership checks (should be false)
      expect(isPlayerOwnedByUser("player-a1", "user-bob", ownership)).toBe(
        false,
      );
      expect(isPlayerOwnedByUser("player-b1", "user-charlie", ownership)).toBe(
        false,
      );
      expect(isPlayerOwnedByUser("player-c1", "user-alice", ownership)).toBe(
        false,
      );
    });

    it("should build complete metadata for game state", () => {
      const ownership = buildPlayerOwnershipFromRoomData(mockRoomData);
      const metadata = buildPlayerMetadata(playerIds, ownership, playersMap);

      // Check all players have metadata
      expect(Object.keys(metadata)).toHaveLength(6);

      // Verify Alice's players
      expect(metadata["player-a1"]).toEqual({
        id: "player-a1",
        name: "Alice P1",
        emoji: "🐶",
        color: "#ff0000",
        userId: "user-alice",
      });
      expect(metadata["player-a2"].userId).toBe("user-alice");

      // Verify Bob's player
      expect(metadata["player-b1"].userId).toBe("user-bob");

      // Verify Charlie's players
      expect(metadata["player-c1"].userId).toBe("user-charlie");
      expect(metadata["player-c2"].userId).toBe("user-charlie");
      expect(metadata["player-c3"].userId).toBe("user-charlie");
    });

    it("should correctly group players by owner for team display", () => {
      const ownership = buildPlayerOwnershipFromRoomData(mockRoomData);
      const groups = groupPlayersByOwner(playerIds, ownership);

      expect(groups.size).toBe(3);
      expect(groups.get("user-alice")).toEqual(["player-a1", "player-a2"]);
      expect(groups.get("user-bob")).toEqual(["player-b1"]);
      expect(groups.get("user-charlie")).toEqual([
        "player-c1",
        "player-c2",
        "player-c3",
      ]);
    });

    it("should identify unique participants", () => {
      const ownership = buildPlayerOwnershipFromRoomData(mockRoomData);
      const owners = getUniqueOwners(ownership);

      expect(owners).toHaveLength(3);
      expect(owners).toContain("user-alice");
      expect(owners).toContain("user-bob");
      expect(owners).toContain("user-charlie");
    });
  });

  describe("Turn-based game authorization scenarios", () => {
    let ownership: PlayerOwnershipMap;

    beforeEach(() => {
      ownership = buildPlayerOwnershipFromRoomData(mockRoomData);
    });

    it("should allow Alice to act when her player has the turn", () => {
      const currentPlayerId = "player-a1";
      const currentViewerId = "user-alice";

      const canAct = isPlayerOwnedByUser(
        currentPlayerId,
        currentViewerId,
        ownership,
      );
      expect(canAct).toBe(true);
    });

    it("should block Bob from acting when Alice has the turn", () => {
      const currentPlayerId = "player-a1"; // Alice's turn
      const currentViewerId = "user-bob"; // Bob trying to act

      const canAct = isPlayerOwnedByUser(
        currentPlayerId,
        currentViewerId,
        ownership,
      );
      expect(canAct).toBe(false);
    });

    it("should handle turn rotation correctly", () => {
      const turnOrder = ["player-a1", "player-b1", "player-c1"];

      for (const currentPlayer of turnOrder) {
        const owner = getPlayerOwner(currentPlayer, ownership);
        expect(owner).toBeDefined();

        // Verify only the owner can act
        for (const userId of ["user-alice", "user-bob", "user-charlie"]) {
          const canAct = isPlayerOwnedByUser(currentPlayer, userId, ownership);
          expect(canAct).toBe(userId === owner);
        }
      }
    });
  });

  describe("Player filtering for UI display", () => {
    let ownership: PlayerOwnershipMap;

    beforeEach(() => {
      ownership = buildPlayerOwnershipFromRoomData(mockRoomData);
    });

    it("should filter to show only local players for current user", () => {
      const alicePlayers = filterPlayersByOwner(
        playerIds,
        "user-alice",
        ownership,
      );
      expect(alicePlayers).toEqual(["player-a1", "player-a2"]);

      const bobPlayers = filterPlayersByOwner(playerIds, "user-bob", ownership);
      expect(bobPlayers).toEqual(["player-b1"]);

      const charliePlayers = filterPlayersByOwner(
        playerIds,
        "user-charlie",
        ownership,
      );
      expect(charliePlayers).toEqual(["player-c1", "player-c2", "player-c3"]);
    });

    it("should handle empty results for users not in game", () => {
      const outsiderPlayers = filterPlayersByOwner(
        playerIds,
        "user-not-in-room",
        ownership,
      );
      expect(outsiderPlayers).toEqual([]);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle room with no players gracefully", () => {
      const emptyRoomData: RoomData = {
        ...mockRoomData,
        memberPlayers: {},
      };

      const ownership = buildPlayerOwnershipFromRoomData(emptyRoomData);
      expect(ownership).toEqual({});

      const owners = getUniqueOwners(ownership);
      expect(owners).toEqual([]);
    });

    it("should handle single-player room", () => {
      const soloRoomData: RoomData = {
        ...mockRoomData,
        memberPlayers: {
          "user-solo": [
            { id: "player-solo", name: "Solo", emoji: "🚀", color: "#ff00ff" },
          ],
        },
      };

      const ownership = buildPlayerOwnershipFromRoomData(soloRoomData);
      expect(Object.keys(ownership)).toHaveLength(1);
      expect(ownership["player-solo"]).toBe("user-solo");
    });

    it("should handle metadata building with missing player data", () => {
      const ownership = buildPlayerOwnershipFromRoomData(mockRoomData);
      const partialPlayerIds = ["player-a1", "player-nonexistent", "player-b1"];

      const metadata = buildPlayerMetadata(
        partialPlayerIds,
        ownership,
        playersMap,
      );

      expect(metadata["player-a1"]).toBeDefined();
      expect(metadata["player-b1"]).toBeDefined();
      expect(metadata["player-nonexistent"]).toBeUndefined();
    });

    it("should use fallback userId when player not in ownership map", () => {
      const partialOwnership: PlayerOwnershipMap = {
        "player-a1": "user-alice",
      };

      const metadata = buildPlayerMetadata(
        ["player-a1", "player-a2"],
        partialOwnership,
        playersMap,
        "fallback-user",
      );

      expect(metadata["player-a1"].userId).toBe("user-alice");
      expect(metadata["player-a2"].userId).toBe("fallback-user");
    });
  });

  describe("Real-world multiplayer scenarios", () => {
    it("should handle player leaving mid-game", () => {
      const ownership = buildPlayerOwnershipFromRoomData(mockRoomData);

      // Bob leaves, but his player data remains in game state
      const remainingPlayerIds = playerIds.filter((id) => id !== "player-b1");

      // Ownership map still has Bob's data
      expect(ownership["player-b1"]).toBe("user-bob");

      // But filtered lists exclude his players
      const alicePlayers = filterPlayersByOwner(
        remainingPlayerIds,
        "user-alice",
        ownership,
      );
      const bobPlayers = filterPlayersByOwner(
        remainingPlayerIds,
        "user-bob",
        ownership,
      );

      expect(alicePlayers).toHaveLength(2);
      expect(bobPlayers).toHaveLength(0); // Bob's player filtered out
    });

    it("should handle user with multiple active players in turn order", () => {
      const ownership = buildPlayerOwnershipFromRoomData(mockRoomData);

      // Charlie has 3 players in rotation
      const charliePlayers = ["player-c1", "player-c2", "player-c3"];

      for (const playerId of charliePlayers) {
        expect(isPlayerOwnedByUser(playerId, "user-charlie", ownership)).toBe(
          true,
        );
        expect(getPlayerOwner(playerId, ownership)).toBe("user-charlie");
      }
    });
  });
});
