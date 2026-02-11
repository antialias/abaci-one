import { type NextRequest, NextResponse } from 'next/server'
import { MATH_CONSTANTS } from '@/components/toys/number-line/constants/constantsData'
import { startImageGeneration } from '@/lib/tasks/image-generate'
import type { ImageGenerateInput } from '@/lib/tasks/image-generate'

const VALID_PROVIDERS = ['gemini', 'openai'] as const
const VALID_STYLES = ['metaphor', 'math'] as const
const VALID_THEMES = ['light', 'dark'] as const

/**
 * POST /api/admin/constant-images/generate
 *
 * Starts a background task to generate constant illustrations.
 * Body: { provider: string, model: string, targets?: Array<{constantId, style}>, forceRegenerate?: boolean }
 * Response: { taskId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, model, targets, forceRegenerate, theme } = body

    // Validate provider
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate model
    if (typeof model !== 'string' || model.trim().length === 0) {
      return NextResponse.json(
        { error: 'model must be a non-empty string' },
        { status: 400 }
      )
    }

    // Validate top-level theme (used for default "generate all" path)
    if (theme !== undefined && !VALID_THEMES.includes(theme)) {
      return NextResponse.json(
        { error: `theme must be one of: ${VALID_THEMES.join(', ')}` },
        { status: 400 }
      )
    }

    // Build targets list: either user-specified or all constants x both styles
    let resolvedTargets: ImageGenerateInput['targets']

    if (targets && Array.isArray(targets) && targets.length > 0) {
      // Validate each target
      const constantIds = new Set(MATH_CONSTANTS.map((c) => c.id))
      for (const t of targets) {
        if (!constantIds.has(t.constantId)) {
          return NextResponse.json(
            { error: `Unknown constantId: ${t.constantId}` },
            { status: 400 }
          )
        }
        if (!VALID_STYLES.includes(t.style)) {
          return NextResponse.json(
            { error: `style must be one of: ${VALID_STYLES.join(', ')}` },
            { status: 400 }
          )
        }
        if (t.theme !== undefined && !VALID_THEMES.includes(t.theme)) {
          return NextResponse.json(
            { error: `target theme must be one of: ${VALID_THEMES.join(', ')}` },
            { status: 400 }
          )
        }
      }
      resolvedTargets = targets
    } else {
      // Default: all constants, both styles (with optional top-level theme)
      resolvedTargets = MATH_CONSTANTS.flatMap((c) => [
        { constantId: c.id, style: 'metaphor' as const, ...(theme && { theme: theme as 'light' | 'dark' }) },
        { constantId: c.id, style: 'math' as const, ...(theme && { theme: theme as 'light' | 'dark' }) },
      ])
    }

    const taskId = await startImageGeneration({
      provider,
      model: model.trim(),
      targets: resolvedTargets,
      forceRegenerate: !!forceRegenerate,
    })

    return NextResponse.json({ taskId })
  } catch (error) {
    console.error('Error starting image generation:', error)
    return NextResponse.json(
      { error: 'Failed to start image generation' },
      { status: 500 }
    )
  }
}
