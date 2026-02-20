import { type NextRequest, NextResponse } from 'next/server'
import { eq, desc, and } from 'drizzle-orm'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/db'
import {
  visionTrainingSessions,
  type VisionTrainingSession,
  toVisionSessionSummary,
} from '@/db/schema/vision-training-sessions'
import type {
  DatasetInfo,
  EpochData,
  ModelType,
  TrainingConfig,
  TrainingResult,
} from '@/app/vision-training/train/components/wizard/types'
import { withAuth } from '@/lib/auth/withAuth'

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
    const sourceFilePath = path.join(sourceDir, file)
    const targetPath = path.join(targetDir, file)

    // Only copy regular files (not directories)
    const stat = await fs.stat(sourceFilePath)
    if (stat.isFile()) {
      await fs.copyFile(sourceFilePath, targetPath)
      console.log(`Copied ${file} to ${targetDir}`)
    }
  }
}

/**
 * Serialize a VisionTrainingSession for JSON response.
 * Converts Date objects to timestamps (milliseconds) for consistent client handling.
 */
function serializeSession(session: VisionTrainingSession) {
  return {
    ...session,
    createdAt: session.createdAt instanceof Date ? session.createdAt.getTime() : session.createdAt,
    trainedAt: session.trainedAt instanceof Date ? session.trainedAt.getTime() : session.trainedAt,
  }
}

/**
 * GET /api/vision/sessions
 * List all training sessions, optionally filtered by model type
 *
 * Query params:
 * - modelType: 'column-classifier' | 'boundary-detector' (optional)
 * - activeOnly: 'true' (optional) - only return active sessions
 */
export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url)
    const modelType = searchParams.get('modelType') as ModelType | null
    const activeOnly = searchParams.get('activeOnly') === 'true'

    // Build query conditions
    const conditions = []
    if (modelType) {
      conditions.push(eq(visionTrainingSessions.modelType, modelType))
    }
    if (activeOnly) {
      conditions.push(eq(visionTrainingSessions.isActive, true))
    }

    // Fetch sessions
    const sessions = await db
      .select()
      .from(visionTrainingSessions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(visionTrainingSessions.trainedAt))

    // Convert to summaries for list view
    const summaries = sessions.map((s) => ({
      ...toVisionSessionSummary(s),
      trainedAt: s.trainedAt instanceof Date ? s.trainedAt.getTime() : s.trainedAt,
    }))

    return NextResponse.json({ sessions: summaries })
  } catch (error) {
    console.error('Error fetching training sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch training sessions' }, { status: 500 })
  }
})

/**
 * POST /api/vision/sessions
 * Create a new training session record
 *
 * Body:
 * - modelType: 'column-classifier' | 'boundary-detector' (required)
 * - displayName: string (required)
 * - config: TrainingConfig (required)
 * - datasetInfo: DatasetInfo (required)
 * - result: TrainingResult (required)
 * - epochHistory: EpochData[] (required)
 * - modelPath: string (required)
 * - notes?: string
 * - tags?: string[]
 * - setActive?: boolean - whether to set this as the active model (default: false)
 */
export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const {
      modelType,
      displayName,
      config,
      datasetInfo,
      result,
      epochHistory,
      modelPath,
      notes,
      tags,
      setActive = false,
    } = body

    // Validate required fields
    if (
      !modelType ||
      !displayName ||
      !config ||
      !datasetInfo ||
      !result ||
      !epochHistory ||
      !modelPath
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate modelType
    if (modelType !== 'column-classifier' && modelType !== 'boundary-detector') {
      return NextResponse.json(
        {
          error: 'Invalid modelType. Must be column-classifier or boundary-detector',
        },
        { status: 400 }
      )
    }

    // If setActive, first deactivate any existing active model for this type
    // and copy model files to public/models/
    if (setActive) {
      await db
        .update(visionTrainingSessions)
        .set({ isActive: false })
        .where(
          and(
            eq(visionTrainingSessions.modelType, modelType as ModelType),
            eq(visionTrainingSessions.isActive, true)
          )
        )

      // Copy model files to public directory
      await copyModelToPublic(modelPath, modelType as 'column-classifier' | 'boundary-detector')
    }

    // Create the new session
    const [newSession] = await db
      .insert(visionTrainingSessions)
      .values({
        modelType: modelType as ModelType,
        displayName,
        config: config as TrainingConfig,
        datasetInfo: datasetInfo as DatasetInfo,
        result: result as TrainingResult,
        epochHistory: epochHistory as EpochData[],
        modelPath,
        isActive: setActive,
        notes: notes || null,
        tags: tags || [],
        trainedAt: new Date(),
      })
      .returning()

    return NextResponse.json({ session: serializeSession(newSession) }, { status: 201 })
  } catch (error) {
    console.error('Error creating training session:', error)
    return NextResponse.json({ error: 'Failed to create training session' }, { status: 500 })
  }
})
