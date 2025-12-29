import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { enterClassroom, isParent } from '@/lib/classroom'
import { emitEntryPromptAccepted, emitEntryPromptDeclined } from '@/lib/classroom/socket-emitter'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ promptId: string }>
}

/**
 * POST /api/entry-prompts/[promptId]/respond
 * Respond to an entry prompt (parent only)
 *
 * Body: { action: 'accept' | 'decline' }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { promptId } = await params
    const userId = await getDbUserId()
    const body = await req.json()

    // Validate action
    if (!body.action || !['accept', 'decline'].includes(body.action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "accept" or "decline".' },
        { status: 400 }
      )
    }

    // Get the prompt
    const prompt = await db.query.entryPrompts.findFirst({
      where: eq(schema.entryPrompts.id, promptId),
    })

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    // Check if prompt is still pending
    if (prompt.status !== 'pending') {
      return NextResponse.json({ error: 'Prompt has already been responded to' }, { status: 400 })
    }

    // Check if prompt has expired
    if (prompt.expiresAt < new Date()) {
      // Mark as expired
      await db
        .update(schema.entryPrompts)
        .set({ status: 'expired' })
        .where(eq(schema.entryPrompts.id, promptId))

      return NextResponse.json({ error: 'Prompt has expired' }, { status: 400 })
    }

    // Verify user is a parent of the player
    const isParentOfPlayer = await isParent(userId, prompt.playerId)
    if (!isParentOfPlayer) {
      return NextResponse.json(
        { error: 'Not authorized. Must be a parent of the student.' },
        { status: 403 }
      )
    }

    // Get user info for notifications
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    })
    const parentName = user?.name || 'Parent'

    // Get player info for notifications
    const player = await db.query.players.findFirst({
      where: eq(schema.players.id, prompt.playerId),
    })
    const playerName = player?.name || 'Student'

    // Get classroom info for notifications
    const classroom = await db.query.classrooms.findFirst({
      where: eq(schema.classrooms.id, prompt.classroomId),
    })
    const classroomName = classroom?.name || 'Classroom'

    if (body.action === 'accept') {
      // Update prompt status
      await db
        .update(schema.entryPrompts)
        .set({
          status: 'accepted',
          respondedBy: userId,
          respondedAt: new Date(),
        })
        .where(eq(schema.entryPrompts.id, promptId))

      // Enter child into classroom
      const enterResult = await enterClassroom({
        playerId: prompt.playerId,
        classroomId: prompt.classroomId,
        enteredBy: userId,
      })

      if (!enterResult.success) {
        // Revert prompt status if enter failed
        await db
          .update(schema.entryPrompts)
          .set({
            status: 'pending',
            respondedBy: null,
            respondedAt: null,
          })
          .where(eq(schema.entryPrompts.id, promptId))

        return NextResponse.json(
          { error: enterResult.error || 'Failed to enter classroom' },
          { status: 400 }
        )
      }

      // Emit socket events
      await emitEntryPromptAccepted(
        {
          promptId,
          classroomId: prompt.classroomId,
          classroomName,
          playerId: prompt.playerId,
          playerName,
          acceptedBy: parentName,
        },
        prompt.teacherId
      )

      return NextResponse.json({
        success: true,
        action: 'accepted',
        message: `${playerName} has been entered into ${classroomName}`,
      })
    } else {
      // Decline the prompt
      await db
        .update(schema.entryPrompts)
        .set({
          status: 'declined',
          respondedBy: userId,
          respondedAt: new Date(),
        })
        .where(eq(schema.entryPrompts.id, promptId))

      // Emit socket event to teacher
      await emitEntryPromptDeclined(
        {
          promptId,
          classroomId: prompt.classroomId,
          playerId: prompt.playerId,
          playerName,
          declinedBy: parentName,
        },
        prompt.teacherId
      )

      return NextResponse.json({
        success: true,
        action: 'declined',
        message: 'Entry prompt declined',
      })
    }
  } catch (error) {
    console.error('Failed to respond to entry prompt:', error)
    return NextResponse.json({ error: 'Failed to respond to entry prompt' }, { status: 500 })
  }
}
