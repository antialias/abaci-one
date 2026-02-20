import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'

const embedHtmlDirectory = path.join(process.cwd(), 'content', 'blog', 'embed-html')

/**
 * GET /api/admin/blog/[slug]/embed-html/[embedId]
 *
 * Returns the HTML content for a specific inline embed.
 */
export const GET = withAuth(async (_request, { params }) => {
  const { slug, embedId } = (await params) as { slug: string; embedId: string }
  const filePath = path.join(embedHtmlDirectory, slug, `${embedId}.html`)

  if (fs.existsSync(filePath)) {
    const html = fs.readFileSync(filePath, 'utf8')
    return NextResponse.json({ html })
  }

  return NextResponse.json({ html: null })
}, { role: 'admin' })

/**
 * PUT /api/admin/blog/[slug]/embed-html/[embedId]
 *
 * Saves the HTML content for a specific inline embed.
 */
export const PUT = withAuth(async (request, { params }) => {
  const { slug, embedId } = (await params) as { slug: string; embedId: string }

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
  const dir = path.join(embedHtmlDirectory, slug)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const filePath = path.join(dir, `${embedId}.html`)
  fs.writeFileSync(filePath, body.html, 'utf8')

  return NextResponse.json({ success: true })
}, { role: 'admin' })
