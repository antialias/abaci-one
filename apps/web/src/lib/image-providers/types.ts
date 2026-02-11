export interface ImageProviderMeta {
  id: string
  name: string
  envKey: string
  envKeyAlt?: string
  models: ReadonlyArray<{ id: string; name: string }>
}

export interface ImageGenerationResult {
  imageBuffer: Buffer
}

export interface ImageProvider {
  readonly meta: ImageProviderMeta
  generate(opts: { model: string; prompt: string }): Promise<ImageGenerationResult>
  isAvailable(): boolean
}
