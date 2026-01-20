import { and, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/flowchart-workshop/sessions/[id]
 * Get a workshop session with full draft content
 *
 * Returns: { session: WorkshopSession } or 404
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const userId = await getDbUserId()

    const session = await db.query.workshopSessions.findFirst({
      where: and(eq(schema.workshopSessions.id, id), eq(schema.workshopSessions.userId, userId)),
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check if expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Session has expired' }, { status: 410 })
    }

    // Parse refinement history if present
    let refinementHistory: string[] = []
    if (session.refinementHistory) {
      try {
        refinementHistory = JSON.parse(session.refinementHistory)
      } catch {
        // Ignore parse errors
      }
    }

    return NextResponse.json({
      session: {
        ...session,
        refinementHistory,
      },
    })
  } catch (error) {
    console.error('Failed to fetch workshop session:', error)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}

/**
 * PATCH /api/flowchart-workshop/sessions/[id]
 * Update workshop session state or draft content
 *
 * Body: {
 *   state?: 'initial' | 'generating' | 'refining' | 'testing' | 'completed'
 *   topicDescription?: string
 *   draftDefinitionJson?: string
 *   draftMermaidContent?: string
 *   draftTitle?: string
 *   draftDescription?: string
 *   draftEmoji?: string
 *   draftDifficulty?: string
 *   draftNotes?: string
 *   addRefinement?: string - Add to refinement history
 * }
 *
 * Returns: { session: WorkshopSession }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const userId = await getDbUserId()
    const body = await req.json()

    // Verify ownership
    const existing = await db.query.workshopSessions.findFirst({
      where: and(eq(schema.workshopSessions.id, id), eq(schema.workshopSessions.userId, userId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check if expired
    if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Session has expired' }, { status: 410 })
    }

    // Build updates
    const updates: Partial<typeof existing> & { updatedAt: Date } = {
      updatedAt: new Date(),
    }

    if (body.state !== undefined) updates.state = body.state
    if (body.topicDescription !== undefined) updates.topicDescription = body.topicDescription
    if (body.draftDefinitionJson !== undefined)
      updates.draftDefinitionJson = body.draftDefinitionJson
    if (body.draftMermaidContent !== undefined)
      updates.draftMermaidContent = body.draftMermaidContent
    if (body.draftTitle !== undefined) updates.draftTitle = body.draftTitle
    if (body.draftDescription !== undefined) updates.draftDescription = body.draftDescription
    if (body.draftEmoji !== undefined) updates.draftEmoji = body.draftEmoji
    if (body.draftDifficulty !== undefined) updates.draftDifficulty = body.draftDifficulty
    if (body.draftNotes !== undefined) updates.draftNotes = body.draftNotes

    // Handle adding to refinement history
    if (body.addRefinement) {
      let history: string[] = []
      if (existing.refinementHistory) {
        try {
          history = JSON.parse(existing.refinementHistory)
        } catch {
          // Ignore
        }
      }
      history.push(body.addRefinement)
      updates.refinementHistory = JSON.stringify(history)
    }

    const [session] = await db
      .update(schema.workshopSessions)
      .set(updates)
      .where(eq(schema.workshopSessions.id, id))
      .returning()

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Failed to update workshop session:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}

/**
 * DELETE /api/flowchart-workshop/sessions/[id]
 * Delete/abandon a workshop session
 *
 * Returns: { success: true }
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const userId = await getDbUserId()

    // Verify ownership
    const existing = await db.query.workshopSessions.findFirst({
      where: and(eq(schema.workshopSessions.id, id), eq(schema.workshopSessions.userId, userId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    await db.delete(schema.workshopSessions).where(eq(schema.workshopSessions.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete workshop session:', error)
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
  }
}
