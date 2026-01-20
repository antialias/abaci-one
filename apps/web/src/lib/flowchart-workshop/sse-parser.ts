/**
 * SSE Parser for Flowchart Workshop streaming endpoints
 *
 * Provides a unified interface for parsing Server-Sent Events from the
 * flowchart generation and refinement endpoints.
 *
 * @module flowchart-workshop/sse-parser
 */

import type { FlowchartDefinition } from '../flowcharts/schema'

/**
 * Event types that can be received from the SSE stream
 */
export interface FlowchartSSEEvents {
  /** Connection established, generation/refinement has begun */
  onStarted?: (responseId: string) => void

  /** Progress update with stage and message */
  onProgress?: (stage: string, message: string) => void

  /** Model's reasoning/thinking process (streamed incrementally) */
  onReasoning?: (text: string, isDelta: boolean, summaryIndex?: number) => void

  /** Partial structured output being generated */
  onOutputDelta?: (text: string, outputIndex?: number) => void

  /** Generation/refinement completed successfully */
  onComplete?: (result: FlowchartCompleteResult) => void

  /** Error occurred during generation/refinement */
  onError?: (message: string, code?: string) => void

  /** Operation was cancelled */
  onCancelled?: () => void
}

/**
 * Result from a successful generation
 */
export interface FlowchartGenerateResult {
  definition: FlowchartDefinition
  mermaidContent: string
  title: string
  description: string
  emoji: string
  difficulty: string
  notes: string[]
  usage?: {
    promptTokens: number
    completionTokens: number
    reasoningTokens?: number
  }
}

/**
 * Result from a successful refinement
 */
export interface FlowchartRefineResult {
  definition: FlowchartDefinition
  mermaidContent: string
  emoji: string
  changesSummary: string
  notes: string[]
  usage?: {
    promptTokens: number
    completionTokens: number
    reasoningTokens?: number
  }
}

/**
 * Union type for complete results
 */
export type FlowchartCompleteResult = FlowchartGenerateResult | FlowchartRefineResult

/**
 * Check if result is a generation result (has title/description)
 */
export function isGenerateResult(
  result: FlowchartCompleteResult
): result is FlowchartGenerateResult {
  return 'title' in result && 'description' in result
}

/**
 * Check if result is a refinement result (has changesSummary)
 */
export function isRefineResult(result: FlowchartCompleteResult): result is FlowchartRefineResult {
  return 'changesSummary' in result
}

/**
 * Parse an SSE stream from the flowchart workshop endpoints
 *
 * @param response - Fetch Response object from the SSE endpoint
 * @param callbacks - Event callbacks to handle stream events
 * @param signal - Optional AbortSignal for cancellation
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/flowchart-workshop/sessions/123/generate', {
 *   method: 'POST',
 *   body: JSON.stringify({ topicDescription: 'two-digit addition' }),
 *   signal: controller.signal,
 * })
 *
 * await parseFlowchartSSE(response, {
 *   onStarted: (id) => console.log('Started:', id),
 *   onReasoning: (text, isDelta) => {
 *     if (isDelta) appendReasoning(text)
 *     else setReasoning(text)
 *   },
 *   onComplete: (result) => setFlowchart(result),
 *   onError: (msg) => setError(msg),
 * }, controller.signal)
 * ```
 */
export async function parseFlowchartSSE(
  response: Response,
  callbacks: FlowchartSSEEvents,
  signal?: AbortSignal
): Promise<void> {
  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = 'Request failed'
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error || errorMessage
    } catch {
      errorMessage = errorText || errorMessage
    }
    callbacks.onError?.(errorMessage, String(response.status))
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    callbacks.onError?.('No response body')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      // Check for cancellation
      if (signal?.aborted) {
        callbacks.onCancelled?.()
        break
      }

      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Process complete events (separated by double newlines)
      const events = buffer.split('\n\n')
      buffer = events.pop() || '' // Keep incomplete event in buffer

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue

        const lines = eventBlock.split('\n')
        let eventType = ''
        let eventData = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7)
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6)
          }
        }

        if (!eventType || !eventData) continue

        try {
          const data = JSON.parse(eventData)

          switch (eventType) {
            case 'started':
              callbacks.onStarted?.(data.responseId)
              break

            case 'progress':
              callbacks.onProgress?.(data.stage, data.message)
              break

            case 'reasoning':
              callbacks.onReasoning?.(data.text, data.isDelta, data.summaryIndex)
              break

            case 'output_delta':
              callbacks.onOutputDelta?.(data.text, data.outputIndex)
              break

            case 'complete':
              callbacks.onComplete?.(data)
              break

            case 'error':
              callbacks.onError?.(data.message, data.code)
              break

            case 'cancelled':
              callbacks.onCancelled?.()
              break
          }
        } catch (parseError) {
          console.error('Failed to parse SSE event data:', parseError, eventData)
        }
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      callbacks.onCancelled?.()
    } else {
      callbacks.onError?.(error instanceof Error ? error.message : 'Stream error')
    }
  } finally {
    reader.releaseLock()
  }
}
