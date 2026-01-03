import { createId } from "@paralleldrive/cuid2";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { players } from "./players";

/**
 * Skill Tutorial Progress
 *
 * Tracks whether a student has completed the tutorial for each skill.
 * Tutorial completion is required before a skill can be added to practice rotation
 * (unless teacher override is used).
 */
export const skillTutorialProgress = sqliteTable(
  "skill_tutorial_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Foreign key to players table */
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),

    /**
     * Skill identifier - matches the skill paths from curriculum phases
     * Examples:
     * - "basic.directAddition"
     * - "fiveComplements.4=5-1"
     * - "tenComplements.9=10-1"
     */
    skillId: text("skill_id").notNull(),

    // ---- Tutorial Completion ----

    /** Whether the student has completed the tutorial for this skill */
    tutorialCompleted: integer("tutorial_completed", { mode: "boolean" })
      .notNull()
      .default(false),

    /** When the tutorial was completed */
    completedAt: integer("completed_at", { mode: "timestamp" }),

    // ---- Teacher Override ----

    /**
     * Teacher can mark a skill as "learned offline" to bypass tutorial requirement.
     * Use case: student learned the technique in person with their teacher.
     */
    teacherOverride: integer("teacher_override", { mode: "boolean" })
      .notNull()
      .default(false),

    /** When the teacher override was applied */
    overrideAt: integer("override_at", { mode: "timestamp" }),

    /** Optional reason for the override (e.g., "Learned in class with Kehkashan") */
    overrideReason: text("override_reason"),

    // ---- Tutorial Skip Tracking ----

    /**
     * Number of times the student has skipped the tutorial prompt.
     * Used to surface to teacher if student is repeatedly avoiding tutorials.
     */
    skipCount: integer("skip_count").notNull().default(0),

    /** When the tutorial was last skipped */
    lastSkippedAt: integer("last_skipped_at", { mode: "timestamp" }),

    // ---- Metadata ----

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Index for fast lookups by playerId */
    playerIdIdx: index("skill_tutorial_progress_player_id_idx").on(
      table.playerId,
    ),

    /** Unique constraint: one record per player per skill */
    playerSkillUnique: uniqueIndex(
      "skill_tutorial_progress_player_skill_unique",
    ).on(table.playerId, table.skillId),
  }),
);

export type SkillTutorialProgress = typeof skillTutorialProgress.$inferSelect;
export type NewSkillTutorialProgress =
  typeof skillTutorialProgress.$inferInsert;

/**
 * Check if a skill's tutorial requirement is satisfied.
 * Returns true if:
 * - Tutorial has been completed, OR
 * - Teacher has applied an override
 */
export function isTutorialSatisfied(
  progress: SkillTutorialProgress | null | undefined,
): boolean {
  if (!progress) return false;
  return progress.tutorialCompleted || progress.teacherOverride;
}
