/**
 * Ephemeral Database Factory
 *
 * Creates in-memory SQLite databases for testing.
 * Each database is fully isolated with all migrations applied.
 */

import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";

/**
 * Type alias for the database client with schema
 */
export type TestDatabase = BetterSQLite3Database<typeof schema>;

// Module-level variable to hold the "current" ephemeral database for mocking
let currentEphemeralDb: TestDatabase | null = null;

/**
 * Sets the current ephemeral database for mocking purposes.
 * Call this in beforeEach to make the mock work.
 */
export function setCurrentEphemeralDb(db: TestDatabase | null): void {
  currentEphemeralDb = db;
}

/**
 * Gets the current ephemeral database.
 * Used by the vi.mock to provide the db to modules being tested.
 */
export function getCurrentEphemeralDb(): TestDatabase {
  if (!currentEphemeralDb) {
    throw new Error(
      "No ephemeral database set. Call setCurrentEphemeralDb() in beforeEach.",
    );
  }
  return currentEphemeralDb;
}

/**
 * Result of creating an ephemeral database
 */
export interface EphemeralDbResult {
  /** Drizzle database client */
  db: TestDatabase;
  /** Underlying better-sqlite3 instance */
  sqlite: Database.Database;
  /** Cleanup function to close the database */
  cleanup: () => void;
}

/**
 * Creates an ephemeral in-memory database for testing.
 * Applies all migrations and returns a Drizzle instance.
 *
 * @returns Database instance with cleanup function
 */
export function createEphemeralDatabase(): EphemeralDbResult {
  // Create in-memory SQLite database
  const sqlite = new Database(":memory:");

  // Enable foreign keys (required for cascading deletes)
  sqlite.pragma("foreign_keys = ON");

  // Create Drizzle instance with schema
  const db = drizzle(sqlite, { schema });

  // Apply all migrations
  migrate(db, { migrationsFolder: "./drizzle" });

  return {
    db,
    sqlite,
    cleanup: () => {
      sqlite.close();
    },
  };
}

/**
 * Creates a test user and player in the database.
 *
 * @param db - The ephemeral database instance
 * @param playerId - Optional custom player ID (defaults to 'test-student')
 * @returns The created user and player IDs
 */
export async function createTestStudent(
  db: TestDatabase,
  playerId: string = "test-student",
): Promise<{ userId: string; playerId: string }> {
  const userId = `user-${playerId}`;
  const now = new Date();

  // Create user
  await db.insert(schema.users).values({
    id: userId,
    guestId: `guest-${playerId}-${Date.now()}`,
    createdAt: now,
  });

  // Create player
  await db.insert(schema.players).values({
    id: playerId,
    userId,
    name: "Test Student",
    emoji: "🧪",
    color: "#4F46E5",
    isActive: true,
    createdAt: now,
  });

  // Initialize curriculum position
  await db.insert(schema.playerCurriculum).values({
    playerId,
    currentLevel: 1,
    currentPhaseId: "L1.add.+1.direct",
    createdAt: now,
    updatedAt: now,
  });

  return { userId, playerId };
}

/**
 * Creates skill mastery records for a player.
 *
 * @param db - The ephemeral database instance
 * @param playerId - The player ID
 * @param skillIds - Array of skill IDs to initialize
 * @param isPracticing - Whether skills should be marked as practicing (default: true)
 */
export async function initializeSkillMastery(
  db: TestDatabase,
  playerId: string,
  skillIds: string[],
  isPracticing: boolean = true,
): Promise<void> {
  const now = new Date();

  for (const skillId of skillIds) {
    await db.insert(schema.playerSkillMastery).values({
      playerId,
      skillId,
      isPracticing,
      lastHadHelp: false,
      createdAt: now,
      lastPracticedAt: null,
    });
  }
}

/**
 * Resets the database by clearing all tables.
 * Useful for running multiple scenarios in a single test file.
 *
 * @param db - The ephemeral database instance
 */
export async function resetDatabase(db: TestDatabase): Promise<void> {
  // Delete in reverse order of dependencies
  await db.delete(schema.sessionPlans);
  await db.delete(schema.playerSkillMastery);
  await db.delete(schema.playerCurriculum);
  await db.delete(schema.players);
  await db.delete(schema.users);
}
