import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getAllPostsMetadata } from '@/lib/blog'
import { parseImageClassParam } from '@/lib/images/switch-images'
import type { BlogImageGenerateInput } from '@/lib/tasks/blog-image-generate'
import { startBlogImageGeneration } from '@/lib/tasks/blog-image-generate'

/**
 * POST /api/admin/blog-images/generate
 *
 * Starts a background task to generate blog hero images.
 * Body: { imageClass?, targets?, forceRegenerate? }
 * Response: { taskId }
 */
export const POST = withAuth(
  async (request: NextRequest, { userId }) => {
    try {
      const body = await request.json()
      const { targets, forceRegenerate } = body

      const parsedClass = parseImageClassParam(body.imageClass)
      if (!parsedClass.ok) {
        return NextResponse.json({ error: parsedClass.error }, { status: 400 })
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
        imageClass: parsedClass.imageClass,
        targets: resolvedTargets,
        forceRegenerate: !!forceRegenerate,
        _userId: userId,
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
