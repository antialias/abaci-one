/**
 * Background Task API for Vision Training
 *
 * POST /api/vision-training/train/task
 *   - Start training as a background task
 *   - Returns a taskId for Socket.IO subscription
 *
 * GET /api/vision-training/train/task
 *   - Get active training task (if any)
 *
 * DELETE /api/vision-training/train/task
 *   - Cancel the active training task
 *
 * PUT /api/vision-training/train/task
 *   - Request early stop (save model at end of current epoch)
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { backgroundTasks } from '@/db/schema/background-tasks'
import { startVisionTraining, requestEarlyStop } from '@/lib/tasks/vision-training'
import { cancelTask } from '@/lib/task-manager'
import { requireAdmin } from '@/lib/auth/requireRole'

export const dynamic = 'force-dynamic'

/**
 * POST - Start vision training as a background task
 */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    // Check for already-running training task
    const existingTask = await db
      .select()
      .from(backgroundTasks)
      .where(eq(backgroundTasks.type, 'vision-training'))
      .all()
      .then((tasks) => tasks.find((t) => t.status === 'running' || t.status === 'pending'))

    if (existingTask) {
      return NextResponse.json({
        taskId: existingTask.id,
        status: 'already_running',
        message: 'Training already in progress',
      })
    }

    // Parse request body
    let config: {
      modelType?: 'column-classifier' | 'boundary-detector'
      epochs?: number
      batchSize?: number
      validationSplit?: number
      noAugmentation?: boolean
      colorAugmentation?: boolean
      manifestId?: string
    } = {}
    try {
      const body = await request.text()
      if (body) {
        config = JSON.parse(body)
      }
    } catch {
      // Use defaults if body parsing fails
    }

    // Start the background task
    const taskId = await startVisionTraining({
      modelType: config.modelType ?? 'column-classifier',
      epochs: config.epochs,
      batchSize: config.batchSize,
      validationSplit: config.validationSplit,
      noAugmentation: config.noAugmentation,
      colorAugmentation: config.colorAugmentation,
      manifestId: config.manifestId,
    })

    return NextResponse.json({
      taskId,
      status: 'started',
      message: 'Training task started',
    })
  } catch (error) {
    console.error('[VisionTrainingTaskAPI] Error starting training task:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start training' },
      { status: 500 }
    )
  }
}

/**
 * GET - Check for active training task
 */
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const tasks = await db
      .select({
        id: backgroundTasks.id,
        status: backgroundTasks.status,
        progress: backgroundTasks.progress,
        progressMessage: backgroundTasks.progressMessage,
      })
      .from(backgroundTasks)
      .where(eq(backgroundTasks.type, 'vision-training'))
      .all()

    const activeTask = tasks.find((t) => t.status === 'running' || t.status === 'pending')

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
      message: 'No active training task',
    })
  } catch (error) {
    console.error('[VisionTrainingTaskAPI] Error checking task:', error)
    return NextResponse.json({ error: 'Failed to check task status' }, { status: 500 })
  }
}

/**
 * DELETE - Cancel the active training task
 */
export async function DELETE() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const tasks = await db
      .select()
      .from(backgroundTasks)
      .where(eq(backgroundTasks.type, 'vision-training'))
      .all()

    const activeTask = tasks.find((t) => t.status === 'running' || t.status === 'pending')

    if (!activeTask) {
      return NextResponse.json({ message: 'No training in progress' })
    }

    const cancelled = await cancelTask(activeTask.id)
    return NextResponse.json({
      cancelled,
      message: cancelled ? 'Training cancellation requested' : 'Could not cancel training',
    })
  } catch (error) {
    console.error('[VisionTrainingTaskAPI] Error cancelling:', error)
    return NextResponse.json({ error: 'Failed to cancel training' }, { status: 500 })
  }
}

/**
 * PUT - Request early stop (save model at end of current epoch)
 */
export async function PUT() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const tasks = await db
      .select()
      .from(backgroundTasks)
      .where(eq(backgroundTasks.type, 'vision-training'))
      .all()

    const activeTask = tasks.find((t) => t.status === 'running' || t.status === 'pending')

    if (!activeTask) {
      return NextResponse.json({ message: 'No training in progress' })
    }

    const stopped = requestEarlyStop(activeTask.id)
    return NextResponse.json({
      stopped,
      message: stopped
        ? 'Early stop requested - model will be saved at end of current epoch'
        : 'Could not request early stop (training may not be running on this pod)',
    })
  } catch (error) {
    console.error('[VisionTrainingTaskAPI] Error requesting early stop:', error)
    return NextResponse.json({ error: 'Failed to request early stop' }, { status: 500 })
  }
}
