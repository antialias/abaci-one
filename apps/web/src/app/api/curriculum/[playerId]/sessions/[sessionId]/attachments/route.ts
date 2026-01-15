/**
 * API route for session attachments
 *
 * GET /api/curriculum/[playerId]/sessions/[sessionId]/attachments
 * POST /api/curriculum/[playerId]/sessions/[sessionId]/attachments
 *
 * GET: Returns list of photo attachments for a session.
 * POST: Adds new photos to an existing session.
 */

// Disable Next.js caching for this route - attachment list changes frequently
export const dynamic = 'force-dynamic'

import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { practiceAttachments, sessionPlans } from '@/db/schema'
import { getPlayerAccess, generateAuthorizationError } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import { createId } from '@paralleldrive/cuid2'

interface RouteParams {
  params: Promise<{ playerId: string; sessionId: string }>
}

export interface SessionAttachment {
  id: string
  filename: string
  originalFilename: string | null
  mimeType: string
  fileSize: number
  uploadedAt: string
  url: string
  originalUrl: string | null
  corners: Array<{ x: number; y: number }> | null
  rotation: 0 | 90 | 180 | 270
  // Parsing fields
  parsingStatus: string | null
  parsedAt: string | null
  parsingError: string | null
  rawParsingResult: unknown | null
  approvedResult: unknown | null
  confidenceScore: number | null
  needsReview: boolean
  sessionCreated: boolean
  createdSessionId: string | null
  // Review progress (for resumable reviews)
  reviewProgress: unknown | null
  // LLM metadata (for debugging/transparency)
  llm: {
    provider: string | null
    model: string | null
    promptUsed: string | null
    rawResponse: string | null
    jsonSchema: string | null
    imageSource: string | null
    attempts: number | null
    usage: {
      promptTokens: number | null
      completionTokens: number | null
      totalTokens: number | null
    }
  } | null
}

