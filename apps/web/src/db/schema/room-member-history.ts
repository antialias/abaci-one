import { createId } from "@paralleldrive/cuid2";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { arcadeRooms } from "./arcade-rooms";

/**
 * Historical record of all users who have ever been in a room
 * This table is append-only and tracks the complete history of room membership
 */
export const roomMemberHistory = sqliteTable("room_member_history", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  roomId: text("room_id")
    .notNull()
    .references(() => arcadeRooms.id, { onDelete: "cascade" }),

  userId: text("user_id").notNull(),
  displayName: text("display_name", { length: 50 }).notNull(),

  // First time this user joined the room
  firstJoinedAt: integer("first_joined_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),

  // Last time we saw this user in the room
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),

  // Track what happened to this membership
  // 'active' - currently in room
  // 'left' - voluntarily left
  // 'kicked' - kicked by host
  // 'banned' - banned by host
  lastAction: text("last_action", {
    enum: ["active", "left", "kicked", "banned"],
  })
    .notNull()
    .default("active"),

  // When the last action occurred
  lastActionAt: integer("last_action_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type RoomMemberHistory = typeof roomMemberHistory.$inferSelect;
export type NewRoomMemberHistory = typeof roomMemberHistory.$inferInsert;
