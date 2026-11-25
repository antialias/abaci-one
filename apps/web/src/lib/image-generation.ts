import type { ImageStorageTarget } from './image-storage'
import { imageExists, storeImage } from './image-storage'
import type { ImageSize } from './images/switch-images'
import { generateImage } from './images/switch-images'

export type { ImageStorageTarget } from './image-storage'

export interface GenerateAndStoreRequest {
  /** Image class to ask the switch proxy for; defaults to DEFAULT_IMAGE_CLASS. */
  imageClass?: string
  prompt: string
  size?: ImageSize
  storageTarget: ImageStorageTarget
  skipIfExists?: boolean
  /** Optional reference image for image-to-image generation (e.g. theme variants). */
  referenceImage?: Buffer
}

export type GenerateAndStoreResult =
  | { status: 'skipped'; publicUrl: string }
  | {
      status: 'generated'
      publicUrl: string
      sizeBytes: number
      /** Class that served the image. */
      imageClass: string
      /** Proxy member that drew it (e.g. `runway/gpt_image_2`), if reported. */
      member: string | null
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

  const { imageBuffer, imageClass, member } = await generateImage({
    imageClass: req.imageClass,
    prompt: req.prompt,
    size: req.size,
    referenceImage: req.referenceImage,
  })

  const { publicUrl, sizeBytes } = storeImage(req.storageTarget, imageBuffer)
  return { status: 'generated', publicUrl, sizeBytes, imageClass, member }
}
