import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { TaskState, TaskEvent } from '../useBackgroundTask'

// ============================================================================
// Mock socket.io
// ============================================================================

type SocketEventHandler = (...args: any[]) => void

const mockSocketHandlers = new Map<string, SocketEventHandler[]>()
const mockEmit = vi.fn()
const mockDisconnect = vi.fn()

const mockSocket = {
  connected: false,
  on: vi.fn((event: string, handler: SocketEventHandler) => {
    if (!mockSocketHandlers.has(event)) {
      mockSocketHandlers.set(event, [])
    }
    mockSocketHandlers.get(event)!.push(handler)
  }),
  emit: mockEmit,
  disconnect: mockDisconnect,
}

function emitSocketEvent(event: string, ...args: any[]) {
  const handlers = mockSocketHandlers.get(event)
  if (handlers) {
    handlers.forEach((h) => h(...args))
  }
}

vi.mock('@/lib/socket', () => ({
  createSocket: vi.fn(() => mockSocket),
}))

// ============================================================================
// Import after mocks
// ============================================================================

// Dynamic import to ensure mocks are in place
let useBackgroundTask: typeof import('../useBackgroundTask').useBackgroundTask

beforeEach(async () => {
  mockSocketHandlers.clear()
  mockEmit.mockClear()
  mockDisconnect.mockClear()
  mockSocket.connected = false
  mockSocket.on.mockClear()

  // Re-import to get fresh module
  const mod = await import('../useBackgroundTask')
  useBackgroundTask = mod.useBackgroundTask
})

// ============================================================================
// Tests
// ============================================================================

