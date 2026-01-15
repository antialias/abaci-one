/**
 * Capture screenshots from Storybook stories for blog posts.
 *
 * Usage:
 *   1. Start Storybook: pnpm storybook
 *   2. Run this script: npx tsx scripts/captureStoryScreenshots.ts
 *
 * Screenshots are saved to public/blog/vision-examples/
 */

import { chromium } from 'playwright'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const STORYBOOK_URL = 'http://localhost:6006'
const OUTPUT_DIR = join(process.cwd(), 'public/blog/vision-examples')

// Stories to capture with their output filenames
const STORIES_TO_CAPTURE = [
  {
    // Before/After comparison - great for showing the feature value
    storyId: 'vision-detection-feedback--before-after',
    filename: 'before-after-comparison.png',
    viewport: { width: 900, height: 500 },
  },
  {
    // Progress gallery showing step-by-step detection
    storyId: 'vision-detection-feedback--progress-gallery',
    filename: 'detection-progress-gallery.png',
    viewport: { width: 1200, height: 500 },
  },
  {
    // First term completed
    storyId: 'vision-detection-feedback--first-term-completed',
    filename: 'first-term-completed.png',
    viewport: { width: 400, height: 450 },
  },
  {
    // Two terms completed
    storyId: 'vision-detection-feedback--two-terms-completed',
    filename: 'two-terms-completed.png',
    viewport: { width: 400, height: 450 },
  },
]

async function captureScreenshots() {
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log(`Created output directory: ${OUTPUT_DIR}`)
  }

  console.log('Launching browser...')
  const browser = await chromium.launch()
  const context = await browser.newContext()

  for (const story of STORIES_TO_CAPTURE) {
    console.log(`\nCapturing: ${story.filename}`)

    const page = await context.newPage()
    await page.setViewportSize(story.viewport)

    // Storybook iframe URL for isolated story view
    const storyUrl = `${STORYBOOK_URL}/iframe.html?id=${story.storyId}&viewMode=story`
    console.log(`  URL: ${storyUrl}`)

    try {
      await page.goto(storyUrl, { waitUntil: 'load', timeout: 60000 })

      // Wait for the story to render and animations to settle
      await page.waitForTimeout(2000)

      const outputPath = join(OUTPUT_DIR, story.filename)
      await page.screenshot({
        path: outputPath,
        type: 'png',
      })

      console.log(`  Saved: ${outputPath}`)
    } catch (error) {
      console.error(`  Error capturing ${story.filename}:`, error)
    }

    await page.close()
  }

  await browser.close()
  console.log('\nDone!')
}

// Run the script
captureScreenshots().catch(console.error)
