export interface ImageProviderMeta {
  id: string
  name: string
  envKey: string
  envKeyAlt?: string
  models: ReadonlyArray<{ id: string; name: string }>
}

export interface ImageOptions {
  size?: { width: number; height: number }
}

export interface ImageGenerationResult {
  imageBuffer: Buffer
}

export interface ImageProvider {
  readonly meta: ImageProviderMeta
  generate(opts: {
    model: string
    prompt: string
    options?: ImageOptions
    /** Optional reference image for image-to-image generation (e.g. theme variants). */
    referenceImage?: Buffer
  }): Promise<ImageGenerationResult>
  isAvailable(): boolean
}
