import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Mock the queryClient module before importing context
vi.mock('@/lib/queryClient', () => ({
  api: vi.fn((url: string, options?: RequestInit) => fetch(`/api/${url}`, options)),
  apiUrl: (path: string) => `/api/${path}`,
  createQueryClient: () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    }),
  getQueryClient: () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    }),
}))

import {
  WorksheetParsingProvider,
  useWorksheetParsingContext,
  useWorksheetParsingContextOptional,
} from '../WorksheetParsingContext'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

/**
 * Create a wrapper with QueryClient and WorksheetParsingProvider
 */
function createWrapper(playerId = 'player-1', sessionId = 'session-1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <WorksheetParsingProvider playerId={playerId} sessionId={sessionId}>
          {children}
        </WorksheetParsingProvider>
      </QueryClientProvider>
    )
  }
}

/**
 * Create a wrapper with only QueryClient (no WorksheetParsingProvider)
 */
function createQueryOnlyWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('WorksheetParsingContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useWorksheetParsingContext', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test since React will log the error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useWorksheetParsingContext(), {
          wrapper: createQueryOnlyWrapper(),
        })
      }).toThrow('useWorksheetParsingContext must be used within a WorksheetParsingProvider')

      consoleSpy.mockRestore()
    })

    it('should return context value when used inside provider', () => {
      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      expect(result.current).toBeDefined()
      expect(result.current.state).toBeDefined()
      expect(typeof result.current.startParse).toBe('function')
      expect(typeof result.current.startReparse).toBe('function')
      expect(typeof result.current.cancel).toBe('function')
      expect(typeof result.current.cancelAll).toBe('function')
      expect(typeof result.current.submitCorrection).toBe('function')
      expect(typeof result.current.approve).toBe('function')
      expect(typeof result.current.unapprove).toBe('function')
    })
  })

  describe('useWorksheetParsingContextOptional', () => {
    it('should return null when used outside provider', () => {
      const { result } = renderHook(() => useWorksheetParsingContextOptional(), {
        wrapper: createQueryOnlyWrapper(),
      })

      expect(result.current).toBeNull()
    })

    it('should return context value when used inside provider', () => {
      const { result } = renderHook(() => useWorksheetParsingContextOptional(), {
        wrapper: createWrapper(),
      })

      expect(result.current).not.toBeNull()
      expect(result.current?.state).toBeDefined()
    })
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      // State uses Maps for concurrent parsing support
      expect(result.current.state.activeStreams).toBeInstanceOf(Map)
      expect(result.current.state.activeStreams.size).toBe(0)
      expect(result.current.state.lastResults).toBeInstanceOf(Map)
      expect(result.current.state.lastStats).toBeInstanceOf(Map)
      expect(result.current.state.lastErrors).toBeInstanceOf(Map)
    })

    it('should report no parsing active initially', () => {
      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isAnyParsingActive()).toBe(false)
      expect(result.current.isParsingAttachment('attachment-1')).toBe(false)
      expect(result.current.getStreamingStatus('attachment-1')).toBeNull()
    })
  })

  describe('cancel', () => {
    it('should dispatch CANCEL action for specific attachment', () => {
      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.cancel('attachment-1')
      })

      // After cancel on initial state, state should be unchanged (no streaming to cancel)
      expect(result.current.state.activeStreams.size).toBe(0)
    })
  })

  describe('cancelAll', () => {
    it('should dispatch CANCEL_ALL action', () => {
      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.cancelAll()
      })

      expect(result.current.state.activeStreams.size).toBe(0)
      expect(result.current.state.lastResults.size).toBe(0)
      expect(result.current.state.lastStats.size).toBe(0)
      expect(result.current.state.lastErrors.size).toBe(0)
    })
  })

  describe('startParse', () => {
    it('should update state to streaming when task starts', async () => {
      // Mock successful task creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ taskId: 'task-123', status: 'started' }),
      })

      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.startParse({ attachmentId: 'attachment-1' })
      })

      // After starting, there should be an active stream for this attachment
      expect(result.current.state.activeStreams.has('attachment-1')).toBe(true)
      const stream = result.current.state.activeStreams.get('attachment-1')
      expect(stream?.streamType).toBe('initial')
    })

    it('should handle fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      })

      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.startParse({ attachmentId: 'attachment-1' })
      })

      // After error, the stream should be removed and error stored
      expect(result.current.state.activeStreams.has('attachment-1')).toBe(false)
      expect(result.current.state.lastErrors.get('attachment-1')).toBe('Server error')
    })
  })

  describe('startReparse', () => {
    it('should update state for reparse operation', async () => {
      // Mock successful task creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ taskId: 'task-456', status: 'started' }),
      })

      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.startReparse({
          attachmentId: 'attachment-1',
          problemIndices: [0, 1],
          boundingBoxes: [
            { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
            { x: 0.3, y: 0.1, width: 0.2, height: 0.2 },
          ],
        })
      })

      // After starting, there should be an active stream for this attachment
      expect(result.current.state.activeStreams.has('attachment-1')).toBe(true)
      const stream = result.current.state.activeStreams.get('attachment-1')
      expect(stream?.streamType).toBe('reparse')
      expect(stream?.totalProblems).toBe(2)
    })
  })

  describe('derived helpers', () => {
    it('isParsingAttachment should return true during parsing', async () => {
      // Mock successful task creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ taskId: 'task-123', status: 'started' }),
      })

      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      // Start parsing
      await act(async () => {
        await result.current.startParse({
          attachmentId: 'attachment-1',
        })
      })

      // Check that isParsingAttachment returns true for the active attachment
      expect(result.current.isParsingAttachment('attachment-1')).toBe(true)
      expect(result.current.isParsingAttachment('attachment-2')).toBe(false)
      expect(result.current.isAnyParsingActive()).toBe(true)
    })

    it('supports concurrent parsing of multiple attachments', async () => {
      // Mock successful task creation for both
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ taskId: 'task-1', status: 'started' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ taskId: 'task-2', status: 'started' }),
        })

      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      // Start parsing two attachments
      await act(async () => {
        await result.current.startParse({ attachmentId: 'attachment-1' })
      })
      await act(async () => {
        await result.current.startParse({ attachmentId: 'attachment-2' })
      })

      // Both should be active
      expect(result.current.isParsingAttachment('attachment-1')).toBe(true)
      expect(result.current.isParsingAttachment('attachment-2')).toBe(true)
      expect(result.current.state.activeStreams.size).toBe(2)

      // Cancel one - the other should still be active
      act(() => {
        result.current.cancel('attachment-1')
      })

      expect(result.current.isParsingAttachment('attachment-1')).toBe(false)
      expect(result.current.isParsingAttachment('attachment-2')).toBe(true)
      expect(result.current.state.activeStreams.size).toBe(1)
    })

    it('getStreamingStatus should return status during parsing', async () => {
      // Mock successful task creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ taskId: 'task-123', status: 'started' }),
      })

      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.startParse({ attachmentId: 'attachment-1' })
      })

      // During parsing, getStreamingStatus should return the current status
      expect(result.current.getStreamingStatus('attachment-1')).toBe('connecting')
      expect(result.current.getStreamingStatus('attachment-2')).toBeNull()
    })
  })
})
