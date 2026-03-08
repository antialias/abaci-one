/**
 * Unit tests for GameBreakScreen observer notification callbacks
 * (onBreakStarted, onBreakPhaseChange, onBreakEnded)
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

describe('GameBreakScreen observer callbacks', () => {
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

  describe('onBreakPhaseChange', () => {
    it('is called with "selecting" when room becomes ready in kid-chooses mode', () => {
      const onBreakPhaseChange = vi.fn()

      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={Date.now()}
          student={defaultStudent}
          onComplete={vi.fn()}
          selectionMode="kid-chooses"
          onBreakPhaseChange={onBreakPhaseChange}
        />
      )

      act(() => {
        mockOnRoomReady?.({ id: MOCK_ROOM_ID })
      })

      expect(onBreakPhaseChange).toHaveBeenCalledWith(MOCK_ROOM_ID, 'selecting')
    })

    it('is called with "selecting" when room becomes ready in auto-start mode', () => {
      const onBreakPhaseChange = vi.fn()

      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={Date.now()}
          student={defaultStudent}
          onComplete={vi.fn()}
          selectionMode="auto-start"
          onBreakPhaseChange={onBreakPhaseChange}
        />
      )

      act(() => {
        mockOnRoomReady?.({ id: MOCK_ROOM_ID })
      })

      // Even in auto-start, the selecting phase callback fires first
      expect(onBreakPhaseChange).toHaveBeenCalledWith(MOCK_ROOM_ID, 'selecting')
    })
  })

  describe('onBreakStarted', () => {
    it('is called when a game is selected in kid-chooses mode', async () => {
      const onBreakStarted = vi.fn()

      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={Date.now()}
          student={defaultStudent}
          onComplete={vi.fn()}
          selectionMode="kid-chooses"
          onBreakStarted={onBreakStarted}
        />
      )

      act(() => {
        mockOnRoomReady?.({ id: MOCK_ROOM_ID })
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Memory Match'))
      })

      expect(onBreakStarted).toHaveBeenCalledWith(MOCK_ROOM_ID, 'Memory Match', 'matching')
    })

    it('is called with the display name from the game registry', async () => {
      const onBreakStarted = vi.fn()

      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={Date.now()}
          student={defaultStudent}
          onComplete={vi.fn()}
          selectionMode="kid-chooses"
          onBreakStarted={onBreakStarted}
        />
      )

      act(() => {
        mockOnRoomReady?.({ id: MOCK_ROOM_ID })
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Memory Match'))
      })

      // Second argument should be display name, third the game ID
      expect(onBreakStarted.mock.calls[0][1]).toBe('Memory Match')
      expect(onBreakStarted.mock.calls[0][2]).toBe('matching')
    })
  })

  describe('onBreakPhaseChange on game selection', () => {
    it('is called with "playing" when game is selected', async () => {
      const onBreakPhaseChange = vi.fn()

      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={Date.now()}
          student={defaultStudent}
          onComplete={vi.fn()}
          selectionMode="kid-chooses"
          onBreakPhaseChange={onBreakPhaseChange}
        />
      )

      act(() => {
        mockOnRoomReady?.({ id: MOCK_ROOM_ID })
      })

      // Clear the 'selecting' call
      onBreakPhaseChange.mockClear()

      await act(async () => {
        fireEvent.click(screen.getByText('Memory Match'))
      })

      expect(onBreakPhaseChange).toHaveBeenCalledWith(MOCK_ROOM_ID, 'playing')
    })
  })

  describe('onBreakEnded', () => {
    it('is called with "skipped" when skip button is clicked', async () => {
      const onBreakEnded = vi.fn()

      render(
        <GameBreakScreen
          isVisible={true}
          maxDurationMinutes={5}
          startTime={Date.now()}
          student={defaultStudent}
          onComplete={vi.fn()}
          onBreakEnded={onBreakEnded}
        />
      )

      await act(async () => {
        fireEvent.click(screen.getByText('Back to Practice →'))
      })

      expect(onBreakEnded).toHaveBeenCalledWith(MOCK_ROOM_ID, 'skipped', undefined)
    })

    it('is called with "timeout" when time expires', async () => {
      const onBreakEnded = vi.fn()
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
          onBreakEnded={onBreakEnded}
        />
      )

      // Let the RAF timer tick to detect timeout
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      expect(onBreakEnded).toHaveBeenCalledWith(MOCK_ROOM_ID, 'timeout', undefined)
    })
  })

  describe('callbacks are optional', () => {
    it('does not throw when callbacks are not provided', async () => {
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

      // Selecting a game without callbacks should not throw
      await act(async () => {
        fireEvent.click(screen.getByText('Memory Match'))
      })

      expect(mockSelectGame).toHaveBeenCalledWith('matching')
    })
  })
})
