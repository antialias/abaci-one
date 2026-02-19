import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { NextRequest, NextResponse } from 'next/server'

const postsDirectory = path.join(process.cwd(), 'content', 'blog')

/**
 * PATCH /api/admin/blog/[slug]
 *
 * Update blog post frontmatter fields (featured, heroCrop, heroPrompt).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const filePath = path.join(postsDirectory, `${slug}.md`)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  let body: { featured?: boolean; heroCrop?: string; heroPrompt?: string }
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

  const updated = matter.stringify(content, data)
  fs.writeFileSync(filePath, updated, 'utf8')

  return NextResponse.json({
    slug,
    featured: data.featured ?? false,
    heroCrop: data.heroCrop ?? null,
    heroPrompt: data.heroPrompt ?? null,
  })
}
