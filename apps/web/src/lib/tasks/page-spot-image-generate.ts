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
import type { PageSpotImageGenerateEvent } from './events'

export interface PageSpotImageGenerateInput {
  pageId: string
  spotId: string
  /** Image class to ask the switch proxy for; defaults to DEFAULT_IMAGE_CLASS. */
  imageClass?: string
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
    if (!isImageGenerationConfigured()) {
      handle.fail(NOT_CONFIGURED_MESSAGE)
      return
    }
    const imageClass = config.imageClass || DEFAULT_IMAGE_CLASS

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
      imageClass,
    })

    handle.setProgress(10, 'Generating image...')

    try {
      const result = await generateAndStoreImage({
        imageClass,
        prompt: config.prompt,
        storageTarget,
      })

      if (config._userId && result.status === 'generated') {
        recordImageGenUsage(result, {
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
        sizeBytes: result.status === 'generated' ? result.sizeBytes : 0,
      })

      handle.complete({
        status: 'generated',
        publicUrl: result.publicUrl,
        sizeBytes: result.status === 'generated' ? result.sizeBytes : undefined,
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
