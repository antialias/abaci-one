import { createId } from "@paralleldrive/cuid2";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { arcadeRooms } from "./arcade-rooms";

/**
 * Game-specific configuration settings for arcade rooms
 * Each row represents one game's settings for one room
 */
export const roomGameConfigs = sqliteTable(
  "room_game_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    // Room reference
    roomId: text("room_id")
      .notNull()
      .references(() => arcadeRooms.id, { onDelete: "cascade" }),

    // Game identifier
    // Accepts any string - validation happens at runtime against validator registry
    gameName: text("game_name").notNull(),

    // Game-specific configuration JSON
    // Structure depends on gameName:
    // - matching: { gameType, difficulty, turnTimer }
    // - memory-quiz: { selectedCount, displayTime, selectedDifficulty, playMode }
    // - complement-race: TBD
    // - number-guesser: { minNumber, maxNumber, roundsToWin }
    // - math-sprint: { difficulty, questionsPerRound, timePerQuestion }
    config: text("config", { mode: "json" }).notNull(),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    // Ensure only one config per game per room
    uniqueRoomGame: uniqueIndex("room_game_idx").on(
      table.roomId,
      table.gameName,
    ),
  }),
);

export type RoomGameConfig = typeof roomGameConfigs.$inferSelect;
export type NewRoomGameConfig = typeof roomGameConfigs.$inferInsert;
