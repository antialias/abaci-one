/**
 * Client-side interface for the example generator Web Worker pool.
 *
 * Provides a promise-based API for generating examples off the main thread,
 * with support for parallel execution across multiple workers.
 */

import type { ExecutableFlowchart } from './schema'
import type { GeneratedExample, GenerationConstraints } from './loader'
import { analyzeFlowchart, mergeAndFinalizeExamples } from './loader'
import type { WorkerResponse } from './example-generator.worker'

// Number of parallel workers to use
// navigator.hardwareConcurrency gives logical cores; we use fewer to leave headroom
const WORKER_COUNT =
  typeof navigator !== 'undefined' ? Math.max(2, Math.min(navigator.hardwareConcurrency - 1, 6)) : 4

interface WorkerState {
  worker: Worker
  busy: boolean
  resolve: ((examples: GeneratedExample[]) => void) | null
  reject: ((error: Error) => void) | null
}

let workerPool: WorkerState[] | null = null

/**
 * Initialize the worker pool lazily
 */
function getWorkerPool(): WorkerState[] {
  if (!workerPool) {
    workerPool = []
    for (let i = 0; i < WORKER_COUNT; i++) {
      const worker = new Worker(new URL('./example-generator.worker.ts', import.meta.url))
      const state: WorkerState = {
        worker,
        busy: false,
        resolve: null,
        reject: null,
      }

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { type } = event.data
        if (type === 'result') {
          state.resolve?.(event.data.examples)
        } else if (type === 'error') {
          state.reject?.(new Error(event.data.message))
        }
        state.busy = false
        state.resolve = null
        state.reject = null
      }

      worker.onerror = (error) => {
        console.error('Web worker error:', error)
        const message = error.message || 'Web worker failed to load or execute'
        state.reject?.(new Error(message))
        state.busy = false
        state.resolve = null
        state.reject = null
      }

      workerPool.push(state)
    }
  }
  return workerPool
}

/**
 * Generate diverse examples using parallel Web Workers.
 *
 * Splits paths across multiple workers for faster generation.
 */
export async function generateExamplesAsync(
  flowchart: ExecutableFlowchart,
  count: number,
  constraints: GenerationConstraints
): Promise<GeneratedExample[]> {
  const pool = getWorkerPool()

  // Analyze flowchart to get path count
  const analysis = analyzeFlowchart(flowchart)
  const totalPaths = analysis.paths.length

  // If very few paths, just use single worker (overhead not worth it)
  if (totalPaths <= 2) {
    return generateExamplesSingleWorker(flowchart, count, constraints)
  }

  // Split paths among workers
  const pathsPerWorker = Math.ceil(totalPaths / pool.length)
  const workerTasks: Promise<GeneratedExample[]>[] = []

  for (let i = 0; i < pool.length; i++) {
    const startIdx = i * pathsPerWorker
    const endIdx = Math.min(startIdx + pathsPerWorker, totalPaths)

    if (startIdx >= totalPaths) break // No more paths to assign

    const pathIndices = Array.from({ length: endIdx - startIdx }, (_, j) => startIdx + j)
    const workerState = pool[i]

    const task = new Promise<GeneratedExample[]>((resolve, reject) => {
      workerState.resolve = resolve
      workerState.reject = reject
      workerState.busy = true

      workerState.worker.postMessage({
        type: 'generate-partial',
        flowchart,
        pathIndices,
        constraints,
      })
    })

    workerTasks.push(task)
  }

  // Wait for all workers to complete
  const results = await Promise.all(workerTasks)

  // Merge results from all workers
  const allExamples = results.flat()

  // Finalize selection (fast, done on main thread)
  return mergeAndFinalizeExamples(allExamples, count)
}

/**
 * Fallback to single worker for simple flowcharts
 */
function generateExamplesSingleWorker(
  flowchart: ExecutableFlowchart,
  count: number,
  constraints: GenerationConstraints
): Promise<GeneratedExample[]> {
  const pool = getWorkerPool()
  const workerState = pool[0]

  return new Promise((resolve, reject) => {
    // Cancel any pending request
    if (workerState.reject) {
      workerState.reject(new Error('Cancelled by new request'))
    }

    workerState.resolve = resolve
    workerState.reject = reject
    workerState.busy = true

    workerState.worker.postMessage({
      type: 'generate',
      flowchart,
      count,
      constraints,
    })
  })
}

/**
 * Terminate all workers (for cleanup)
 */
export function terminateExampleWorkers(): void {
  if (workerPool) {
    for (const state of workerPool) {
      state.worker.terminate()
    }
    workerPool = null
  }
}