/**
 * GET - List attachments for a session
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId, sessionId } = await params

    if (!playerId || !sessionId) {
      return NextResponse.json({ error: 'Player ID and Session ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getDbUserId()
    const access = await getPlayerAccess(userId, playerId)
    if (access.accessLevel === 'none') {
      const authError = generateAuthorizationError(access, 'view', {
        actionDescription: 'view attachments for this student',
      })
      return NextResponse.json(authError, { status: 403 })
    }

    // Get attachments for this session
    const attachments = await db
      .select()
      .from(practiceAttachments)
      .where(
        and(
          eq(practiceAttachments.playerId, playerId),
          eq(practiceAttachments.sessionId, sessionId)
        )
      )
      .all()

    // Transform to response format with URLs
    // Include filename as cache-busting param since it changes on re-crop
    const result: SessionAttachment[] = attachments.map((att) => ({
      id: att.id,
      filename: att.filename,
      originalFilename: att.originalFilename,
      mimeType: att.mimeType,
      fileSize: att.fileSize,
      uploadedAt: att.uploadedAt,
      url: `/api/curriculum/${playerId}/attachments/${att.id}/file?v=${encodeURIComponent(att.filename)}`,
      originalUrl: att.originalFilename
        ? `/api/curriculum/${playerId}/attachments/${att.id}/original?v=${encodeURIComponent(att.originalFilename)}`
        : null,
      corners: att.corners ?? null,
      rotation: (att.rotation ?? 0) as 0 | 90 | 180 | 270,
      // Parsing fields
      parsingStatus: att.parsingStatus ?? null,
      parsedAt: att.parsedAt ?? null,
      parsingError: att.parsingError ?? null,
      rawParsingResult: att.rawParsingResult ?? null,
      approvedResult: att.approvedResult ?? null,
      confidenceScore: att.confidenceScore ?? null,
      needsReview: att.needsReview === true,
      sessionCreated: att.sessionCreated === true,
      createdSessionId: att.createdSessionId ?? null,
      // Review progress (for resumable reviews)
      reviewProgress: att.reviewProgress ?? null,
      // LLM metadata (for debugging/transparency)
      llm:
        att.llmProvider || att.llmModel
          ? {
              provider: att.llmProvider ?? null,
              model: att.llmModel ?? null,
              promptUsed: att.llmPromptUsed ?? null,
              rawResponse: att.llmRawResponse ?? null,
              jsonSchema: att.llmJsonSchema ?? null,
              imageSource: att.llmImageSource ?? null,
              attempts: att.llmAttempts ?? null,
              usage: {
                promptTokens: att.llmPromptTokens ?? null,
                completionTokens: att.llmCompletionTokens ?? null,
                totalTokens: att.llmTotalTokens ?? null,
              },
            }
          : null,
    }))

    return NextResponse.json({ attachments: result })
  } catch (error) {
    console.error('Error fetching session attachments:', error)
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 })
  }
}

/**
 * POST - Add photos to an existing session
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { playerId, sessionId } = await params

    if (!playerId || !sessionId) {
      return NextResponse.json({ error: 'Player ID and Session ID required' }, { status: 400 })
    }

    // Authorization check - require 'view' permission (parent, teacher-enrolled, or teacher-present)
    // Adding photos to an existing session is less sensitive than starting a new session
    const userId = await getDbUserId()
    const access = await getPlayerAccess(userId, playerId)
    if (access.accessLevel === 'none') {
      console.error(
        `[attachments POST] Authorization failed: userId=${userId} has no access to playerId=${playerId}`
      )
      const authError = generateAuthorizationError(access, 'view', {
        actionDescription: 'add photos for this student',
      })
      return NextResponse.json(authError, { status: 403 })
    }

    // Verify session exists and belongs to player
    const session = await db.query.sessionPlans.findFirst({
      where: and(eq(sessionPlans.id, sessionId), eq(sessionPlans.playerId, playerId)),
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Parse form data
    const formData = await request.formData()

    // Get all photos from form data
    // - 'photos' are the displayed/cropped versions
    // - 'originals' are the uncropped originals (optional, same order as photos)
    // - 'corners' are JSON strings of crop coordinates (optional, same order as photos)
    const photos: File[] = []
    const originals: (File | null)[] = []
    const cornersData: (Array<{ x: number; y: number }> | null)[] = []

    for (const [key, value] of formData.entries()) {
      if (key === 'photos' && value instanceof File && value.size > 0) {
        // Validate file type
        if (!value.type.startsWith('image/')) {
          return NextResponse.json({ error: `File ${value.name} is not an image` }, { status: 400 })
        }
        // Validate file size (max 10MB)
        if (value.size > 10 * 1024 * 1024) {
          return NextResponse.json(
            { error: `File ${value.name} exceeds 10MB limit` },
            { status: 400 }
          )
        }
        photos.push(value)
      }
    }

    // Get originals (if provided)
    for (const [key, value] of formData.entries()) {
      if (key === 'originals' && value instanceof File && value.size > 0) {
        // Validate file type
        if (!value.type.startsWith('image/')) {
          return NextResponse.json(
            { error: `Original file ${value.name} is not an image` },
            { status: 400 }
          )
        }
        // Validate file size (max 15MB for originals - larger since uncropped)
        if (value.size > 15 * 1024 * 1024) {
          return NextResponse.json(
            { error: `Original file ${value.name} exceeds 15MB limit` },
            { status: 400 }
          )
        }
        originals.push(value)
      }
    }

    // Get corners data (if provided)
    for (const [key, value] of formData.entries()) {
      if (key === 'corners' && typeof value === 'string') {
        try {
          const parsed = JSON.parse(value) as Array<{ x: number; y: number }>
          cornersData.push(parsed)
        } catch {
          cornersData.push(null)
        }
      }
    }

    // Get rotation data (if provided)
    const rotationData: (0 | 90 | 180 | 270)[] = []
    for (const [key, value] of formData.entries()) {
      if (key === 'rotation' && typeof value === 'string') {
        const parsed = parseInt(value, 10)
        if (parsed === 0 || parsed === 90 || parsed === 180 || parsed === 270) {
          rotationData.push(parsed)
        } else {
          rotationData.push(0)
        }
      }
    }

    if (photos.length === 0) {
      return NextResponse.json({ error: 'At least one photo is required' }, { status: 400 })
    }

    // Save photos and create attachment records
    const attachments: SessionAttachment[] = []

    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'players', playerId)
    await mkdir(uploadDir, { recursive: true })

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]
      const original = originals[i] || null
      const corners = cornersData[i] || null
      const rotation = rotationData[i] || 0

      const extension = photo.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filename = `${randomUUID()}.${extension}`
      const filepath = join(uploadDir, filename)

      // Save cropped/displayed file
      const bytes = await photo.arrayBuffer()
      await writeFile(filepath, Buffer.from(bytes))

      // Save original if provided
      let originalFilename: string | null = null
      if (original) {
        const origExtension = original.name.split('.').pop()?.toLowerCase() || 'jpg'
        originalFilename = `${randomUUID()}_original.${origExtension}`
        const originalFilepath = join(uploadDir, originalFilename)
        const originalBytes = await original.arrayBuffer()
        await writeFile(originalFilepath, Buffer.from(originalBytes))
      }

      // Create attachment record
      const attachmentId = createId()
      await db.insert(practiceAttachments).values({
        id: attachmentId,
        playerId,
        sessionId,
        filename,
        originalFilename,
        mimeType: photo.type,
        fileSize: photo.size,
        uploadedBy: userId,
        corners,
        rotation,
      })

      attachments.push({
        id: attachmentId,
        filename,
        originalFilename,
        mimeType: photo.type,
        fileSize: photo.size,
        uploadedAt: new Date().toISOString(),
        url: `/api/curriculum/${playerId}/attachments/${attachmentId}/file?v=${encodeURIComponent(filename)}`,
        originalUrl: originalFilename
          ? `/api/curriculum/${playerId}/attachments/${attachmentId}/original?v=${encodeURIComponent(originalFilename)}`
          : null,
        corners,
        rotation,
        // New attachments have no parsing data yet
        parsingStatus: null,
        parsedAt: null,
        parsingError: null,
        rawParsingResult: null,
        approvedResult: null,
        confidenceScore: null,
        needsReview: false,
        sessionCreated: false,
        createdSessionId: null,
        // No review progress yet
        reviewProgress: null,
        // No LLM metadata yet
        llm: null,
      })
    }

    return NextResponse.json({
      success: true,
      attachmentCount: attachments.length,
      attachments,
    })
  } catch (error) {
    console.error('Error adding session attachments:', error)
    return NextResponse.json({ error: 'Failed to add attachments' }, { status: 500 })
  }
}
