/**
 * In-memory registry for active flowchart generations
 *
 * This allows multiple clients to watch the same generation stream via Socket.IO.
 * When a client reconnects during generation, they can:
 * 1. Receive the accumulated content so far (from Redis, works cross-pod)
 * 2. Subscribe to live deltas going forward (via Socket.IO room)
 *
 * The database is used for durability (periodic saves), but the primary
 * streaming path is through Socket.IO rooms with Redis adapter for low latency.
 */

import { getRedisClient } from '@/lib/redis'

export interface StreamEvent {
  type: 'reasoning' | 'output_delta' | 'progress' | 'complete' | 'error'
  data: unknown
}

export interface GenerationState {
  /** Session ID */
  sessionId: string

  /** Accumulated reasoning text (for seeding reconnecting clients) */
  accumulatedReasoning: string

  /** Accumulated output text */
  accumulatedOutput: string

  /** Current status */
  status: 'generating' | 'complete' | 'error'

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

// Redis key prefix and TTL for cross-pod state sharing
const REDIS_KEY_PREFIX = 'flowchart:generation:'
const REDIS_TTL = 1800 // 30 min safety TTL

/**
 * Sync generation state to Redis so any pod can serve it on client join
 */
async function syncToRedis(sessionId: string, state: GenerationState): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return
  try {
    await redis.setex(`${REDIS_KEY_PREFIX}${sessionId}`, REDIS_TTL, JSON.stringify({
      status: state.status,
      accumulatedReasoning: state.accumulatedReasoning,
      accumulatedOutput: state.accumulatedOutput,
      startedAt: state.startedAt,
    }))
  } catch (err) {
    console.error('[registry] Failed to sync to Redis:', err)
  }
}

/**
 * Clean up Redis key after generation completes/fails
 */
async function cleanRedis(sessionId: string): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return
  try {
    // Delay cleanup so late-joining clients can still get state
    setTimeout(() => {
      redis.del(`${REDIS_KEY_PREFIX}${sessionId}`).catch((err: unknown) => {
        console.error('[registry] Failed to clean Redis key:', err)
      })
    }, 5000)
  } catch (err) {
    console.error('[registry] Failed to schedule Redis cleanup:', err)
  }
}

/**
 * Get generation state from Redis (for cross-pod access)
 * Exported for use by socket-server join handler
 */
export async function getGenerationFromRedis(sessionId: string): Promise<{
  status: string
  accumulatedReasoning: string
  accumulatedOutput: string
  startedAt: number
} | null> {
  const redis = getRedisClient()
  if (!redis) return null
  try {
    const data = await redis.get(`${REDIS_KEY_PREFIX}${sessionId}`)
    return data ? JSON.parse(data) : null
  } catch (err) {
    console.error('[registry] Failed to read from Redis:', err)
    return null
  }
}

/**
 * Create a new generation state for a session
 */
export function startGeneration(sessionId: string): GenerationState {
  // Clean up any existing state for this session
  const existing = activeGenerations.get(sessionId)
  if (existing) {
    console.log(`[registry] Cleaning up existing generation for session ${sessionId}`, {
      previousStatus: existing.status,
    })
  }
  activeGenerations.delete(sessionId)

  const state: GenerationState = {
    sessionId,
    accumulatedReasoning: '',
    accumulatedOutput: '',
    status: 'generating',
    startedAt: Date.now(),
  }

  activeGenerations.set(sessionId, state)
  console.log(`[registry] Started generation for session ${sessionId}`, {
    totalActiveGenerations: activeGenerations.size,
  })

  // Sync initial state to Redis
  void syncToRedis(sessionId, state)

  return state
}

/**
 * Get the current generation state for a session (if active on this pod)
 */
export function getGeneration(sessionId: string): GenerationState | undefined {
  return activeGenerations.get(sessionId)
}

/**
 * Check if a generation is currently active for a session (on this pod)
 */
export function isGenerationActive(sessionId: string): boolean {
  const state = activeGenerations.get(sessionId)
  return state?.status === 'generating'
}

// Track broadcast counts per session to avoid log spam
const broadcastCounts = new Map<string, number>()

/**
 * Broadcast an event to all Socket.IO clients watching this generation
 * Also updates accumulated state in Redis for cross-pod access
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

  // Sync to Redis (throttled for high-frequency events, always for milestones)
  if (event.type !== 'reasoning' && event.type !== 'output_delta') {
    void syncToRedis(sessionId, state)
  } else if (count % 20 === 0) {
    void syncToRedis(sessionId, state)
  }

  // Emit to Socket.IO room (cross-pod via Redis adapter)
  const io = getSocketIOLazy()
  if (io) {
    io.to(`flowchart:${sessionId}`).emit('flowchart:event', event)
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
    accumulatedReasoningLength: state.accumulatedReasoning.length,
    accumulatedOutputLength: state.accumulatedOutput.length,
  })

  state.status = 'complete'
  state.result = result

  // Broadcast completion to all watchers
  broadcast(sessionId, { type: 'complete', data: result })

  // Clean broadcast count
  broadcastCounts.delete(sessionId)

  // Final sync + cleanup
  void syncToRedis(sessionId, state)
  void cleanRedis(sessionId)

  // Clean up local state after a delay
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
  })

  state.status = 'error'
  state.error = error

  // Broadcast error to all watchers
  broadcast(sessionId, { type: 'error', data: { message: error } })

  // Clean broadcast count
  broadcastCounts.delete(sessionId)

  // Final sync + cleanup
  void syncToRedis(sessionId, state)
  void cleanRedis(sessionId)

  // Clean up local state after a delay
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

/**
 * Lazy import of getSocketIO to avoid circular dependency
 * (socket-server imports from this module, and we need to emit to Socket.IO)
 */
let _cachedIO: any = null
function getSocketIOLazy() {
  if (_cachedIO) return _cachedIO
  // Access globalThis directly to avoid circular import
  _cachedIO = (globalThis as any).__socketIO || null
  // Don't cache null - the server may not be initialized yet
  if (!_cachedIO) return null
  return _cachedIO
}
