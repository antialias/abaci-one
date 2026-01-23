/**
 * In-memory registry for active flowchart generations
 *
 * This allows multiple clients to subscribe to the same generation stream.
 * When a client reconnects during generation, they can:
 * 1. Receive the accumulated content so far
 * 2. Subscribe to live deltas going forward
 *
 * The database is used for durability (periodic saves), but the primary
 * streaming path is through this in-memory registry for low latency.
 */

export interface StreamEvent {
  type: 'reasoning' | 'output_delta' | 'progress' | 'complete' | 'error'
  data: unknown
}

export type Subscriber = (event: StreamEvent) => void

export interface GenerationState {
  /** Session ID */
  sessionId: string

  /** Accumulated reasoning text (for seeding reconnecting clients) */
  accumulatedReasoning: string

  /** Accumulated output text */
  accumulatedOutput: string

  /** Current status */
  status: 'generating' | 'complete' | 'error'

  /** Active subscribers to this generation */
  subscribers: Set<Subscriber>

  /** Final result (when complete) */
  result?: unknown

  /** Error message (when error) */
  error?: string

  /** Timestamp when generation started */
  startedAt: number
}

/**
 * Registry of active generations, keyed by session ID
 */
const activeGenerations = new Map<string, GenerationState>()

/**
 * Create a new generation state for a session
 */
export function startGeneration(sessionId: string): GenerationState {
  // Clean up any existing state for this session
  const existing = activeGenerations.get(sessionId)
  if (existing) {
    console.log(`[registry] Cleaning up existing generation for session ${sessionId}`, {
      previousStatus: existing.status,
      previousSubscriberCount: existing.subscribers.size,
    })
  }
  activeGenerations.delete(sessionId)

  const state: GenerationState = {
    sessionId,
    accumulatedReasoning: '',
    accumulatedOutput: '',
    status: 'generating',
    subscribers: new Set(),
    startedAt: Date.now(),
  }

  activeGenerations.set(sessionId, state)
  console.log(`[registry] Started generation for session ${sessionId}`, {
    totalActiveGenerations: activeGenerations.size,
  })
  return state
}

/**
 * Get the current generation state for a session (if active)
 */
export function getGeneration(sessionId: string): GenerationState | undefined {
  return activeGenerations.get(sessionId)
}

/**
 * Check if a generation is currently active for a session
 */
export function isGenerationActive(sessionId: string): boolean {
  const state = activeGenerations.get(sessionId)
  return state?.status === 'generating'
}

/**
 * Subscribe to generation updates
 * Returns a function to unsubscribe
 */
export function subscribe(sessionId: string, subscriber: Subscriber): (() => void) | null {
  const state = activeGenerations.get(sessionId)
  if (!state) {
    console.log(`[registry] Subscribe failed: no generation state for session ${sessionId}`)
    return null
  }

  state.subscribers.add(subscriber)
  console.log(`[registry] New subscriber added for session ${sessionId}`, {
    subscriberCount: state.subscribers.size,
    status: state.status,
  })

  return () => {
    state.subscribers.delete(subscriber)
    console.log(`[registry] Subscriber removed for session ${sessionId}`, {
      subscriberCount: state.subscribers.size,
    })
  }
}

// Track broadcast counts per session to avoid log spam
const broadcastCounts = new Map<string, number>()

/**
 * Broadcast an event to all subscribers of a generation
 */
export function broadcast(sessionId: string, event: StreamEvent): void {
  const state = activeGenerations.get(sessionId)
  if (!state) {
    console.log(`[registry] Broadcast failed: no generation state for session ${sessionId}`)
    return
  }

  // Count broadcasts for this session
  const count = (broadcastCounts.get(sessionId) ?? 0) + 1
  broadcastCounts.set(sessionId, count)

  // Log first few and then periodically
  if (count <= 3 || count % 100 === 0) {
    console.log(`[registry] Broadcast #${count}`, {
      sessionId,
      eventType: event.type,
      subscriberCount: state.subscribers.size,
    })
  }

  // Update accumulated content
  if (event.type === 'reasoning') {
    const data = event.data as { text: string; isDelta: boolean }
    if (data.isDelta) {
      state.accumulatedReasoning += data.text
    } else {
      // Full text (summary complete) - append with separator
      state.accumulatedReasoning += `${data.text}\n\n`
    }
  } else if (event.type === 'output_delta') {
    const data = event.data as { text: string }
    state.accumulatedOutput += data.text
  }

  // Broadcast to all subscribers
  for (const subscriber of state.subscribers) {
    try {
      subscriber(event)
    } catch (err) {
      // Remove failed subscribers
      console.error('[registry] Subscriber error:', err)
      state.subscribers.delete(subscriber)
    }
  }
}

/**
 * Mark a generation as complete
 */
export function completeGeneration(sessionId: string, result: unknown): void {
  const state = activeGenerations.get(sessionId)
  if (!state) {
    console.log(`[registry] completeGeneration: no state for session ${sessionId}`)
    return
  }

  console.log(`[registry] Completing generation for session ${sessionId}`, {
    subscriberCount: state.subscribers.size,
    accumulatedReasoningLength: state.accumulatedReasoning.length,
    accumulatedOutputLength: state.accumulatedOutput.length,
  })

  state.status = 'complete'
  state.result = result

  // Broadcast completion to all subscribers
  broadcast(sessionId, { type: 'complete', data: result })

  // Clean broadcast count
  broadcastCounts.delete(sessionId)

  // Clean up after a delay (give subscribers time to receive the event)
  setTimeout(() => {
    console.log(`[registry] Cleaning up completed generation for session ${sessionId}`)
    activeGenerations.delete(sessionId)
  }, 5000)
}

/**
 * Mark a generation as failed
 */
export function failGeneration(sessionId: string, error: string): void {
  const state = activeGenerations.get(sessionId)
  if (!state) {
    console.log(`[registry] failGeneration: no state for session ${sessionId}`)
    return
  }

  console.log(`[registry] Failing generation for session ${sessionId}`, {
    error,
    subscriberCount: state.subscribers.size,
  })

  state.status = 'error'
  state.error = error

  // Broadcast error to all subscribers
  broadcast(sessionId, { type: 'error', data: { message: error } })

  // Clean broadcast count
  broadcastCounts.delete(sessionId)

  // Clean up after a delay
  setTimeout(() => {
    console.log(`[registry] Cleaning up failed generation for session ${sessionId}`)
    activeGenerations.delete(sessionId)
  }, 5000)
}

/**
 * Clean up stale generations (safety net for crashed generations)
 * Call this periodically or on server start
 */
export function cleanupStaleGenerations(maxAgeMs: number = 30 * 60 * 1000): void {
  const now = Date.now()
  for (const [sessionId, state] of activeGenerations) {
    if (now - state.startedAt > maxAgeMs) {
      console.log(`[generation-registry] Cleaning up stale generation: ${sessionId}`)
      activeGenerations.delete(sessionId)
    }
  }
}

/**
 * Get stats about active generations (for debugging)
 */
export function getStats(): { activeCount: number; sessions: string[] } {
  return {
    activeCount: activeGenerations.size,
    sessions: Array.from(activeGenerations.keys()),
  }
}
