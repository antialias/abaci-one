import fs from 'fs'
import path from 'path'
import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getSpotDefinition } from '@/lib/page-spots/spotDefinitions'

const contentDir = path.join(process.cwd(), 'content', 'page-spots')

/**
 * POST /api/admin/page-spots/capture-snapshot
 *
 * Fetches a URL, extracts content, and saves it as HTML for an html-type spot.
 * Body: { pageId, spotId, url, method?, body?, extractPath? }
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    let body: {
      pageId: string
      spotId: string
      url: string
      method?: string
      body?: unknown
      extractPath?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { pageId, spotId, url, method = 'GET', body: fetchBody, extractPath } = body

    if (!pageId || !spotId || !url) {
      return NextResponse.json({ error: 'pageId, spotId, and url are required' }, { status: 400 })
    }

    const def = getSpotDefinition(pageId, spotId)
    if (!def) {
      return NextResponse.json({ error: `Unknown spot: ${pageId}/${spotId}` }, { status: 404 })
    }

    // Resolve URL against the app's own origin
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

      // Save to content/page-spots/{pageId}/{spotId}.html
      const targetDir = path.join(contentDir, pageId)
      const filePath = path.join(targetDir, `${spotId}.html`)

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
