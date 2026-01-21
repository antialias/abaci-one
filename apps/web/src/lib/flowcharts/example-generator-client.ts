/**
 * Client-side interface for the example generator Web Worker pool.
 *
 * Provides a promise-based API for generating examples off the main thread,
 * with support for parallel execution across multiple workers.
 *
 * Uses a task queue to properly handle concurrent requests without callback clobbering.
 */

import type { ExecutableFlowchart } from './schema'
import type { GeneratedExample, GenerationConstraints } from './loader'
import { analyzeFlowchart, mergeAndFinalizeExamples } from './loader'
import type { WorkerResponse } from './example-generator.worker'

// Number of parallel workers to use
// navigator.hardwareConcurrency gives logical cores; we use fewer to leave headroom
const WORKER_COUNT =
  typeof navigator !== 'undefined' ? Math.max(2, Math.min(navigator.hardwareConcurrency - 1, 6)) : 4

// Unique ID generator for requests
let nextRequestId = 0
function generateRequestId(): string {
  return `req-${nextRequestId++}-${Date.now()}`
}

/**
 * A task to be processed by a worker
 */
interface WorkerTask {
  requestId: string
  type: 'generate' | 'generate-partial'
  flowchart: ExecutableFlowchart
  constraints: GenerationConstraints
  // For 'generate' type
  count?: number
  // For 'generate-partial' type
  pathIndices?: number[]
}

/**
 * Tracks a pending request's state
 */
interface PendingRequest {
  requestId: string
  totalTasks: number
  completedTasks: number
  results: GeneratedExample[][] // Results from each task
  errors: Error[]
  resolve: (examples: GeneratedExample[]) => void
  reject: (error: Error) => void
  count: number // Final count for selection
}

/**
 * Worker state - just tracks if busy
 */
interface WorkerState {
  worker: Worker
  busy: boolean
  currentRequestId: string | null // Which request this worker is processing
}

// The worker pool
let workerPool: WorkerState[] | null = null

// Task queue - tasks waiting to be processed
const taskQueue: WorkerTask[] = []

// Pending requests - map of requestId to request state
const pendingRequests = new Map<string, PendingRequest>()

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
        currentRequestId: null,
      }

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        handleWorkerResponse(state, event.data)
      }

      worker.onerror = (error) => {
        console.error('Web worker error:', error)
        const message = error.message || 'Web worker failed to load or execute'
        handleWorkerError(state, new Error(message))
      }

      workerPool.push(state)
    }
  }
  return workerPool
}

/**
 * Handle a response from a worker
 */
function handleWorkerResponse(workerState: WorkerState, response: WorkerResponse): void {
  const { requestId } = response
  const request = pendingRequests.get(requestId)

  // Mark worker as free
  workerState.busy = false
  workerState.currentRequestId = null

  if (request) {
    if (response.type === 'result') {
      request.results.push(response.examples)
      request.completedTasks++
    } else if (response.type === 'error') {
      request.errors.push(new Error(response.message))
      request.completedTasks++
    }

    // Check if all tasks for this request are complete
    if (request.completedTasks >= request.totalTasks) {
      pendingRequests.delete(requestId)

      if (request.errors.length > 0 && request.results.length === 0) {
        // All tasks failed
        request.reject(request.errors[0])
      } else {
        // Merge all results and finalize
        const allExamples = request.results.flat()
        const finalExamples = mergeAndFinalizeExamples(allExamples, request.count)
        request.resolve(finalExamples)
      }
    }
  }

  // Try to dispatch next task from queue
  dispatchNextTask()
}

/**
 * Handle an error from a worker (not a task error, but a worker failure)
 */
function handleWorkerError(workerState: WorkerState, error: Error): void {
  const requestId = workerState.currentRequestId
  workerState.busy = false
  workerState.currentRequestId = null

  if (requestId) {
    const request = pendingRequests.get(requestId)
    if (request) {
      request.errors.push(error)
      request.completedTasks++

      // Check if all tasks for this request are complete
      if (request.completedTasks >= request.totalTasks) {
        pendingRequests.delete(requestId)

        if (request.errors.length > 0 && request.results.length === 0) {
          request.reject(request.errors[0])
        } else {
          const allExamples = request.results.flat()
          const finalExamples = mergeAndFinalizeExamples(allExamples, request.count)
          request.resolve(finalExamples)
        }
      }
    }
  }

  // Try to dispatch next task from queue
  dispatchNextTask()
}

/**
 * Find a free worker and dispatch the next task from the queue
 */
function dispatchNextTask(): void {
  if (taskQueue.length === 0) return

  const pool = getWorkerPool()
  const freeWorker = pool.find((w) => !w.busy)
  if (!freeWorker) return

  const task = taskQueue.shift()!
  freeWorker.busy = true
  freeWorker.currentRequestId = task.requestId

  if (task.type === 'generate') {
    freeWorker.worker.postMessage({
      type: 'generate',
      requestId: task.requestId,
      flowchart: task.flowchart,
      count: task.count,
      constraints: task.constraints,
    })
  } else {
    freeWorker.worker.postMessage({
      type: 'generate-partial',
      requestId: task.requestId,
      flowchart: task.flowchart,
      pathIndices: task.pathIndices,
      constraints: task.constraints,
    })
  }
}

/**
 * Generate diverse examples using parallel Web Workers.
 *
 * Splits paths across multiple workers for faster generation.
 * Properly handles concurrent requests via a task queue.
 */
export async function generateExamplesAsync(
  flowchart: ExecutableFlowchart,
  count: number,
  constraints: GenerationConstraints
): Promise<GeneratedExample[]> {
  const pool = getWorkerPool()
  const requestId = generateRequestId()

  // Analyze flowchart to get path count
  const analysis = analyzeFlowchart(flowchart)
  const totalPaths = analysis.paths.length

  // If very few paths, just use single task
  if (totalPaths <= 2) {
    return new Promise((resolve, reject) => {
      // Create request tracking
      const request: PendingRequest = {
        requestId,
        totalTasks: 1,
        completedTasks: 0,
        results: [],
        errors: [],
        resolve,
        reject,
        count,
      }
      pendingRequests.set(requestId, request)

      // Add single task to queue
      taskQueue.push({
        requestId,
        type: 'generate',
        flowchart,
        count,
        constraints,
      })

      // Try to dispatch immediately
      dispatchNextTask()
    })
  }

  // Split paths among workers - create multiple tasks
  const pathsPerWorker = Math.ceil(totalPaths / pool.length)
  const tasks: WorkerTask[] = []

  for (let i = 0; i < pool.length; i++) {
    const startIdx = i * pathsPerWorker
    const endIdx = Math.min(startIdx + pathsPerWorker, totalPaths)

    if (startIdx >= totalPaths) break

    const pathIndices = Array.from({ length: endIdx - startIdx }, (_, j) => startIdx + j)
    tasks.push({
      requestId,
      type: 'generate-partial',
      flowchart,
      pathIndices,
      constraints,
    })
  }

  return new Promise((resolve, reject) => {
    // Create request tracking
    const request: PendingRequest = {
      requestId,
      totalTasks: tasks.length,
      completedTasks: 0,
      results: [],
      errors: [],
      resolve,
      reject,
      count,
    }
    pendingRequests.set(requestId, request)

    // Add all tasks to queue
    taskQueue.push(...tasks)

    // Try to dispatch as many as we can
    for (let i = 0; i < tasks.length; i++) {
      dispatchNextTask()
    }
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
  // Clear any pending state
  taskQueue.length = 0
  pendingRequests.clear()
}
