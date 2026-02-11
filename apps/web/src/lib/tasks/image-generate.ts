import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  MATH_CONSTANTS,
  METAPHOR_PROMPT_PREFIX,
  MATH_PROMPT_PREFIX,
  THEME_MODIFIERS,
} from '@/components/toys/number-line/constants/constantsData'
import { createTask } from '../task-manager'
import { getImageProvider } from '../image-providers'
import type { ImageGenerateEvent } from './events'

export { IMAGE_PROVIDERS } from '../image-providers'

const IMAGES_DIR = join(process.cwd(), 'public', 'images', 'constants')

export interface ImageGenerateInput {
  provider: 'gemini' | 'openai'
  model: string
  targets: Array<{ constantId: string; style: 'metaphor' | 'math'; theme?: 'light' | 'dark' }>
  forceRegenerate?: boolean
}

export interface ImageGenerateOutput {
  generated: number
  skipped: number
  failed: number
  results: Array<{
    constantId: string
    style: string
    status: 'generated' | 'skipped' | 'failed'
    error?: string
  }>
}

/**
 * Start an image generation background task.
 *
 * Generates constant illustrations using the specified AI provider.
 * Reports per-image progress via task events.
 */
export async function startImageGeneration(input: ImageGenerateInput): Promise<string> {
  return createTask<ImageGenerateInput, ImageGenerateOutput, ImageGenerateEvent>(
    'image-generate',
    input,
    async (handle, config) => {
      const provider = getImageProvider(config.provider)
      if (!provider) {
        handle.fail(`Unknown image provider: ${config.provider}`)
        return
      }

      if (!provider.isAvailable()) {
        const { envKey, envKeyAlt } = provider.meta
        const keys = envKeyAlt ? `${envKey} or ${envKeyAlt}` : envKey
        handle.fail(
          `No API key configured for ${provider.meta.name}. Set ${keys} in your environment.`
        )
        return
      }

      mkdirSync(IMAGES_DIR, { recursive: true })

      // Build lookup for constant data
      const constantMap = new Map(MATH_CONSTANTS.map((c) => [c.id, c]))

      // Determine work items
      const results: ImageGenerateOutput['results'] = []
      let generated = 0
      let skipped = 0
      let failed = 0
      let consecutiveErrors = 0
      const MAX_CONSECUTIVE_ERRORS = 3

      const total = config.targets.length

      handle.setProgress(0, `Starting generation of ${total} images`)

      for (let i = 0; i < config.targets.length; i++) {
        if (handle.isCancelled()) break

        const target = config.targets[i]
        const constant = constantMap.get(target.constantId)
        if (!constant) {
          results.push({
            constantId: target.constantId,
            style: target.style,
            status: 'failed',
            error: `Unknown constant: ${target.constantId}`,
          })
          failed++
          continue
        }

        const filename = `${target.constantId}-${target.style}${target.theme ? `-${target.theme}` : ''}.png`
        const filePath = join(IMAGES_DIR, filename)

        // Skip if already exists and not force-regenerating
        if (!config.forceRegenerate && existsSync(filePath)) {
          results.push({
            constantId: target.constantId,
            style: target.style,
            status: 'skipped',
          })
          skipped++
          const progress = Math.round(((i + 1) / total) * 100)
          handle.setProgress(progress, `Skipped ${target.constantId} ${target.style} (already exists)`)
          continue
        }

        handle.emit({
          type: 'image_started',
          constantId: target.constantId,
          style: target.style,
          model: config.model,
          provider: config.provider,
          ...(target.theme && { theme: target.theme }),
        })

        handle.emit({
          type: 'batch_progress',
          completed: generated + skipped + failed,
          total,
          currentConstant: constant.name,
          currentStyle: target.style,
          ...(target.theme && { theme: target.theme }),
        })

        // Build the full prompt
        const prefix = target.style === 'metaphor' ? METAPHOR_PROMPT_PREFIX : MATH_PROMPT_PREFIX
        const suffix = target.style === 'metaphor' ? constant.metaphorPrompt : constant.mathPrompt
        const themeModifier = target.theme ? ` ${THEME_MODIFIERS[target.theme][target.style]}` : ''
        const fullPrompt = `${prefix} ${suffix}${themeModifier}`

        try {
          const { imageBuffer } = await provider.generate({ model: config.model, prompt: fullPrompt })

          writeFileSync(filePath, imageBuffer)
          const sizeBytes = statSync(filePath).size

          generated++
          consecutiveErrors = 0

          handle.emit({
            type: 'image_complete',
            constantId: target.constantId,
            style: target.style,
            filePath: `/images/constants/${filename}`,
            sizeBytes,
            ...(target.theme && { theme: target.theme }),
          })

          results.push({
            constantId: target.constantId,
            style: target.style,
            status: 'generated',
          })
        } catch (err) {
          failed++
          consecutiveErrors++
          const errorMsg = err instanceof Error ? err.message : String(err)

          handle.emit({
            type: 'image_error',
            constantId: target.constantId,
            style: target.style,
            error: errorMsg,
            ...(target.theme && { theme: target.theme }),
          })

          results.push({
            constantId: target.constantId,
            style: target.style,
            status: 'failed',
            error: errorMsg,
          })

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            handle.fail(`Generation aborted after ${MAX_CONSECUTIVE_ERRORS} consecutive failures: ${errorMsg}`)
            return
          }
        }

        const progress = Math.round(((i + 1) / total) * 100)
        handle.setProgress(
          progress,
          `${generated + skipped + failed}/${total} — ${generated} generated, ${skipped} skipped, ${failed} failed`
        )
      }

      handle.emit({
        type: 'batch_complete',
        generated,
        skipped,
        failed,
      })

      handle.complete({ generated, skipped, failed, results })
    }
  )
}
