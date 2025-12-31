/**
 * API route for individual attachment operations
 *
 * DELETE /api/curriculum/[playerId]/attachments/[attachmentId]
 *
 * Deletes a practice attachment (both DB record and file).
 * Authorization is checked to ensure only parents and teachers can delete.
 */

import { unlink } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { practiceAttachments } from '@/db/schema'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string; attachmentId: string }>
}

/**
 * DELETE - Delete an attachment
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { playerId, attachmentId } = await params

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Authorization check - require 'start-session' permission (parent or present teacher)
    const userId = await getDbUserId()
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

    // Build file path
    const filepath = join(
      process.cwd(),
      'data',
      'uploads',
      'players',
      playerId,
      attachment.filename
    )

    // Delete file from disk (ignore error if file doesn't exist)
    try {
      await unlink(filepath)
    } catch (err) {
      // Log but don't fail if file is already gone
      console.warn(`Could not delete attachment file: ${filepath}`, err)
    }

    // Delete database record
    await db.delete(practiceAttachments).where(eq(practiceAttachments.id, attachmentId))

    return NextResponse.json({ success: true, deleted: attachmentId })
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 })
  }
}
