/**
 * Generate illustrations for number line constants through the switch proxy's
 * Images API (the proxy picks who draws each image class).
 *
 * Usage:
 *   SWITCH_MEDIA_URL=... SWITCH_MEDIA_LOGIN=... npx tsx apps/web/scripts/generate-constant-images.ts
 *
 * Options:
 *   --class <c>    Image class to ask for (default: image-best)
 *   --only <id>    Generate images only for a specific constant (e.g. --only pi)
 *   --style <s>    Generate only one style: "metaphor" or "math"
 *   --dry-run      Print prompts without calling the API
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  MATH_CONSTANTS,
  MATH_PROMPT_PREFIX,
  METAPHOR_PROMPT_PREFIX,
} from '../src/components/toys/number-line/constants/constantsData'
import {
  DEFAULT_IMAGE_CLASS,
  generateImage,
  isImageGenerationConfigured,
  NOT_CONFIGURED_MESSAGE,
} from '../src/lib/images/switch-images'

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

async function generateJob(job: GenerationJob, imageClass: string): Promise<void> {
  // Skip if image already exists
  if (fs.existsSync(job.outPath)) {
    console.log(`  SKIP ${path.basename(job.outPath)} (already exists)`)
    return
  }

  console.log(`  GEN  ${path.basename(job.outPath)}`)
  console.log(`       prompt: ${job.prompt.slice(0, 80)}...`)

  const { imageBuffer, member } = await generateImage({
    prompt: job.prompt,
    imageClass,
    size: { width: 1024, height: 1024 },
  })
  if (member) console.log(`       drawn by ${member}`)
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

  const classIdx = args.indexOf('--class')
  const imageClass = classIdx !== -1 ? args[classIdx + 1] : DEFAULT_IMAGE_CLASS

  if (!dryRun && !isImageGenerationConfigured()) {
    console.error(`Error: ${NOT_CONFIGURED_MESSAGE}`)
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
      await generateJob(job, imageClass)
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
