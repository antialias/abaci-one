import { createId } from '@paralleldrive/cuid2'
import { eq, asc, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSocketIO } from '../socket-server'
import type {
  TaskType,
  TaskStatus,
  BackgroundTask,
  BackgroundTaskEvent,
} from '@/db/schema/background-tasks'
import type { TaskEventBase } from './tasks/events'

export type { TaskType, TaskStatus, BackgroundTask, BackgroundTaskEvent }

// ============================================================================
// Lifecycle Hooks
// ============================================================================

/**
 * Hooks called at key points in a task's lifecycle.
 * Register via `registerTaskHooks()` at app startup.
 */
export interface TaskLifecycleHooks {
  onTaskCreated?(taskId: string, type: TaskType): void
  onTaskCompleted?(taskId: string, type: TaskType): void
  onTaskFailed?(taskId: string, type: TaskType, error: string): void
}

let lifecycleHooks: TaskLifecycleHooks = {}

/**
 * Register lifecycle hooks for task events.
 * Call once at app startup (e.g., in socket-server initialization).
 */
export function registerTaskHooks(hooks: TaskLifecycleHooks): void {
  lifecycleHooks = hooks
}

// ============================================================================
// Task Timeouts
// ============================================================================

/** Default timeout per task type (ms). Override with `setTaskTimeout()`. */
const taskTimeouts: Partial<Record<TaskType, number>> = {
  'worksheet-parse': 5 * 60 * 1000, // 5 minutes
  'worksheet-reparse': 5 * 60 * 1000, // 5 minutes
  'vision-training': 30 * 60 * 1000, // 30 minutes (training can be long)
  'flowchart-embed': 5 * 60 * 1000, // 5 minutes
  'flowchart-generate': 6 * 60 * 1000, // 6 minutes (LLM + validation)
  'flowchart-refine': 6 * 60 * 1000, // 6 minutes (LLM + validation)
  demo: 2 * 60 * 1000, // 2 minutes
}

const DEFAULT_TASK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/** Active timeout timers, keyed by task ID */
const activeTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/** Get the timeout for a task type */
function getTaskTimeout(type: TaskType): number {
  return taskTimeouts[type] ?? DEFAULT_TASK_TIMEOUT_MS
}

/** Clear an active timeout for a task */
function clearTaskTimeout(taskId: string): void {
  const timer = activeTimeouts.get(taskId)
  if (timer) {
    clearTimeout(timer)
    activeTimeouts.delete(taskId)
  }
}

/**
 * Handle provided to task handlers for reporting progress and completion.
 *
 * @typeParam TOutput - The type of the task's completion output
 * @typeParam TEvent - The discriminated union of domain events this task can emit.
 *   Must extend `TaskEventBase` (i.e., have a `type` field).
 *   See `src/lib/tasks/events.ts` for per-task event definitions.
 */
export interface TaskHandle<TOutput = unknown, TEvent extends TaskEventBase = TaskEventBase> {
  /** The task ID */
  id: string
  /** Emit a domain event to all subscribers (persisted to DB for replay) */
  emit(event: TEvent): void
  /** Emit a transient domain event (Socket.IO only, NOT persisted to DB) */
  emitTransient(event: TEvent): void
  /** Update progress (0-100) with optional message. DB writes are throttled. */
  setProgress(progress: number, message?: string): void
  /** Mark task as completed with output */
  complete(output: TOutput): void
  /** Mark task as failed with error message */
  fail(error: string): void
  /** Check if task has been cancelled */
  isCancelled(): boolean
}

/**
 * Task state returned when subscribing to a task
 */
export interface TaskState<TOutput = unknown> {
  id: string
  type: TaskType
  status: TaskStatus
  progress: number
  progressMessage: string | null
  input: unknown
  output: TOutput | null
  error: string | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
  userId: string | null
}

/**
 * Lightweight task state for sending to clients via Socket.IO
 * Omits the `input` field which can contain large data (e.g., base64 images)
 */
