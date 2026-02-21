/**
 * Background task route for selective problem re-parsing
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/parse-selected/task
 *   - Start a new re-parse task for selected problems
 *   - Returns taskId for Socket.IO subscription
 *
 * GET /api/curriculum/[playerId]/attachments/[attachmentId]/parse-selected/task
 *   - Check for active re-parse task (for reconnection after page reload)
 *   - Returns taskId if a task is running/pending
 */

import { and, desc, eq, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { backgroundTasks } from '@/db/schema/background-tasks'
import { practiceAttachments } from '@/db/schema/practice-attachments'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { startWorksheetReparse, type WorksheetReparseInput } from '@/lib/tasks/worksheet-reparse'
import { getUserId } from '@/lib/viewer'

// Request body schema
const RequestBodySchema = z.object({
  problemIndices: z.array(z.number().int().min(0)).min(1).max(50),
  boundingBoxes: z.array(
    z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
  ),
  additionalContext: z.string().optional(),
})

/**
 * POST - Start a new re-parse task
 */
export const POST = withAuth(async (request, { params }) => {
  const { playerId, attachmentId } = (await params) as { playerId: string; attachmentId: string }

  if (!playerId || !attachmentId) {
    return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
  }

  // Parse request body
  let body: z.infer<typeof RequestBodySchema>
  try {
    const rawBody = await request.json()
    body = RequestBodySchema.parse(rawBody)
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 400 }
    )
  }

  const { problemIndices, boundingBoxes, additionalContext } = body

  if (problemIndices.length !== boundingBoxes.length) {
    return NextResponse.json(
      { error: 'problemIndices and boundingBoxes must have the same length' },
      { status: 400 }
    )
  }

  // Authorization check
  const userId = await getUserId()
  const canParse = await canPerformAction(userId, playerId, 'start-session')
  if (!canParse) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Get attachment record
  const attachment = await db
    .select()
    .from(practiceAttachments)
    .where(eq(practiceAttachments.id, attachmentId))
    .get()

  if (!attachment || attachment.playerId !== playerId) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  // Must have existing parsing result to merge into
  if (!attachment.rawParsingResult) {
    return NextResponse.json({ error: 'Attachment has not been parsed yet' }, { status: 400 })
  }

  // Check for already running task
  const existingTask = await db
    .select({ id: backgroundTasks.id, status: backgroundTasks.status })
    .from(backgroundTasks)
    .where(
      and(
        eq(backgroundTasks.type, 'worksheet-reparse'),
        or(eq(backgroundTasks.status, 'pending'), eq(backgroundTasks.status, 'running'))
      )
    )
    .orderBy(desc(backgroundTasks.createdAt))
    .get()

  // Check if this task is for our attachment
  if (existingTask) {
    const taskInput = await db
      .select({ input: backgroundTasks.input })
      .from(backgroundTasks)
      .where(eq(backgroundTasks.id, existingTask.id))
      .get()

    if (taskInput?.input) {
      const input = taskInput.input as WorksheetReparseInput
      if (input.attachmentId === attachmentId) {
        console.log(
          '[ReparseTaskAPI] Task already running for attachment:',
          attachmentId,
          'taskId:',
          existingTask.id
        )
        return NextResponse.json({
          taskId: existingTask.id,
          status: 'already_running',
        })
      }
    }
  }

  console.log('[ReparseTaskAPI] Starting worksheet re-parse task for attachment:', attachmentId)
  const taskId = await startWorksheetReparse({
    attachmentId,
    playerId,
    problemIndices,
    boundingBoxes,
    additionalContext,
  })
  console.log('[ReparseTaskAPI] Task created with ID:', taskId)

  return NextResponse.json({ taskId, status: 'started' })
})

/**
 * GET - Check for active re-parse task (for reconnection)
 */
export const GET = withAuth(async (_request, { params }) => {
  const { playerId, attachmentId } = (await params) as { playerId: string; attachmentId: string }

  if (!playerId || !attachmentId) {
    return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
  }

  // Authorization check
  const userId = await getUserId()
  const canView = await canPerformAction(userId, playerId, 'view')
  if (!canView) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Find active task for this attachment
  const tasks = await db
    .select({
      id: backgroundTasks.id,
      status: backgroundTasks.status,
      input: backgroundTasks.input,
    })
    .from(backgroundTasks)
    .where(
      and(
        eq(backgroundTasks.type, 'worksheet-reparse'),
        or(eq(backgroundTasks.status, 'pending'), eq(backgroundTasks.status, 'running'))
      )
    )
    .orderBy(desc(backgroundTasks.createdAt))
    .all()

  // Find the task that matches our attachment
  for (const task of tasks) {
    if (task.input) {
      const input = task.input as WorksheetReparseInput
      if (input.attachmentId === attachmentId) {
        return NextResponse.json({
          taskId: task.id,
          status: task.status,
        })
      }
    }
  }

  return NextResponse.json({ taskId: null, status: 'none' })
})
