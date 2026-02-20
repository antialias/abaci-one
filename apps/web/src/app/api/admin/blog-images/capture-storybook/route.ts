import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'

const BLOG_IMAGES_DIR = path.join(process.cwd(), 'public', 'blog')

/**
 * POST /api/admin/blog-images/capture-storybook
 *
 * Captures a screenshot of a Storybook story using Puppeteer.
 * Requires Storybook running locally on port 6006.
 */
export const POST = withAuth(async (request: NextRequest) => {
  let body: { slug: string; storyId: string; width?: number; height?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { slug, storyId, width = 1200, height = 500 } = body

  if (!slug || !storyId) {
    return NextResponse.json({ error: 'slug and storyId are required' }, { status: 400 })
  }

  let puppeteer: typeof import('puppeteer')
  try {
    puppeteer = await import('puppeteer')
  } catch {
    return NextResponse.json(
      { error: 'puppeteer is not installed. Run: pnpm add -D puppeteer' },
      { status: 500 }
    )
  }

  let browser
  try {
    browser = await puppeteer.default.launch({
      headless: true,
      protocolTimeout: 120000,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setViewport({ width, height })

    const storybookUrl = `http://localhost:6006/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`
    await page.goto(storybookUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // Wait for story content to render (Storybook HMR keeps connections open, so networkidle0 times out)
    await new Promise((r) => setTimeout(r, 5000))

    // Ensure output directory exists
    if (!fs.existsSync(BLOG_IMAGES_DIR)) {
      fs.mkdirSync(BLOG_IMAGES_DIR, { recursive: true })
    }

    const outputPath = path.join(BLOG_IMAGES_DIR, `${slug}.png`)
    await page.screenshot({ path: outputPath, type: 'png' })

    const stats = fs.statSync(outputPath)

    return NextResponse.json({
      success: true,
      path: `/blog/${slug}.png`,
      sizeBytes: stats.size,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Screenshot capture failed' },
      { status: 500 }
    )
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}, { role: 'admin' })
