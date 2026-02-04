/**
 * Background Task API for Flowchart Embedding
 *
 * POST /api/flowcharts/seed-embeddings/task
 *   - Start embedding as a background task
 *   - Returns a taskId for Socket.IO subscription
 *
 * GET /api/flowcharts/seed-embeddings/task
 *   - Get active embedding task (if any)
 *
 * DELETE /api/flowcharts/seed-embeddings/task
 *   - Cancel the active embedding task
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { backgroundTasks } from '@/db/schema/background-tasks'
import { startFlowchartEmbedding } from '@/lib/tasks/flowchart-embed'
import { cancelTask } from '@/lib/task-manager'

export const dynamic = 'force-dynamic'

/**
 * POST - Start flowchart embedding as a background task
 */
export async function POST(request: Request) {
  try {
    // Check for already-running embedding task
    const existingTask = await db
      .select()
      .from(backgroundTasks)
      .where(eq(backgroundTasks.type, 'flowchart-embed'))
      .all()
      .then((tasks) =>
        tasks.find((t) => t.status === 'running' || t.status === 'pending')
      )

    if (existingTask) {
      return NextResponse.json({
        taskId: existingTask.id,
        status: 'already_running',
        message: 'Embedding generation already in progress',
      })
    }

    // Parse request body
    let config: { flowchartId?: string } = {}
    try {
      const body = await request.text()
      if (body) {
        config = JSON.parse(body)
      }
    } catch {
      // Use defaults if body parsing fails
    }

    const taskId = await startFlowchartEmbedding({
      flowchartId: config.flowchartId,
    })

    return NextResponse.json({
      taskId,
      status: 'started',
      message: 'Embedding task started',
    })
  } catch (error) {
    console.error('[FlowchartEmbedTaskAPI] Error starting embedding task:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start embedding' },
      { status: 500 }
    )
  }
}

/**
 * GET - Check for active embedding task
 */
export async function GET() {
  try {
    const tasks = await db
      .select({
        id: backgroundTasks.id,
        status: backgroundTasks.status,
        progress: backgroundTasks.progress,
        progressMessage: backgroundTasks.progressMessage,
      })
      .from(backgroundTasks)
      .where(eq(backgroundTasks.type, 'flowchart-embed'))
      .all()

    const activeTask = tasks.find(
      (t) => t.status === 'running' || t.status === 'pending'
    )

    if (activeTask) {
      return NextResponse.json({
        taskId: activeTask.id,
        status: activeTask.status,
        progress: activeTask.progress,
        progressMessage: activeTask.progressMessage,
      })
    }

    return NextResponse.json({
      taskId: null,
      status: 'none',
      message: 'No active embedding task',
    })
  } catch (error) {
    console.error('[FlowchartEmbedTaskAPI] Error checking task:', error)
    return NextResponse.json({ error: 'Failed to check task status' }, { status: 500 })
  }
}

/**
 * DELETE - Cancel the active embedding task
 */
export async function DELETE() {
  try {
    const tasks = await db
      .select()
      .from(backgroundTasks)
      .where(eq(backgroundTasks.type, 'flowchart-embed'))
      .all()

    const activeTask = tasks.find(
      (t) => t.status === 'running' || t.status === 'pending'
    )

    if (!activeTask) {
      return NextResponse.json({ message: 'No embedding in progress' })
    }

    const cancelled = await cancelTask(activeTask.id)
    return NextResponse.json({
      cancelled,
      message: cancelled ? 'Embedding cancellation requested' : 'Could not cancel embedding',
    })
  } catch (error) {
    console.error('[FlowchartEmbedTaskAPI] Error cancelling:', error)
    return NextResponse.json({ error: 'Failed to cancel embedding' }, { status: 500 })
  }
}
