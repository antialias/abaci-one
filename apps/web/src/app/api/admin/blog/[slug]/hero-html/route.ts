import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireRole'

const heroHtmlDirectory = path.join(process.cwd(), 'content', 'blog', 'hero-html')

/**
 * GET /api/admin/blog/[slug]/hero-html
 *
 * Reads the hero HTML file for a blog post.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { slug } = await params
  const filePath = path.join(heroHtmlDirectory, `${slug}.html`)

  if (fs.existsSync(filePath)) {
    const html = fs.readFileSync(filePath, 'utf8')
    return NextResponse.json({ html })
  }

  return NextResponse.json({ html: null })
}

/**
 * PUT /api/admin/blog/[slug]/hero-html
 *
 * Writes the hero HTML file for a blog post.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { slug } = await params

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
}
