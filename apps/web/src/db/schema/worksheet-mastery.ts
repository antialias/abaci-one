import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * Worksheet mastery tracking table - tracks skill mastery per user
 *
 * Supports the mastery mode in worksheet generator, which provides
 * skill-based progression with automatic review mixing.
 *
 * Each row represents a user's mastery state for a specific skill
 * (e.g., "td-ones-regroup" for two-digit addition with ones place regrouping)
 */
export const worksheetMastery = sqliteTable(
  "worksheet_mastery",
  {
    /** Unique identifier (UUID) */
    id: text("id").primaryKey(),

    /** User ID (can be guest or authenticated user) */
    userId: text("user_id").notNull(),

    /**
     * Skill ID (e.g., "sd-no-regroup", "td-ones-regroup", "3d-full-regroup")
     * See SKILL_DEFINITIONS in src/app/create/worksheets/skills.ts
     */
    skillId: text("skill_id").notNull(),

    /** Whether this skill has been mastered (boolean) */
    isMastered: integer("is_mastered", { mode: "boolean" })
      .notNull()
      .default(false),

    /** Total number of attempts/worksheets for this skill (future use) */
    totalAttempts: integer("total_attempts").notNull().default(0),

    /** Number of correct attempts (future use for validation) */
    correctAttempts: integer("correct_attempts").notNull().default(0),

    /**
     * Last measured accuracy (0.0-1.0) from most recent worksheet (future use)
     * null if never attempted
     */
    lastAccuracy: real("last_accuracy"),

    /** When this skill was first attempted */
    firstAttemptAt: integer("first_attempt_at", { mode: "timestamp" }),

    /** When this skill was marked as mastered (null if not mastered) */
    masteredAt: integer("mastered_at", { mode: "timestamp" }),

    /** When this skill was last practiced */
    lastPracticedAt: integer("last_practiced_at", {
      mode: "timestamp",
    }).notNull(),

    /** Timestamp of last update */
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),

    /** Timestamp of creation */
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    // Composite index for fast user+skill lookups
    userSkillIdx: index("worksheet_mastery_user_skill_idx").on(
      table.userId,
      table.skillId,
    ),
  }),
);

export type WorksheetMastery = typeof worksheetMastery.$inferSelect;
export type NewWorksheetMastery = typeof worksheetMastery.$inferInsert;
