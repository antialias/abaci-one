import { eq, sql } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { worksheetShares } from '@/db/schema'
import { isValidShareId } from '@/lib/generateShareId'

/**
 * GET /api/worksheets/share/[id]
 *
 * Retrieve a shared worksheet configuration by ID
 * Increments view counter on each access
 *
 * Response:
 * {
 *   id: 'abc123X',
 *   worksheetType: 'addition',
 *   config: { ...worksheet config object },
 *   createdAt: '2025-01-01T00:00:00.000Z',
 *   views: 42,
 *   title: 'Optional title'
 * }
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Validate ID format
    if (!isValidShareId(id)) {
      return NextResponse.json({ error: 'Invalid share ID format' }, { status: 400 })
    }

    // Fetch share record
    const share = await db.query.worksheetShares.findFirst({
      where: eq(worksheetShares.id, id),
    })

    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    // Increment view counter
    await db
      .update(worksheetShares)
      .set({
        views: sql`${worksheetShares.views} + 1`,
      })
      .where(eq(worksheetShares.id, id))

    // Parse config JSON
    const config = JSON.parse(share.config)

    return NextResponse.json({
      id: share.id,
      worksheetType: share.worksheetType,
      config,
      createdAt: share.createdAt.toISOString(),
      views: share.views + 1, // Return incremented count
      title: share.title,
    })
  } catch (error) {
    console.error('Error fetching worksheet share:', error)
    return NextResponse.json({ error: 'Failed to fetch share' }, { status: 500 })
  }
}
