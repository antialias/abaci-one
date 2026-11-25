/**
 * Subtask: Generate a postcard thumbnail image.
 *
 * Simple image generation — no review needed. Generates a small iconic
 * thumbnail and stores it directly.
 */

import { AiFeature } from '../ai-usage/features'
import { recordImageGenUsage } from '../ai-usage/helpers'
import { generateAndStoreImage } from '../image-generation'
import { createChildTask, createTask, type TaskHandle } from '../task-manager'
import type { PostcardThumbnailGenerateEvent } from './events'

export interface PostcardThumbnailGenerateInput {
  postcardId: string
  prompt: string
  /** Image class to ask the switch proxy for. */
  imageClass: string
  _userId?: string
}

export interface PostcardThumbnailGenerateOutput {
  postcardId: string
  thumbnailUrl: string
  sizeBytes: number
}

type Handler = (
  handle: TaskHandle<PostcardThumbnailGenerateOutput, PostcardThumbnailGenerateEvent>,
  input: PostcardThumbnailGenerateInput
) => Promise<void>

const handler: Handler = async (handle, config) => {
  const { postcardId, prompt, imageClass } = config

  handle.emit({ type: 'thumbnail_generating', postcardId, imageClass })
  handle.setProgress(10, 'Generating thumbnail...')

  try {
    const result = await generateAndStoreImage({
      imageClass,
      prompt,
      size: { width: 256, height: 192 },
      storageTarget: {
        type: 'persistent',
        category: 'postcards',
        filename: `${postcardId}-thumb.png`,
      },
    })

    if (config._userId && result.status === 'generated') {
      recordImageGenUsage(result, {
        userId: config._userId,
        feature: AiFeature.IMAGE_POSTCARD_THUMB,
        backgroundTaskId: handle.id,
      })
    }

    handle.emit({
      type: 'thumbnail_generated',
      postcardId,
      thumbnailUrl: result.publicUrl,
      sizeBytes: result.status === 'generated' ? result.sizeBytes : 0,
    })

    handle.complete({
      postcardId,
      thumbnailUrl: result.publicUrl,
      sizeBytes: result.status === 'generated' ? result.sizeBytes : 0,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Thumbnail generation failed'
    handle.emit({ type: 'thumbnail_error', postcardId, error })
    handle.fail(error)
  }
}

export async function startPostcardThumbnailGenerate(
  input: PostcardThumbnailGenerateInput,
  userId?: string,
  parentTaskId?: string
): Promise<string> {
  if (parentTaskId) {
    return createChildTask<
      PostcardThumbnailGenerateInput,
      PostcardThumbnailGenerateOutput,
      PostcardThumbnailGenerateEvent
    >(parentTaskId, 'postcard-thumbnail-generate', input, handler, userId)
  }
  return createTask<
    PostcardThumbnailGenerateInput,
    PostcardThumbnailGenerateOutput,
    PostcardThumbnailGenerateEvent
  >('postcard-thumbnail-generate', input, handler, userId)
}
