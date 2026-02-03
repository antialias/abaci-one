/**
 * Admin Tasks API
 *
 * GET /api/admin/tasks - List recent background tasks with their events
 */

import { NextResponse } from 'next/server'
import { desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

  // Fetch recent tasks
  const tasks = await db
    .select()
    .from(schema.backgroundTasks)
    .orderBy(desc(schema.backgroundTasks.createdAt))
    .limit(Math.min(limit, 100))
    .all()

  if (tasks.length === 0) {
    return NextResponse.json({ tasks: [] })
  }

  // Fetch all events in a single query instead of N+1
  const taskIds = tasks.map((t) => t.id)
  const allEvents = await db
    .select({
      id: schema.backgroundTaskEvents.id,
      taskId: schema.backgroundTaskEvents.taskId,
      eventType: schema.backgroundTaskEvents.eventType,
      payload: schema.backgroundTaskEvents.payload,
      createdAt: schema.backgroundTaskEvents.createdAt,
    })
    .from(schema.backgroundTaskEvents)
    .where(inArray(schema.backgroundTaskEvents.taskId, taskIds))
    .orderBy(schema.backgroundTaskEvents.id)
    .all()

  // Group events by task ID
  const eventsByTask = new Map<string, typeof allEvents>()
  for (const event of allEvents) {
    const existing = eventsByTask.get(event.taskId) ?? []
    existing.push(event)
    eventsByTask.set(event.taskId, existing)
  }

  const tasksWithEvents = tasks.map((task) => {
    const events = (eventsByTask.get(task.id) ?? []).slice(-100) // Keep last 100 per task
    const sanitizedEvents = events.map((event) => ({
      ...event,
      payload: sanitizePayload(event.payload),
    }))

    return {
      id: task.id,
      type: task.type,
      status: task.status,
      progress: task.progress ?? 0,
      progressMessage: task.progressMessage,
      error: task.error,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      events: sanitizedEvents,
    }
  })

  return NextResponse.json({ tasks: tasksWithEvents })
}

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
