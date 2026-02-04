import { type NextRequest, NextResponse } from 'next/server'
import { createTask, type TaskHandle } from '@/lib/task-manager'
import type { DemoTaskEvent } from '@/lib/tasks/events'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * Demo task input
 */
interface DemoTaskInput {
  /** Duration of the task in seconds */
  duration: number
  /** Whether the task should fail at specified percentage */
  shouldFail: boolean
  /** Percentage at which to fail (default 70) */
  failAt?: number
  /** Number of events to emit (default 10) */
  eventCount?: number
  /** Delay between events in ms (overrides duration-based calculation) */
  eventIntervalMs?: number
  /** Size of payload in bytes to include in each event (default 0) */
  payloadSizeBytes?: number
}

/**
 * Demo task output
 */
interface DemoTaskOutput {
  message: string
  completedAt: string
  totalEvents: number
  totalPayloadBytes: number
}

/**
 * Generate a random string of specified byte size
 */
function generatePayload(sizeBytes: number): string {
  if (sizeBytes <= 0) return ''
  // Each character is roughly 1 byte in ASCII
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < sizeBytes; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * POST /api/demo/task
 * Start a demo background task
 *
 * This endpoint creates a simulated long-running task that:
 * - Updates progress incrementally
 * - Emits log events at each step
 * - Optionally fails at specified percentage
 * - Supports configurable event count, interval, and payload size for stress testing
 */
export async function POST(request: NextRequest) {
  try {
    const input: DemoTaskInput = await request.json()

    const taskId = await createTask<DemoTaskInput, DemoTaskOutput, DemoTaskEvent>(
      'demo',
      input,
      async (handle: TaskHandle<DemoTaskOutput, DemoTaskEvent>, options) => {
        const {
          duration,
          shouldFail,
          failAt = 70,
          eventCount = 10,
          eventIntervalMs,
          payloadSizeBytes = 0,
        } = options

        // Calculate interval: use explicit interval or derive from duration
        const interval = eventIntervalMs ?? (duration * 1000) / eventCount
        const failAtStep = Math.floor((failAt / 100) * eventCount)

        // Pre-generate payload if needed (reuse for consistency)
        const payload = generatePayload(payloadSizeBytes)
        let totalPayloadBytes = 0

        for (let i = 1; i <= eventCount; i++) {
          // Check for cancellation
          if (handle.isCancelled()) {
            console.log(`[DemoTask] Task ${handle.id} was cancelled at step ${i}`)
            return
          }

          await new Promise((resolve) => setTimeout(resolve, interval))

          const progress = Math.round((i / eventCount) * 100)
          handle.setProgress(progress, `Step ${i}/${eventCount}`)

          if (payload) {
            totalPayloadBytes += payloadSizeBytes
          }

          handle.emit({ type: 'log', step: i, timestamp: new Date().toISOString() })

          // Fail at specified percentage if shouldFail
          if (shouldFail && i === failAtStep) {
            throw new Error(`Simulated failure at step ${i} (${failAt}%)`)
          }
        }

        handle.complete({
          message: 'Task completed successfully!',
          completedAt: new Date().toISOString(),
          totalEvents: eventCount,
          totalPayloadBytes,
        })
      }
    )

    return NextResponse.json({ taskId })
  } catch (error) {
    console.error('Failed to create demo task:', error)
    return NextResponse.json(
      { error: 'Failed to create task', details: String(error) },
      { status: 500 }
    )
  }
}
