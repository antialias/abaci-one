/**
 * Vision Training Sync History Schema
 *
 * Tracks sync operations between local development and production.
 * Provides audit trail for when data was synced, what changed, and tombstone maintenance.
 */

import { createId } from "@paralleldrive/cuid2";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Sync status enum
 */
export type SyncStatus = "success" | "failed" | "cancelled";

/**
 * Model type for sync operations
 */
export type SyncModelType = "column-classifier" | "boundary-detector";

/**
 * Vision training sync history table
 */
export const visionTrainingSyncHistory = sqliteTable(
  "vision_training_sync_history",
  {
    /** Primary key */
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    // ---- Sync Identification ----

    /** Model type: 'column-classifier' | 'boundary-detector' */
    modelType: text("model_type").$type<SyncModelType>().notNull(),

    /** Sync status */
    status: text("status").$type<SyncStatus>().notNull(),

    // ---- Timing ----

    /** When sync started */
    startedAt: integer("started_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),

    /** When sync completed (null if still running or cancelled) */
    completedAt: integer("completed_at", { mode: "timestamp" }),

    /** Duration in milliseconds */
    durationMs: integer("duration_ms"),

    // ---- Transfer Stats ----

    /** Number of files transferred from remote */
    filesTransferred: integer("files_transferred").notNull().default(0),

    /** Remote file count at sync time */
    remoteFilesCount: integer("remote_files_count"),

    /** Local file count before sync */
    localFilesBefore: integer("local_files_before"),

    /** Local file count after sync */
    localFilesAfter: integer("local_files_after"),

    // ---- Tombstone Stats ----

    /** Tombstone entries before pruning */
    tombstoneEntriesBefore: integer("tombstone_entries_before"),

    /** Tombstone entries after pruning */
    tombstoneEntriesAfter: integer("tombstone_entries_after"),

    /** Number of tombstone entries pruned */
    tombstonePruned: integer("tombstone_pruned"),

    /** Files excluded by tombstone during this sync */
    filesExcludedByTombstone: integer("files_excluded_by_tombstone"),

    // ---- Error Info ----

    /** Error message if sync failed */
    error: text("error"),

    // ---- Metadata ----

    /** Remote host used for sync */
    remoteHost: text("remote_host"),

    /** Additional notes or context */
    notes: text("notes"),
  },
  (table) => ({
    /** Index for filtering by model type */
    modelTypeIdx: index("vision_sync_history_model_type_idx").on(
      table.modelType,
    ),

    /** Index for filtering by status */
    statusIdx: index("vision_sync_history_status_idx").on(table.status),

    /** Index for sorting by start time */
    startedAtIdx: index("vision_sync_history_started_at_idx").on(
      table.startedAt,
    ),

    /** Compound index for model type + start time (common query) */
    modelTypeStartedAtIdx: index(
      "vision_sync_history_model_type_started_at_idx",
    ).on(table.modelType, table.startedAt),
  }),
);

export type VisionTrainingSyncHistory =
  typeof visionTrainingSyncHistory.$inferSelect;
export type NewVisionTrainingSyncHistory =
  typeof visionTrainingSyncHistory.$inferInsert;

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Summary for display in UI
 */
export interface SyncHistorySummary {
  id: string;
  modelType: SyncModelType;
  status: SyncStatus;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  filesTransferred: number;
  tombstonePruned: number | null;
  error: string | null;
}

/**
 * Convert a full record to a summary
 */
export function toSyncHistorySummary(
  record: VisionTrainingSyncHistory,
): SyncHistorySummary {
  return {
    id: record.id,
    modelType: record.modelType,
    status: record.status,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    durationMs: record.durationMs,
    filesTransferred: record.filesTransferred,
    tombstonePruned: record.tombstonePruned,
    error: record.error,
  };
}
