/**
 * API route for session attachments
 *
 * GET /api/curriculum/[playerId]/sessions/[sessionId]/attachments
 * POST /api/curriculum/[playerId]/sessions/[sessionId]/attachments
 *
 * GET: Returns list of photo attachments for a session.
 * POST: Adds new photos to an existing session.
 */

import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { practiceAttachments, sessionPlans } from '@/db/schema'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import { createId } from '@paralleldrive/cuid2'

interface RouteParams {
  params: Promise<{ playerId: string; sessionId: string }>
}

export interface SessionAttachment {
  id: string
  filename: string
  mimeType: string
  fileSize: number
  uploadedAt: string
  url: string
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
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
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
    const result: SessionAttachment[] = attachments.map((att) => ({
      id: att.id,
      filename: att.filename,
      mimeType: att.mimeType,
      fileSize: att.fileSize,
      uploadedAt: att.uploadedAt,
      url: `/api/curriculum/${playerId}/attachments/${att.id}/file`,
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

    // Authorization check - require 'start-session' permission (parent or present teacher)
    const userId = await getDbUserId()
    const canAdd = await canPerformAction(userId, playerId, 'start-session')
    if (!canAdd) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
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
    const photos: File[] = []
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

    if (photos.length === 0) {
      return NextResponse.json({ error: 'At least one photo is required' }, { status: 400 })
    }

    // Save photos and create attachment records
    const attachments: SessionAttachment[] = []

    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'players', playerId)
    await mkdir(uploadDir, { recursive: true })

    for (const photo of photos) {
      const extension = photo.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filename = `${randomUUID()}.${extension}`
      const filepath = join(uploadDir, filename)

      // Save file
      const bytes = await photo.arrayBuffer()
      await writeFile(filepath, Buffer.from(bytes))

      // Create attachment record
      const attachmentId = createId()
      await db.insert(practiceAttachments).values({
        id: attachmentId,
        playerId,
        sessionId,
        filename,
        mimeType: photo.type,
        fileSize: photo.size,
        uploadedBy: userId,
      })

      attachments.push({
        id: attachmentId,
        filename,
        mimeType: photo.type,
        fileSize: photo.size,
        uploadedAt: new Date().toISOString(),
        url: `/api/curriculum/${playerId}/attachments/${attachmentId}/file`,
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
