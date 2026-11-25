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
import type { BlogImageGenerateEvent } from './events'

export interface BlogImageGenerateInput {
  /** Image class to ask the switch proxy for; defaults to DEFAULT_IMAGE_CLASS. */
  imageClass?: string
  targets: Array<{ slug: string; prompt: string }>
  forceRegenerate?: boolean
  aspectRatio?: string
  _userId?: string
}

export interface BlogImageGenerateOutput {
  generated: number
  skipped: number
  failed: number
  results: Array<{
    slug: string
    status: 'generated' | 'skipped' | 'failed'
    error?: string
  }>
}

/**
 * Start a blog hero image generation background task.
 *
 * Generates hero images for blog posts through the switch proxy, by image
 * class. Fallback between providers is the proxy's job, not ours.
 */
export async function startBlogImageGeneration(input: BlogImageGenerateInput): Promise<string> {
  return createTask<BlogImageGenerateInput, BlogImageGenerateOutput, BlogImageGenerateEvent>(
    'blog-image-generate',
    input,
    async (handle, config) => {
      if (!isImageGenerationConfigured()) {
        handle.fail(NOT_CONFIGURED_MESSAGE)
        return
      }
      const imageClass = config.imageClass || DEFAULT_IMAGE_CLASS

      const results: BlogImageGenerateOutput['results'] = []
      let generated = 0
      let skipped = 0
      let failed = 0
      let consecutiveErrors = 0
      const MAX_CONSECUTIVE_ERRORS = 3

      const total = config.targets.length

      handle.setProgress(0, `Starting generation of ${total} blog image${total === 1 ? '' : 's'}`)

      for (let i = 0; i < config.targets.length; i++) {
        if (handle.isCancelled()) break

        const target = config.targets[i]
        const storageTarget = { type: 'static' as const, relativePath: `blog/${target.slug}.png` }

        // Skip if already exists and not force-regenerating
        if (!config.forceRegenerate && imageExists(storageTarget)) {
          results.push({ slug: target.slug, status: 'skipped' })
          skipped++
          const progress = Math.round(((i + 1) / total) * 100)
          handle.setProgress(progress, `Skipped ${target.slug} (already exists)`)
          continue
        }

        handle.emit({
          type: 'image_started',
          slug: target.slug,
          imageClass,
        })

        handle.emit({
          type: 'batch_progress',
          completed: generated + skipped + failed,
          total,
          currentSlug: target.slug,
        })

        try {
          const result = await generateAndStoreImage({
            imageClass,
            prompt: target.prompt,
            storageTarget,
          })

          generated++
          consecutiveErrors = 0
          if (config._userId && result.status === 'generated') {
            recordImageGenUsage(result, {
              userId: config._userId,
              feature: AiFeature.IMAGE_BLOG,
              backgroundTaskId: handle.id,
            })
          }

          handle.emit({
            type: 'image_complete',
            slug: target.slug,
            filePath: result.publicUrl,
            sizeBytes: result.status === 'generated' ? result.sizeBytes : 0,
          })

          results.push({ slug: target.slug, status: 'generated' })
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          failed++
          consecutiveErrors++

          handle.emit({
            type: 'image_error',
            slug: target.slug,
            error: errorMsg,
          })

          results.push({ slug: target.slug, status: 'failed', error: errorMsg })

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
