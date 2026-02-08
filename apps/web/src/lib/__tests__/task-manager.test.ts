/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before importing the module under test

// Mock @/db with a more controllable mock for task-manager tests
const mockFindFirst = vi.fn<any[], Promise<any>>(() => Promise.resolve(undefined))
const mockFindMany = vi.fn<any[], Promise<any[]>>(() => Promise.resolve([]))
const mockInsert = vi.fn<any[], any>(() => ({ values: vi.fn(() => Promise.resolve()) }))
const mockUpdate = vi.fn<any[], any>(() => ({
  set: vi.fn(() => ({
    where: vi.fn(() => Promise.resolve()),
  })),
}))

vi.mock('@/db', () => ({
  db: {
    query: {
      backgroundTasks: {
        findFirst: (...args: any[]) => mockFindFirst(...args),
        findMany: (...args: any[]) => mockFindMany(...args),
      },
      backgroundTaskEvents: {
        findMany: (...args: any[]) => mockFindMany(...args),
      },
    },
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
  },
  schema: {
    backgroundTasks: {
      id: 'id',
      status: 'status',
      userId: 'userId',
      createdAt: 'createdAt',
      type: 'type',
    },
    backgroundTaskEvents: {
      taskId: 'taskId',
      id: 'id',
    },
  },
}))

// Mock socket-server
vi.mock('../../socket-server', () => ({
  getSocketIO: vi.fn(() => null),
}))

// Mock redis
vi.mock('../redis', () => ({
  createRedisClient: vi.fn(() => null),
  getRedisClient: vi.fn(() => null),
}))

// Mock @paralleldrive/cuid2
let mockIdCounter = 0
vi.mock('@paralleldrive/cuid2', () => ({
  createId: () => `mock-id-${++mockIdCounter}`,
}))

// Mock os
vi.mock('os', () => ({
  hostname: () => 'test-host',
}))

