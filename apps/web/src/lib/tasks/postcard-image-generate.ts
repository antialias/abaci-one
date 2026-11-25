/**
 * Subtask: Generate a single postcard AI image.
 *
 * Takes a prompt + image class, generates the image, stores it as a draft,
 * and returns the storage path. The parent orchestrator (postcard-generate)
 * decides whether to accept, retry, or discard based on review results.
 */

import { AiFeature } from '@/lib/ai-usage/features'
import { recordImageGenUsage } from '@/lib/ai-usage/helpers'
import { readPersistentImage, storeImage } from '../image-storage'
import {
  generateImage,
  isImageGenerationConfigured,
  NOT_CONFIGURED_MESSAGE,
} from '../images/switch-images'
import { createChildTask, createTask, type TaskHandle } from '../task-manager'
import type { PostcardImageGenerateEvent } from './events'

export interface PostcardImageGenerateInput {
  postcardId: string
  prompt: string
  /** Image class to ask the switch proxy for. */
  imageClass: string
  attempt: number
  /** Storage key for reference image (category/filename), if any */
  referenceImageKey?: string
  _userId?: string
}

export interface PostcardImageGenerateOutput {
  postcardId: string
  /** Storage path: category/filename for the draft image */
  imagePath: string
  sizeBytes: number
}

type Handler = (
  handle: TaskHandle<PostcardImageGenerateOutput, PostcardImageGenerateEvent>,
  input: PostcardImageGenerateInput
) => Promise<void>

const handler: Handler = async (handle, config) => {
  const { postcardId, prompt, imageClass, attempt, referenceImageKey } = config

  if (!isImageGenerationConfigured()) {
    handle.emit({ type: 'image_error', postcardId, error: NOT_CONFIGURED_MESSAGE })
    handle.fail(NOT_CONFIGURED_MESSAGE)
    return
  }

  handle.emit({
    type: 'image_generating',
    postcardId,
    imageClass,
    attempt,
  })
  handle.setProgress(10, 'Generating image...')

  // Load reference image if provided
  let referenceImage: Buffer | undefined
  if (referenceImageKey) {
    const [category, filename] = referenceImageKey.split('/')
    const result = await readPersistentImage(category, filename)
    if (result) referenceImage = result.buffer
  }

  const genResult = await generateImage({
    imageClass,
    prompt,
    size: { width: 1024, height: 768 },
    referenceImage,
  })

  if (config._userId) {
    recordImageGenUsage(genResult, {
      userId: config._userId,
      feature: AiFeature.IMAGE_GENERATE,
      backgroundTaskId: handle.id,
    })
  }

  handle.setProgress(80, 'Storing draft image...')

  // Store as draft with attempt number
  const draftFilename = `${postcardId}-draft-${attempt}.png`
  const { sizeBytes } = storeImage(
    { type: 'persistent', category: 'postcards', filename: draftFilename },
    genResult.imageBuffer
  )

  const imagePath = `postcards/${draftFilename}`

  handle.emit({ type: 'image_generated', postcardId, imagePath, sizeBytes })
  handle.complete({ postcardId, imagePath, sizeBytes })
}

export async function startPostcardImageGenerate(
  input: PostcardImageGenerateInput,
  userId?: string,
  parentTaskId?: string
): Promise<string> {
  if (parentTaskId) {
    return createChildTask<
      PostcardImageGenerateInput,
      PostcardImageGenerateOutput,
      PostcardImageGenerateEvent
    >(parentTaskId, 'postcard-image-generate', input, handler, userId)
  }
  return createTask<
    PostcardImageGenerateInput,
    PostcardImageGenerateOutput,
    PostcardImageGenerateEvent
  >('postcard-image-generate', input, handler, userId)
}
