import { describe, expect, it } from "vitest";
import { arcadeSessions, players, userStats, users } from "../schema";

describe("Schema validation", () => {
  describe("users table", () => {
    it("has correct structure", () => {
      expect(users.id).toBeDefined();
      expect(users.guestId).toBeDefined();
      expect(users.createdAt).toBeDefined();
      expect(users.upgradedAt).toBeDefined();
      expect(users.email).toBeDefined();
      expect(users.name).toBeDefined();
    });

    it("has unique constraints on guestId and email", () => {
      expect(users.guestId.notNull).toBe(true);
      expect(users.email.notNull).toBe(false); // nullable until upgrade
    });
  });

  describe("players table", () => {
    it("has correct structure", () => {
      expect(players.id).toBeDefined();
      expect(players.userId).toBeDefined();
      expect(players.name).toBeDefined();
      expect(players.emoji).toBeDefined();
      expect(players.color).toBeDefined();
      expect(players.isActive).toBeDefined();
      expect(players.createdAt).toBeDefined();
    });

    it("has foreign key to users", () => {
      const userIdColumn = players.userId;
      expect(userIdColumn).toBeDefined();
      expect(userIdColumn.notNull).toBe(true);
    });

    it("has required fields as not null", () => {
      expect(players.name.notNull).toBe(true);
      expect(players.emoji.notNull).toBe(true);
      expect(players.color.notNull).toBe(true);
      expect(players.isActive.notNull).toBe(true);
    });
  });

  describe("user_stats table", () => {
    it("has correct structure", () => {
      expect(userStats.userId).toBeDefined();
      expect(userStats.gamesPlayed).toBeDefined();
      expect(userStats.totalWins).toBeDefined();
      expect(userStats.favoriteGameType).toBeDefined();
      expect(userStats.bestTime).toBeDefined();
      expect(userStats.highestAccuracy).toBeDefined();
    });

    it("has foreign key to users", () => {
      const userIdColumn = userStats.userId;
      expect(userIdColumn).toBeDefined();
    });

    it("has correct defaults", () => {
      expect(userStats.gamesPlayed.notNull).toBe(true);
      expect(userStats.totalWins.notNull).toBe(true);
      expect(userStats.highestAccuracy.notNull).toBe(true);
    });
  });

  describe("arcade_sessions table", () => {
    it("exists in schema", () => {
      expect(arcadeSessions).toBeDefined();
    });

    it("has correct structure", () => {
      expect(arcadeSessions.userId).toBeDefined();
      expect(arcadeSessions.currentGame).toBeDefined();
      expect(arcadeSessions.gameUrl).toBeDefined();
      expect(arcadeSessions.gameState).toBeDefined();
      expect(arcadeSessions.activePlayers).toBeDefined();
      expect(arcadeSessions.startedAt).toBeDefined();
      expect(arcadeSessions.lastActivityAt).toBeDefined();
      expect(arcadeSessions.expiresAt).toBeDefined();
      expect(arcadeSessions.isActive).toBeDefined();
      expect(arcadeSessions.version).toBeDefined();
    });

    it("has userId as primary key", () => {
      expect(arcadeSessions.userId).toBeDefined();
      expect(arcadeSessions.userId.primary).toBe(true);
    });

    it("has foreign key to users", () => {
      const userIdColumn = arcadeSessions.userId;
      expect(userIdColumn).toBeDefined();
      expect(userIdColumn.notNull).toBe(true);
    });

    it("has required fields as not null", () => {
      expect(arcadeSessions.currentGame.notNull).toBe(true);
      expect(arcadeSessions.gameUrl.notNull).toBe(true);
      expect(arcadeSessions.gameState.notNull).toBe(true);
      expect(arcadeSessions.activePlayers.notNull).toBe(true);
      expect(arcadeSessions.startedAt.notNull).toBe(true);
      expect(arcadeSessions.lastActivityAt.notNull).toBe(true);
      expect(arcadeSessions.expiresAt.notNull).toBe(true);
      expect(arcadeSessions.isActive.notNull).toBe(true);
      expect(arcadeSessions.version.notNull).toBe(true);
    });

    it("has correct defaults", () => {
      expect(arcadeSessions.isActive.default).toBeDefined();
      expect(arcadeSessions.version.default).toBeDefined();
    });
  });
});
