/**
 * Unit tests for GameBreakScreen observer notification via onBreakContextChange
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GameBreakScreen } from '../GameBreakScreen'

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}))

// Mock MyAbacusContext
vi.mock('@/contexts/MyAbacusContext', () => ({
  useMyAbacus: () => ({
    setIsHidden: vi.fn(),
  }),
}))

// Mock Panda CSS
vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

// Mock game registry
const mockGame = {
  manifest: { name: 'matching', displayName: 'Memory Match', icon: '🃏' },
  Provider: ({ children }: { children: React.ReactNode }) => children,
  GameComponent: () => React.createElement('div', { 'data-testid': 'game-component' }, 'Game'),
  defaultConfig: {},
  validator: {},
}

vi.mock('@/lib/arcade/game-registry', () => ({
  getGame: (name: string) => (name === 'matching' ? mockGame : null),
}))

vi.mock('@/lib/arcade/practice-approved-games', () => ({
  getPracticeApprovedGames: () => [
    { manifest: { name: 'matching', displayName: 'Memory Match', icon: '🃏' } },
    { manifest: { name: 'card-sorting', displayName: 'Card Sorting', icon: '🎯' } },
  ],
}))

// Mock game break room hook — returns a room with an id so observer callbacks fire
const mockSelectGame = vi.fn().mockResolvedValue(undefined)
const mockCleanup = vi.fn().mockResolvedValue(undefined)
let mockOnRoomReady: ((room: { id: string }) => void) | null = null
const MOCK_ROOM_ID = 'room-test-123'

vi.mock('@/hooks/useGameBreakRoom', () => ({
  useGameBreakRoom: ({ onRoomReady }: { onRoomReady: (room: { id: string }) => void }) => {
    mockOnRoomReady = onRoomReady
    return {
      room: { id: MOCK_ROOM_ID, gameName: 'matching' },
      isCreating: false,
      selectGame: mockSelectGame,
      cleanup: mockCleanup,
    }
  },
}))

// Mock PracticeGameModeProvider
vi.mock('../PracticeGameModeProvider', () => ({
  PracticeGameModeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock GameLayoutContext
vi.mock('@/contexts/GameLayoutContext', () => ({
  GameLayoutProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock useGameBreakAudio
vi.mock('../hooks/useGameBreakAudio', () => ({
  useGameBreakAudio: vi.fn(),
}))

const defaultStudent = {
  id: 'student-1',
  name: 'Alice',
  emoji: '🐱',
  color: '#FF6B6B',
}

describe('GameBreakScreen onBreakContextChange', () => {
  let originalRaf: typeof requestAnimationFrame
  let originalCaf: typeof cancelAnimationFrame

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnRoomReady = null
    originalRaf = globalThis.requestAnimationFrame
    originalCaf = globalThis.cancelAnimationFrame

    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number
    }) as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = ((id: number) => {
      clearTimeout(id)
    }) as typeof cancelAnimationFrame
  })

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCaf
    vi.restoreAllMocks()
  })

  describe('room ready', () => {
    it('is called with selecting phase when room becomes ready in kid-chooses mode', () => {
      const onBreakContextChange = vi.fn()

      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={Date.now()}
          student={defaultStudent}
          onComplete={vi.fn()}
          selectionMode="kid-chooses"
          onBreakContextChange={onBreakContextChange}
        />
      )

      act(() => {
        mockOnRoomReady?.({ id: MOCK_ROOM_ID })
      })

      expect(onBreakContextChange).toHaveBeenCalledWith({
        roomId: MOCK_ROOM_ID,
        gameName: '',
        gameId: '',
        phase: 'selecting',
      })
    })

    it('is called with selecting phase when room becomes ready in auto-start mode', () => {
      const onBreakContextChange = vi.fn()

      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={Date.now()}
          student={defaultStudent}
          onComplete={vi.fn()}
          selectionMode="auto-start"
          onBreakContextChange={onBreakContextChange}
        />
      )

      act(() => {
        mockOnRoomReady?.({ id: MOCK_ROOM_ID })
      })

      expect(onBreakContextChange).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: MOCK_ROOM_ID,
          phase: 'selecting',
        })
      )
    })
  })

  describe('game selection', () => {
    it('is called with playing phase and game info when a game is selected', async () => {
      const onBreakContextChange = vi.fn()

      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={Date.now()}
          student={defaultStudent}
          onComplete={vi.fn()}
          selectionMode="kid-chooses"
          onBreakContextChange={onBreakContextChange}
        />
      )

      act(() => {
        mockOnRoomReady?.({ id: MOCK_ROOM_ID })
      })

      onBreakContextChange.mockClear()

      await act(async () => {
        fireEvent.click(screen.getByText('Memory Match'))
      })

      expect(onBreakContextChange).toHaveBeenCalledWith({
        roomId: MOCK_ROOM_ID,
        gameName: 'Memory Match',
        gameId: 'matching',
        phase: 'playing',
      })
    })
  })

  describe('break ended', () => {
    it('is called with null when skip button is clicked', async () => {
      const onBreakContextChange = vi.fn()

      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={Date.now()}
          student={defaultStudent}
          onComplete={vi.fn()}
          onBreakContextChange={onBreakContextChange}
        />
      )

      await act(async () => {
        fireEvent.click(screen.getByText('Back to Practice →'))
      })

      expect(onBreakContextChange).toHaveBeenCalledWith(null)
    })

    it('is called with null when time expires', async () => {
      const onBreakContextChange = vi.fn()
      const now = Date.now()
      // Start time is 6 minutes ago, max is 5 minutes → already expired
      const startTime = now - 6 * 60 * 1000

      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={startTime}
          student={defaultStudent}
          onComplete={vi.fn()}
          onBreakContextChange={onBreakContextChange}
        />
      )

      // Let the RAF timer tick to detect timeout
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      expect(onBreakContextChange).toHaveBeenCalledWith(null)
    })
  })

  describe('callback is optional', () => {
    it('does not throw when onBreakContextChange is not provided', async () => {
      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={Date.now()}
          student={defaultStudent}
          onComplete={vi.fn()}
          selectionMode="kid-chooses"
        />
      )

      act(() => {
        mockOnRoomReady?.({ id: MOCK_ROOM_ID })
      })

      // Selecting a game without callback should not throw
      await act(async () => {
        fireEvent.click(screen.getByText('Memory Match'))
      })

      expect(mockSelectGame).toHaveBeenCalledWith('matching')
    })
  })
})
