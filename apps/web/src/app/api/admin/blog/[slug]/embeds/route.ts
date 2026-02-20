import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'

const embedsDirectory = path.join(process.cwd(), 'content', 'blog', 'embeds')

/**
 * GET /api/admin/blog/[slug]/embeds
 *
 * Returns the embed config JSON for a blog post.
 */
export const GET = withAuth(async (_request, { params }) => {
  const { slug } = (await params) as { slug: string }
  const filePath = path.join(embedsDirectory, `${slug}.json`)

  if (fs.existsSync(filePath)) {
    try {
      const config = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      return NextResponse.json({ config })
    } catch {
      return NextResponse.json({ config: {} })
    }
  }

  return NextResponse.json({ config: {} })
}, { role: 'admin' })

/**
 * PUT /api/admin/blog/[slug]/embeds
 *
 * Saves the full embed config JSON for a blog post.
 */
export const PUT = withAuth(async (request, { params }) => {
  const { slug } = (await params) as { slug: string }

  let body: { config: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.config !== 'object' || body.config === null) {
    return NextResponse.json({ error: 'config field required' }, { status: 400 })
  }

  // Ensure directory exists
  if (!fs.existsSync(embedsDirectory)) {
    fs.mkdirSync(embedsDirectory, { recursive: true })
  }

  const filePath = path.join(embedsDirectory, `${slug}.json`)
  fs.writeFileSync(filePath, JSON.stringify(body.config, null, 2) + '\n', 'utf8')

  return NextResponse.json({ success: true })
}, { role: 'admin' })
