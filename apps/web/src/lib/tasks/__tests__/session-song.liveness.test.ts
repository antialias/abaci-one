/**
 * @vitest-environment node
 *
 * Tests for the worker-liveness fan-out wiring in session-song.ts (#153)
 * and the suppress-alive testing tool (#153 follow-up).
 *
 * What's under test:
 *  - `setupSessionSongLiveness()` registers exactly one heartbeat handler
 *    and one task-end handler with the task-manager registries.
 *  - The heartbeat handler emits `session-song:alive:<planId>` over
 *    Socket.IO when the task type is session-song.
 *  - `rememberSessionSongPlan(taskId, planId)` warms an in-memory cache so
 *    steady-state emission does zero DB reads.
 *  - Cold cache → one DB lookup → cache warmed.
 *  - `startSuppressAliveLocal(taskId)` suppresses emissions for ~60s.
 *  - Task-end handler clears the cache for the completed task.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// Mocks — set up BEFORE importing the module under test
// ============================================================================

const mockEmit = vi.fn()
const mockIo = { emit: mockEmit }

vi.mock('@/lib/socket-io', () => ({
  getSocketIO: vi.fn().mockResolvedValue(mockIo),
}))

vi.mock('@/lib/redis', () => ({
  createRedisClient: vi.fn(() => null),
  getRedisClient: vi.fn(() => null),
}))

// Capture the heartbeat / task-end handlers as session-song registers them.
let capturedHeartbeatHandler:
  | ((taskId: string, type: string) => void | Promise<void>)
  | null = null
let capturedTaskEndHandler: ((taskId: string, type: string) => void) | null = null

vi.mock('../../task-manager', () => ({
  registerHeartbeatHandler: vi.fn((fn) => {
    capturedHeartbeatHandler = fn
    return () => {
      capturedHeartbeatHandler = null
    }
  }),
  registerTaskEndHandler: vi.fn((fn) => {
    capturedTaskEndHandler = fn
    return () => {
      capturedTaskEndHandler = null
    }
  }),
  createTask: vi.fn(),
}))

// Controllable drizzle select chain. Default: empty result.
const mockSelectResult = vi.fn<unknown[], Promise<Array<{ planId: string }>>>(() =>
  Promise.resolve([])
)
const mockLimit = vi.fn(() => mockSelectResult())
const mockWhere = vi.fn(() => ({ limit: mockLimit }))
const mockFrom = vi.fn(() => ({ where: mockWhere }))
const mockSelect = vi.fn(() => ({ from: mockFrom }))

vi.mock('@/db', () => ({
  db: { select: mockSelect },
  schema: {
    sessionSongs: {
      id: 'id',
      sessionPlanId: 'sessionPlanId',
      backgroundTaskId: 'backgroundTaskId',
    },
  },
}))

// ============================================================================
// Helpers
// ============================================================================

const TASK_ID = 'task-1'
const PLAN_ID = 'plan-1'

async function loadModule() {
  // Fresh import each test so the in-module Sets/Maps are clean.
  vi.resetModules()
  capturedHeartbeatHandler = null
  capturedTaskEndHandler = null
  return await import('../session-song')
}

async function fireHeartbeat(taskId: string, type = 'session-song'): Promise<void> {
  if (!capturedHeartbeatHandler) throw new Error('heartbeat handler not registered')
  await capturedHeartbeatHandler(taskId, type)
}

function fireTaskEnd(taskId: string, type = 'session-song'): void {
  if (!capturedTaskEndHandler) throw new Error('task-end handler not registered')
  capturedTaskEndHandler(taskId, type)
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  mockEmit.mockClear()
  mockSelectResult.mockReset()
  mockSelectResult.mockResolvedValue([])
  mockSelect.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('session-song liveness wiring', () => {
  it('setupSessionSongLiveness is idempotent', async () => {
    const mod = await loadModule()
    const taskManager = await import('../../task-manager')

    mod.setupSessionSongLiveness()
    mod.setupSessionSongLiveness()
    mod.setupSessionSongLiveness()

    expect(taskManager.registerHeartbeatHandler).toHaveBeenCalledTimes(1)
    expect(taskManager.registerTaskEndHandler).toHaveBeenCalledTimes(1)
  })

  it('emits alive event using cached planId without a DB read', async () => {
    const mod = await loadModule()
    mod.setupSessionSongLiveness()
    mod.rememberSessionSongPlan(TASK_ID, PLAN_ID)

    await fireHeartbeat(TASK_ID)

    expect(mockEmit).toHaveBeenCalledWith(`session-song:alive:${PLAN_ID}`, expect.any(Object))
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('falls back to a DB lookup for an unknown taskId, then warms the cache', async () => {
    const mod = await loadModule()
    mod.setupSessionSongLiveness()
    mockSelectResult.mockResolvedValueOnce([{ planId: PLAN_ID }])

    await fireHeartbeat(TASK_ID)
    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(mockEmit).toHaveBeenCalledWith(`session-song:alive:${PLAN_ID}`, expect.any(Object))

    // Second call should hit the cache, not the DB.
    mockSelect.mockClear()
    mockEmit.mockClear()
    await fireHeartbeat(TASK_ID)
    expect(mockSelect).not.toHaveBeenCalled()
    expect(mockEmit).toHaveBeenCalledWith(`session-song:alive:${PLAN_ID}`, expect.any(Object))
  })

  it('ignores ticks for tasks that are not session-song', async () => {
    const mod = await loadModule()
    mod.setupSessionSongLiveness()
    mod.rememberSessionSongPlan(TASK_ID, PLAN_ID)

    await fireHeartbeat(TASK_ID, 'demo')

    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('startSuppressAliveLocal blocks the alive emit', async () => {
    const mod = await loadModule()
    mod.setupSessionSongLiveness()
    mod.rememberSessionSongPlan(TASK_ID, PLAN_ID)

    mod.startSuppressAliveLocal(TASK_ID)
    await fireHeartbeat(TASK_ID)

    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('suppression expires after 60s and emissions resume', async () => {
    vi.useFakeTimers()
    const mod = await loadModule()
    mod.setupSessionSongLiveness()
    mod.rememberSessionSongPlan(TASK_ID, PLAN_ID)
    mod.startSuppressAliveLocal(TASK_ID)

    await fireHeartbeat(TASK_ID)
    expect(mockEmit).not.toHaveBeenCalled()

    // Advance past the 60s suppression window.
    await vi.advanceTimersByTimeAsync(61_000)

    await fireHeartbeat(TASK_ID)
    expect(mockEmit).toHaveBeenCalledWith(`session-song:alive:${PLAN_ID}`, expect.any(Object))
  })

  it('task-end handler clears the planId cache for that task', async () => {
    const mod = await loadModule()
    mod.setupSessionSongLiveness()
    mod.rememberSessionSongPlan(TASK_ID, PLAN_ID)

    // Sanity: cache is warm — no DB hit.
    await fireHeartbeat(TASK_ID)
    expect(mockSelect).not.toHaveBeenCalled()

    fireTaskEnd(TASK_ID)

    // Next emit hits the DB again because the cache was cleared.
    mockEmit.mockClear()
    mockSelect.mockClear()
    mockSelectResult.mockResolvedValueOnce([{ planId: PLAN_ID }])
    await fireHeartbeat(TASK_ID)
    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(mockEmit).toHaveBeenCalledWith(`session-song:alive:${PLAN_ID}`, expect.any(Object))
  })
})
