import fs from 'fs'
import path from 'path'
import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'

const heroHtmlDirectory = path.join(process.cwd(), 'content', 'blog', 'hero-html')
const embedHtmlDirectory = path.join(process.cwd(), 'content', 'blog', 'embed-html')

/**
 * POST /api/admin/blog-images/capture-snapshot
 *
 * Fetches an internal URL (e.g. /api/worksheets/preview), extracts content
 * from the response, and saves it as a hero-html or embed-html file for a blog post.
 *
 * When `embedId` is provided, saves to content/blog/embed-html/{slug}/{embedId}.html
 * Otherwise saves to content/blog/hero-html/{slug}.html
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    let body: {
      slug: string
      url: string
      method?: string
      body?: unknown
      extractPath?: string
      embedId?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { slug, url, method = 'GET', body: fetchBody, extractPath, embedId } = body

    if (!slug || !url) {
      return NextResponse.json({ error: 'slug and url are required' }, { status: 400 })
    }

    // Resolve url against the app's own origin
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const origin = `${protocol}://${host}`
    const resolvedUrl = new URL(url, origin).toString()

    // Forward cookies for authentication
    const cookie = request.headers.get('cookie')

    try {
      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { cookie } : {}),
        },
      }

      if (method.toUpperCase() === 'POST' && fetchBody !== undefined) {
        fetchOptions.body = JSON.stringify(fetchBody)
      }

      const res = await fetch(resolvedUrl, fetchOptions)

      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error')
        return NextResponse.json(
          { error: `Upstream request failed (${res.status}): ${text.slice(0, 200)}` },
          { status: 502 }
        )
      }

      let content: string

      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json') && extractPath) {
        const json = await res.json()
        // Drill into the object using dot-notation path (e.g. "pages.0")
        let current: unknown = json
        for (const segment of extractPath.split('.')) {
          if (current === null || current === undefined) break
          if (typeof current === 'object') {
            current = (current as Record<string, unknown>)[segment]
          } else {
            current = undefined
          }
        }
        if (typeof current !== 'string') {
          return NextResponse.json(
            {
              error: `extractPath "${extractPath}" did not resolve to a string (got ${typeof current})`,
            },
            { status: 422 }
          )
        }
        content = current
      } else {
        content = await res.text()
      }

      // Determine save path: embed-html/{slug}/{embedId}.html or hero-html/{slug}.html
      let targetDir: string
      let filePath: string
      if (embedId) {
        targetDir = path.join(embedHtmlDirectory, slug)
        filePath = path.join(targetDir, `${embedId}.html`)
      } else {
        targetDir = heroHtmlDirectory
        filePath = path.join(targetDir, `${slug}.html`)
      }

      // Ensure directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }

      fs.writeFileSync(filePath, content, 'utf8')

      return NextResponse.json({
        success: true,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Snapshot capture failed' },
        { status: 500 }
      )
    }
  },
  { role: 'admin' }
)
