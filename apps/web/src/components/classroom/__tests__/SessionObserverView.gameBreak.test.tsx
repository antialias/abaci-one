/**
 * Unit tests for SessionObserverView game break overlay rendering
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { ObservedGameBreakState } from '@/hooks/useSessionObserver'

// Mock useSessionObserver to return controlled breakState and flowState
let mockBreakState: ObservedGameBreakState | null = null
let mockFlowState: string | null = null
let mockIsObserving = true
let mockIsConnected = true

vi.mock('@/hooks/useSessionObserver', () => ({
  useSessionObserver: () => ({
    state: null,
    results: [],
    transitionState: null,
    flowState: mockFlowState,
    breakState: mockBreakState,
    visionFrame: null,
    isConnected: mockIsConnected,
    isObserving: mockIsObserving,
    error: null,
    stopObserving: vi.fn(),
    sendControl: vi.fn(),
    sendPause: vi.fn(),
    sendResume: vi.fn(),
    dvrBufferInfo: null,
    isLive: true,
    scrubTo: vi.fn(),
    goLive: vi.fn(),
  }),
}))

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
    requestDock: vi.fn(),
    dock: null,
    setDockedValue: vi.fn(),
    isDockedByUser: false,
  }),
}))

// Mock ToastContext
vi.mock('@/components/common/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}))

// Mock Panda CSS
vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

// Mock tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

// Mock queryClient
vi.mock('@/lib/queryClient', () => ({
  api: vi.fn(),
}))

// Mock Radix UI Dialog to avoid context errors
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Overlay: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  )),
  Content: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  )),
  Title: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <h2 ref={ref} {...props}>
      {children}
    </h2>
  )),
  Description: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <p ref={ref} {...props}>
      {children}
    </p>
  )),
  Close: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <button ref={ref} {...props}>
      {children}
    </button>
  )),
  Trigger: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <button ref={ref} {...props}>
      {children}
    </button>
  )),
}))

// Mock Z_INDEX constants
vi.mock('@/constants/zIndex', () => ({
  Z_INDEX: {
    MODAL_OVERLAY: 1000,
    MODAL_CONTENT: 1001,
    TOAST: 9999,
  },
}))

// Mock child components that are heavy to render
vi.mock('../AbacusDock', () => ({
  AbacusDock: () => null,
}))
vi.mock('../../practice/LiveResultsPanel', () => ({
  LiveResultsPanel: () => null,
}))
vi.mock('../../practice/LiveSessionReportModal', () => ({
  LiveSessionReportInline: () => null,
}))
vi.mock('../../practice/MobileResultsSummary', () => ({
  MobileResultsSummary: () => null,
}))
vi.mock('../../practice/ObserverTransitionView', () => ({
  ObserverTransitionView: () => null,
}))
vi.mock('../../practice/PracticeFeedback', () => ({
  PracticeFeedback: () => null,
}))
vi.mock('../../practice/PurposeBadge', () => ({
  PurposeBadge: () => null,
}))
vi.mock('../../practice/SessionPlanOverview', () => ({
  SessionPlanOverview: () => null,
}))
vi.mock('../../practice/SessionProgressIndicator', () => ({
  SessionProgressIndicator: () => null,
}))
vi.mock('../../practice/VerticalProblem', () => ({
  VerticalProblem: () => null,
}))
vi.mock('../../vision/ObserverVisionFeed', () => ({
  ObserverVisionFeed: () => null,
}))
vi.mock('../../vision/ProblemVideoPlayer', () => ({
  ProblemVideoPlayer: () => null,
}))
vi.mock('../../debug/ObserverDebugPanel', () => ({
  ObserverDebugPanel: () => null,
}))
vi.mock('../SessionShareButton', () => ({
  SessionShareButton: () => null,
}))
vi.mock('../GameBreakSpectatorView', () => ({
  GameBreakSpectatorView: ({ breakState, studentName }: any) => (
    <div data-element="game-break-spectator" data-game-id={breakState.gameId}>
      Spectating {studentName}&apos;s {breakState.gameName}
    </div>
  ),
}))
vi.mock('@/lib/utils/attempt-tracking', () => ({
  getVideoAttemptsForProblem: () => [],
  getAttemptLabel: () => '',
}))

import { SessionObserverView } from '../SessionObserverModal'

const defaultSession = {
  sessionId: 'session-123',
  playerId: 'player-456',
  startedAt: new Date().toISOString(),
  currentPartIndex: 0,
  currentSlotIndex: 0,
  totalParts: 3,
  totalProblems: 15,
  completedProblems: 0,
}

const defaultStudent = {
  name: 'Alice',
  emoji: '🐱',
  color: '#FF6B6B',
}

describe('SessionObserverView game break overlay', () => {
  it('does not show game break overlay when breakState is null', () => {
    mockBreakState = null
    mockFlowState = 'practicing'
    mockIsObserving = true
    mockIsConnected = true

    render(
      <SessionObserverView
        session={defaultSession}
        student={defaultStudent}
        observerId="observer-1"
      />
    )

    expect(document.querySelector('[data-element="game-break-overlay"]')).not.toBeInTheDocument()
  })

  it('shows fallback overlay when flowState is break_pending but breakState is null', () => {
    mockBreakState = null
    mockFlowState = 'break_pending'
    mockIsObserving = true
    mockIsConnected = true

    render(
      <SessionObserverView
        session={defaultSession}
        student={defaultStudent}
        observerId="observer-1"
      />
    )

    // Should show the fallback game break overlay (not blank)
    expect(document.querySelector('[data-element="game-break-overlay"]')).toBeInTheDocument()
    expect(screen.getByText('Alice is taking a game break...')).toBeInTheDocument()
    expect(screen.getByText('Game Break')).toBeInTheDocument()
  })

  it('shows fallback overlay when flowState is break_active but breakState is null', () => {
    mockBreakState = null
    mockFlowState = 'break_active'
    mockIsObserving = true
    mockIsConnected = true

    render(
      <SessionObserverView
        session={defaultSession}
        student={defaultStudent}
        observerId="observer-1"
      />
    )

    expect(document.querySelector('[data-element="game-break-overlay"]')).toBeInTheDocument()
    expect(screen.getByText('Alice is taking a game break...')).toBeInTheDocument()
  })

  it('shows game break spectator view when breakState is playing (authenticated observer)', () => {
    mockFlowState = 'break_active'
    mockBreakState = {
      roomId: 'room-abc',
      gameName: 'Memory Match',
      gameId: 'matching',
      phase: 'playing',
    }

    render(
      <SessionObserverView
        session={defaultSession}
        student={defaultStudent}
        observerId="observer-1"
      />
    )

    // Authenticated observer sees spectator view, not the overlay
    const spectator = document.querySelector('[data-element="game-break-spectator"]')
    expect(spectator).toBeInTheDocument()
  })

  it('shows game break spectator view when breakState is playing (guest/share-token observer)', () => {
    mockFlowState = 'break_active'
    mockBreakState = {
      roomId: 'room-abc',
      gameName: 'Memory Match',
      gameId: 'matching',
      phase: 'playing',
    }

    render(
      <SessionObserverView
        session={defaultSession}
        student={defaultStudent}
        observerId="observer-1"
        shareToken="guest-token"
      />
    )

    // Guest observer also sees spectator view (guests have userId via identity model)
    const spectator = document.querySelector('[data-element="game-break-spectator"]')
    expect(spectator).toBeInTheDocument()
  })

  it('shows "choosing a game" text during selecting phase', () => {
    mockFlowState = 'break_pending'
    mockBreakState = {
      roomId: 'room-abc',
      gameName: 'Memory Match',
      gameId: 'matching',
      phase: 'selecting',
    }

    render(
      <SessionObserverView
        session={defaultSession}
        student={defaultStudent}
        observerId="observer-1"
      />
    )

    expect(screen.getByText('Alice is choosing a game...')).toBeInTheDocument()
    expect(screen.getByText('Choosing game')).toBeInTheDocument()
  })

  it('shows spectator view (not overlay text) during playing phase for guest observer', () => {
    mockFlowState = 'break_active'
    mockBreakState = {
      roomId: 'room-abc',
      gameName: 'Memory Match',
      gameId: 'matching',
      phase: 'playing',
    }

    render(
      <SessionObserverView
        session={defaultSession}
        student={defaultStudent}
        observerId="observer-1"
        shareToken="guest-token"
      />
    )

    // Guest now sees spectator view, not the informational overlay
    const spectator = document.querySelector('[data-element="game-break-spectator"]')
    expect(spectator).toBeInTheDocument()
    // Overlay should NOT be shown
    const overlay = document.querySelector('[data-element="game-break-overlay"]')
    expect(overlay).not.toBeInTheDocument()
  })

  it('shows "reviewing results" during break_results flow state', () => {
    mockFlowState = 'break_results'
    mockBreakState = null // breakState cleared when transitioning to results

    render(
      <SessionObserverView
        session={defaultSession}
        student={defaultStudent}
        observerId="observer-1"
      />
    )

    expect(screen.getByText('Alice is reviewing game results...')).toBeInTheDocument()
  })

  it('shows "Game Break" heading during selecting phase', () => {
    mockFlowState = 'break_pending'
    mockBreakState = {
      roomId: 'room-abc',
      gameName: '',
      gameId: '',
      phase: 'selecting',
    }

    render(
      <SessionObserverView
        session={defaultSession}
        student={defaultStudent}
        observerId="observer-1"
      />
    )

    expect(screen.getByText('Game Break')).toBeInTheDocument()
  })

  it('hides "waiting for activity" message during game break', () => {
    mockFlowState = 'break_pending'
    mockBreakState = {
      roomId: 'room-abc',
      gameName: '',
      gameId: '',
      phase: 'selecting',
    }
    mockIsObserving = true

    render(
      <SessionObserverView
        session={defaultSession}
        student={defaultStudent}
        observerId="observer-1"
      />
    )

    expect(screen.queryByText('Waiting for student activity...')).not.toBeInTheDocument()
  })

  it('shows "waiting for activity" when not in a break and no state', () => {
    mockBreakState = null
    mockFlowState = null
    mockIsObserving = true

    render(
      <SessionObserverView
        session={defaultSession}
        student={defaultStudent}
        observerId="observer-1"
      />
    )

    expect(screen.getByText('Waiting for student activity...')).toBeInTheDocument()
  })
})
