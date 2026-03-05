import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getSpotDefinition } from '@/lib/page-spots/spotDefinitions'
import { loadSpotHtml, saveSpotHtml } from '@/lib/page-spots/loadSpotConfig'

/**
 * GET /api/admin/page-spots/[pageId]/[spotId]/html
 *
 * Returns the HTML content for an html-type spot.
 */
export const GET = withAuth(
  async (_request: NextRequest, { params }) => {
    const { pageId, spotId } = (await params) as { pageId: string; spotId: string }

    const def = getSpotDefinition(pageId, spotId)
    if (!def) {
      return NextResponse.json({ error: `Unknown spot: ${pageId}/${spotId}` }, { status: 404 })
    }

    const html = loadSpotHtml(pageId, spotId)
    return NextResponse.json({ html })
  },
  { role: 'admin' }
)

/**
 * PUT /api/admin/page-spots/[pageId]/[spotId]/html
 *
 * Save HTML content for an html-type spot.
 */
export const PUT = withAuth(
  async (request: NextRequest, { params }) => {
    const { pageId, spotId } = (await params) as { pageId: string; spotId: string }

    const def = getSpotDefinition(pageId, spotId)
    if (!def) {
      return NextResponse.json({ error: `Unknown spot: ${pageId}/${spotId}` }, { status: 404 })
    }

    let body: { html: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (typeof body.html !== 'string') {
      return NextResponse.json({ error: 'html must be a string' }, { status: 400 })
    }

    saveSpotHtml(pageId, spotId, body.html)

    return NextResponse.json({
      success: true,
      sizeBytes: Buffer.byteLength(body.html, 'utf8'),
    })
  },
  { role: 'admin' }
)
