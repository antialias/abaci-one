/**
 * API route for individual attachment operations
 *
 * PATCH /api/curriculum/[playerId]/attachments/[attachmentId]
 *   - Replace the cropped file with a new version (keeps original)
 *
 * DELETE /api/curriculum/[playerId]/attachments/[attachmentId]
 *   - Deletes a practice attachment (both DB record and files)
 *
 * Authorization is checked to ensure only parents and teachers can modify.
 */

import { randomUUID } from 'crypto'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { practiceAttachments } from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

/**
 * PATCH - Replace the cropped file with a new version
 *
 * Used when re-editing a photo. The original file is preserved,
 * only the cropped/displayed version is replaced.
 */
export const PATCH = withAuth(async (request, { params }) => {
  try {
    const { playerId, attachmentId } = (await params) as { playerId: string; attachmentId: string }

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Authorization check - require 'start-session' permission (parent or present teacher)
    const userId = await getUserId()
    const canEdit = await canPerformAction(userId, playerId, 'start-session')
    if (!canEdit) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get existing attachment record
    const attachment = await db
      .select()
      .from(practiceAttachments)
      .where(eq(practiceAttachments.id, attachmentId))
      .get()

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Verify the attachment belongs to the specified player
    if (attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Parse form data - expect a single 'file' (the new cropped version)
    // and optionally 'corners' (JSON string of crop coordinates) and 'rotation'
    const formData = await request.formData()
    const file = formData.get('file')
    const cornersStr = formData.get('corners')
    const rotationStr = formData.get('rotation')

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Parse corners if provided
    let corners: Array<{ x: number; y: number }> | null = null
    if (cornersStr && typeof cornersStr === 'string') {
      try {
        corners = JSON.parse(cornersStr) as Array<{ x: number; y: number }>
      } catch {
        // Invalid JSON, ignore corners
      }
    }

    // Parse rotation if provided
    let rotation: 0 | 90 | 180 | 270 = 0
    if (rotationStr && typeof rotationStr === 'string') {
      const parsed = parseInt(rotationStr, 10)
      if (parsed === 0 || parsed === 90 || parsed === 180 || parsed === 270) {
        rotation = parsed
      }
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
    }

    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'players', playerId)
    await mkdir(uploadDir, { recursive: true })

    // Delete old cropped file (but NOT the original)
    const oldFilepath = join(uploadDir, attachment.filename)
    try {
      await unlink(oldFilepath)
    } catch {
      // Ignore - file may already be gone
    }

    // Save new cropped file with new UUID
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const newFilename = `${randomUUID()}.${extension}`
    const newFilepath = join(uploadDir, newFilename)

    const bytes = await file.arrayBuffer()
    await writeFile(newFilepath, Buffer.from(bytes))

    // Update database record with new filename, size, corners, and rotation
    await db
      .update(practiceAttachments)
      .set({
        filename: newFilename,
        fileSize: file.size,
        mimeType: file.type,
        corners,
        rotation,
      })
      .where(eq(practiceAttachments.id, attachmentId))

    return NextResponse.json({
      success: true,
      attachmentId,
      filename: newFilename,
      fileSize: file.size,
      rotation,
      url: `/api/curriculum/${playerId}/attachments/${attachmentId}/file?v=${encodeURIComponent(newFilename)}`,
    })
  } catch (error) {
    console.error('Error replacing attachment:', error)
    return NextResponse.json({ error: 'Failed to replace attachment' }, { status: 500 })
  }
})

/**
 * DELETE - Delete an attachment
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { playerId, attachmentId } = (await params) as { playerId: string; attachmentId: string }

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Authorization check - require 'start-session' permission (parent or present teacher)
    const userId = await getUserId()
    const canDelete = await canPerformAction(userId, playerId, 'start-session')
    if (!canDelete) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
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

    // Verify the attachment belongs to the specified player
    if (attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Build file paths
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'players', playerId)
    const croppedFilepath = join(uploadDir, attachment.filename)

    // Delete cropped file from disk (ignore error if file doesn't exist)
    try {
      await unlink(croppedFilepath)
    } catch (err) {
      // Log but don't fail if file is already gone
      console.warn(`Could not delete cropped file: ${croppedFilepath}`, err)
    }

    // Also delete original file if it exists
    if (attachment.originalFilename) {
      const originalFilepath = join(uploadDir, attachment.originalFilename)
      try {
        await unlink(originalFilepath)
      } catch (err) {
        console.warn(`Could not delete original file: ${originalFilepath}`, err)
      }
    }

    // Delete database record
    await db.delete(practiceAttachments).where(eq(practiceAttachments.id, attachmentId))

    return NextResponse.json({ success: true, deleted: attachmentId })
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 })
  }
})
