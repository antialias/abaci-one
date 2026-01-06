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
      expect(typeof result.current.reset).toBe('function')
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

      expect(result.current.state).toEqual({
        activeAttachmentId: null,
        streaming: null,
        lastResult: null,
        lastStats: null,
        lastError: null,
      })
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
    it('should dispatch CANCEL action', () => {
      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.cancel()
      })

      // After cancel on initial state, state should be unchanged (no streaming to cancel)
      expect(result.current.state.streaming).toBeNull()
    })
  })

  describe('reset', () => {
    it('should dispatch RESET action', () => {
      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.state).toEqual({
        activeAttachmentId: null,
        streaming: null,
        lastResult: null,
        lastStats: null,
        lastError: null,
      })
    })
  })

  describe('startParse', () => {
    it('should update state to streaming on successful fetch', async () => {
      // Mock a successful SSE response that completes immediately
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              'event: complete\ndata: {"result": {"problems": [], "pageMetadata": {}, "overallConfidence": 0.9, "warnings": [], "needsReview": false}, "status": "approved"}\n\n'
            ),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      })

      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.startParse({ attachmentId: 'attachment-1' })
      })

      // After completion, streaming state should have status "complete"
      expect(result.current.state.streaming?.status).toBe('complete')
      expect(result.current.state.lastResult).toBeDefined()
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

      expect(result.current.state.streaming?.status).toBe('error')
      expect(result.current.state.lastError).toBe('Server error')
    })
  })

  describe('startReparse', () => {
    it('should update state for reparse operation', async () => {
      // Mock a successful SSE response for reparse
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              'event: complete\ndata: {"updatedResult": {"problems": [], "pageMetadata": {}, "overallConfidence": 0.95, "warnings": [], "needsReview": false}, "status": "approved"}\n\n'
            ),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
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

      expect(result.current.state.streaming?.status).toBe('complete')
      expect(result.current.state.lastResult).toBeDefined()
    })
  })

  describe('derived helpers', () => {
    it('isParsingAttachment should return true during parsing', async () => {
      // Create a stream that doesn't complete immediately
      let resolveRead: () => void
      const readPromise = new Promise<{ done: boolean; value: undefined }>((resolve) => {
        resolveRead = () => resolve({ done: true, value: undefined })
      })

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: started\ndata: {"responseId": "resp-1"}\n\n'),
          })
          .mockImplementationOnce(() => readPromise),
        releaseLock: vi.fn(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      })

      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      // Start parsing without waiting for completion
      let parsePromise: Promise<void>
      act(() => {
        parsePromise = result.current.startParse({
          attachmentId: 'attachment-1',
        })
      })

      // Wait for the streaming to start
      await waitFor(() => {
        expect(result.current.state.streaming).not.toBeNull()
      })

      // Check that isParsingAttachment returns true for the active attachment
      expect(result.current.isParsingAttachment('attachment-1')).toBe(true)
      expect(result.current.isParsingAttachment('attachment-2')).toBe(false)
      expect(result.current.isAnyParsingActive()).toBe(true)

      // Cleanup: complete the read and wait for parse to finish
      resolveRead!()
      await act(async () => {
        await parsePromise
      })
    })

    it('getStreamingStatus should return null after completion (activeAttachmentId is cleared)', async () => {
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              'event: reasoning\ndata: {"text": "Thinking...", "isDelta": true}\n\n'
            ),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              'event: complete\ndata: {"result": {"problems": [], "pageMetadata": {}, "overallConfidence": 0.9, "warnings": [], "needsReview": false}}\n\n'
            ),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      })

      const { result } = renderHook(() => useWorksheetParsingContext(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.startParse({ attachmentId: 'attachment-1' })
      })

      // After completion, activeAttachmentId is cleared, so getStreamingStatus returns null
      // This is correct behavior - the attachment is no longer "actively" being parsed
      expect(result.current.getStreamingStatus('attachment-1')).toBeNull()
      expect(result.current.getStreamingStatus('attachment-2')).toBeNull()

      // The streaming state is still available with "complete" status for UI reference
      expect(result.current.state.streaming?.status).toBe('complete')
    })
  })
})
