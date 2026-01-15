/**
 * API route for offline practice sessions
 *
 * POST /api/curriculum/[playerId]/offline-sessions - Create offline session with photos
 *
 * Offline sessions represent practice done away from the app (with physical abacus).
 * They include the date, practice types performed, and optional photos of student work.
 */

import { createId } from '@paralleldrive/cuid2'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { getPracticeType, isValidPracticeTypeId } from '@/constants/practiceTypes'
import { db } from '@/db'
import { practiceAttachments, sessionPlans } from '@/db/schema'
import type { SessionPart, SessionPartType, SessionSummary } from '@/db/schema/session-plans'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

/**
 * Build minimal session parts for an offline session.
 * Each part has enabled=true if that practice type was performed.
 */
function buildOfflineSessionParts(practiceTypes: SessionPartType[]): SessionPart[] {
  return [
    {
      partNumber: 1,
      type: 'abacus',
      format: 'vertical',
      useAbacus: true,
      slots: [],
      estimatedMinutes: 0,
    },
    {
      partNumber: 2,
      type: 'visualization',
      format: 'vertical',
      useAbacus: false,
      slots: [],
      estimatedMinutes: 0,
    },
    {
      partNumber: 3,
      type: 'linear',
      format: 'linear',
      useAbacus: false,
      slots: [],
      estimatedMinutes: 0,
    },
  ].map((part) => ({
    ...part,
    // We can't add 'enabled' to SessionPart, so we check if slots is empty
    // and set estimatedMinutes > 0 to indicate the part was practiced
    estimatedMinutes: practiceTypes.includes(part.type) ? 1 : 0,
  })) as SessionPart[]
}

/**
 * Build session summary for display
 */
function buildOfflineSummary(practiceTypes: SessionPartType[], date: Date): SessionSummary {
  return {
    focusDescription: `Offline practice on ${date.toLocaleDateString()}`,
    totalProblemCount: 0,
    estimatedMinutes: 0,
    parts: practiceTypes.map((type, idx) => ({
      partNumber: (idx + 1) as 1 | 2 | 3,
      type,
      description: getPracticeType(type).label,
      problemCount: 0,
      estimatedMinutes: 0,
    })),
  }
}

/**
 * POST - Create offline session with photos
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization check - require 'start-session' permission (parent or present teacher)
    const userId = await getDbUserId()
    const canCreate = await canPerformAction(userId, playerId, 'start-session')
    if (!canCreate) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()

    // Get date (defaults to today)
    const dateStr = formData.get('date') as string | null
    const sessionDate = dateStr ? new Date(dateStr) : new Date()
    if (Number.isNaN(sessionDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Get practice types
    const practiceTypesJson = formData.get('practiceTypes') as string | null
    let practiceTypes: SessionPartType[] = []
    if (practiceTypesJson) {
      try {
        const parsed = JSON.parse(practiceTypesJson) as string[]
        // Validate types using central definition
        practiceTypes = parsed.filter(isValidPracticeTypeId)
      } catch {
        return NextResponse.json({ error: 'Invalid practiceTypes format' }, { status: 400 })
      }
    }

    if (practiceTypes.length === 0) {
      return NextResponse.json({ error: 'At least one practice type is required' }, { status: 400 })
    }

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

    // Create session plan
    const sessionId = createId()
    const parts = buildOfflineSessionParts(practiceTypes)
    const summary = buildOfflineSummary(practiceTypes, sessionDate)

    await db.insert(sessionPlans).values({
      id: sessionId,
      playerId,
      targetDurationMinutes: 0,
      estimatedProblemCount: 0,
      avgTimePerProblemSeconds: 0,
      parts,
      summary,
      masteredSkillIds: [],
      status: 'completed',
      currentPartIndex: 3, // Past all parts
      currentSlotIndex: 0,
      results: [],
      createdAt: sessionDate,
      completedAt: sessionDate,
    })

    // Save photos and create attachment records
    const attachments: Array<{ id: string; filename: string }> = []

    if (photos.length > 0) {
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

        attachments.push({ id: attachmentId, filename })
      }
    }

    return NextResponse.json({
      sessionId,
      date: sessionDate.toISOString(),
      practiceTypes,
      attachmentCount: attachments.length,
      attachments,
    })
  } catch (error) {
    console.error('Error creating offline session:', error)
    return NextResponse.json({ error: 'Failed to create offline session' }, { status: 500 })
  }
}