export interface TaskStateForClient<TOutput = unknown> {
  id: string
  type: TaskType
  status: TaskStatus
  progress: number
  progressMessage: string | null
  output: TOutput | null
  error: string | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

/**
 * Task event for replay
 */
export interface TaskEvent {
  id: number
  taskId: string
  eventType: string
  payload: unknown
  createdAt: Date
  replayed?: boolean
}

// Track cancelled tasks in-memory (for same-pod cancellation)
const cancelledTasks = new Set<string>()

/**
 * Emit a task event to all subscribers
 * @param persist - If true (default), persists to DB for replay. If false, Socket.IO only.
 */
async function emitTaskEvent(
  taskId: string,
  eventType: string,
  payload: unknown,
  persist = true
): Promise<void> {
  const now = new Date()

  // Persist event for replay (skip for transient events like streaming tokens)
  if (persist) {
    await db.insert(schema.backgroundTaskEvents).values({
      taskId,
      eventType,
      payload: payload as any,
      createdAt: now,
    })
  }

  // Broadcast via Socket.IO
  const io = getSocketIO()
  if (io) {
    io.to(`task:${taskId}`).emit('task:event', {
      taskId,
      eventType,
      payload,
      createdAt: now,
    })
  }
}

/** Throttle interval for progress DB writes (ms) */
const PROGRESS_DB_THROTTLE_MS = 3000

/** Track last DB write time per task for throttling */
const lastProgressDbWrite = new Map<string, number>()

/**
 * Update task progress and broadcast to subscribers.
 * DB writes are throttled to avoid hammering libsql during streaming.
 * Socket.IO broadcasts happen on every call for real-time UI updates.
 */
async function updateProgress(taskId: string, progress: number, message?: string): Promise<void> {
  const now = Date.now()
  const lastWrite = lastProgressDbWrite.get(taskId) ?? 0
  const shouldPersist = now - lastWrite >= PROGRESS_DB_THROTTLE_MS || progress >= 100

  if (shouldPersist) {
    lastProgressDbWrite.set(taskId, now)
    await db
      .update(schema.backgroundTasks)
      .set({
        progress,
        progressMessage: message ?? null,
      })
      .where(eq(schema.backgroundTasks.id, taskId))
  }

  // Always broadcast to Socket.IO for real-time UI, but don't persist every progress event
  await emitTaskEvent(taskId, 'progress', { progress, message }, shouldPersist)
}

/**
 * Complete a task with output
 */
async function completeTask<TOutput>(
  taskId: string,
  output: TOutput,
  type?: TaskType
): Promise<void> {
  clearTaskTimeout(taskId)
  const now = new Date()

  await db
    .update(schema.backgroundTasks)
    .set({
      status: 'completed',
      output: output as any,
      progress: 100,
      completedAt: now,
    })
    .where(eq(schema.backgroundTasks.id, taskId))

  await emitTaskEvent(taskId, 'completed', { output })

  if (type) {
    try {
      lifecycleHooks.onTaskCompleted?.(taskId, type)
    } catch (err) {
      console.error(`[TaskManager] Lifecycle hook onTaskCompleted error:`, err)
    }
  }
}

/**
 * Fail a task with error message
 */
async function failTask(taskId: string, error: string, type?: TaskType): Promise<void> {
  clearTaskTimeout(taskId)
  const now = new Date()

  await db
    .update(schema.backgroundTasks)
    .set({
      status: 'failed',
      error,
      completedAt: now,
    })
    .where(eq(schema.backgroundTasks.id, taskId))

  await emitTaskEvent(taskId, 'failed', { error })

  if (type) {
    try {
      lifecycleHooks.onTaskFailed?.(taskId, type, error)
    } catch (err) {
      console.error(`[TaskManager] Lifecycle hook onTaskFailed error:`, err)
    }
  }
}

/**
 * Cancel a task
 */
export async function cancelTask(taskId: string): Promise<boolean> {
  const task = await db.query.backgroundTasks.findFirst({
    where: eq(schema.backgroundTasks.id, taskId),
  })

  if (!task) return false
  if (task.status !== 'pending' && task.status !== 'running') return false

  clearTaskTimeout(taskId)

  // Mark as cancelled in memory for same-pod handler check
  cancelledTasks.add(taskId)

  const now = new Date()
  await db
    .update(schema.backgroundTasks)
    .set({
      status: 'cancelled',
      completedAt: now,
    })
    .where(eq(schema.backgroundTasks.id, taskId))

  await emitTaskEvent(taskId, 'cancelled', {})
  return true
}

/**
 * Get task state by ID
 */
export async function getTaskState(taskId: string): Promise<TaskState | null> {
  const task = await db.query.backgroundTasks.findFirst({
    where: eq(schema.backgroundTasks.id, taskId),
  })

  if (!task) return null

  return {
    id: task.id,
    type: task.type as TaskType,
    status: task.status as TaskStatus,
    progress: task.progress ?? 0,
    progressMessage: task.progressMessage,
    input: task.input,
    output: task.output,
    error: task.error,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    userId: task.userId,
  }
}

/**
 * Get lightweight task state for sending to clients via Socket.IO
 * Omits the `input` field which can contain large data (e.g., base64 images)
 */
export async function getTaskStateForClient(taskId: string): Promise<TaskStateForClient | null> {
  const task = await db.query.backgroundTasks.findFirst({
    where: eq(schema.backgroundTasks.id, taskId),
  })

  if (!task) return null

  return {
    id: task.id,
    type: task.type as TaskType,
    status: task.status as TaskStatus,
    progress: task.progress ?? 0,
    progressMessage: task.progressMessage,
    output: task.output,
    error: task.error,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
  }
}

/**
 * Get all events for a task (for replay)
 */
export async function getTaskEvents(taskId: string): Promise<TaskEvent[]> {
  const events = await db.query.backgroundTaskEvents.findMany({
    where: eq(schema.backgroundTaskEvents.taskId, taskId),
    orderBy: [asc(schema.backgroundTaskEvents.id)],
  })

  return events.map((event) => ({
    id: event.id,
    taskId: event.taskId,
    eventType: event.eventType,
    payload: event.payload,
    createdAt: event.createdAt,
  }))
}

/**
 * Create and start a background task
 *
 * @param type - The type of task (for routing to correct handler)
 * @param input - Input data for the task
 * @param handler - Async function that performs the work
 * @param userId - Optional user ID to associate with task
 * @returns The task ID
 *
 * @example
 * ```typescript
 * const taskId = await createTask<DemoInput, DemoOutput, DemoTaskEvent>(
 *   'demo',
 *   { duration: 10 },
 *   async (handle, input) => {
 *     for (let i = 1; i <= 10; i++) {
 *       await sleep(input.duration * 100)
 *       handle.setProgress(i * 10, `Step ${i}/10`)
 *       handle.emit({ type: 'log', step: i, timestamp: new Date().toISOString() })
 *     }
 *     handle.complete({ message: 'Done!' })
 *   }
 * )
 * ```
 */
export async function createTask<
  TInput,
  TOutput,
  TEvent extends TaskEventBase = TaskEventBase,
>(
  type: TaskType,
  input: TInput,
  handler: (handle: TaskHandle<TOutput, TEvent>, input: TInput) => Promise<void>,
  userId?: string
): Promise<string> {
  const id = createId()
  const now = new Date()

  // Persist task
  await db.insert(schema.backgroundTasks).values({
    id,
    type,
    status: 'pending',
    input: input as any,
    createdAt: now,
    userId: userId ?? null,
  })

  // Create handle for the handler
  const handle: TaskHandle<TOutput, TEvent> = {
    id,
    emit: (event) => {
      // Destructure the typed event: `type` becomes the eventType, rest is the payload
      const { type: eventType, ...payload } = event
      // Fire and forget - don't block the handler (persisted to DB)
      void emitTaskEvent(id, eventType, payload, true)
    },
    emitTransient: (event) => {
      const { type: eventType, ...payload } = event
      // Fire and forget - Socket.IO only, no DB write
      void emitTaskEvent(id, eventType, payload, false)
    },
    setProgress: (progress, message) => {
      void updateProgress(id, progress, message)
    },
    complete: (output) => {
      void completeTask(id, output, type)
    },
    fail: (error) => {
      void failTask(id, error, type)
    },
    isCancelled: () => cancelledTasks.has(id),
  }

  // Start task asynchronously (don't block the return)
  console.log(`[TaskManager] Task ${id} (${type}) created`)

  try {
    lifecycleHooks.onTaskCreated?.(id, type)
  } catch (err) {
    console.error(`[TaskManager] Lifecycle hook onTaskCreated error:`, err)
  }

  setImmediate(async () => {
    // Update status to running
    await db
      .update(schema.backgroundTasks)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(schema.backgroundTasks.id, id))

    await emitTaskEvent(id, 'started', {})

    // Start timeout timer
    const timeoutMs = getTaskTimeout(type)
    const timer = setTimeout(async () => {
      const task = await db.query.backgroundTasks.findFirst({
        where: eq(schema.backgroundTasks.id, id),
      })
      if (task && task.status === 'running') {
        console.error(
          `[TaskManager] Task ${id} (${type}) timed out after ${timeoutMs / 1000}s`
        )
        await failTask(id, `Task timed out after ${timeoutMs / 1000}s`, type)
      }
    }, timeoutMs)
    activeTimeouts.set(id, timer)

    try {
      await handler(handle, input)
      console.log(`[TaskManager] Task ${id} completed`)
    } catch (err) {
      console.error(`[TaskManager] Task ${id} failed:`, err)
      // Don't fail if already completed/failed/cancelled
      const task = await db.query.backgroundTasks.findFirst({
        where: eq(schema.backgroundTasks.id, id),
      })
      if (task && task.status === 'running') {
        await failTask(id, err instanceof Error ? err.message : String(err), type)
      }
    } finally {
      // Clean up tracking state
      clearTaskTimeout(id)
      cancelledTasks.delete(id)
      lastProgressDbWrite.delete(id)
    }
  })

