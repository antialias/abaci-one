import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { players } from "./players";
import { sessionPlans } from "./session-plans";

/**
 * Recording status values
 */
export type VisionRecordingStatus =
  | "recording"
  | "processing"
  | "ready"
  | "failed";

/**
 * Problem marker for timeline synchronization
 */
export interface ProblemMarker {
  /** Offset from recording start in milliseconds */
  offsetMs: number;
  /** Problem number (1-indexed) */
  problemNumber: number;
  /** Part index (0-2) */
  partIndex: number;
  /** Event type */
  eventType: "problem-shown" | "answer-submitted" | "feedback-shown";
  /** Whether the answer was correct (for answer-submitted events) */
  isCorrect?: boolean;
}

/**
 * Vision recordings - video recordings of abacus camera during practice sessions
 *
 * Records the abacus camera feed during practice for:
 * - Live scrub-back during teacher observation (DVR-style)
 * - Post-session playback with problem timeline synchronization
 * - Debugging student technique issues
 *
 * Recordings are automatically created when camera is active during practice
 * and deleted after 7 days (configurable retention).
 */
export const visionRecordings = sqliteTable(
  "vision_recordings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    // Link to session
    sessionId: text("session_id")
      .notNull()
      .references(() => sessionPlans.id, { onDelete: "cascade" }),

    // Denormalized for efficient queries
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),

    // File info
    filename: text("filename").notNull(), // UUID.mp4 stored on disk
    fileSize: integer("file_size"), // bytes (null while recording)
    durationMs: integer("duration_ms"), // milliseconds (null while recording)
    frameCount: integer("frame_count"), // total frames in video
    avgFps: real("avg_fps"), // average frames per second

    // Time range (for seeking/display)
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp" }), // null while recording

    // Recording state
    status: text("status")
      .$type<VisionRecordingStatus>()
      .notNull()
      .default("recording"),
    processingError: text("processing_error"), // error message if encoding failed

    // Problem timeline markers (for synchronized playback)
    problemMarkers: text("problem_markers", { mode: "json" }).$type<
      ProblemMarker[]
    >(),

    // Retention management
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),

    // Audit
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    // Find recordings for a session
    index("vision_recordings_session_id_idx").on(table.sessionId),
    // Find recordings for a player (for history view)
    index("vision_recordings_player_id_idx").on(table.playerId),
    // Find expired recordings for cleanup
    index("vision_recordings_expires_at_idx").on(table.expiresAt),
    // Find recordings by status (for processing queue)
    index("vision_recordings_status_idx").on(table.status),
  ],
);

export type VisionRecording = typeof visionRecordings.$inferSelect;
export type NewVisionRecording = typeof visionRecordings.$inferInsert;
