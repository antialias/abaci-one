import { createTask } from '../task-manager'
import { getImageProvider } from '../image-providers'
import { generateAndStoreImage } from '../image-generation'
import { imageExists } from '../image-storage'
import type { PageSpotImageGenerateEvent } from './events'
import { recordImageGenUsage } from '../ai-usage/helpers'
import { AiFeature } from '../ai-usage/features'

export { IMAGE_PROVIDERS } from '../image-providers'

export interface PageSpotImageGenerateInput {
  pageId: string
  spotId: string
  provider: 'gemini' | 'openai'
  model: string
  prompt: string
  forceRegenerate?: boolean
  _userId?: string
}

export interface PageSpotImageGenerateOutput {
  status: 'generated' | 'skipped' | 'failed'
  publicUrl?: string
  sizeBytes?: number
  error?: string
}

/**
 * Start a page-spot image generation background task.
 */
export async function startPageSpotImageGeneration(
  input: PageSpotImageGenerateInput
): Promise<string> {
  return createTask<
    PageSpotImageGenerateInput,
    PageSpotImageGenerateOutput,
    PageSpotImageGenerateEvent
  >('page-spot-generate', input, async (handle, config) => {
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

    const storageTarget = {
      type: 'static' as const,
      relativePath: `page-spots/${config.pageId}/${config.spotId}.png`,
    }

    // Skip if exists and not force-regenerating
    if (!config.forceRegenerate && imageExists(storageTarget)) {
      handle.emit({
        type: 'spot_skipped',
        pageId: config.pageId,
        spotId: config.spotId,
      })
      handle.complete({
        status: 'skipped',
        publicUrl: `/page-spots/${config.pageId}/${config.spotId}.png`,
      })
      return
    }

    handle.emit({
      type: 'spot_started',
      pageId: config.pageId,
      spotId: config.spotId,
      model: config.model,
      provider: config.provider,
    })

    handle.setProgress(10, 'Generating image...')

    try {
      const result = await generateAndStoreImage({
        provider: config.provider,
        model: config.model,
        prompt: config.prompt,
        storageTarget,
      })

      if (config._userId) {
        recordImageGenUsage(config.provider, config.model, {
          userId: config._userId,
          feature: AiFeature.IMAGE_PAGE_SPOT,
          backgroundTaskId: handle.id,
        })
      }

      handle.emit({
        type: 'spot_complete',
        pageId: config.pageId,
        spotId: config.spotId,
        filePath: result.publicUrl,
        sizeBytes: result.sizeBytes ?? 0,
      })

      handle.complete({
        status: 'generated',
        publicUrl: result.publicUrl,
        sizeBytes: result.sizeBytes,
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)

      handle.emit({
        type: 'spot_error',
        pageId: config.pageId,
        spotId: config.spotId,
        error,
      })

      handle.fail(error)
    }
  })
}
