import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getSpotDefinition } from '@/lib/page-spots/spotDefinitions'
import { loadSpotConfig } from '@/lib/page-spots/loadSpotConfig'
import { startPageSpotImageGeneration } from '@/lib/tasks/page-spot-image-generate'

const VALID_PROVIDERS = ['gemini', 'openai'] as const

/**
 * POST /api/admin/page-spots/generate
 *
 * Starts a background task to generate an image for a page spot.
 * Body: { pageId, spotId, provider?, model?, forceRegenerate? }
 */
export const POST = withAuth(
  async (request: NextRequest, { userId }) => {
    try {
      const body = await request.json()
      const { pageId, spotId, provider, model, forceRegenerate } = body

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

      // Use provider/model from request or fall back to config
      const resolvedProvider = provider ?? config.provider
      const resolvedModel = model ?? config.model

      if (!resolvedProvider || !VALID_PROVIDERS.includes(resolvedProvider)) {
        return NextResponse.json(
          { error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` },
          { status: 400 }
        )
      }

      if (!resolvedModel || typeof resolvedModel !== 'string') {
        return NextResponse.json({ error: 'model must be a non-empty string' }, { status: 400 })
      }

      const taskId = await startPageSpotImageGeneration({
        pageId,
        spotId,
        provider: resolvedProvider,
        model: resolvedModel,
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
