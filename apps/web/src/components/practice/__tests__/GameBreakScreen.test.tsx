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

// Mock Panda CSS
vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

// Mock game registry
const mockGame = {
  manifest: { name: 'test-game', displayName: 'Test Game', icon: '🎮' },
  Provider: ({ children }: { children: React.ReactNode }) => children,
  GameComponent: () => React.createElement('div', { 'data-testid': 'game-component' }, 'Game'),
  defaultConfig: {},
  validator: {},
}

vi.mock('@/lib/arcade/game-registry', () => ({
  getGame: (name: string) => (name === 'test-game' ? mockGame : null),
}))

vi.mock('@/lib/arcade/practice-approved-games', () => ({
  getPracticeApprovedGames: () => [
    { manifest: { name: 'game-1', displayName: 'Matching Game', icon: '🃏' } },
    { manifest: { name: 'game-2', displayName: 'Memory Game', icon: '🧠' } },
  ],
  getRandomPracticeApprovedGame: () => ({
    manifest: { name: 'game-1', displayName: 'Matching Game', icon: '🃏' },
  }),
}))

// Mock game break room hook
const mockSelectGame = vi.fn().mockResolvedValue(undefined)
const mockCleanup = vi.fn().mockResolvedValue(undefined)
let mockOnRoomReady: (() => void) | null = null

vi.mock('@/hooks/useGameBreakRoom', () => ({
  useGameBreakRoom: ({ onRoomReady }: { onRoomReady: () => void }) => {
    // Store the callback so tests can trigger it
    mockOnRoomReady = onRoomReady
    return {
      room: null,
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

const defaultStudent = {
  id: 'student-1',
  name: 'Alice',
  emoji: '🐱',
  color: '#FF6B6B',
}

describe('GameBreakScreen', () => {
  let originalDateNow: typeof Date.now
  let originalRaf: typeof requestAnimationFrame
  let originalCaf: typeof cancelAnimationFrame

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnRoomReady = null
    originalDateNow = Date.now
    originalRaf = globalThis.requestAnimationFrame
    originalCaf = globalThis.cancelAnimationFrame

    // Mock requestAnimationFrame to prevent infinite loops
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number
    }) as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = ((id: number) => {
      clearTimeout(id)
    }) as typeof cancelAnimationFrame
  })

  afterEach(() => {
    Date.now = originalDateNow
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCaf
    vi.restoreAllMocks()
  })

  it('returns null when not visible', () => {
    const { container } = render(
      <GameBreakScreen
        isVisible={false}
        maxDurationMinutes={5}
        startTime={Date.now()}
        student={defaultStudent}
        onComplete={vi.fn()}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders the game break screen when visible', () => {
    render(
      <GameBreakScreen
        isVisible={true}
        maxDurationMinutes={5}
        startTime={Date.now()}
        student={defaultStudent}
        onComplete={vi.fn()}
      />
    )

    expect(screen.getByText(/Game Break!/)).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('shows "Setting up..." in initializing phase', () => {
    render(
      <GameBreakScreen
        isVisible={true}
        maxDurationMinutes={5}
        startTime={Date.now()}
        student={defaultStudent}
        onComplete={vi.fn()}
      />
    )

    expect(screen.getByText('Setting up...')).toBeInTheDocument()
  })

  it('shows the skip button', () => {
    render(
      <GameBreakScreen
        isVisible={true}
        maxDurationMinutes={5}
        startTime={Date.now()}
        student={defaultStudent}
        onComplete={vi.fn()}
      />
    )

    const skipButton = screen.getByText('Back to Practice →')
    expect(skipButton).toBeInTheDocument()
  })

  it('calls onComplete with "skipped" when skip button is clicked', async () => {
    const onComplete = vi.fn()

    render(
      <GameBreakScreen
        isVisible={true}
        maxDurationMinutes={5}
        startTime={Date.now()}
        student={defaultStudent}
        onComplete={onComplete}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByText('Back to Practice →'))
    })

    expect(mockCleanup).toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalledWith('skipped', undefined)
  })

  it('shows game selection screen when room is ready in kid-chooses mode', () => {
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

    // Trigger room ready
    act(() => {
      mockOnRoomReady?.()
    })

    // Should show game selection
    expect(screen.getByText('Pick a game to play')).toBeInTheDocument()
    expect(screen.getByText('Matching Game')).toBeInTheDocument()
    expect(screen.getByText('Memory Game')).toBeInTheDocument()
  })

  it('shows available games in selection mode', () => {
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
      mockOnRoomReady?.()
    })

    const gameGrid = document.querySelector('[data-element="game-grid"]')
    expect(gameGrid).toBeInTheDocument()
  })

  it('calls selectGame when a game is clicked in selection mode', async () => {
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
      mockOnRoomReady?.()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Matching Game'))
    })

    expect(mockSelectGame).toHaveBeenCalledWith('game-1')
  })

  it('displays student info with emoji and name', () => {
    render(
      <GameBreakScreen
        isVisible={true}
        maxDurationMinutes={5}
        startTime={Date.now()}
        student={defaultStudent}
        onComplete={vi.fn()}
      />
    )

    const studentBadge = document.querySelector('[data-element="student-badge"]')!
    expect(studentBadge.textContent).toContain('Alice')
  })

  it('shows timer with remaining time', () => {
    const now = Date.now()
    Date.now = () => now

    render(
      <GameBreakScreen
        isVisible={true}
        maxDurationMinutes={5}
        startTime={now}
        student={defaultStudent}
        onComplete={vi.fn()}
      />
    )

    const timer = document.querySelector('[data-element="timer"]')
    expect(timer).toBeInTheDocument()
  })

  it('shows auto-start message for auto-start mode', () => {
    render(
      <GameBreakScreen
        isVisible={true}
        maxDurationMinutes={5}
        startTime={Date.now()}
        student={defaultStudent}
        onComplete={vi.fn()}
        selectionMode="auto-start"
      />
    )

    act(() => {
      mockOnRoomReady?.()
    })

    // Should show "Get ready!" and the auto-start message
    expect(screen.getByText('Get ready!')).toBeInTheDocument()
    const autoStartMsg = document.querySelector('[data-element="auto-start-message"]')
    expect(autoStartMsg).toBeInTheDocument()
  })

  it('marks pre-selected game as "Suggested" in kid-chooses mode', () => {
    render(
      <GameBreakScreen
        isVisible={true}
        maxDurationMinutes={5}
        startTime={Date.now()}
        student={defaultStudent}
        onComplete={vi.fn()}
        selectionMode="kid-chooses"
        selectedGame="game-1"
      />
    )

    act(() => {
      mockOnRoomReady?.()
    })

    // The pre-selected game should have "Suggested" badge
    expect(screen.getByText('Suggested')).toBeInTheDocument()
  })

  it('does not mark games as "Suggested" when no pre-selection', () => {
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
      mockOnRoomReady?.()
    })

    expect(screen.queryByText('Suggested')).not.toBeInTheDocument()
  })
})
