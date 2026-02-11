import { getImageProvider } from './image-providers'
import type { ImageOptions } from './image-providers'
import { imageExists, storeImage } from './image-storage'
import type { ImageStorageTarget } from './image-storage'

export type { ImageStorageTarget } from './image-storage'

export interface GenerateAndStoreRequest {
  provider: string
  model: string
  prompt: string
  imageOptions?: ImageOptions
  storageTarget: ImageStorageTarget
  skipIfExists?: boolean
}

export interface GenerateAndStoreResult {
  status: 'generated' | 'skipped'
  publicUrl: string
  sizeBytes?: number
}

export async function generateAndStoreImage(
  req: GenerateAndStoreRequest
): Promise<GenerateAndStoreResult> {
  if (req.skipIfExists && imageExists(req.storageTarget)) {
    const publicUrl =
      req.storageTarget.type === 'static'
        ? `/${req.storageTarget.relativePath}`
        : `/api/images/${req.storageTarget.category}/${req.storageTarget.filename}`
    return { status: 'skipped', publicUrl }
  }

  const provider = getImageProvider(req.provider)
  if (!provider) {
    throw new Error(`Unknown image provider: ${req.provider}`)
  }

  const { imageBuffer } = await provider.generate({
    model: req.model,
    prompt: req.prompt,
    options: req.imageOptions,
  })

  const { publicUrl, sizeBytes } = storeImage(req.storageTarget, imageBuffer)
  return { status: 'generated', publicUrl, sizeBytes }
}
