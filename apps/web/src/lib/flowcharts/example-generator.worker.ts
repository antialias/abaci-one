/**
 * Web Worker for generating flowchart examples off the main thread.
 *
 * This worker handles the CPU-intensive example generation computation
 * so it doesn't block UI interactions like dice dragging.
 *
 * Supports two modes:
 * 1. Full generation: Generate all examples (single worker)
 * 2. Partial generation: Generate examples for a subset of paths (parallel workers)
 */

import type { ExecutableFlowchart } from './schema'
import type { GeneratedExample, GenerationConstraints } from './loader'
import { generateDiverseExamples, generateExamplesForPaths } from './loader'

export interface GenerateExamplesRequest {
  type: 'generate'
  flowchart: ExecutableFlowchart
  count: number
  constraints: GenerationConstraints
}

export interface GenerateExamplesPartialRequest {
  type: 'generate-partial'
  flowchart: ExecutableFlowchart
  pathIndices: number[] // Which paths this worker should process
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

export type WorkerMessage = GenerateExamplesRequest | GenerateExamplesPartialRequest
export type WorkerResponse = GenerateExamplesResponse | GenerateExamplesError

// Handle incoming messages
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const data = event.data

  try {
    if (data.type === 'generate') {
      // Full generation mode
      const examples = generateDiverseExamples(data.flowchart, data.count, data.constraints)
      const response: GenerateExamplesResponse = { type: 'result', examples }
      self.postMessage(response)
    } else if (data.type === 'generate-partial') {
      // Partial generation mode - only process assigned paths
      const examples = generateExamplesForPaths(
        data.flowchart,
        data.pathIndices,
        data.constraints
      )
      const response: GenerateExamplesResponse = { type: 'result', examples }
      self.postMessage(response)
    }
  } catch (error) {
    const response: GenerateExamplesError = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
    self.postMessage(response)
  }
}
