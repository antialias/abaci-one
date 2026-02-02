/**
 * Admin Tasks API
 *
 * GET /api/admin/tasks - List recent background tasks with their events
 */

import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
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

  // Fetch events for each task (limit per task to avoid huge payloads)
  const tasksWithEvents = await Promise.all(
    tasks.map(async (task) => {
      const events = await db
        .select({
          id: schema.backgroundTaskEvents.id,
          taskId: schema.backgroundTaskEvents.taskId,
          eventType: schema.backgroundTaskEvents.eventType,
          payload: schema.backgroundTaskEvents.payload,
          createdAt: schema.backgroundTaskEvents.createdAt,
        })
        .from(schema.backgroundTaskEvents)
        .where(eq(schema.backgroundTaskEvents.taskId, task.id))
        .orderBy(desc(schema.backgroundTaskEvents.id))
        .limit(100)
        .all()

      // Filter out large payloads for the list view
      const sanitizedEvents = events.reverse().map((event) => ({
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
  )

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
