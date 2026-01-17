/**
 * Web Worker for generating flowchart examples off the main thread.
 *
 * This worker handles the CPU-intensive generateDiverseExamples computation
 * so it doesn't block UI interactions like dice dragging.
 */

import type { ExecutableFlowchart } from './schema'
import type { GeneratedExample, GenerationConstraints } from './loader'
import { generateDiverseExamples } from './loader'

export interface GenerateExamplesRequest {
  type: 'generate'
  flowchart: ExecutableFlowchart
  count: number
  constraints: GenerationConstraints
}

export interface GenerateExamplesResponse {
  type: 'result'
  examples: GeneratedExample[]
}

export interface GenerateExamplesError {
  type: 'error'
  message: string
}

export type WorkerMessage = GenerateExamplesRequest
export type WorkerResponse = GenerateExamplesResponse | GenerateExamplesError

// Handle incoming messages
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, flowchart, count, constraints } = event.data

  if (type === 'generate') {
    try {
      const examples = generateDiverseExamples(flowchart, count, constraints)
      const response: GenerateExamplesResponse = { type: 'result', examples }
      self.postMessage(response)
    } catch (error) {
      const response: GenerateExamplesError = {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
      self.postMessage(response)
    }
  }
}
