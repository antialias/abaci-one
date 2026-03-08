import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { getSpotDefinition } from '@/lib/page-spots/spotDefinitions'
import { loadSpotConfig } from '@/lib/page-spots/loadSpotConfig'
import { llm } from '@/lib/llm'
import { trackedCall } from '@/lib/ai-usage/llm-middleware'
import { AiFeature } from '@/lib/ai-usage/features'

const SYSTEM_CONTEXT = `You are an expert prompt engineer for AI image generation. You're writing prompts for Abaci.one — an educational platform teaching mental math through the soroban (Japanese abacus). The image will be displayed as a content spot on a marketing page. Improve the given prompt to be more vivid, specific, and effective for image generation, without changing the subject or adding concepts not already indicated.`

/**
 * POST /api/admin/page-spots/[pageId]/[spotId]/refine-prompt
 *
 * Uses an LLM to refine the current prompt for better image generation.
 */
export const POST = withAuth(
  async (_request: NextRequest, { userId, params }) => {
    const { pageId, spotId } = (await params) as { pageId: string; spotId: string }

    const def = getSpotDefinition(pageId, spotId)
    if (!def) {
      return NextResponse.json({ error: `Unknown spot: ${pageId}/${spotId}` }, { status: 404 })
    }

    const config = loadSpotConfig(pageId, spotId)
    if (!config || config.type !== 'generated') {
      return NextResponse.json(
        { error: 'Spot must be configured as "generated" type with a prompt' },
        { status: 400 }
      )
    }

    if (!config.prompt) {
      return NextResponse.json({ error: 'Spot has no prompt to refine' }, { status: 400 })
    }

    const response = await trackedCall(
      llm,
      {
        prompt: `${SYSTEM_CONTEXT}

Spot location: "${def.label}" — ${def.description}
${def.aspectRatio ? `Aspect ratio: ${def.aspectRatio}` : ''}

Current image prompt:
"${config.prompt}"

Provide an improved version of this prompt.`,
        schema: z.object({
          refined: z.string().describe('The improved image generation prompt'),
        }),
      },
      { userId, feature: AiFeature.PAGE_SPOT_REFINE }
    )

    return NextResponse.json({
      original: config.prompt,
      refined: response.data.refined,
    })
  },
  { role: 'admin' }
)
