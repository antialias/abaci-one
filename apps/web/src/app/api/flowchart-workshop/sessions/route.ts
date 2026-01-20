import { and, desc, eq, gt } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET /api/flowchart-workshop/sessions
 * List current user's active workshop sessions
 *
 * Returns: { sessions: WorkshopSession[] }
 */
export async function GET() {
  try {
    const userId = await getDbUserId()
    const now = new Date()

    // Get non-expired sessions
    const sessions = await db.query.workshopSessions.findMany({
      where: and(
        eq(schema.workshopSessions.userId, userId),
        gt(schema.workshopSessions.expiresAt, now)
      ),
      orderBy: [desc(schema.workshopSessions.updatedAt)],
      columns: {
        id: true,
        state: true,
        topicDescription: true,
        flowchartId: true,
        remixFromId: true,
        draftTitle: true,
        draftDescription: true,
        draftEmoji: true,
        draftDifficulty: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Failed to list workshop sessions:', error)
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 })
  }
}

/**
 * POST /api/flowchart-workshop/sessions
 * Create a new workshop session
 *
 * Body: {
 *   topicDescription?: string - Initial topic description
 *   remixFromId?: string - ID of flowchart to remix from (hardcoded or database)
 *   flowchartId?: string - ID of existing teacher flowchart to edit (creates new on publish)
 *   editPublishedId?: string - ID of own published flowchart to edit (updates on publish)
 * }
 *
 * Returns: { session: WorkshopSession }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getDbUserId()
    const body = await req.json()

    const now = new Date()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7-day expiry

    // Determine initial state
    let initialState: 'initial' | 'refining' = 'initial'
    let draftDefinitionJson: string | null = null
    let draftMermaidContent: string | null = null
    let draftTitle: string | null = null
    let draftDescription: string | null = null
    let draftEmoji: string | null = null
    let draftDifficulty: 'Beginner' | 'Intermediate' | 'Advanced' | null = null
    let linkedPublishedId: string | null = null
    let topicDescription: string | null = body.topicDescription || null

    // If editing a published flowchart (edit-in-place workflow)
    if (body.editPublishedId) {
      const existing = await db.query.teacherFlowcharts.findFirst({
        where: and(
          eq(schema.teacherFlowcharts.id, body.editPublishedId),
          eq(schema.teacherFlowcharts.userId, userId),
          eq(schema.teacherFlowcharts.status, 'published')
        ),
      })

      if (!existing) {
        return NextResponse.json(
          { error: 'Flowchart not found or not owned by you' },
          { status: 404 }
        )
      }

      initialState = 'refining'
      draftDefinitionJson = existing.definitionJson
      draftMermaidContent = existing.mermaidContent
      draftTitle = existing.title // Keep same title (no "(Copy)")
      draftDescription = existing.description
      draftEmoji = existing.emoji
      draftDifficulty = existing.difficulty as typeof draftDifficulty
      linkedPublishedId = existing.id // This tells publish to UPDATE instead of INSERT
    }

    // If editing an existing flowchart (legacy path), load its data as the draft
    if (body.flowchartId && !linkedPublishedId) {
      const existing = await db.query.teacherFlowcharts.findFirst({
        where: and(
          eq(schema.teacherFlowcharts.id, body.flowchartId),
          eq(schema.teacherFlowcharts.userId, userId)
        ),
      })

      if (existing) {
        initialState = 'refining'
        draftDefinitionJson = existing.definitionJson
        draftMermaidContent = existing.mermaidContent
        draftTitle = existing.title
        draftDescription = existing.description
        draftEmoji = existing.emoji
        draftDifficulty = existing.difficulty as typeof draftDifficulty
      }
    }

    // If remixing from an existing flowchart, load it as the starting point
    if (body.remixFromId && !draftDefinitionJson) {
      // Try hardcoded flowcharts first
      const { getFlowchart } = await import('@/lib/flowcharts/definitions')
      const hardcoded = getFlowchart(body.remixFromId)

      if (hardcoded) {
        initialState = 'refining'
        draftDefinitionJson = JSON.stringify(hardcoded.definition)
        draftMermaidContent = hardcoded.mermaid
        draftTitle = `${hardcoded.meta.title} (Copy)`
        draftDescription = hardcoded.meta.description
        draftEmoji = hardcoded.meta.emoji
        draftDifficulty = hardcoded.meta.difficulty
        topicDescription = hardcoded.meta.description // Use description as topic for remixes
      } else {
        // Try database flowcharts
        const dbFlowchart = await db.query.teacherFlowcharts.findFirst({
          where: and(
            eq(schema.teacherFlowcharts.id, body.remixFromId),
            eq(schema.teacherFlowcharts.status, 'published')
          ),
        })

        if (dbFlowchart) {
          initialState = 'refining'
          draftDefinitionJson = dbFlowchart.definitionJson
          draftMermaidContent = dbFlowchart.mermaidContent
          draftTitle = `${dbFlowchart.title} (Copy)`
          draftDescription = dbFlowchart.description
          draftEmoji = dbFlowchart.emoji
          draftDifficulty = dbFlowchart.difficulty as typeof draftDifficulty
          topicDescription = dbFlowchart.description // Use description as topic for remixes
        }
      }
    }

    const [session] = await db
      .insert(schema.workshopSessions)
      .values({
        userId,
        state: initialState,
        topicDescription,
        remixFromId: body.remixFromId || null,
        flowchartId: body.flowchartId || null,
        linkedPublishedId,
        draftDefinitionJson,
        draftMermaidContent,
        draftTitle,
        draftDescription,
        draftEmoji,
        draftDifficulty,
        refinementHistory: JSON.stringify([]),
        createdAt: now,
        updatedAt: now,
        expiresAt,
      })
      .returning()

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error('Failed to create workshop session:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
