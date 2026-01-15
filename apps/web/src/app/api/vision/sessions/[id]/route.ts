import { type NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  visionTrainingSessions,
  type VisionTrainingSession,
} from '@/db/schema/vision-training-sessions'
import { promises as fs } from 'fs'
import path from 'path'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Serialize a VisionTrainingSession for JSON response.
 */
function serializeSession(session: VisionTrainingSession) {
  return {
    ...session,
    createdAt: session.createdAt instanceof Date ? session.createdAt.getTime() : session.createdAt,
    trainedAt: session.trainedAt instanceof Date ? session.trainedAt.getTime() : session.trainedAt,
  }
}

/**
 * GET /api/vision/sessions/[id]
 * Get full details of a training session
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const [session] = await db
      .select()
      .from(visionTrainingSessions)
      .where(eq(visionTrainingSessions.id, id))

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({ session: serializeSession(session) })
  } catch (error) {
    console.error('Error fetching training session:', error)
    return NextResponse.json({ error: 'Failed to fetch training session' }, { status: 500 })
  }
}

/**
 * PUT /api/vision/sessions/[id]
 * Update session metadata (notes, tags, displayName)
 *
 * Body:
 * - displayName?: string
 * - notes?: string
 * - tags?: string[]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const body = await request.json()
    const { displayName, notes, tags } = body

    // Check session exists
    const [existingSession] = await db
      .select()
      .from(visionTrainingSessions)
      .where(eq(visionTrainingSessions.id, id))

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Build update object
    const updates: Partial<VisionTrainingSession> = {}
    if (displayName !== undefined) updates.displayName = displayName
    if (notes !== undefined) updates.notes = notes
    if (tags !== undefined) updates.tags = tags

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const [updatedSession] = await db
      .update(visionTrainingSessions)
      .set(updates)
      .where(eq(visionTrainingSessions.id, id))
      .returning()

    return NextResponse.json({ session: serializeSession(updatedSession) })
  } catch (error) {
    console.error('Error updating training session:', error)
    return NextResponse.json({ error: 'Failed to update training session' }, { status: 500 })
  }
}

/**
 * DELETE /api/vision/sessions/[id]
 * Delete a training session and its model files
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    // Get session to find model path
    const [session] = await db
      .select()
      .from(visionTrainingSessions)
      .where(eq(visionTrainingSessions.id, id))

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Don't allow deleting the active model without confirmation
    if (session.isActive) {
      return NextResponse.json(
        {
          error: 'Cannot delete active model. Activate a different model first.',
          code: 'ACTIVE_MODEL',
        },
        { status: 409 }
      )
    }

    // Delete model files
    const modelDir = path.join(process.cwd(), 'data/vision-training/models', session.modelPath)
    try {
      await fs.rm(modelDir, { recursive: true, force: true })
      console.log(`Deleted model files at ${modelDir}`)
    } catch (fsError) {
      // Log but don't fail if files don't exist
      console.warn(`Could not delete model files at ${modelDir}:`, fsError)
    }

    // Delete database record
    await db.delete(visionTrainingSessions).where(eq(visionTrainingSessions.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting training session:', error)
    return NextResponse.json({ error: 'Failed to delete training session' }, { status: 500 })
  }
}
