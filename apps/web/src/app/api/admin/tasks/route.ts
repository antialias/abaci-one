/**
 * Admin Tasks API
 *
 * GET /api/admin/tasks - List recent background tasks (without events for fast loading)
 * GET /api/admin/tasks?taskId=xxx - Get a single task with its events
 */

import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'

export const GET = withAuth(async (request) => {
  const url = new URL(request.url)
  const taskId = url.searchParams.get('taskId')

  // Single task with events
  if (taskId) {
    const task = await db.query.backgroundTasks.findFirst({
      where: eq(schema.backgroundTasks.id, taskId),
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const events = await db
      .select({
        id: schema.backgroundTaskEvents.id,
        taskId: schema.backgroundTaskEvents.taskId,
        eventType: schema.backgroundTaskEvents.eventType,
        payload: schema.backgroundTaskEvents.payload,
        createdAt: schema.backgroundTaskEvents.createdAt,
      })
      .from(schema.backgroundTaskEvents)
      .where(eq(schema.backgroundTaskEvents.taskId, taskId))
      .orderBy(schema.backgroundTaskEvents.id)
      .limit(200)
      .all()

    return NextResponse.json({
      task: {
        id: task.id,
        type: task.type,
        status: task.status,
        progress: task.progress ?? 0,
        progressMessage: task.progressMessage,
        error: task.error,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        events: events.map((e) => ({ ...e, payload: sanitizePayload(e.payload) })),
      },
    })
  }

  // Task list (no events, no input/output blobs — fast)
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

  const taskList = await db
    .select({
      id: schema.backgroundTasks.id,
      type: schema.backgroundTasks.type,
      status: schema.backgroundTasks.status,
      progress: schema.backgroundTasks.progress,
      progressMessage: schema.backgroundTasks.progressMessage,
      error: schema.backgroundTasks.error,
      createdAt: schema.backgroundTasks.createdAt,
      startedAt: schema.backgroundTasks.startedAt,
      completedAt: schema.backgroundTasks.completedAt,
    })
    .from(schema.backgroundTasks)
    .orderBy(desc(schema.backgroundTasks.createdAt))
    .limit(Math.min(limit, 100))
    .all()

  const tasks = taskList.map((t) => ({
    ...t,
    progress: t.progress ?? 0,
    events: [],
  }))

  return NextResponse.json({ tasks })
}, { role: 'admin' })

/**
 * Remove or truncate large fields from event payloads
 */
function sanitizePayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload

  if (typeof payload === 'string') {
    // Truncate long strings
    return payload.length > 500 ? payload.substring(0, 500) + '...' : payload
  }

  if (typeof payload !== 'object') return payload

  const obj = payload as Record<string, unknown>
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    // Skip image data entirely
    if (key === 'imageDataUrl' || key === 'croppedDataUrl') {
      result[key] = '[IMAGE DATA OMITTED]'
      continue
    }

    // Skip accumulated text (can be very long)
    if (key === 'accumulated') {
      result[key] = '[ACCUMULATED TEXT OMITTED]'
      continue
    }

    // Handle nested objects
    if (typeof value === 'object' && value !== null) {
      result[key] = sanitizePayload(value)
      continue
    }

    // Truncate long strings
    if (typeof value === 'string' && value.length > 500) {
      result[key] = value.substring(0, 500) + '...'
      continue
    }

    result[key] = value
  }

  return result
}
