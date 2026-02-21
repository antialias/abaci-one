import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { db, schema } from '@/db'
import { getUserId } from '@/lib/viewer'
import { validateFlowchartStructure } from '@/lib/flowcharts/validator'
import { generateFlowchartEmbeddings, EMBEDDING_VERSION } from '@/lib/flowcharts/embedding'
import { invalidateEmbeddingCache } from '@/lib/flowcharts/embedding-search'

/**
 * POST /api/flowchart-workshop/sessions/[id]/save
 * Save the current draft to a teacher flowchart
 *
 * If the session has a flowchartId, updates that flowchart (or creates a new version if published).
 * Otherwise, creates a new teacher flowchart.
 *
 * Returns: { flowchart: TeacherFlowchart, session: WorkshopSession }
 */
export const POST = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()

    // Get the session
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

    // Validate draft exists
    if (!session.draftDefinitionJson || !session.draftMermaidContent) {
      return NextResponse.json(
        { error: 'No draft to save - generate or refine first' },
        { status: 400 }
      )
    }

    // Validate the draft structure
    let definition
    try {
      definition = JSON.parse(session.draftDefinitionJson)
    } catch {
      return NextResponse.json({ error: 'Invalid draft definition JSON' }, { status: 400 })
    }

    const structureValidation = validateFlowchartStructure(definition)
    if (!structureValidation.valid) {
      return NextResponse.json(
        {
          error: 'Draft validation failed',
          details: structureValidation.errors,
        },
        { status: 400 }
      )
    }

    const now = new Date()
    let flowchart

    // If editing a published flowchart in-place (via linkedPublishedId)
    if (session.linkedPublishedId) {
      const existing = await db.query.teacherFlowcharts.findFirst({
        where: and(
          eq(schema.teacherFlowcharts.id, session.linkedPublishedId),
          eq(schema.teacherFlowcharts.userId, userId),
          eq(schema.teacherFlowcharts.status, 'published')
        ),
      })

      if (!existing) {
        return NextResponse.json({ error: 'Linked published flowchart not found' }, { status: 404 })
      }

      // Generate new embeddings for the updated content
      let embedding: Buffer | null = null
      let promptEmbedding: Buffer | null = null
      try {
        const result = await generateFlowchartEmbeddings({
          title: session.draftTitle || existing.title,
          description: session.draftDescription,
          topicDescription: session.topicDescription,
          difficulty: session.draftDifficulty,
        })
        embedding = result.embedding
        promptEmbedding = result.promptEmbedding
      } catch (embeddingError) {
        console.error('Failed to generate embeddings:', embeddingError)
      }

      // Update the published flowchart directly
      const [updated] = await db
        .update(schema.teacherFlowcharts)
        .set({
          title: session.draftTitle || existing.title,
          description: session.draftDescription,
          emoji: session.draftEmoji,
          difficulty: session.draftDifficulty,
          definitionJson: session.draftDefinitionJson,
          mermaidContent: session.draftMermaidContent,
          version: existing.version + 1,
          embedding,
          promptEmbedding,
          embeddingVersion: embedding ? EMBEDDING_VERSION : null,
          updatedAt: now,
          // Keep status as 'published' and publishedAt unchanged
        })
        .where(eq(schema.teacherFlowcharts.id, existing.id))
        .returning()

      flowchart = updated

      // Mark session as completed and delete it (optional cleanup)
      await db
        .update(schema.workshopSessions)
        .set({
          state: 'completed',
          updatedAt: now,
        })
        .where(eq(schema.workshopSessions.id, id))

      // Invalidate embedding cache
      if (embedding) {
        invalidateEmbeddingCache()
      }

      // Get updated session
      const updatedSession = await db.query.workshopSessions.findFirst({
        where: eq(schema.workshopSessions.id, id),
      })

      return NextResponse.json({
        flowchart,
        session: updatedSession,
        // Flag to tell the client this was an in-place update (skip publish step)
        alreadyPublished: true,
      })
    }

    // If editing an existing flowchart (legacy path)
    if (session.flowchartId) {
      const existing = await db.query.teacherFlowcharts.findFirst({
        where: and(
          eq(schema.teacherFlowcharts.id, session.flowchartId),
          eq(schema.teacherFlowcharts.userId, userId)
        ),
      })

      if (!existing) {
        return NextResponse.json({ error: 'Original flowchart not found' }, { status: 404 })
      }

      // If published, create a new version
      if (existing.status === 'published') {
        const [newVersion] = await db
          .insert(schema.teacherFlowcharts)
          .values({
            userId,
            title: session.draftTitle || existing.title,
            description: session.draftDescription || existing.description,
            emoji: session.draftEmoji || existing.emoji,
            difficulty: session.draftDifficulty || existing.difficulty,
            definitionJson: session.draftDefinitionJson,
            mermaidContent: session.draftMermaidContent,
            version: existing.version + 1,
            parentVersionId: existing.id,
            status: 'draft',
            createdAt: now,
            updatedAt: now,
          })
          .returning()

        flowchart = newVersion

        // Update session to point to new version
        await db
          .update(schema.workshopSessions)
          .set({
            flowchartId: newVersion.id,
            state: 'completed',
            updatedAt: now,
          })
          .where(eq(schema.workshopSessions.id, id))
      } else {
        // Update existing draft
        const [updated] = await db
          .update(schema.teacherFlowcharts)
          .set({
            title: session.draftTitle || existing.title,
            description: session.draftDescription,
            emoji: session.draftEmoji,
            difficulty: session.draftDifficulty,
            definitionJson: session.draftDefinitionJson,
            mermaidContent: session.draftMermaidContent,
            updatedAt: now,
          })
          .where(eq(schema.teacherFlowcharts.id, existing.id))
          .returning()

        flowchart = updated

        // Update session state
        await db
          .update(schema.workshopSessions)
          .set({
            state: 'completed',
            updatedAt: now,
          })
          .where(eq(schema.workshopSessions.id, id))
      }
    } else {
      // Create new flowchart
      const [newFlowchart] = await db
        .insert(schema.teacherFlowcharts)
        .values({
          userId,
          title: session.draftTitle || 'Untitled Flowchart',
          description: session.draftDescription,
          emoji: session.draftEmoji || '📊',
          difficulty: session.draftDifficulty,
          definitionJson: session.draftDefinitionJson,
          mermaidContent: session.draftMermaidContent,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      flowchart = newFlowchart

      // Update session to link to the new flowchart
      await db
        .update(schema.workshopSessions)
        .set({
          flowchartId: newFlowchart.id,
          state: 'completed',
          updatedAt: now,
        })
        .where(eq(schema.workshopSessions.id, id))
    }

    // Get updated session
    const updatedSession = await db.query.workshopSessions.findFirst({
      where: eq(schema.workshopSessions.id, id),
    })

    return NextResponse.json({
      flowchart,
      session: updatedSession,
    })
  } catch (error) {
    console.error('Failed to save workshop draft:', error)
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
  }
})
