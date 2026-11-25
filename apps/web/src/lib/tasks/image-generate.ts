import {
  MATH_CONSTANTS,
  MATH_PROMPT_PREFIX,
  METAPHOR_PROMPT_PREFIX,
  THEME_MODIFIERS,
} from '@/components/toys/number-line/constants/constantsData'
import { AiFeature } from '../ai-usage/features'
import { recordImageGenUsage } from '../ai-usage/helpers'
import { generateAndStoreImage } from '../image-generation'
import { imageExists } from '../image-storage'
import {
  DEFAULT_IMAGE_CLASS,
  isImageGenerationConfigured,
  NOT_CONFIGURED_MESSAGE,
} from '../images/switch-images'
import { createTask } from '../task-manager'
import type { ImageGenerateEvent } from './events'

export interface ImageGenerateInput {
  /** Image class to ask the switch proxy for; defaults to DEFAULT_IMAGE_CLASS. */
  imageClass?: string
  targets: Array<{ constantId: string; style: 'metaphor' | 'math'; theme?: 'light' | 'dark' }>
  forceRegenerate?: boolean
  _userId?: string
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
 * Generates constant illustrations through the switch proxy, by image class.
 * Reports per-image progress via task events.
 */
export async function startImageGeneration(input: ImageGenerateInput): Promise<string> {
  return createTask<ImageGenerateInput, ImageGenerateOutput, ImageGenerateEvent>(
    'image-generate',
    input,
    async (handle, config) => {
      if (!isImageGenerationConfigured()) {
        handle.fail(NOT_CONFIGURED_MESSAGE)
        return
      }
      const imageClass = config.imageClass || DEFAULT_IMAGE_CLASS

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
        const storageTarget = {
          type: 'static' as const,
          relativePath: `images/constants/${filename}`,
        }

        // Skip if already exists and not force-regenerating
        if (!config.forceRegenerate && imageExists(storageTarget)) {
          results.push({
            constantId: target.constantId,
            style: target.style,
            status: 'skipped',
          })
          skipped++
          const progress = Math.round(((i + 1) / total) * 100)
          handle.setProgress(
            progress,
            `Skipped ${target.constantId} ${target.style} (already exists)`
          )
          continue
        }

        handle.emit({
          type: 'image_started',
          constantId: target.constantId,
          style: target.style,
          imageClass,
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
          const result = await generateAndStoreImage({
            imageClass,
            prompt: fullPrompt,
            storageTarget,
          })

          const sizeBytes = result.status === 'generated' ? result.sizeBytes : 0

          generated++
          consecutiveErrors = 0
          if (config._userId && result.status === 'generated') {
            recordImageGenUsage(result, {
              userId: config._userId,
              feature: AiFeature.IMAGE_CONSTANT,
              backgroundTaskId: handle.id,
            })
          }

          handle.emit({
            type: 'image_complete',
            constantId: target.constantId,
            style: target.style,
            filePath: result.publicUrl,
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
            handle.fail(
              `Generation aborted after ${MAX_CONSECUTIVE_ERRORS} consecutive failures: ${errorMsg}`
            )
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
