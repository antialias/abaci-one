import { createTask } from '../task-manager'
import { getImageProvider } from '../image-providers'
import { generateAndStoreImage } from '../image-generation'
import { imageExists } from '../image-storage'
import type { BlogImageGenerateEvent } from './events'

export { IMAGE_PROVIDERS } from '../image-providers'

export interface BlogImageGenerateInput {
  provider: 'gemini' | 'openai'
  model: string
  fallbackProvider?: 'gemini' | 'openai'
  fallbackModel?: string
  targets: Array<{ slug: string; prompt: string }>
  forceRegenerate?: boolean
  aspectRatio?: string
}

export interface BlogImageGenerateOutput {
  generated: number
  skipped: number
  failed: number
  results: Array<{
    slug: string
    status: 'generated' | 'skipped' | 'failed'
    error?: string
    usedFallback?: boolean
  }>
}

/**
 * Start a blog hero image generation background task.
 *
 * Generates hero images for blog posts using the specified AI provider.
 * If a fallback provider is configured, automatically retries failed images
 * with the fallback before counting them as failures.
 */
export async function startBlogImageGeneration(input: BlogImageGenerateInput): Promise<string> {
  return createTask<BlogImageGenerateInput, BlogImageGenerateOutput, BlogImageGenerateEvent>(
    'blog-image-generate',
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

      // Validate fallback provider if specified
      const hasFallback = config.fallbackProvider && config.fallbackModel
      if (hasFallback) {
        const fb = getImageProvider(config.fallbackProvider!)
        if (!fb) {
          handle.fail(`Unknown fallback provider: ${config.fallbackProvider}`)
          return
        }
        if (!fb.isAvailable()) {
          const { envKey, envKeyAlt } = fb.meta
          const keys = envKeyAlt ? `${envKey} or ${envKeyAlt}` : envKey
          handle.fail(
            `No API key configured for fallback ${fb.meta.name}. Set ${keys} in your environment.`
          )
          return
        }
      }

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
          model: config.model,
          provider: config.provider,
        })

        handle.emit({
          type: 'batch_progress',
          completed: generated + skipped + failed,
          total,
          currentSlug: target.slug,
        })

        // Try primary provider
        let succeeded = false
        let usedFallback = false

        try {
          const result = await generateAndStoreImage({
            provider: config.provider,
            model: config.model,
            prompt: target.prompt,
            storageTarget,
          })

          generated++
          consecutiveErrors = 0
          succeeded = true

          handle.emit({
            type: 'image_complete',
            slug: target.slug,
            filePath: result.publicUrl,
            sizeBytes: result.sizeBytes ?? 0,
          })

          results.push({ slug: target.slug, status: 'generated' })
        } catch (primaryErr) {
          const primaryError = primaryErr instanceof Error ? primaryErr.message : String(primaryErr)

          // Try fallback if configured
          if (hasFallback) {
            handle.emit({
              type: 'image_fallback',
              slug: target.slug,
              primaryError,
              fallbackProvider: config.fallbackProvider!,
              fallbackModel: config.fallbackModel!,
            })

            try {
              const result = await generateAndStoreImage({
                provider: config.fallbackProvider!,
                model: config.fallbackModel!,
                prompt: target.prompt,
                storageTarget,
              })

              generated++
              consecutiveErrors = 0
              succeeded = true
              usedFallback = true

              handle.emit({
                type: 'image_complete',
                slug: target.slug,
                filePath: result.publicUrl,
                sizeBytes: result.sizeBytes ?? 0,
                usedFallback: true,
              })

              results.push({ slug: target.slug, status: 'generated', usedFallback: true })
            } catch (fallbackErr) {
              // Both primary and fallback failed
              const fallbackError =
                fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
              const combinedError = `Primary (${config.provider}): ${primaryError} | Fallback (${config.fallbackProvider}): ${fallbackError}`

              failed++
              consecutiveErrors++

              handle.emit({
                type: 'image_error',
                slug: target.slug,
                error: combinedError,
              })

              results.push({ slug: target.slug, status: 'failed', error: combinedError })
            }
          } else {
            // No fallback configured
            failed++
            consecutiveErrors++

            handle.emit({
              type: 'image_error',
              slug: target.slug,
              error: primaryError,
            })

            results.push({ slug: target.slug, status: 'failed', error: primaryError })
          }
        }

        if (!succeeded && consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          const lastError = results[results.length - 1]?.error ?? 'Unknown error'
          handle.fail(
            `Generation aborted after ${MAX_CONSECUTIVE_ERRORS} consecutive failures: ${lastError}`
          )
          return
        }

        const progress = Math.round(((i + 1) / total) * 100)
        handle.setProgress(
          progress,
          `${generated + skipped + failed}/${total} — ${generated} generated${usedFallback ? ' (fallback)' : ''}, ${skipped} skipped, ${failed} failed`
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