  return id
}

// ============================================================================
// Zombie Task Cleanup
// ============================================================================

/**
 * Mark any tasks stuck in 'running' or 'pending' status as failed.
 *
 * This should be called on server startup to clean up tasks that were
 * interrupted by a pod restart or crash. Without this, those tasks
 * would appear as "running" forever in the UI.
 *
 * @returns Number of zombie tasks cleaned up
 */
export async function cleanupZombieTasks(): Promise<number> {
  const zombies = await db.query.backgroundTasks.findMany({
    where: inArray(schema.backgroundTasks.status, ['running', 'pending']),
  })

  if (zombies.length === 0) {
    return 0
  }

  console.log(`[TaskManager] Found ${zombies.length} zombie task(s), marking as failed`)

  const now = new Date()
  for (const task of zombies) {
    await db
      .update(schema.backgroundTasks)
      .set({
        status: 'failed',
        error: 'Task interrupted by server restart',
        completedAt: now,
      })
      .where(eq(schema.backgroundTasks.id, task.id))

    await emitTaskEvent(task.id, 'failed', {
      error: 'Task interrupted by server restart',
    })

    console.log(
      `[TaskManager] Zombie task ${task.id} (${task.type}) marked as failed`
    )

    try {
      lifecycleHooks.onTaskFailed?.(
        task.id,
        task.type as TaskType,
        'Task interrupted by server restart'
      )
    } catch (err) {
      console.error(`[TaskManager] Lifecycle hook onTaskFailed error during cleanup:`, err)
    }
  }

  return zombies.length
}

/**
 * Get tasks for a user
 */
export async function getUserTasks(userId: string, limit = 20): Promise<TaskState[]> {
  const tasks = await db.query.backgroundTasks.findMany({
    where: eq(schema.backgroundTasks.userId, userId),
    orderBy: [asc(schema.backgroundTasks.createdAt)],
    limit,
  })

  return tasks.map((task) => ({
    id: task.id,
    type: task.type as TaskType,
    status: task.status as TaskStatus,
    progress: task.progress ?? 0,
    progressMessage: task.progressMessage,
    input: task.input,
    output: task.output,
    error: task.error,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    userId: task.userId,
  }))
}
