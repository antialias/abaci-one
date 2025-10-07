import { renderHook, waitFor } from '@testing-library/react'
import * as nextNavigation from 'next/navigation'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useArcadeGuard } from '../useArcadeGuard'
import * as arcadeSocket from '../useArcadeSocket'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}))

// Mock useArcadeSocket
vi.mock('../useArcadeSocket', () => ({
  useArcadeSocket: vi.fn(),
}))

describe('useArcadeGuard', () => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }

  const mockUseArcadeSocket = {
    connected: true,
    joinSession: vi.fn(),
    socket: null,
    sendMove: vi.fn(),
    exitSession: vi.fn(),
    pingSession: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(nextNavigation, 'useRouter').mockReturnValue(mockRouter as any)
    vi.spyOn(nextNavigation, 'usePathname').mockReturnValue('/arcade/matching')
    vi.spyOn(arcadeSocket, 'useArcadeSocket').mockReturnValue(mockUseArcadeSocket)
    global.fetch = vi.fn()
  })

  it('should initialize with loading state', () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
    })

    const { result } = renderHook(() =>
      useArcadeGuard({
        userId: 'test-user',
      })
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.hasActiveSession).toBe(false)
    expect(result.current.activeSession).toBe(null)
  })

  it('should fetch active session on mount', async () => {
    const mockSession = {
      gameUrl: '/arcade/matching',
      currentGame: 'matching',
      gameState: {},
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    })

    const { result } = renderHook(() =>
      useArcadeGuard({
        userId: 'test-user',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/arcade-session?userId=test-user')
    expect(result.current.hasActiveSession).toBe(true)
    expect(result.current.activeSession).toEqual({
      gameUrl: '/arcade/matching',
      currentGame: 'matching',
    })
  })

  it('should redirect to active session if on different page', async () => {
    const mockSession = {
      gameUrl: '/arcade/memory-quiz',
      currentGame: 'memory-quiz',
      gameState: {},
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    })

    vi.spyOn(nextNavigation, 'usePathname').mockReturnValue('/arcade/matching')

    renderHook(() =>
      useArcadeGuard({
        userId: 'test-user',
      })
    )

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/arcade/memory-quiz')
    })
  })

  it('should NOT redirect if already on active session page', async () => {
    const mockSession = {
      gameUrl: '/arcade/matching',
      currentGame: 'matching',
      gameState: {},
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    })

    vi.spyOn(nextNavigation, 'usePathname').mockReturnValue('/arcade/matching')

    renderHook(() =>
      useArcadeGuard({
        userId: 'test-user',
      })
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('should handle no active session (404)', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
    })

    const { result } = renderHook(() =>
      useArcadeGuard({
        userId: 'test-user',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.hasActiveSession).toBe(false)
    expect(result.current.activeSession).toBe(null)
  })

  it('should call onRedirect callback when redirecting', async () => {
    const onRedirect = vi.fn()
    const mockSession = {
      gameUrl: '/arcade/memory-quiz',
      currentGame: 'memory-quiz',
      gameState: {},
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    })

    vi.spyOn(nextNavigation, 'usePathname').mockReturnValue('/arcade/matching')

    renderHook(() =>
      useArcadeGuard({
        userId: 'test-user',
        onRedirect,
      })
    )

    await waitFor(() => {
      expect(onRedirect).toHaveBeenCalledWith('/arcade/memory-quiz')
    })
  })

  it('should not fetch session when disabled', () => {
    renderHook(() =>
      useArcadeGuard({
        userId: 'test-user',
        enabled: false,
      })
    )

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should not fetch session when userId is null', () => {
    renderHook(() =>
      useArcadeGuard({
        userId: null,
      })
    )

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should join WebSocket room when connected', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
    })

    renderHook(() =>
      useArcadeGuard({
        userId: 'test-user',
      })
    )

    await waitFor(() => {
      expect(mockUseArcadeSocket.joinSession).toHaveBeenCalledWith('test-user')
    })
  })

  it('should handle session-state event from WebSocket', async () => {
    let onSessionStateCallback: ((data: any) => void) | null = null

    vi.spyOn(arcadeSocket, 'useArcadeSocket').mockImplementation((events) => {
      onSessionStateCallback = events.onSessionState || null
      return mockUseArcadeSocket
    })

    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
    })

    const { result } = renderHook(() =>
      useArcadeGuard({
        userId: 'test-user',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Simulate session-state event from WebSocket
    onSessionStateCallback?.({
      gameUrl: '/arcade/complement-race',
      currentGame: 'complement-race',
      gameState: {},
      activePlayers: [1],
      version: 1,
    })

    await waitFor(() => {
      expect(result.current.hasActiveSession).toBe(true)
      expect(result.current.activeSession).toEqual({
        gameUrl: '/arcade/complement-race',
        currentGame: 'complement-race',
      })
    })
  })

  it('should handle session-ended event from WebSocket', async () => {
    let onSessionEndedCallback: (() => void) | null = null

    vi.spyOn(arcadeSocket, 'useArcadeSocket').mockImplementation((events) => {
      onSessionEndedCallback = events.onSessionEnded || null
      return mockUseArcadeSocket
    })

    const mockSession = {
      gameUrl: '/arcade/matching',
      currentGame: 'matching',
      gameState: {},
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    })

    const { result } = renderHook(() =>
      useArcadeGuard({
        userId: 'test-user',
      })
    )

    await waitFor(() => {
      expect(result.current.hasActiveSession).toBe(true)
    })

    // Simulate session-ended event
    onSessionEndedCallback?.()

    await waitFor(() => {
      expect(result.current.hasActiveSession).toBe(false)
      expect(result.current.activeSession).toBe(null)
    })
  })

  it('should handle fetch errors gracefully', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() =>
      useArcadeGuard({
        userId: 'test-user',
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Should not crash, just set loading to false
    expect(result.current.hasActiveSession).toBe(false)
  })
})
