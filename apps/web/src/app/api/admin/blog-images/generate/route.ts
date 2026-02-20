import { type NextRequest, NextResponse } from 'next/server'
import { getAllPostsMetadata } from '@/lib/blog'
import { startBlogImageGeneration } from '@/lib/tasks/blog-image-generate'
import type { BlogImageGenerateInput } from '@/lib/tasks/blog-image-generate'
import { withAuth } from '@/lib/auth/withAuth'

const VALID_PROVIDERS = ['gemini', 'openai'] as const

/**
 * POST /api/admin/blog-images/generate
 *
 * Starts a background task to generate blog hero images.
 * Body: { provider, model, fallbackProvider?, fallbackModel?, targets?, forceRegenerate? }
 * Response: { taskId }
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json()
      const { provider, model, fallbackProvider, fallbackModel, targets, forceRegenerate } = body

      // Validate provider
      if (!provider || !VALID_PROVIDERS.includes(provider)) {
        return NextResponse.json(
          { error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` },
          { status: 400 }
        )
      }

      // Validate model
      if (typeof model !== 'string' || model.trim().length === 0) {
        return NextResponse.json({ error: 'model must be a non-empty string' }, { status: 400 })
      }

      // Validate fallback if provided (both or neither)
      if (fallbackProvider || fallbackModel) {
        if (!fallbackProvider || !VALID_PROVIDERS.includes(fallbackProvider)) {
          return NextResponse.json(
            { error: `fallbackProvider must be one of: ${VALID_PROVIDERS.join(', ')}` },
            { status: 400 }
          )
        }
        if (typeof fallbackModel !== 'string' || fallbackModel.trim().length === 0) {
          return NextResponse.json(
            { error: 'fallbackModel must be a non-empty string when fallbackProvider is set' },
            { status: 400 }
          )
        }
      }

      // Build targets list
      let resolvedTargets: BlogImageGenerateInput['targets']

      if (targets && Array.isArray(targets) && targets.length > 0) {
        // Validate each target has slug and prompt
        for (const t of targets) {
          if (typeof t.slug !== 'string' || !t.slug) {
            return NextResponse.json({ error: 'Each target must have a slug' }, { status: 400 })
          }
          if (typeof t.prompt !== 'string' || !t.prompt) {
            return NextResponse.json({ error: 'Each target must have a prompt' }, { status: 400 })
          }
        }
        resolvedTargets = targets
      } else {
        // Default: all posts with heroPrompt
        const posts = await getAllPostsMetadata()
        resolvedTargets = posts
          .filter((p) => p.heroPrompt)
          .map((p) => ({ slug: p.slug, prompt: p.heroPrompt! }))

        if (resolvedTargets.length === 0) {
          return NextResponse.json(
            { error: 'No blog posts have a heroPrompt in their frontmatter' },
            { status: 400 }
          )
        }
      }

      const input: BlogImageGenerateInput = {
        provider,
        model: model.trim(),
        targets: resolvedTargets,
        forceRegenerate: !!forceRegenerate,
      }

      if (fallbackProvider && fallbackModel) {
        input.fallbackProvider = fallbackProvider
        input.fallbackModel = fallbackModel.trim()
      }

      const taskId = await startBlogImageGeneration(input)

      return NextResponse.json({ taskId })
    } catch (error) {
      console.error('Error starting blog image generation:', error)
      return NextResponse.json({ error: 'Failed to start blog image generation' }, { status: 500 })
    }
  },
  { role: 'admin' }
)
