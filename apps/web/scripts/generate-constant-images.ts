/**
 * Generate illustrations for number line constants using Gemini image generation.
 *
 * Usage:
 *   GEMINI_API_KEY=... npx tsx apps/web/scripts/generate-constant-images.ts
 *
 * Options:
 *   --only <id>    Generate images only for a specific constant (e.g. --only pi)
 *   --style <s>    Generate only one style: "metaphor" or "math"
 *   --dry-run      Print prompts without calling the API
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  MATH_CONSTANTS,
  METAPHOR_PROMPT_PREFIX,
  MATH_PROMPT_PREFIX,
} from '../src/components/toys/number-line/constants/constantsData'

const API_KEY = process.env.GEMINI_API_KEY
const MODEL = 'gemini-2.0-flash-exp'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`

const OUT_DIR = path.resolve(__dirname, '../public/images/constants')

interface GenerationJob {
  constantId: string
  style: 'metaphor' | 'math'
  prompt: string
  outPath: string
}

function buildJobs(onlyId?: string, onlyStyle?: string): GenerationJob[] {
  const jobs: GenerationJob[] = []

  for (const c of MATH_CONSTANTS) {
    if (onlyId && c.id !== onlyId) continue

    if (!onlyStyle || onlyStyle === 'metaphor') {
      jobs.push({
        constantId: c.id,
        style: 'metaphor',
        prompt: `${METAPHOR_PROMPT_PREFIX} ${c.metaphorPrompt}`,
        outPath: path.join(OUT_DIR, `${c.id}-metaphor.png`),
      })
    }

    if (!onlyStyle || onlyStyle === 'math') {
      jobs.push({
        constantId: c.id,
        style: 'math',
        prompt: `${MATH_PROMPT_PREFIX} ${c.mathPrompt}`,
        outPath: path.join(OUT_DIR, `${c.id}-math.png`),
      })
    }
  }

  return jobs
}

async function generateImage(job: GenerationJob): Promise<void> {
  // Skip if image already exists
  if (fs.existsSync(job.outPath)) {
    console.log(`  SKIP ${path.basename(job.outPath)} (already exists)`)
    return
  }

  console.log(`  GEN  ${path.basename(job.outPath)}`)
  console.log(`       prompt: ${job.prompt.slice(0, 80)}...`)

  const body = {
    contents: [{ parts: [{ text: job.prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageDimension: 'SQUARE_500x500',
    },
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status} for ${job.constantId}-${job.style}: ${text}`)
  }

  const data = await res.json()

  // Extract base64 image from response
  const parts = data.candidates?.[0]?.content?.parts
  if (!parts) {
    throw new Error(`No parts in response for ${job.constantId}-${job.style}: ${JSON.stringify(data).slice(0, 200)}`)
  }

  const imagePart = parts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imagePart) {
    throw new Error(`No image part in response for ${job.constantId}-${job.style}: ${JSON.stringify(parts.map((p: Record<string, unknown>) => Object.keys(p))).slice(0, 200)}`)
  }

  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
  fs.writeFileSync(job.outPath, imageBuffer)
  console.log(`  OK   ${path.basename(job.outPath)} (${(imageBuffer.length / 1024).toFixed(0)} KB)`)
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const onlyIdx = args.indexOf('--only')
  const onlyId = onlyIdx !== -1 ? args[onlyIdx + 1] : undefined
  const styleIdx = args.indexOf('--style')
  const onlyStyle = styleIdx !== -1 ? args[styleIdx + 1] : undefined

  if (!dryRun && !API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is required')
    process.exit(1)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const jobs = buildJobs(onlyId, onlyStyle)
  console.log(`\nGenerating ${jobs.length} images...\n`)

  if (dryRun) {
    for (const job of jobs) {
      console.log(`[${job.constantId}/${job.style}]`)
      console.log(`  File:   ${path.basename(job.outPath)}`)
      console.log(`  Prompt: ${job.prompt}\n`)
    }
    return
  }

  // Generate sequentially to avoid rate limits
  let success = 0
  let skipped = 0
  let failed = 0

  for (const job of jobs) {
    try {
      const existed = fs.existsSync(job.outPath)
      await generateImage(job)
      if (existed) skipped++
      else success++
    } catch (err) {
      failed++
      console.error(`  FAIL ${job.constantId}-${job.style}: ${err}`)
    }
  }

  console.log(`\nDone: ${success} generated, ${skipped} skipped, ${failed} failed`)
}

main()
