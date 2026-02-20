import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'

const postsDirectory = path.join(process.cwd(), 'content', 'blog')

/**
 * PATCH /api/admin/blog/[slug]
 *
 * Update blog post frontmatter fields (featured, heroCrop, heroPrompt).
 */
export const PATCH = withAuth(async (request, { params }) => {
  const { slug } = (await params) as { slug: string }

  const filePath = path.join(postsDirectory, `${slug}.md`)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  let body: {
    featured?: boolean
    heroCrop?: string
    heroPrompt?: string
    heroType?: string
    heroStoryId?: string
    heroComponentId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const fileContents = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(fileContents)

  if (typeof body.featured === 'boolean') {
    data.featured = body.featured
  }
  if (typeof body.heroCrop === 'string') {
    data.heroCrop = body.heroCrop
  }
  if (typeof body.heroPrompt === 'string') {
    if (body.heroPrompt.trim()) {
      data.heroPrompt = body.heroPrompt.trim()
    } else {
      delete data.heroPrompt
    }
  }
  if (typeof body.heroType === 'string') {
    if (body.heroType.trim()) {
      data.heroType = body.heroType.trim()
    } else {
      delete data.heroType
    }
  }
  if (typeof body.heroStoryId === 'string') {
    if (body.heroStoryId.trim()) {
      data.heroStoryId = body.heroStoryId.trim()
    } else {
      delete data.heroStoryId
    }
  }
  if (typeof body.heroComponentId === 'string') {
    if (body.heroComponentId.trim()) {
      data.heroComponentId = body.heroComponentId.trim()
    } else {
      delete data.heroComponentId
    }
  }

  const updated = matter.stringify(content, data)
  fs.writeFileSync(filePath, updated, 'utf8')

  return NextResponse.json({
    slug,
    featured: data.featured ?? false,
    heroCrop: data.heroCrop ?? null,
    heroPrompt: data.heroPrompt ?? null,
    heroType: data.heroType ?? null,
    heroStoryId: data.heroStoryId ?? null,
    heroComponentId: data.heroComponentId ?? null,
  })
}, { role: 'admin' })