describe('task-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIdCounter = 0
    mockFindFirst.mockResolvedValue(undefined)
    mockFindMany.mockResolvedValue([])
  })

  describe('registerTaskHooks', () => {
    it('registers lifecycle hooks without error', async () => {
      const { registerTaskHooks } = await import('../task-manager')

      const hooks = {
        onTaskCreated: vi.fn(),
        onTaskCompleted: vi.fn(),
        onTaskFailed: vi.fn(),
      }

      expect(() => registerTaskHooks(hooks)).not.toThrow()
    })

    it('accepts partial hooks (only some callbacks)', async () => {
      const { registerTaskHooks } = await import('../task-manager')

      expect(() => registerTaskHooks({ onTaskCreated: vi.fn() })).not.toThrow()
      expect(() => registerTaskHooks({})).not.toThrow()
    })
  })

  describe('module exports', () => {
    it('exports all expected functions', async () => {
      const mod = await import('../task-manager')

      expect(typeof mod.registerTaskHooks).toBe('function')
      expect(typeof mod.initCancellationSubscriber).toBe('function')
      expect(typeof mod.initCancellationDbSync).toBe('function')
      expect(typeof mod.cancelTask).toBe('function')
      expect(typeof mod.getTaskState).toBe('function')
      expect(typeof mod.getTaskStateForClient).toBe('function')
      expect(typeof mod.getTaskEvents).toBe('function')
      expect(typeof mod.createTask).toBe('function')
      expect(typeof mod.cleanupZombieTasks).toBe('function')
      expect(typeof mod.getUserTasks).toBe('function')
    })
  })

  describe('getTaskState', () => {
    it('returns null when task is not found', async () => {
      const { getTaskState } = await import('../task-manager')

      mockFindFirst.mockResolvedValue(undefined)

      const result = await getTaskState('nonexistent-id')
      expect(result).toBeNull()
    })

    it('returns mapped task state when task exists', async () => {
      const { getTaskState } = await import('../task-manager')

      const now = new Date()
      mockFindFirst.mockResolvedValue({
        id: 'task-1',
        type: 'demo',
        status: 'running',
        progress: 50,
        progressMessage: 'Halfway',
        input: { test: true },
        output: null,
        error: null,
        createdAt: now,
        startedAt: now,
        completedAt: null,
        userId: 'user-1',
      })

      const result = await getTaskState('task-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('task-1')
      expect(result!.type).toBe('demo')
      expect(result!.status).toBe('running')
      expect(result!.progress).toBe(50)
      expect(result!.progressMessage).toBe('Halfway')
      expect(result!.input).toEqual({ test: true })
      expect(result!.output).toBeNull()
      expect(result!.error).toBeNull()
      expect(result!.userId).toBe('user-1')
    })

    it('defaults progress to 0 when null', async () => {
      const { getTaskState } = await import('../task-manager')

      mockFindFirst.mockResolvedValue({
        id: 'task-2',
        type: 'demo',
        status: 'pending',
        progress: null,
        progressMessage: null,
        input: null,
        output: null,
        error: null,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        userId: null,
      })

      const result = await getTaskState('task-2')

      expect(result).not.toBeNull()
      expect(result!.progress).toBe(0)
    })
  })

  describe('getTaskStateForClient', () => {
    it('returns null when task is not found', async () => {
      const { getTaskStateForClient } = await import('../task-manager')

      mockFindFirst.mockResolvedValue(undefined)

      const result = await getTaskStateForClient('nonexistent-id')
      expect(result).toBeNull()
    })

    it('returns state without input field', async () => {
      const { getTaskStateForClient } = await import('../task-manager')

      const now = new Date()
      mockFindFirst.mockResolvedValue({
        id: 'task-1',
        type: 'demo',
        status: 'completed',
        progress: 100,
        progressMessage: 'Done',
        input: { largeData: 'base64...' }, // should be omitted
        output: { result: 'success' },
        error: null,
        createdAt: now,
        startedAt: now,
        completedAt: now,
      })

      const result = await getTaskStateForClient('task-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('task-1')
      expect(result!.output).toEqual({ result: 'success' })
      // The returned type should NOT have an `input` field
      expect((result as any).input).toBeUndefined()
    })
  })

  describe('getTaskEvents', () => {
    it('returns empty array when no events found', async () => {
      const { getTaskEvents } = await import('../task-manager')

      mockFindMany.mockResolvedValue([])

      const events = await getTaskEvents('task-1')
      expect(events).toEqual([])
    })

    it('maps events correctly', async () => {
      const { getTaskEvents } = await import('../task-manager')

      const now = new Date()
      mockFindMany.mockResolvedValue([
        {
          id: 1,
          taskId: 'task-1',
          eventType: 'started',
          payload: {},
          createdAt: now,
        },
        {
          id: 2,
          taskId: 'task-1',
          eventType: 'progress',
          payload: { progress: 50, message: 'Half done' },
          createdAt: now,
        },
      ])

      const events = await getTaskEvents('task-1')

      expect(events).toHaveLength(2)
      expect(events[0].id).toBe(1)
      expect(events[0].taskId).toBe('task-1')
      expect(events[0].eventType).toBe('started')
      expect(events[1].eventType).toBe('progress')
      expect(events[1].payload).toEqual({ progress: 50, message: 'Half done' })
    })
  })

  describe('cancelTask', () => {
    it('returns false when task is not found', async () => {
      const { cancelTask } = await import('../task-manager')

      mockFindFirst.mockResolvedValue(undefined)

      const result = await cancelTask('nonexistent-id')
      expect(result).toBe(false)
    })

    it('returns false when task is already completed', async () => {
      const { cancelTask } = await import('../task-manager')

      mockFindFirst.mockResolvedValue({
        id: 'task-1',
        status: 'completed',
        type: 'demo',
      })

      const result = await cancelTask('task-1')
      expect(result).toBe(false)
    })

    it('returns false when task is already failed', async () => {
      const { cancelTask } = await import('../task-manager')

      mockFindFirst.mockResolvedValue({
        id: 'task-1',
        status: 'failed',
        type: 'demo',
      })

      const result = await cancelTask('task-1')
      expect(result).toBe(false)
    })

    it('returns true and updates status when task is pending', async () => {
      const { cancelTask } = await import('../task-manager')

      mockFindFirst.mockResolvedValue({
        id: 'task-1',
        status: 'pending',
        type: 'demo',
      })

      const result = await cancelTask('task-1')
      expect(result).toBe(true)
    })

    it('returns true and updates status when task is running', async () => {
      const { cancelTask } = await import('../task-manager')

      mockFindFirst.mockResolvedValue({
        id: 'task-1',
        status: 'running',
        type: 'demo',
      })

      const result = await cancelTask('task-1')
      expect(result).toBe(true)
    })
  })

  describe('getUserTasks', () => {
    it('returns empty array when no tasks found', async () => {
      const { getUserTasks } = await import('../task-manager')

      mockFindMany.mockResolvedValue([])

      const tasks = await getUserTasks('user-1')
      expect(tasks).toEqual([])
    })

    it('maps tasks correctly', async () => {
      const { getUserTasks } = await import('../task-manager')

      const now = new Date()
      mockFindMany.mockResolvedValue([
        {
          id: 'task-1',
          type: 'demo',
          status: 'completed',
          progress: 100,
          progressMessage: null,
          input: {},
          output: { result: 'ok' },
          error: null,
          createdAt: now,
          startedAt: now,
          completedAt: now,
          userId: 'user-1',
        },
      ])

      const tasks = await getUserTasks('user-1')

      expect(tasks).toHaveLength(1)
      expect(tasks[0].id).toBe('task-1')
      expect(tasks[0].type).toBe('demo')
      expect(tasks[0].status).toBe('completed')
      expect(tasks[0].userId).toBe('user-1')
    })

    it('defaults progress to 0 when null', async () => {
      const { getUserTasks } = await import('../task-manager')

      mockFindMany.mockResolvedValue([
        {
          id: 'task-1',
          type: 'demo',
          status: 'pending',
          progress: null,
          progressMessage: null,
          input: null,
          output: null,
          error: null,
          createdAt: new Date(),
          startedAt: null,
          completedAt: null,
          userId: 'user-1',
        },
      ])

      const tasks = await getUserTasks('user-1')

      expect(tasks[0].progress).toBe(0)
    })
  })

  describe('cleanupZombieTasks', () => {
    it('returns 0 when no running/pending tasks exist', async () => {
      const { cleanupZombieTasks } = await import('../task-manager')

      mockFindMany.mockResolvedValue([])

      const cleaned = await cleanupZombieTasks()
      expect(cleaned).toBe(0)
    })

    it('cleans up tasks belonging to this runner (test-host)', async () => {
      const { cleanupZombieTasks } = await import('../task-manager')

      mockFindMany.mockResolvedValue([
        {
          id: 'task-1',
          type: 'demo',
          status: 'running',
          runnerId: 'test-host', // matches mocked hostname
          lastHeartbeat: new Date(),
        },
      ])

      const cleaned = await cleanupZombieTasks()
      expect(cleaned).toBe(1)
    })

    it('cleans up tasks with no runner assigned', async () => {
      const { cleanupZombieTasks } = await import('../task-manager')

      mockFindMany.mockResolvedValue([
        {
          id: 'task-orphan',
          type: 'demo',
          status: 'running',
          runnerId: null,
          lastHeartbeat: new Date(),
        },
      ])

      const cleaned = await cleanupZombieTasks()
      expect(cleaned).toBe(1)
    })

    it('cleans up tasks with stale heartbeats from other runners', async () => {
      const { cleanupZombieTasks } = await import('../task-manager')

      const staleTime = new Date(Date.now() - 60_000) // 60 seconds ago (> 30s threshold)
      mockFindMany.mockResolvedValue([
        {
          id: 'task-stale',
          type: 'demo',
          status: 'running',
          runnerId: 'other-pod',
          lastHeartbeat: staleTime,
        },
      ])

      const cleaned = await cleanupZombieTasks()
      expect(cleaned).toBe(1)
    })

    it('skips tasks on other runners with recent heartbeats', async () => {
      const { cleanupZombieTasks } = await import('../task-manager')

      mockFindMany.mockResolvedValue([
        {
          id: 'task-alive',
          type: 'demo',
          status: 'running',
          runnerId: 'other-pod',
          lastHeartbeat: new Date(), // fresh heartbeat
        },
      ])

      const cleaned = await cleanupZombieTasks()
      expect(cleaned).toBe(0)
    })
  })

  describe('initCancellationSubscriber', () => {
    it('does not throw when redis is unavailable', async () => {
      const { initCancellationSubscriber } = await import('../task-manager')

      expect(() => initCancellationSubscriber()).not.toThrow()
    })
  })

  describe('createTask', () => {
    it('returns a task id string', async () => {
      const { createTask } = await import('../task-manager')

      const handler = vi.fn()
      const taskId = await createTask('demo', { test: true }, handler)

      expect(typeof taskId).toBe('string')
      expect(taskId).toMatch(/^mock-id-/)
    })

    it('calls lifecycle hook onTaskCreated', async () => {
      const { createTask, registerTaskHooks } = await import('../task-manager')

      const onTaskCreated = vi.fn()
      registerTaskHooks({ onTaskCreated })

      const handler = vi.fn()
      const taskId = await createTask('demo', { test: true }, handler)

      expect(onTaskCreated).toHaveBeenCalledWith(taskId, 'demo')
    })

    it('does not throw if lifecycle hook throws', async () => {
      const { createTask, registerTaskHooks } = await import('../task-manager')

      registerTaskHooks({
        onTaskCreated: () => {
          throw new Error('Hook error')
        },
      })

      const handler = vi.fn()

      await expect(createTask('demo', {}, handler)).resolves.toBeDefined()
    })

    it('calls db.insert to persist the task', async () => {
      const { createTask } = await import('../task-manager')

      const handler = vi.fn()
      await createTask('demo', { myInput: 123 }, handler)

      expect(mockInsert).toHaveBeenCalled()
    })

    it('passes userId when provided', async () => {
      const { createTask } = await import('../task-manager')

      const handler = vi.fn()
      const taskId = await createTask('demo', {}, handler, 'user-123')

      expect(typeof taskId).toBe('string')
    })

    it('handler receives a TaskHandle with all methods', async () => {
      const { createTask, registerTaskHooks } = await import('../task-manager')
      registerTaskHooks({}) // clear previous hooks

      let receivedHandle: any = null

      const handler = vi.fn(async (handle) => {
        receivedHandle = handle
        handle.complete({ done: true })
      })

      await createTask('demo', {}, handler)

      // Wait for setImmediate to execute the handler
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(receivedHandle).not.toBeNull()
      expect(typeof receivedHandle.id).toBe('string')
      expect(typeof receivedHandle.emit).toBe('function')
      expect(typeof receivedHandle.emitTransient).toBe('function')
      expect(typeof receivedHandle.setProgress).toBe('function')
      expect(typeof receivedHandle.complete).toBe('function')
      expect(typeof receivedHandle.fail).toBe('function')
      expect(typeof receivedHandle.isCancelled).toBe('function')
    })

    it('handle.isCancelled returns false initially', async () => {
      const { createTask, registerTaskHooks } = await import('../task-manager')
      registerTaskHooks({})

      let wasCancelled = true

      const handler = vi.fn(async (handle) => {
        wasCancelled = handle.isCancelled()
        handle.complete({})
      })

      await createTask('demo', {}, handler)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(wasCancelled).toBe(false)
    })
  })
})
