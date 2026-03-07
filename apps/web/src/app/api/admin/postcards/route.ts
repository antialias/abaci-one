/**
 * Admin Postcards API
 *
 * GET /api/admin/postcards - List recent postcards with their task trees
 */

import { NextResponse } from 'next/server'
import { desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'

export const GET = withAuth(
  async (request) => {
    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)

    // Fetch postcards
    let postcards = await db
      .select()
      .from(schema.numberLinePostcards)
      .orderBy(desc(schema.numberLinePostcards.createdAt))
      .limit(limit)
      .all()

    // Apply status filter if provided
    if (statusFilter) {
      postcards = postcards.filter((p) => p.status === statusFilter)
    }

    // Collect all task IDs from postcards
    const taskIds = postcards.map((p) => p.taskId).filter((id): id is string => id !== null)

    if (taskIds.length === 0) {
      return NextResponse.json({
        postcards: postcards.map((p) => ({
          ...p,
          manifest: p.manifest,
          parentTask: null,
          childTasks: [],
        })),
      })
    }

    // Fetch parent tasks
    const parentTasks = await db
      .select({
        id: schema.backgroundTasks.id,
        type: schema.backgroundTasks.type,
        status: schema.backgroundTasks.status,
        progress: schema.backgroundTasks.progress,
        progressMessage: schema.backgroundTasks.progressMessage,
        error: schema.backgroundTasks.error,
        output: schema.backgroundTasks.output,
        createdAt: schema.backgroundTasks.createdAt,
        startedAt: schema.backgroundTasks.startedAt,
        completedAt: schema.backgroundTasks.completedAt,
      })
      .from(schema.backgroundTasks)
      .where(inArray(schema.backgroundTasks.id, taskIds))
      .all()

    const parentTaskMap = new Map(parentTasks.map((t) => [t.id, t]))

    // Fetch child tasks for all parent task IDs
    const childTasks = await db
      .select({
        id: schema.backgroundTasks.id,
        type: schema.backgroundTasks.type,
        status: schema.backgroundTasks.status,
        progress: schema.backgroundTasks.progress,
        progressMessage: schema.backgroundTasks.progressMessage,
        error: schema.backgroundTasks.error,
        output: schema.backgroundTasks.output,
        createdAt: schema.backgroundTasks.createdAt,
        startedAt: schema.backgroundTasks.startedAt,
        completedAt: schema.backgroundTasks.completedAt,
        parentTaskId: schema.backgroundTasks.parentTaskId,
      })
      .from(schema.backgroundTasks)
      .where(inArray(schema.backgroundTasks.parentTaskId, taskIds))
      .all()

    // Group child tasks by parent
    const childTasksByParent = new Map<string, typeof childTasks>()
    for (const child of childTasks) {
      if (!child.parentTaskId) continue
      const existing = childTasksByParent.get(child.parentTaskId) ?? []
      existing.push(child)
      childTasksByParent.set(child.parentTaskId, existing)
    }

    // Assemble response
    const result = postcards.map((p) => ({
      ...p,
      manifest: p.manifest,
      parentTask: p.taskId ? (parentTaskMap.get(p.taskId) ?? null) : null,
      childTasks: p.taskId ? (childTasksByParent.get(p.taskId) ?? []) : [],
    }))

    return NextResponse.json({ postcards: result })
  },
  { role: 'admin' }
)
