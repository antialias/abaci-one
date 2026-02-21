/**
 * Background Task API for LLM-powered worksheet parsing
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/parse/task
 *   - Start parsing as a background task
 *   - Returns a taskId for Socket.IO subscription
 *   - Survives page reloads with event replay
 *
 * GET /api/curriculum/[playerId]/attachments/[attachmentId]/parse/task
 *   - Get task ID for an attachment (if parsing is in progress)
 */

import { and, eq, gte } from 'drizzle-orm'
import { readFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { db } from '@/db'
import { backgroundTasks } from '@/db/schema/background-tasks'
import { practiceAttachments } from '@/db/schema/practice-attachments'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getLimitsForUser } from '@/lib/subscription'
import { startWorksheetParsing } from '@/lib/tasks/worksheet-parse'
import { getUserId } from '@/lib/viewer'

/**
 * POST - Start worksheet parsing as a background task
 *
 * Body (optional):
 *   - additionalContext: string - Additional context/hints for the LLM
 *   - preservedBoundingBoxes: Record<number, BoundingBox> - Bounding boxes to preserve
 *
 * Returns:
 *   - taskId: string - ID to subscribe via Socket.IO
 */
export const POST = withAuth(async (request, { params }) => {
  try {
    const { playerId, attachmentId } = (await params) as { playerId: string; attachmentId: string }

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getUserId()
    const canParse = await canPerformAction(userId, playerId, 'start-session')
    if (!canParse) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Enforce monthly offline parsing limit
    const limits = await getLimitsForUser(userId)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const parseTasksThisMonth = await db
      .select({ id: backgroundTasks.id })
      .from(backgroundTasks)
      .where(
        and(
          eq(backgroundTasks.type, 'worksheet-parse'),
          eq(backgroundTasks.userId, userId),
          gte(backgroundTasks.createdAt, monthStart)
        )
      )
      .all()
    if (parseTasksThisMonth.length >= limits.maxOfflineParsingPerMonth) {
      return NextResponse.json(
        {
          error: 'Monthly parsing limit reached',
          code: 'PARSING_LIMIT_REACHED',
          limit: limits.maxOfflineParsingPerMonth,
          count: parseTasksThisMonth.length,
        },
        { status: 403 }
      )
    }

    // Get attachment record
    const attachment = await db
      .select()
      .from(practiceAttachments)
      .where(eq(practiceAttachments.id, attachmentId))
      .get()

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    if (attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Check if there's already an active task for this attachment
    // The background_tasks table is the source of truth for in-progress tasks
    const existingTask = await db
      .select()
      .from(backgroundTasks)
      .where(eq(backgroundTasks.status, 'running'))
      .all()
      .then((tasks) =>
        tasks.find((t) => {
          const input = t.input as { attachmentId?: string } | null
          return input?.attachmentId === attachmentId
        })
      )

    if (existingTask) {
      return NextResponse.json({
        taskId: existingTask.id,
        status: 'already_running',
        message: 'Parsing already in progress',
      })
    }

    // Parse request body
    let additionalContext: string | undefined
    let preservedBoundingBoxes:
      | Record<number, { x: number; y: number; width: number; height: number }>
      | undefined
    try {
      const body = await request.json()
      additionalContext = body?.additionalContext
      preservedBoundingBoxes = body?.preservedBoundingBoxes
    } catch {
      // No body or invalid JSON is fine
    }

    // Read the image file
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'players', playerId)
    const filepath = join(uploadDir, attachment.filename)
    const imageBuffer = await readFile(filepath)
    const base64Image = imageBuffer.toString('base64')
    const mimeType = attachment.mimeType || 'image/jpeg'
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`

    // Start the background task
    console.log('[ParseTaskAPI] Starting worksheet parsing task for attachment:', attachmentId)
    const taskId = await startWorksheetParsing({
      imageDataUrl,
      attachmentId,
      playerId,
      promptOptions: additionalContext ? { additionalContext } : undefined,
      preservedBoundingBoxes,
    })
    console.log('[ParseTaskAPI] Task created with ID:', taskId)

    return NextResponse.json({
      taskId,
      status: 'started',
      message: 'Parsing task started',
    })
  } catch (error) {
    console.error('Error starting parse task:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start parsing' },
      { status: 500 }
    )
  }
})

/**
 * GET - Get active task ID for an attachment
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
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
      .select()
      .from(backgroundTasks)
      .where(eq(backgroundTasks.type, 'worksheet-parse'))
      .all()

    const activeTask = tasks.find((t) => {
      if (t.status !== 'running' && t.status !== 'pending') return false
      const input = t.input as { attachmentId?: string } | null
      return input?.attachmentId === attachmentId
    })

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
      message: 'No active parsing task',
    })
  } catch (error) {
    console.error('Error getting parse task:', error)
    return NextResponse.json({ error: 'Failed to get task status' }, { status: 500 })
  }
})
