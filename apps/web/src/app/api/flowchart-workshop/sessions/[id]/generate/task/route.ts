/**
 * Background Task API for Flowchart Generation
 *
 * POST /api/flowchart-workshop/sessions/[id]/generate/task
 *   - Start generation as a background task
 *   - Returns { taskId } for Socket.IO subscription
 *
 * GET /api/flowchart-workshop/sessions/[id]/generate/task
 *   - Get active generation task for this session
 *
 * DELETE /api/flowchart-workshop/sessions/[id]/generate/task
 *   - Cancel the active generation task
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { startFlowchartGeneration } from '@/lib/tasks/flowchart-generate'
import { cancelTask, getTaskState } from '@/lib/task-manager'
import { getUserId } from '@/lib/viewer'

export const dynamic = 'force-dynamic'

/**
 * POST - Start flowchart generation as a background task
 */
export const POST = withAuth(async (request, { params }) => {
  const { id: sessionId } = (await params) as { id: string }

  // Authorization check
  let userId: string
  try {
    userId = await getUserId()
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Get the session
  const session = await db.query.workshopSessions.findFirst({
    where: and(
      eq(schema.workshopSessions.id, sessionId),
      eq(schema.workshopSessions.userId, userId)
    ),
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Check for already-running task on this session
  if (session.currentTaskId) {
    const existingTask = await getTaskState(session.currentTaskId)
    if (existingTask && (existingTask.status === 'running' || existingTask.status === 'pending')) {
      return NextResponse.json({
        taskId: session.currentTaskId,
        status: 'already_running',
        message: 'Generation already in progress',
      })
    }
  }

  // Parse request body
  let topicDescription: string
  try {
    const body = await request.json()
    topicDescription = body.topicDescription || session.topicDescription
    if (!topicDescription) {
      return NextResponse.json({ error: 'Topic description required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const taskId = await startFlowchartGeneration({
      sessionId,
      topicDescription,
      userId,
    })

    return NextResponse.json({
      taskId,
      status: 'started',
      message: 'Generation task started',
    })
  } catch (error) {
    console.error('[FlowchartGenerateTaskAPI] Error starting generation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start generation' },
      { status: 500 }
    )
  }
})

/**
 * GET - Check for active generation task on this session
 */
export const GET = withAuth(async (_request, { params }) => {
  const { id: sessionId } = (await params) as { id: string }

  let userId: string
  try {
    userId = await getUserId()
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const session = await db.query.workshopSessions.findFirst({
    where: and(
      eq(schema.workshopSessions.id, sessionId),
      eq(schema.workshopSessions.userId, userId)
    ),
    columns: { currentTaskId: true },
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (!session.currentTaskId) {
    return NextResponse.json({ taskId: null, status: 'none' })
  }

  const task = await getTaskState(session.currentTaskId)
  if (!task || (task.status !== 'running' && task.status !== 'pending')) {
    return NextResponse.json({ taskId: null, status: 'none' })
  }

  return NextResponse.json({
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    progressMessage: task.progressMessage,
  })
})

/**
 * DELETE - Cancel the active generation task
 */
export const DELETE = withAuth(async (_request, { params }) => {
  const { id: sessionId } = (await params) as { id: string }

  let userId: string
  try {
    userId = await getUserId()
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const session = await db.query.workshopSessions.findFirst({
    where: and(
      eq(schema.workshopSessions.id, sessionId),
      eq(schema.workshopSessions.userId, userId)
    ),
    columns: { currentTaskId: true },
  })

  if (!session?.currentTaskId) {
    return NextResponse.json({ message: 'No active generation task' })
  }

  const cancelled = await cancelTask(session.currentTaskId)
  return NextResponse.json({
    cancelled,
    message: cancelled ? 'Generation cancellation requested' : 'Could not cancel generation',
  })
})
