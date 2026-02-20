import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { getAllPostsMetadata, getPostBySlug } from '@/lib/blog'
import { IMAGE_PROVIDERS } from '@/lib/tasks/blog-image-generate'
import { withAuth } from '@/lib/auth/withAuth'

const BLOG_IMAGES_DIR = join(process.cwd(), 'public', 'blog')
const EMBEDS_DIR = join(process.cwd(), 'content', 'blog', 'embeds')

/**
 * GET /api/admin/blog-images/status
 *
 * Returns blog posts with their hero image status and available providers.
 */
export const GET = withAuth(async () => {
  const allPosts = await getAllPostsMetadata()

  // Load full posts to get embeds (parsed from markdown content)
  const fullPosts = await Promise.all(
    allPosts.map((meta) => getPostBySlug(meta.slug))
  )

  const posts = allPosts.map((post, idx) => {
    // Check generated image at convention path
    const generatedFile = join(BLOG_IMAGES_DIR, `${post.slug}.png`)
    const generatedExists = existsSync(generatedFile)

    // Check for explicit heroImage from frontmatter (e.g. legacy images with non-standard names)
    let heroImageExists = false
    let heroImageSize: number | undefined
    if (post.heroImage) {
      const heroFile = join(process.cwd(), 'public', post.heroImage.replace(/^\//, ''))
      heroImageExists = existsSync(heroFile)
      if (heroImageExists) {
        heroImageSize = statSync(heroFile).size
      }
    }

    const imageExists = generatedExists || heroImageExists

    // Read embed config to check which embeds are configured
    const fullPost = fullPosts[idx]
    let embedConfig: Record<string, unknown> = {}
    const embedConfigPath = join(EMBEDS_DIR, `${post.slug}.json`)
    if (existsSync(embedConfigPath)) {
      try {
        embedConfig = JSON.parse(readFileSync(embedConfigPath, 'utf8'))
      } catch {
        // ignore
      }
    }

    const embeds = fullPost.embeds.map((embed) => ({
      id: embed.id,
      description: embed.description,
      configured: embed.id in embedConfig,
    }))

    return {
      slug: post.slug,
      title: post.title,
      heroPrompt: post.heroPrompt ?? null,
      heroImage: post.heroImage ?? null,
      heroAspectRatio: post.heroAspectRatio ?? null,
      featured: post.featured,
      heroCrop: post.heroCrop ?? null,
      heroImageUrl: post.heroImageUrl ?? null,
      heroType: post.heroType ?? null,
      heroStoryId: post.heroStoryId ?? null,
      heroComponentId: post.heroComponentId ?? null,
      imageExists,
      sizeBytes: generatedExists
        ? statSync(generatedFile).size
        : heroImageSize,
      embeds,
    }
  })

  const providers = IMAGE_PROVIDERS.map((p) => {
    const hasKey =
      'envKeyAlt' in p
        ? !!(process.env[p.envKey] || process.env[p.envKeyAlt!])
        : !!process.env[p.envKey]

    return {
      id: p.id,
      name: p.name,
      available: hasKey,
      models: p.models.map((m) => ({ id: m.id, name: m.name })),
    }
  })

  return NextResponse.json({ posts, providers })
}, { role: 'admin' })
