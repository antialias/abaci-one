import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { invalidateEmbeddingCache } from '@/lib/flowcharts/embedding-search'
import { reembedFlowchart } from '@/lib/tasks/flowchart-embed'

/**
 * POST /api/flowcharts/[id]/embedding
 *
 * Generate and store embeddings for a single published flowchart. Admin only;
 * teachers' flowcharts are embedded on publish and on workshop save.
 */
export const POST = withAuth(
  async (_request, { params }) => {
    try {
      const { id } = (await params) as { id: string }

      const fc = await db.query.teacherFlowcharts.findFirst({
        where: eq(schema.teacherFlowcharts.id, id),
        columns: { id: true, status: true },
      })

      if (!fc || fc.status !== 'published') {
        return NextResponse.json({ error: 'Flowchart not found' }, { status: 404 })
      }

      await reembedFlowchart(fc.id)

      invalidateEmbeddingCache()

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Failed to generate embedding:', error)
      return NextResponse.json(
        { error: 'Failed to generate embedding', details: String(error) },
        { status: 500 }
      )
    }
  },
  { role: 'admin' }
)
