import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getSpotDefinition } from '@/lib/page-spots/spotDefinitions'
import { loadPageSpotConfig, savePageSpotConfig } from '@/lib/page-spots/loadSpotConfig'
import type { SpotConfig } from '@/lib/page-spots/types'

/**
 * PATCH /api/admin/page-spots/[pageId]/[spotId]
 *
 * Create or update a spot config in the page's JSON file.
 */
export const PATCH = withAuth(
  async (request: NextRequest, { params }) => {
    const { pageId, spotId } = (await params) as { pageId: string; spotId: string }

    const def = getSpotDefinition(pageId, spotId)
    if (!def) {
      return NextResponse.json({ error: `Unknown spot: ${pageId}/${spotId}` }, { status: 404 })
    }

    let body: SpotConfig
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (!body.type || !['generated', 'component', 'html'].includes(body.type)) {
      return NextResponse.json(
        { error: 'type must be one of: generated, component, html' },
        { status: 400 }
      )
    }

    const config = loadPageSpotConfig(pageId)
    config[spotId] = body
    savePageSpotConfig(pageId, config)

    return NextResponse.json({ success: true, config: body })
  },
  { role: 'admin' }
)

/**
 * DELETE /api/admin/page-spots/[pageId]/[spotId]
 *
 * Remove a spot config from the page's JSON file.
 */
export const DELETE = withAuth(
  async (_request: NextRequest, { params }) => {
    const { pageId, spotId } = (await params) as { pageId: string; spotId: string }

    const config = loadPageSpotConfig(pageId)
    if (!(spotId in config)) {
      return NextResponse.json({ error: 'Spot not configured' }, { status: 404 })
    }

    delete config[spotId]
    savePageSpotConfig(pageId, config)

    return NextResponse.json({ success: true })
  },
  { role: 'admin' }
)
