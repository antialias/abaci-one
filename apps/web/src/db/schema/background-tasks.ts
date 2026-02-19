import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

/**
 * Background tasks table - stores long-running task metadata and results
 *
 * Used for tasks like TensorFlow training, worksheet parsing, worksheet generation,
 * and flowchart embedding. Persists task state to survive page reloads and enables
 * event replay.
 */
export const backgroundTasks = sqliteTable(
  'background_tasks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Task type - determines which handler processes it */
    type: text('type').notNull(), // 'vision-training' | 'worksheet-parse' | 'worksheet-generate' | 'flowchart-embed' | 'demo'

    /** Current status of the task */
    status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

    /** JSON input for the task (task-specific parameters) */
    input: text('input', { mode: 'json' }),

    /** JSON result when completed (task-specific output) */
    output: text('output', { mode: 'json' }),

    /** Error message if task failed */
    error: text('error'),

    /** Progress percentage (0-100) */
    progress: integer('progress').default(0),

    /** Human-readable progress message */
    progressMessage: text('progress_message'),

    /** When the task was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** When the task started running */
    startedAt: integer('started_at', { mode: 'timestamp' }),

    /** When the task completed (success or failure) */
    completedAt: integer('completed_at', { mode: 'timestamp' }),

    /** Optional user ID association */
    userId: text('user_id'),

    /** Runner ID - identifies which pod/process owns this task */
    runnerId: text('runner_id'),

    /** Last heartbeat timestamp - updated periodically while task is running */
    lastHeartbeat: integer('last_heartbeat', { mode: 'timestamp' }),
  },
  (table) => ({
    statusIdx: index('background_tasks_status_idx').on(table.status),
    typeIdx: index('background_tasks_type_idx').on(table.type),
    userIdx: index('background_tasks_user_idx').on(table.userId),
    createdAtIdx: index('background_tasks_created_at_idx').on(table.createdAt),
  })
)

/**
 * Background task events table - stores events for replay
 *
 * When a client reconnects or subscribes to a running task, all events
 * are replayed in order to bring them up to date.
 */
export const backgroundTaskEvents = sqliteTable(
  'background_task_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    /** Foreign key to the parent task */
    taskId: text('task_id')
      .notNull()
      .references(() => backgroundTasks.id, { onDelete: 'cascade' }),

    /** Type of event (see src/lib/tasks/events.ts for per-task-type definitions) */
    eventType: text('event_type').notNull(),

    /** JSON payload for the event (event-specific data) */
    payload: text('payload', { mode: 'json' }),

    /** When the event was emitted */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    taskIdIdx: index('background_task_events_task_id_idx').on(table.taskId),
  })
)

// Relations
export const backgroundTasksRelations = relations(backgroundTasks, ({ many }) => ({
  events: many(backgroundTaskEvents),
}))

export const backgroundTaskEventsRelations = relations(backgroundTaskEvents, ({ one }) => ({
  task: one(backgroundTasks, {
    fields: [backgroundTaskEvents.taskId],
    references: [backgroundTasks.id],
  }),
}))

// Types
export type BackgroundTask = typeof backgroundTasks.$inferSelect
export type NewBackgroundTask = typeof backgroundTasks.$inferInsert
export type BackgroundTaskEvent = typeof backgroundTaskEvents.$inferSelect
export type NewBackgroundTaskEvent = typeof backgroundTaskEvents.$inferInsert

export type TaskType =
  | 'vision-training'
  | 'worksheet-parse'
  | 'worksheet-reparse'
  | 'worksheet-generate'
  | 'flowchart-embed'
  | 'flowchart-generate'
  | 'flowchart-refine'
  | 'seed-students'
  | 'audio-generate'
  | 'collected-clip-generate'
  | 'image-generate'
  | 'phi-explore-generate'
  | 'blog-image-generate'
  | 'demo'
  | 'demo-refine'
  | 'session-plan'
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
/**
 * Event types are defined per task type in `src/lib/tasks/events.ts`.
 * The DB column `event_type` stores the string discriminant from those unions.
 * Lifecycle events (started, progress, completed, failed, cancelled) are
 * emitted by the task manager; domain events are emitted by handlers.
 */
