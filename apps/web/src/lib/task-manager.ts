import { createId } from '@paralleldrive/cuid2'
import { eq, asc } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSocketIO } from '../socket-server'
import type {
  TaskType,
  TaskStatus,
  TaskEventType,
  BackgroundTask,
  BackgroundTaskEvent,
} from '@/db/schema/background-tasks'

export type { TaskType, TaskStatus, TaskEventType, BackgroundTask, BackgroundTaskEvent }

/**
 * Handle provided to task handlers for reporting progress and completion
 */
export interface TaskHandle<TOutput = unknown> {
  /** The task ID */
  id: string
  /** Emit a custom event to all subscribers */
  emit(eventType: TaskEventType | string, payload: unknown): void
  /** Update progress (0-100) with optional message */
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
 * Emit a task event to all subscribers and persist it for replay
 */
async function emitTaskEvent(taskId: string, eventType: string, payload: unknown): Promise<void> {
  const now = new Date()
  console.log(`[TaskManager] Emitting event: ${eventType} for task ${taskId}`)

  // Persist event for replay
  await db.insert(schema.backgroundTaskEvents).values({
    taskId,
    eventType,
    payload: payload as any,
    createdAt: now,
  })

  // Broadcast via Socket.IO
  const io = getSocketIO()
  if (io) {
    const room = `task:${taskId}`
    const sockets = io.sockets.adapter.rooms.get(room)
    console.log(`[TaskManager] Broadcasting to room ${room}, subscribers: ${sockets?.size ?? 0}`)
    io.to(room).emit('task:event', {
      taskId,
      eventType,
      payload,
      createdAt: now,
    })
  } else {
    console.log('[TaskManager] WARNING: Socket.IO not available!')
  }
}

/**
 * Update task progress and broadcast to subscribers
 */
async function updateProgress(taskId: string, progress: number, message?: string): Promise<void> {
  await db
    .update(schema.backgroundTasks)
    .set({
      progress,
      progressMessage: message ?? null,
    })
    .where(eq(schema.backgroundTasks.id, taskId))

  await emitTaskEvent(taskId, 'progress', { progress, message })
}

/**
 * Complete a task with output
 */
async function completeTask<TOutput>(taskId: string, output: TOutput): Promise<void> {
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
}

/**
 * Fail a task with error message
 */
async function failTask(taskId: string, error: string): Promise<void> {
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
 * const taskId = await createTask<DemoInput, DemoOutput>(
 *   'demo',
 *   { duration: 10 },
 *   async (handle, input) => {
 *     for (let i = 1; i <= 10; i++) {
 *       await sleep(input.duration * 100)
 *       handle.setProgress(i * 10, `Step ${i}/10`)
 *     }
 *     handle.complete({ message: 'Done!' })
 *   }
 * )
 * ```
 */
export async function createTask<TInput, TOutput>(
  type: TaskType,
  input: TInput,
  handler: (handle: TaskHandle<TOutput>, input: TInput) => Promise<void>,
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
  const handle: TaskHandle<TOutput> = {
    id,
    emit: (eventType, payload) => {
      // Fire and forget - don't block the handler
      void emitTaskEvent(id, eventType, payload)
    },
    setProgress: (progress, message) => {
      void updateProgress(id, progress, message)
    },
    complete: (output) => {
      void completeTask(id, output)
    },
    fail: (error) => {
      void failTask(id, error)
    },
    isCancelled: () => cancelledTasks.has(id),
  }

  // Start task asynchronously (don't block the return)
  console.log(`[TaskManager] Task ${id} created, scheduling handler via setImmediate`)
  setImmediate(async () => {
    console.log(`[TaskManager] Task ${id} handler starting`)
    // Update status to running
    await db
      .update(schema.backgroundTasks)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(schema.backgroundTasks.id, id))

    await emitTaskEvent(id, 'started', {})

    try {
      console.log(`[TaskManager] Task ${id} calling handler function`)
      await handler(handle, input)
      console.log(`[TaskManager] Task ${id} handler completed`)
    } catch (err) {
      console.error(`[TaskManager] Task ${id} handler error:`, err)
      // Don't fail if already completed/failed/cancelled
      const task = await db.query.backgroundTasks.findFirst({
        where: eq(schema.backgroundTasks.id, id),
      })
      if (task && task.status === 'running') {
        handle.fail(err instanceof Error ? err.message : String(err))
      }
    } finally {
      // Clean up cancellation tracking
      cancelledTasks.delete(id)
    }
  })

  return id
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
