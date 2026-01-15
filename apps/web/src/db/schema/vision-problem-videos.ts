import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'
import { players } from './players'
import { sessionPlans } from './session-plans'

/**
 * Video status values
 * - recording: Currently capturing frames
 * - processing: Encoding frames to video
 * - ready: Video encoded and available
 * - failed: Encoding failed
 * - no_video: Problem completed but no video frames were captured (camera not enabled)
 */
export type VisionProblemVideoStatus = 'recording' | 'processing' | 'ready' | 'failed' | 'no_video'

/**
 * Vision problem videos - per-problem video recordings of abacus camera during practice
 *
 * Each problem attempt gets its own video, allowing teachers to:
 * - Click on any completed problem in the observer nav to watch that specific attempt
 * - Review student technique for individual problems
 * - See exactly what the student was doing from problem shown to answer submitted
 *
 * Videos are encoded incrementally as each problem completes, not at session end.
 * Retained for 7 days (configurable), then automatically cleaned up.
 */
export const visionProblemVideos = sqliteTable(
  'vision_problem_videos',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // Link to session
    sessionId: text('session_id')
      .notNull()
      .references(() => sessionPlans.id, { onDelete: 'cascade' }),

    // Denormalized for efficient queries
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    // Problem identification
    problemNumber: integer('problem_number').notNull(), // 1-indexed
    partIndex: integer('part_index').notNull(), // 0, 1, or 2 (abacus, visualization, linear)

    // Attempt tracking (for epoch retries and manual redos)
    epochNumber: integer('epoch_number').notNull().default(0), // 0 = initial pass, 1-2 = retry epochs
    attemptNumber: integer('attempt_number').notNull().default(1), // 1-indexed within epoch
    isRetry: integer('is_retry', { mode: 'boolean' }).notNull().default(false),
    isManualRedo: integer('is_manual_redo', { mode: 'boolean' }).notNull().default(false),

    // File info
    filename: text('filename').notNull(), // problem_001.mp4 stored on disk
    fileSize: integer('file_size'), // bytes (null while recording/processing)
    durationMs: integer('duration_ms'), // milliseconds (null while recording)
    frameCount: integer('frame_count'), // total frames in video
    avgFps: real('avg_fps'), // average frames per second

    // Time range
    startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp' }), // null while recording

    // Problem result (denormalized for display)
    isCorrect: integer('is_correct', { mode: 'boolean' }),

    // Recording state
    status: text('status').$type<VisionProblemVideoStatus>().notNull().default('recording'),
    processingError: text('processing_error'), // error message if encoding failed

    // Retention management
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),

    // Audit
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    // Find videos for a session (for observer to list available replays)
    index('vision_problem_videos_session_id_idx').on(table.sessionId),
    // Find specific problem video (with epoch/attempt for multi-attempt support)
    index('vision_problem_videos_session_problem_idx').on(
      table.sessionId,
      table.problemNumber,
      table.epochNumber,
      table.attemptNumber
    ),
    // Find videos for a player (for history view)
    index('vision_problem_videos_player_id_idx').on(table.playerId),
    // Find expired videos for cleanup
    index('vision_problem_videos_expires_at_idx').on(table.expiresAt),
    // Find videos by status (for processing queue)
    index('vision_problem_videos_status_idx').on(table.status),
  ]
)

export type VisionProblemVideo = typeof visionProblemVideos.$inferSelect
export type NewVisionProblemVideo = typeof visionProblemVideos.$inferInsert
