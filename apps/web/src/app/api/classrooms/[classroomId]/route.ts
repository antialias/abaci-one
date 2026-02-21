import { NextResponse } from 'next/server'
import {
  deleteClassroom,
  getClassroom,
  updateClassroom,
  regenerateClassroomCode,
} from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/classrooms/[classroomId]
 * Get classroom by ID
 *
 * Returns: { classroom } or 404
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { classroomId } = (await params) as { classroomId: string }

    const classroom = await getClassroom(classroomId)

    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 })
    }

    return NextResponse.json({ classroom })
  } catch (error) {
    console.error('Failed to fetch classroom:', error)
    return NextResponse.json({ error: 'Failed to fetch classroom' }, { status: 500 })
  }
})

/**
 * PATCH /api/classrooms/[classroomId]
 * Update classroom settings (teacher only)
 *
 * Body: { name?: string, regenerateCode?: boolean, entryPromptExpiryMinutes?: number | null }
 * Returns: { classroom }
 */
export const PATCH = withAuth(async (req, { params }) => {
  try {
    const { classroomId } = (await params) as { classroomId: string }
    const userId = await getUserId()
    const body = await req.json()

    // Handle code regeneration separately
    if (body.regenerateCode) {
      const newCode = await regenerateClassroomCode(classroomId, userId)
      if (!newCode) {
        return NextResponse.json(
          { error: 'Not authorized or classroom not found' },
          { status: 403 }
        )
      }
      // Fetch updated classroom
      const classroom = await getClassroom(classroomId)
      return NextResponse.json({ classroom })
    }

    // Update other fields
    const updates: { name?: string; entryPromptExpiryMinutes?: number | null } = {}
    if (body.name) updates.name = body.name
    // Allow setting to null (use system default) or a positive number
    if ('entryPromptExpiryMinutes' in body) {
      const value = body.entryPromptExpiryMinutes
      if (value === null || (typeof value === 'number' && value > 0)) {
        updates.entryPromptExpiryMinutes = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const classroom = await updateClassroom(classroomId, userId, updates)

    if (!classroom) {
      return NextResponse.json({ error: 'Not authorized or classroom not found' }, { status: 403 })
    }

    return NextResponse.json({ classroom })
  } catch (error) {
    console.error('Failed to update classroom:', error)
    return NextResponse.json({ error: 'Failed to update classroom' }, { status: 500 })
  }
})

/**
 * DELETE /api/classrooms/[classroomId]
 * Delete classroom (teacher only, cascades enrollments)
 *
 * Returns: { success: true }
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { classroomId } = (await params) as { classroomId: string }
    const userId = await getUserId()

    const success = await deleteClassroom(classroomId, userId)

    if (!success) {
      return NextResponse.json({ error: 'Not authorized or classroom not found' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete classroom:', error)
    return NextResponse.json({ error: 'Failed to delete classroom' }, { status: 500 })
  }
})
