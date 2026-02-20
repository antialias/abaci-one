import { NextResponse } from 'next/server'
import { getEmbeddingStatus, regenerateEmbeddings } from '@/lib/seed/embedding-search'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/debug/seed-students/embeddings
 *
 * Returns the current embedding cache status including whether
 * cached embeddings are stale (profile content changed since generation).
 */
export const GET = withAuth(async () => {
  try {
    const status = getEmbeddingStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error('[seed-students/embeddings] Status check failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}, { role: 'admin' })

/**
 * POST /api/debug/seed-students/embeddings
 *
 * Invalidates cached embeddings and regenerates them from current
 * profile content. Use this after updating profile intentionNotes.
 */
export const POST = withAuth(async () => {
  try {
    const status = await regenerateEmbeddings()
    return NextResponse.json(status)
  } catch (error) {
    console.error('[seed-students/embeddings] Regeneration failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Regeneration failed' },
      { status: 500 }
    )
  }
}, { role: 'admin' })
