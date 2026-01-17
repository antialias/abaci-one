/**
 * Client-side interface for the example generator Web Worker.
 *
 * Provides a promise-based API for generating examples off the main thread.
 */

import type { ExecutableFlowchart } from './schema'
import type { GeneratedExample, GenerationConstraints } from './loader'
import type { WorkerResponse } from './example-generator.worker'

let worker: Worker | null = null
let pendingResolve: ((examples: GeneratedExample[]) => void) | null = null
let pendingReject: ((error: Error) => void) | null = null

/**
 * Get or create the worker instance
 */
function getWorker(): Worker {
  if (!worker) {
    // Create worker using webpack's worker-loader pattern
    worker = new Worker(new URL('./example-generator.worker.ts', import.meta.url))

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type } = event.data

      if (type === 'result') {
        pendingResolve?.(event.data.examples)
      } else if (type === 'error') {
        pendingReject?.(new Error(event.data.message))
      }

      pendingResolve = null
      pendingReject = null
    }

    worker.onerror = (error) => {
      pendingReject?.(new Error(error.message))
      pendingResolve = null
      pendingReject = null
    }
  }

  return worker
}

/**
 * Generate diverse examples using the Web Worker.
 *
 * This runs off the main thread so it won't block UI interactions.
 */
export function generateExamplesAsync(
  flowchart: ExecutableFlowchart,
  count: number,
  constraints: GenerationConstraints
): Promise<GeneratedExample[]> {
  return new Promise((resolve, reject) => {
    // If there's already a pending request, reject the old one
    // (only one generation at a time makes sense for dice rolls)
    if (pendingReject) {
      pendingReject(new Error('Cancelled by new request'))
    }

    pendingResolve = resolve
    pendingReject = reject

    const w = getWorker()
    w.postMessage({
      type: 'generate',
      flowchart,
      count,
      constraints,
    })
  })
}

/**
 * Terminate the worker (for cleanup)
 */
export function terminateExampleWorker(): void {
  if (worker) {
    worker.terminate()
    worker = null
    pendingResolve = null
    pendingReject = null
  }
}
