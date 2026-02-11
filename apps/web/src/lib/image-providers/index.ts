import { geminiProvider } from './gemini'
import { openaiProvider } from './openai'
import type { ImageProvider, ImageProviderMeta } from './types'

export type { ImageProvider, ImageProviderMeta, ImageGenerationResult, ImageOptions } from './types'

const providers: ImageProvider[] = [geminiProvider, openaiProvider]

const providerMap = new Map<string, ImageProvider>(
  providers.map((p) => [p.meta.id, p])
)

/** Look up a provider by its id (e.g. 'gemini', 'openai'). */
export function getImageProvider(id: string): ImageProvider | undefined {
  return providerMap.get(id)
}

/** Backward-compatible metadata array used by status routes and UI. */
export const IMAGE_PROVIDERS: readonly ImageProviderMeta[] = providers.map((p) => p.meta)
