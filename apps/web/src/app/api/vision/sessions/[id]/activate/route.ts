import { type NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
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
 * Model type to public directory mapping
 */
const MODEL_TYPE_TO_PUBLIC_DIR: Record<string, string> = {
  'column-classifier': 'abacus-column-classifier',
  'boundary-detector': 'abacus-boundary-detector',
}

/**
 * Copy model files to public/models/
 */
async function copyModelToPublic(
  sourcePath: string,
  modelType: 'column-classifier' | 'boundary-detector'
): Promise<void> {
  const sourceDir = path.join(process.cwd(), 'data/vision-training/models', sourcePath)
  const targetDir = path.join(process.cwd(), 'public/models', MODEL_TYPE_TO_PUBLIC_DIR[modelType])

  // Ensure target directory exists
  await fs.mkdir(targetDir, { recursive: true })

  // Read source directory
  const files = await fs.readdir(sourceDir)

  // Copy each file
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file)
    const targetPath = path.join(targetDir, file)

    // Only copy regular files (not directories)
    const stat = await fs.stat(sourcePath)
    if (stat.isFile()) {
      await fs.copyFile(sourcePath, targetPath)
      console.log(`Copied ${file} to ${targetDir}`)
    }
  }
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
 * PUT /api/vision/sessions/[id]/activate
 * Set this session as the active model for its type
 *
 * This will:
 * 1. Deactivate the current active model for this type
 * 2. Copy model files to public/models/
 * 3. Mark this session as active
 */
export async function PUT(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    // Get session
    const [session] = await db
      .select()
      .from(visionTrainingSessions)
      .where(eq(visionTrainingSessions.id, id))

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // If already active, nothing to do
    if (session.isActive) {
      return NextResponse.json({
        session: serializeSession(session),
        message: 'Session is already active',
      })
    }

    // Verify model files exist
    const sourceDir = path.join(process.cwd(), 'data/vision-training/models', session.modelPath)
    try {
      await fs.access(sourceDir)
    } catch {
      return NextResponse.json(
        {
          error: 'Model files not found',
          code: 'MODEL_FILES_MISSING',
          path: session.modelPath,
        },
        { status: 404 }
      )
    }

    // Deactivate current active model for this type
    await db
      .update(visionTrainingSessions)
      .set({ isActive: false })
      .where(
        and(
          eq(visionTrainingSessions.modelType, session.modelType),
          eq(visionTrainingSessions.isActive, true)
        )
      )

    // Copy model files to public directory
    await copyModelToPublic(session.modelPath, session.modelType)

    // Mark this session as active
    const [updatedSession] = await db
      .update(visionTrainingSessions)
      .set({ isActive: true })
      .where(eq(visionTrainingSessions.id, id))
      .returning()

    return NextResponse.json({
      session: serializeSession(updatedSession),
      message: 'Model activated successfully',
    })
  } catch (error) {
    console.error('Error activating model:', error)
    return NextResponse.json({ error: 'Failed to activate model' }, { status: 500 })
  }
}
