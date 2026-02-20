import { and, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getDbUserId } from '@/lib/viewer'
import { generateFlowchartEmbeddings, EMBEDDING_VERSION } from '@/lib/flowcharts/embedding'
import { invalidateEmbeddingCache } from '@/lib/flowcharts/embedding-search'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * POST /api/teacher-flowcharts/[id]/publish
 * Publish a draft flowchart
 *
 * Validates the flowchart before publishing:
 * - Definition JSON must be valid
 * - Required fields must be present
 *
 * Returns: { flowchart: TeacherFlowchart }
 */
export const POST = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getDbUserId()

    // Find the flowchart
    const existing = await db.query.teacherFlowcharts.findFirst({
      where: and(eq(schema.teacherFlowcharts.id, id), eq(schema.teacherFlowcharts.userId, userId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Flowchart not found' }, { status: 404 })
    }

    if (existing.status === 'published') {
      return NextResponse.json({ error: 'Flowchart is already published' }, { status: 400 })
    }

    if (existing.status === 'archived') {
      return NextResponse.json({ error: 'Cannot publish an archived flowchart' }, { status: 400 })
    }

    // Validate the definition before publishing
    let definition
    try {
      definition = JSON.parse(existing.definitionJson)
    } catch {
      return NextResponse.json({ error: 'Invalid flowchart definition JSON' }, { status: 400 })
    }

    // Basic validation
    const validationErrors: string[] = []

    if (!definition.id) validationErrors.push('Missing flowchart ID in definition')
    if (!definition.title) validationErrors.push('Missing title in definition')
    if (!definition.entryNode) validationErrors.push('Missing entry node')
    if (!definition.nodes || Object.keys(definition.nodes).length === 0) {
      validationErrors.push('Flowchart must have at least one node')
    }
    if (!definition.problemInput) {
      validationErrors.push('Missing problem input schema')
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      )
    }

    // TODO: Add more comprehensive validation:
    // - Verify mermaid parses correctly
    // - Verify all node references are valid
    // - Verify expressions are valid
    // - Test with example generation

    // Find the workshop session to get the original topic description (if any)
    // This helps with semantic matching - the user's original phrasing captures intent
    const workshopSession = await db.query.workshopSessions.findFirst({
      where: eq(schema.workshopSessions.flowchartId, id),
      columns: {
        topicDescription: true,
      },
    })

    // Generate embeddings for semantic search
    // - embedding: full content (title + description + topic + difficulty)
    // - promptEmbedding: just the original topic description (better for short queries)
    let embedding: Buffer | null = null
    let promptEmbedding: Buffer | null = null
    try {
      const result = await generateFlowchartEmbeddings({
        title: existing.title,
        description: existing.description,
        topicDescription: workshopSession?.topicDescription,
        difficulty: existing.difficulty,
      })
      embedding = result.embedding
      promptEmbedding = result.promptEmbedding
    } catch (embeddingError) {
      // Log but don't fail publish - embedding is nice to have but not required
      console.error('Failed to generate embeddings for flowchart:', embeddingError)
    }

    const now = new Date()

    const [flowchart] = await db
      .update(schema.teacherFlowcharts)
      .set({
        status: 'published',
        publishedAt: now,
        updatedAt: now,
        embedding,
        promptEmbedding,
        embeddingVersion: embedding ? EMBEDDING_VERSION : null,
      })
      .where(eq(schema.teacherFlowcharts.id, id))
      .returning()

    // Invalidate embedding cache so new flowchart appears in searches
    if (embedding) {
      invalidateEmbeddingCache()
    }

    return NextResponse.json({ flowchart })
  } catch (error) {
    console.error('Failed to publish teacher flowchart:', error)
    return NextResponse.json({ error: 'Failed to publish flowchart' }, { status: 500 })
  }
})