describe('useBackgroundTask', () => {
  it('initializes with null state when no taskId', () => {
    const { result } = renderHook(() => useBackgroundTask(null))

    expect(result.current.state).toBeNull()
    expect(result.current.isConnected).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('starts loading when taskId is provided', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('subscribes to task on connect', () => {
    renderHook(() => useBackgroundTask('task-123'))

    // Simulate socket connection
    act(() => {
      emitSocketEvent('connect')
    })

    expect(mockEmit).toHaveBeenCalledWith('task:subscribe', 'task-123')
  })

  it('sets isConnected=true on connect', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    act(() => {
      emitSocketEvent('connect')
    })

    expect(result.current.isConnected).toBe(true)
  })

  it('sets isConnected=false on disconnect', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    act(() => {
      emitSocketEvent('connect')
    })
    expect(result.current.isConnected).toBe(true)

    act(() => {
      emitSocketEvent('disconnect')
    })
    expect(result.current.isConnected).toBe(false)
  })

  it('handles task:state event', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    const taskState: TaskState = {
      id: 'task-123',
      type: 'worksheet-parse',
      status: 'running',
      progress: 50,
      progressMessage: 'Processing...',
      output: null,
      error: null,
      createdAt: '2024-01-01T00:00:00Z',
      startedAt: '2024-01-01T00:00:01Z',
      completedAt: null,
      events: [],
    }

    act(() => {
      emitSocketEvent('task:state', taskState)
    })

    expect(result.current.state).not.toBeNull()
    expect(result.current.state!.id).toBe('task-123')
    expect(result.current.state!.status).toBe('running')
    expect(result.current.state!.progress).toBe(50)
    expect(result.current.isLoading).toBe(false)
  })

  it('handles task:event for progress updates', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    // First set initial state
    act(() => {
      emitSocketEvent('task:state', {
        id: 'task-123',
        type: 'parse',
        status: 'running',
        progress: 0,
        progressMessage: null,
        output: null,
        error: null,
        createdAt: '2024-01-01',
        startedAt: '2024-01-01',
        completedAt: null,
        events: [],
      })
    })

    // Then send a progress event
    const progressEvent: TaskEvent = {
      taskId: 'task-123',
      eventType: 'progress',
      payload: { progress: 75, message: '75% done' },
      createdAt: '2024-01-01T00:00:02Z',
    }

    act(() => {
      emitSocketEvent('task:event', progressEvent)
    })

    expect(result.current.state!.progress).toBe(75)
    expect(result.current.state!.progressMessage).toBe('75% done')
    expect(result.current.state!.events).toHaveLength(1)
  })

  it('handles task:event for completed status', () => {
    const { result } = renderHook(() => useBackgroundTask<{ result: string }>('task-123'))

    act(() => {
      emitSocketEvent('task:state', {
        id: 'task-123',
        type: 'parse',
        status: 'running',
        progress: 50,
        progressMessage: null,
        output: null,
        error: null,
        createdAt: '2024-01-01',
        startedAt: '2024-01-01',
        completedAt: null,
        events: [],
      })
    })

    const completedEvent: TaskEvent = {
      taskId: 'task-123',
      eventType: 'completed',
      payload: { output: { result: 'success' } },
      createdAt: '2024-01-01T00:00:05Z',
    }

    act(() => {
      emitSocketEvent('task:event', completedEvent)
    })

    expect(result.current.state!.status).toBe('completed')
    expect(result.current.state!.progress).toBe(100)
    expect(result.current.state!.output).toEqual({ result: 'success' })
  })

  it('handles task:event for failed status', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    act(() => {
      emitSocketEvent('task:state', {
        id: 'task-123',
        type: 'parse',
        status: 'running',
        progress: 50,
        progressMessage: null,
        output: null,
        error: null,
        createdAt: '2024-01-01',
        startedAt: '2024-01-01',
        completedAt: null,
        events: [],
      })
    })

    const failedEvent: TaskEvent = {
      taskId: 'task-123',
      eventType: 'failed',
      payload: { error: 'Something went wrong' },
      createdAt: '2024-01-01T00:00:05Z',
    }

    act(() => {
      emitSocketEvent('task:event', failedEvent)
    })

    expect(result.current.state!.status).toBe('failed')
    expect(result.current.state!.error).toBe('Something went wrong')
  })

  it('handles task:event for cancelled status', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    act(() => {
      emitSocketEvent('task:state', {
        id: 'task-123',
        type: 'parse',
        status: 'running',
        progress: 50,
        progressMessage: null,
        output: null,
        error: null,
        createdAt: '2024-01-01',
        startedAt: '2024-01-01',
        completedAt: null,
        events: [],
      })
    })

    act(() => {
      emitSocketEvent('task:event', {
        taskId: 'task-123',
        eventType: 'cancelled',
        payload: {},
        createdAt: '2024-01-01T00:00:05Z',
      })
    })

    expect(result.current.state!.status).toBe('cancelled')
  })

  it('handles task:event for started status', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    act(() => {
      emitSocketEvent('task:state', {
        id: 'task-123',
        type: 'parse',
        status: 'pending',
        progress: 0,
        progressMessage: null,
        output: null,
        error: null,
        createdAt: '2024-01-01',
        startedAt: null,
        completedAt: null,
        events: [],
      })
    })

    act(() => {
      emitSocketEvent('task:event', {
        taskId: 'task-123',
        eventType: 'started',
        payload: {},
        createdAt: '2024-01-01T00:00:01Z',
      })
    })

    expect(result.current.state!.status).toBe('running')
  })

  it('ignores events for different task IDs', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    act(() => {
      emitSocketEvent('task:state', {
        id: 'task-123',
        type: 'parse',
        status: 'running',
        progress: 50,
        progressMessage: null,
        output: null,
        error: null,
        createdAt: '2024-01-01',
        startedAt: '2024-01-01',
        completedAt: null,
        events: [],
      })
    })

    act(() => {
      emitSocketEvent('task:event', {
        taskId: 'task-999',
        eventType: 'completed',
        payload: { output: {} },
        createdAt: '2024-01-01T00:00:05Z',
      })
    })

    // Status should still be running - the event was for a different task
    expect(result.current.state!.status).toBe('running')
  })

  it('handles task:error event', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    act(() => {
      emitSocketEvent('task:error', {
        taskId: 'task-123',
        error: 'Task not found',
      })
    })

    expect(result.current.error).toBe('Task not found')
    expect(result.current.isLoading).toBe(false)
  })

  it('ignores task:error for different task IDs', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    act(() => {
      emitSocketEvent('task:error', {
        taskId: 'task-999',
        error: 'Task not found',
      })
    })

    expect(result.current.error).toBeNull()
  })

  it('handles connect_error', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    act(() => {
      emitSocketEvent('connect_error', new Error('Connection refused'))
    })

    expect(result.current.error).toBe('Failed to connect to task server')
    expect(result.current.isLoading).toBe(false)
  })

  it('cancel() emits task:cancel event', () => {
    const { result } = renderHook(() => useBackgroundTask('task-123'))

    act(() => {
      result.current.cancel()
    })

    expect(mockEmit).toHaveBeenCalledWith('task:cancel', 'task-123')
  })

  it('cleans up socket on unmount', () => {
    const { unmount } = renderHook(() => useBackgroundTask('task-123'))

    unmount()

    expect(mockEmit).toHaveBeenCalledWith('task:unsubscribe', 'task-123')
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('cleans up and resets when taskId becomes null', () => {
    const { result, rerender } = renderHook(
      ({ taskId }: { taskId: string | null }) => useBackgroundTask(taskId),
      { initialProps: { taskId: 'task-123' as string | null } }
    )

    // Verify initial subscription
    expect(result.current.isLoading).toBe(true)

    // Change taskId to null
    rerender({ taskId: null })

    expect(result.current.state).toBeNull()
    expect(result.current.isConnected).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
