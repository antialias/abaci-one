import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { parseImageClassParam } from '@/lib/images/switch-images'
import { loadSpotConfig } from '@/lib/page-spots/loadSpotConfig'
import { getSpotDefinition } from '@/lib/page-spots/spotDefinitions'
import { startPageSpotImageGeneration } from '@/lib/tasks/page-spot-image-generate'

/**
 * POST /api/admin/page-spots/generate
 *
 * Starts a background task to generate an image for a page spot.
 * Body: { pageId, spotId, imageClass?, forceRegenerate? }
 */
export const POST = withAuth(
  async (request: NextRequest, { userId }) => {
    try {
      const body = await request.json()
      const { pageId, spotId, forceRegenerate } = body

      if (!pageId || !spotId) {
        return NextResponse.json({ error: 'pageId and spotId are required' }, { status: 400 })
      }

      const def = getSpotDefinition(pageId, spotId)
      if (!def) {
        return NextResponse.json({ error: `Unknown spot: ${pageId}/${spotId}` }, { status: 404 })
      }

      const config = loadSpotConfig(pageId, spotId)
      if (!config || config.type !== 'generated') {
        return NextResponse.json(
          { error: 'Spot must be configured as "generated" type' },
          { status: 400 }
        )
      }

      if (!config.prompt) {
        return NextResponse.json({ error: 'Spot has no prompt configured' }, { status: 400 })
      }

      // Use the image class from the request, else the spot's config, else the default
      const parsedClass = parseImageClassParam(body.imageClass ?? config.imageClass)
      if (!parsedClass.ok) {
        return NextResponse.json({ error: parsedClass.error }, { status: 400 })
      }

      const taskId = await startPageSpotImageGeneration({
        pageId,
        spotId,
        imageClass: parsedClass.imageClass,
        prompt: config.prompt,
        forceRegenerate: !!forceRegenerate,
        _userId: userId,
      })

      return NextResponse.json({ taskId })
    } catch (error) {
      console.error('Error starting page spot generation:', error)
      return NextResponse.json(
        { error: 'Failed to start page spot image generation' },
        { status: 500 }
      )
    }
  },
  { role: 'admin' }
)
