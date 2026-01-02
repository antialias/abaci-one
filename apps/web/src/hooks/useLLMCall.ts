/**
 * React hooks for making LLM calls with progress tracking
 *
 * These hooks integrate the LLM client with React Query for proper
 * state management, caching, and UI feedback.
 *
 * @example
 * ```typescript
 * import { useLLMCall } from '@/hooks/useLLMCall'
 * import { z } from 'zod'
 *
 * const SentimentSchema = z.object({
 *   sentiment: z.enum(['positive', 'negative', 'neutral']),
 *   confidence: z.number(),
 * })
 *
 * function MyComponent() {
 *   const { mutate, progress, isPending, error, data } = useLLMCall(SentimentSchema)
 *
 *   return (
 *     <div>
 *       <button onClick={() => mutate({ prompt: 'Analyze: I love this!' })}>
 *         Analyze
 *       </button>
 *       {progress && <div>{progress.message}</div>}
 *       {data && <div>Sentiment: {data.data.sentiment}</div>}
 *     </div>
 *   )
 * }
 * ```
 */

import { useState, useCallback } from 'react'
import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import type { z } from 'zod'
import { llm, type LLMProgress, type LLMResponse } from '@/lib/llm'

/** Request options for LLM call (without schema) */
interface LLMCallRequest {
  prompt: string
  images?: string[]
  provider?: string
  model?: string
  maxRetries?: number
}

/** Request options for vision call (requires images) */
interface LLMVisionRequest extends LLMCallRequest {
  images: string[]
}

/**
 * Hook for making type-safe LLM calls with progress tracking
 *
 * @param schema - Zod schema for validating the LLM response
 * @param options - Optional React Query mutation options
 */
export function useLLMCall<T extends z.ZodType>(
  schema: T,
  options?: Omit<UseMutationOptions<LLMResponse<z.infer<T>>, Error, LLMCallRequest>, 'mutationFn'>
) {
  const [progress, setProgress] = useState<LLMProgress | null>(null)

  const mutation = useMutation({
    mutationFn: async (request: LLMCallRequest) => {
      setProgress(null)
      return llm.call({
        ...request,
        schema,
        onProgress: setProgress,
      })
    },
    onSettled: () => {
      setProgress(null)
    },
    ...options,
  })

  return {
    ...mutation,
    progress,
  }
}

/**
 * Hook for making vision (image + text) LLM calls with progress tracking
 *
 * @param schema - Zod schema for validating the LLM response
 * @param options - Optional React Query mutation options
 *
 * @example
 * ```typescript
 * const { mutate, progress } = useLLMVision(ImageAnalysisSchema)
 *
 * mutate({
 *   prompt: 'Describe this image',
 *   images: ['data:image/jpeg;base64,...'],
 * })
 * ```
 */
export function useLLMVision<T extends z.ZodType>(
  schema: T,
  options?: Omit<UseMutationOptions<LLMResponse<z.infer<T>>, Error, LLMVisionRequest>, 'mutationFn'>
) {
  const [progress, setProgress] = useState<LLMProgress | null>(null)

  const mutation = useMutation({
    mutationFn: async (request: LLMVisionRequest) => {
      setProgress(null)
      return llm.vision({
        ...request,
        schema,
        onProgress: setProgress,
      })
    },
    onSettled: () => {
      setProgress(null)
    },
    ...options,
  })

  return {
    ...mutation,
    progress,
  }
}

/**
 * Hook for getting LLM client status and configuration
 *
 * @example
 * ```typescript
 * const { providers, isProviderAvailable, defaultProvider } = useLLMStatus()
 *
 * if (!isProviderAvailable('openai')) {
 *   return <div>OpenAI is not configured</div>
 * }
 * ```
 */
export function useLLMStatus() {
  const getProviders = useCallback(() => llm.getProviders(), [])
  const isProviderAvailable = useCallback((name: string) => llm.isProviderAvailable(name), [])
  const getDefaultProvider = useCallback(() => llm.getDefaultProvider(), [])
  const getDefaultModel = useCallback((provider?: string) => llm.getDefaultModel(provider), [])

  return {
    providers: getProviders(),
    isProviderAvailable,
    defaultProvider: getDefaultProvider(),
    getDefaultModel,
  }
}
