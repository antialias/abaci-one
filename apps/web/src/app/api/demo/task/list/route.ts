import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { desc, inArray } from 'drizzle-orm'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/demo/task/list
 * Fetch recent background tasks, optionally filtered by status
 *
 * Query params:
 * - status: comma-separated list of statuses (e.g., "running,pending")
 * - limit: max number of tasks to return (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    let query = db
      .select({
        id: schema.backgroundTasks.id,
        type: schema.backgroundTasks.type,
        status: schema.backgroundTasks.status,
        progress: schema.backgroundTasks.progress,
        progressMessage: schema.backgroundTasks.progressMessage,
        error: schema.backgroundTasks.error,
        createdAt: schema.backgroundTasks.createdAt,
        input: schema.backgroundTasks.input,
      })
      .from(schema.backgroundTasks)
      .orderBy(desc(schema.backgroundTasks.createdAt))
      .limit(limit)

    if (statusParam) {
      const statuses = statusParam.split(',').map((s) => s.trim())
      query = query.where(inArray(schema.backgroundTasks.status, statuses)) as typeof query
    }

    const tasks = await query

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks', details: String(error) },
      { status: 500 }
    )
  }
}
