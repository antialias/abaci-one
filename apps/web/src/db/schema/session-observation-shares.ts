import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { players } from "./players";
import { sessionPlans } from "./session-plans";

/**
 * Shareable observation links for practice sessions
 *
 * Allows parents/teachers to share time-limited links that anyone can use
 * to observe a student's practice session without logging in.
 */
export const sessionObservationShares = sqliteTable(
  "session_observation_shares",
  {
    // 10-char base62 token (cryptographically random)
    id: text("id").primaryKey(),

    // Session being shared
    sessionId: text("session_id")
      .notNull()
      .references(() => sessionPlans.id, { onDelete: "cascade" }),

    // Player being observed (denormalized for fast lookup)
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),

    // Who created the share link
    createdBy: text("created_by").notNull(),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),

    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),

    // Status: active, expired (time-based), or revoked (manually)
    status: text("status", {
      enum: ["active", "expired", "revoked"],
    })
      .notNull()
      .default("active"),

    // Analytics
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: integer("last_viewed_at", { mode: "timestamp" }),
  },
  (table) => ({
    // Index for cleanup when session ends
    sessionIdx: index("idx_session_observation_shares_session").on(
      table.sessionId,
    ),
    // Index for listing active shares
    statusIdx: index("idx_session_observation_shares_status").on(table.status),
  }),
);

export type SessionObservationShare =
  typeof sessionObservationShares.$inferSelect;
export type NewSessionObservationShare =
  typeof sessionObservationShares.$inferInsert;
