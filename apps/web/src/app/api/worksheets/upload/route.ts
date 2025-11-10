import { randomUUID } from 'crypto'
import { writeFile } from 'fs/promises'
import { type NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { db } from '@/db'
import { worksheetAttempts } from '@/db/schema'
import { processWorksheetAttempt } from '@/lib/grading/processAttempt'
import { getViewerId } from '@/lib/viewer'

/**
 * Trigger processing in background without blocking response
 * In production, this would be a proper job queue
 */
function processAttemptInBackground(attemptId: string) {
  // Fire and forget - don't await
  processWorksheetAttempt(attemptId).catch((error) => {
    console.error(`Background processing failed for ${attemptId}:`, error)
  })
}

/**
 * Upload API endpoint for worksheet images
 *
 * Teachers upload photos of completed paper worksheets.
 * This endpoint stores the image and creates a database record
 * for background AI grading.
 *
 * Optional: sessionId can be provided to group multiple uploads together
 * (used for QR code batch upload workflow)
 */
export async function POST(request: NextRequest) {
  try {
    // Get viewer ID from session (works for both authenticated users and guests)
    const userId = await getViewerId()

    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Generate unique ID for this attempt
    const attemptId = randomUUID()
    const extension = file.name.split('.').pop() || 'jpg'
    const filename = `${attemptId}.${extension}`

    // Save to local storage (MVP) - will move to Cloudflare R2 later
    const uploadDir = join(process.cwd(), 'data', 'uploads')
    const filepath = join(uploadDir, filename)

    const bytes = await file.arrayBuffer()
    await writeFile(filepath, Buffer.from(bytes))

    // Get optional metadata from form data
    const worksheetId = formData.get('worksheetId') as string | null
    const sessionId = formData.get('sessionId') as string | null // For batch QR uploads
    const operatorInput = formData.get('operator') as string | null
    const digitCountInput = formData.get('digitCount') as string | null
    const problemCountInput = formData.get('problemCount') as string | null

    // Parse metadata with defaults
    const operator = operatorInput || 'addition'
    const digitCount = digitCountInput ? parseInt(digitCountInput, 10) : 2
    const problemCount = problemCountInput ? parseInt(problemCountInput, 10) : 20

    // Create database record
    const now = new Date()
    await db.insert(worksheetAttempts).values({
      id: attemptId,
      userId,
      uploadedImageUrl: `/uploads/${filename}`,
      worksheetId,
      sessionId, // Optional: groups uploads from same QR code session
      operator: operator as 'addition' | 'subtraction' | 'mixed',
      digitCount,
      problemCount,
      gradingStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    })

    // For MVP: Process immediately (not truly async)
    // In production, this should be queued to a background job
    // For now, we'll trigger processing but not wait for it
    processAttemptInBackground(attemptId)

    return NextResponse.json({
      attemptId,
      sessionId, // Echo back for client tracking
      status: 'pending',
      message: 'Upload successful. Grading will begin shortly.',
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
