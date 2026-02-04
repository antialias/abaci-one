/**
 * Background Task API for Flowchart Refinement
 *
 * POST /api/flowchart-workshop/sessions/[id]/refine/task
 *   - Start refinement as a background task
 *   - Returns { taskId } for Socket.IO subscription
 *
 * GET /api/flowchart-workshop/sessions/[id]/refine/task
 *   - Get active refinement task for this session
 *
 * DELETE /api/flowchart-workshop/sessions/[id]/refine/task
 *   - Cancel the active refinement task
 */

import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { startFlowchartRefinement } from '@/lib/tasks/flowchart-refine'
import { cancelTask, getTaskState } from '@/lib/task-manager'
import { getDbUserId } from '@/lib/viewer'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST - Start flowchart refinement as a background task
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: sessionId } = await params

  // Authorization check
  let userId: string
  try {
    userId = await getDbUserId()
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

  // Check we have a draft to refine
  if (!session.draftDefinitionJson || !session.draftMermaidContent) {
    return NextResponse.json({ error: 'No draft to refine - generate first' }, { status: 400 })
  }

  // Check for already-running task on this session
  if (session.currentTaskId) {
    const existingTask = await getTaskState(session.currentTaskId)
    if (existingTask && (existingTask.status === 'running' || existingTask.status === 'pending')) {
      return NextResponse.json({
        taskId: session.currentTaskId,
        status: 'already_running',
        message: 'Task already in progress on this session',
      })
    }
  }

  // Parse request body
  let refinementRequest: string
  try {
    const body = await request.json()
    refinementRequest = body.request
    if (!refinementRequest) {
      return NextResponse.json({ error: 'Refinement request required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const taskId = await startFlowchartRefinement({
      sessionId,
      refinementRequest,
      userId,
    })

    return NextResponse.json({
      taskId,
      status: 'started',
      message: 'Refinement task started',
    })
  } catch (error) {
    console.error('[FlowchartRefineTaskAPI] Error starting refinement:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start refinement' },
      { status: 500 }
    )
  }
}

/**
 * GET - Check for active refinement task on this session
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: sessionId } = await params

  let userId: string
  try {
    userId = await getDbUserId()
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
}

/**
 * DELETE - Cancel the active refinement task
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: sessionId } = await params

  let userId: string
  try {
    userId = await getDbUserId()
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
    return NextResponse.json({ message: 'No active refinement task' })
  }

  const cancelled = await cancelTask(session.currentTaskId)
  return NextResponse.json({
    cancelled,
    message: cancelled ? 'Refinement cancellation requested' : 'Could not cancel refinement',
  })
}
