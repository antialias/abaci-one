import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'

const heroHtmlDirectory = path.join(process.cwd(), 'content', 'blog', 'hero-html')

/**
 * GET /api/admin/blog/[slug]/hero-html
 *
 * Reads the hero HTML file for a blog post.
 */
export const GET = withAuth(async (_request, { params }) => {
  const { slug } = (await params) as { slug: string }
  const filePath = path.join(heroHtmlDirectory, `${slug}.html`)

  if (fs.existsSync(filePath)) {
    const html = fs.readFileSync(filePath, 'utf8')
    return NextResponse.json({ html })
  }

  return NextResponse.json({ html: null })
}, { role: 'admin' })

/**
 * PUT /api/admin/blog/[slug]/hero-html
 *
 * Writes the hero HTML file for a blog post.
 */
export const PUT = withAuth(async (request, { params }) => {
  const { slug } = (await params) as { slug: string }

  let body: { html: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.html !== 'string') {
    return NextResponse.json({ error: 'html field required' }, { status: 400 })
  }

  // Ensure directory exists
  if (!fs.existsSync(heroHtmlDirectory)) {
    fs.mkdirSync(heroHtmlDirectory, { recursive: true })
  }

  const filePath = path.join(heroHtmlDirectory, `${slug}.html`)
  fs.writeFileSync(filePath, body.html, 'utf8')

  return NextResponse.json({ success: true })
}, { role: 'admin' })
