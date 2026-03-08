/**
 * Subtask: Generate a single postcard AI image.
 *
 * Takes a prompt + provider config, generates the image, stores it as a draft,
 * and returns the storage path. The parent orchestrator (postcard-generate)
 * decides whether to accept, retry, or discard based on review results.
 */

import { createTask, createChildTask, type TaskHandle } from '../task-manager'
import { getImageProvider } from '../image-providers'
import { storeImage, readPersistentImage } from '../image-storage'
import { recordImageGenUsage } from '@/lib/ai-usage/helpers'
import { AiFeature } from '@/lib/ai-usage/features'
import type { PostcardImageGenerateEvent } from './events'

export interface PostcardImageGenerateInput {
  postcardId: string
  prompt: string
  providerId: string
  modelId: string
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
  const { postcardId, prompt, providerId, modelId, attempt, referenceImageKey } = config

  const provider = getImageProvider(providerId)
  if (!provider || !provider.isAvailable()) {
    handle.emit({ type: 'image_error', postcardId, error: `Provider ${providerId} unavailable` })
    handle.fail(`Provider ${providerId} unavailable`)
    return
  }

  handle.emit({
    type: 'image_generating',
    postcardId,
    provider: providerId,
    model: modelId,
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

  const genResult = await provider.generate({
    model: modelId,
    prompt,
    options: { size: { width: 1024, height: 768 } },
    referenceImage,
  })

  if (config._userId) {
    recordImageGenUsage(providerId as 'openai' | 'gemini', modelId, {
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
