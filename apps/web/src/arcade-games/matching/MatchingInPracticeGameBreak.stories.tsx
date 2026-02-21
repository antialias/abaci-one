'use client'

import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ViewportProvider } from '@/contexts/ViewportContext'
import { FullscreenProvider } from '@/contexts/FullscreenContext'
import { DeploymentInfoProvider } from '@/contexts/DeploymentInfoContext'
import { GameLayoutProvider } from '@/contexts/GameLayoutContext'
import { PreviewModeContext } from '@/contexts/PreviewModeContext'
import { GameModeProvider, type RoomData as GameModeRoomData } from '@/contexts/GameModeContext'
import type { Player as DBPlayer } from '@/db/schema/players'
import { identityKeys } from '@/hooks/useUserId'
import { roomKeys, type RoomData } from '@/hooks/useRoomData'
import { AppNavBar } from '@/components/AppNavBar'
import { PracticeSubNav, type GameBreakHudData } from '@/components/practice'
import { matchingGame } from './index'

const MatchingProvider = matchingGame.Provider
const MatchingGameComponent = matchingGame.GameComponent
import { generateGameCards } from './utils/cardGeneration'
import type { MatchingState, PlayerMetadata } from './types'
import { css } from '../../../styled-system/css'

/**
 * Stories for the Matching Tiles game rendered in game-break practice session context.
 *
 * These stories use the REAL game components (not mocks) to debug full-screen layout issues.
 * INCLUDES the full page context with:
 * - AppNavBar (main navigation)
 * - PracticeSubNav with game break HUD (timer, progress bar, skip button)
 * - The matching game in the main content area
 *
 * Architecture:
 * - React Query pre-populated with viewer ID and room data
 * - PreviewModeContext provides mock game state to useArcadeSession
 * - GameModeProvider provides player management
 * - FullscreenProvider for fullscreen functionality
 * - ViewportProvider for responsive sizing
 */

// Mock router for Next.js navigation
const mockRouter = {
  push: (url: string) => console.log('Router push:', url),
  replace: (url: string) => console.log('Router replace:', url),
  back: () => console.log('Router back'),
  forward: () => console.log('Router forward'),
  refresh: () => console.log('Router refresh'),
  prefetch: (url: string) => console.log('Router prefetch:', url),
}

const meta: Meta = {
  title: 'Practice/MatchingInGameBreak',
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: mockRouter,
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj

// =============================================================================
// Mock Data
// =============================================================================

const mockViewerId = 'mock-viewer-id-123'

const mockStudent = {
  id: 'student-sonia-id',
  name: 'Sonia',
  emoji: '🌟',
  color: '#a855f7',
}

// Mock player as DBPlayer type
const mockDBPlayer: DBPlayer = {
  id: mockStudent.id,
  userId: mockViewerId,
  name: mockStudent.name,
  emoji: mockStudent.emoji,
  color: mockStudent.color,
  isActive: true,
  createdAt: new Date(),
  helpSettings: null,
  notes: null,
  isArchived: false,
  isPracticeStudent: true,
  familyCode: null,
  age: null,
}

const mockRoomData: RoomData = {
  id: 'mock-room-123',
  name: 'Practice Game Break Room',
  code: 'PRAC',
  gameName: 'matching',
  gameConfig: {
    matching: {
      gameType: 'abacus-numeral',
      difficulty: 6,
      turnTimer: 30,
    },
  },
  accessMode: 'open',
  members: [
    {
      id: 'member-1',
      userId: mockViewerId,
      displayName: mockStudent.name,
      isOnline: true,
      isCreator: true,
    },
  ],
  memberPlayers: {
    [mockViewerId]: [
      {
        id: mockStudent.id,
        name: mockStudent.name,
        emoji: mockStudent.emoji,
        color: mockStudent.color,
      },
    ],
  },
}

const mockPlayerMetadata: Record<string, PlayerMetadata> = {
  [mockStudent.id]: {
    id: mockStudent.id,
    name: mockStudent.name,
    emoji: mockStudent.emoji,
    userId: mockViewerId,
    color: mockStudent.color,
  },
}

// Create game cards for different phases
function createMockMatchingState(phase: 'setup' | 'playing' | 'results'): MatchingState {
  const cards = generateGameCards('abacus-numeral', 6)

  const baseState: MatchingState = {
    cards,
    gameCards: cards,
    flippedCards: [],
    gameType: 'abacus-numeral',
    difficulty: 6,
    turnTimer: 30,
    gamePhase: phase,
    currentPlayer: mockStudent.id,
    matchedPairs: 0,
    totalPairs: 6,
    moves: 0,
    scores: { [mockStudent.id]: 0 },
    activePlayers: [mockStudent.id],
    playerMetadata: mockPlayerMetadata,
    consecutiveMatches: { [mockStudent.id]: 0 },
    gameStartTime: phase === 'setup' ? null : Date.now(),
    gameEndTime: null,
    currentMoveStartTime: null,
    celebrationAnimations: [],
    isProcessingMove: false,
    showMismatchFeedback: false,
    lastMatchedPair: null,
    playerHovers: {},
  }

  if (phase === 'playing') {
    return {
      ...baseState,
      gamePhase: 'playing',
      gameStartTime: Date.now() - 30000, // 30 seconds ago
    }
  }

  if (phase === 'results') {
    // Mark all cards as matched for results phase
    const matchedCards = cards.map((card) => ({
      ...card,
      matched: true,
      matchedBy: mockStudent.id,
    }))
    return {
      ...baseState,
      cards: matchedCards,
      gameCards: matchedCards,
      gamePhase: 'results',
      matchedPairs: 6,
      scores: { [mockStudent.id]: 6 },
      moves: 12,
      gameStartTime: Date.now() - 120000, // 2 minutes ago
      gameEndTime: Date.now(),
    }
  }

  return baseState
}

// =============================================================================
// Story Wrapper Component - FULL PAGE CONTEXT
// =============================================================================

interface MatchingGameStoryWrapperProps {
  phase: 'setup' | 'playing' | 'results'
  theme?: 'light' | 'dark'
  /** Duration of game break in minutes (for timer display) */
  gameBreakDurationMinutes?: number
  /** How much time has already elapsed in the game break (for testing different timer states) */
  elapsedSeconds?: number
}

/**
 * Wrapper component that sets up the FULL practice page context including:
 * - AppNavBar (main navigation)
 * - PracticeSubNav with game break HUD
 * - The matching game in the main content area
 */
function MatchingGameStoryWrapper({
  phase,
  theme = 'light',
  gameBreakDurationMinutes = 5,
  elapsedSeconds = 0,
}: MatchingGameStoryWrapperProps) {
  // Create query client with pre-populated data
  const queryClient = useMemo(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
        },
      },
    })

    // Pre-populate viewer ID
    client.setQueryData(identityKeys.id(), mockViewerId)

    // Pre-populate room data
    client.setQueryData(roomKeys.current(), mockRoomData)

    return client
  }, [])

  // Create mock matching state for preview mode
  const mockState = useMemo(() => createMockMatchingState(phase), [phase])

  // Preview mode context value - this makes useArcadeSession return mock data
  // NOTE: We DON'T wrap the entire page in PreviewModeContext since PageWithNav
  // checks it and skips nav rendering. We only wrap the game components.
  const previewModeValue = useMemo(
    () => ({
      isPreview: true,
      mockState,
    }),
    [mockState]
  )

  // GameModeProvider props (no-op mutations for Storybook)
  const gameModeProps = useMemo(
    () => ({
      dbPlayers: [mockDBPlayer],
      isLoading: false,
      createPlayer: () => {},
      updatePlayerMutation: () => {},
      deletePlayer: () => {},
      roomData: mockRoomData as GameModeRoomData,
      notifyRoomOfPlayerUpdate: () => {},
      viewerId: mockViewerId,
    }),
    []
  )

  // Game break HUD data - shows timer and "Back to Practice" button
  const gameBreakHud: GameBreakHudData = useMemo(
    () => ({
      startTime: Date.now() - elapsedSeconds * 1000,
      maxDurationMs: gameBreakDurationMinutes * 60 * 1000,
      onSkip: () => console.log('Skip game break clicked'),
      gameIcon: '⚔️',
      gameName: 'Matching Pairs',
    }),
    [gameBreakDurationMinutes, elapsedSeconds]
  )

  const isDark = theme === 'dark'

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DeploymentInfoProvider>
          <FullscreenProvider>
            <div
              data-theme={theme}
              className={css({
                minHeight: '100vh',
                backgroundColor: isDark ? 'gray.900' : 'gray.50',
              })}
            >
              {/* Main Navigation Bar */}
              <AppNavBar navSlot={null} />

              {/* Practice Sub-Navigation with Game Break HUD */}
              <PracticeSubNav
                student={mockStudent}
                pageContext="session"
                gameBreakHud={gameBreakHud}
              />

              {/* Main content area - positioned exactly like PracticeClient */}
              <main
                data-component="practice-page"
                className={css({
                  // Fixed positioning to precisely control bounds
                  position: 'fixed',
                  // Top: main nav (80px) + sub-nav height (~52px mobile, ~60px desktop)
                  top: { base: '132px', md: '140px' },
                  left: 0,
                  right: 0,
                  // Bottom: 0 for game break (no keypad needed)
                  bottom: 0,
                  overflow: 'hidden',
                })}
              >
                {/* Game Container - matches GameBreakScreen layout */}
                <div
                  data-component="game-break-screen"
                  data-phase="playing"
                  data-element="game-container"
                  className={css({
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                  })}
                >
                  <GameLayoutProvider mode="container">
                    <PreviewModeContext.Provider value={previewModeValue}>
                      <ViewportProvider width={1440} height={900}>
                        <GameModeProvider {...gameModeProps}>
                          <MatchingProvider>
                            <MatchingGameComponent />
                          </MatchingProvider>
                        </GameModeProvider>
                      </ViewportProvider>
                    </PreviewModeContext.Provider>
                  </GameLayoutProvider>
                </div>
              </main>
            </div>
          </FullscreenProvider>
        </DeploymentInfoProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

// =============================================================================
// Isolated Game Wrapper (without nav context, for comparison)
// =============================================================================

interface IsolatedGameWrapperProps {
  phase: 'setup' | 'playing' | 'results'
  theme?: 'light' | 'dark'
}

/**
 * Wrapper that renders ONLY the game without page navigation context.
 * Useful for comparing layout behavior with/without navs.
 */
function IsolatedGameWrapper({ phase, theme = 'light' }: IsolatedGameWrapperProps) {
  const queryClient = useMemo(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(identityKeys.id(), mockViewerId)
    client.setQueryData(roomKeys.current(), mockRoomData)
    return client
  }, [])

  const mockState = useMemo(() => createMockMatchingState(phase), [phase])
  const previewModeValue = useMemo(() => ({ isPreview: true, mockState }), [mockState])

  const gameModeProps = useMemo(
    () => ({
      dbPlayers: [mockDBPlayer],
      isLoading: false,
      createPlayer: () => {},
      updatePlayerMutation: () => {},
      deletePlayer: () => {},
      roomData: mockRoomData as GameModeRoomData,
      notifyRoomOfPlayerUpdate: () => {},
      viewerId: mockViewerId,
    }),
    []
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div data-theme={theme}>
          <PreviewModeContext.Provider value={previewModeValue}>
            <FullscreenProvider>
              <ViewportProvider width={1440} height={900}>
                <GameModeProvider {...gameModeProps}>
                  <div
                    data-component="matching-game-isolated"
                    className={css({
                      width: '100vw',
                      height: '100vh',
                      overflow: 'hidden',
                    })}
                  >
                    <MatchingProvider>
                      <MatchingGameComponent />
                    </MatchingProvider>
                  </div>
                </GameModeProvider>
              </ViewportProvider>
            </FullscreenProvider>
          </PreviewModeContext.Provider>
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

// =============================================================================
// Interactive Story Component (with phase and timer switching)
// =============================================================================

function InteractiveMatchingGame({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'results'>('playing')
  const [elapsedSeconds, setElapsedSeconds] = useState(60)

  return (
    <div className={css({ position: 'relative', width: '100vw', height: '100vh' })}>
      {/* Controls overlay */}
      <div
        data-element="story-controls"
        className={css({
          position: 'fixed',
          top: '10px',
          right: '10px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          padding: '0.75rem',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderRadius: '8px',
          minWidth: '180px',
        })}
      >
        {/* Phase controls */}
        <div className={css({ display: 'flex', gap: '0.25rem' })}>
          {(['setup', 'playing', 'results'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPhase(p)}
              className={css({
                padding: '0.25rem 0.5rem',
                fontSize: '0.625rem',
                fontWeight: '600',
                color: phase === p ? 'white' : 'gray.400',
                backgroundColor:
                  phase === p
                    ? p === 'setup'
                      ? 'blue.600'
                      : p === 'playing'
                        ? 'green.600'
                        : 'purple.600'
                    : 'gray.700',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                textTransform: 'capitalize',
              })}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Timer simulation */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          })}
        >
          <span className={css({ fontSize: '0.625rem', color: 'gray.400' })}>
            Timer: {Math.floor(elapsedSeconds / 60)}:
            {(elapsedSeconds % 60).toString().padStart(2, '0')} elapsed
          </span>
          <input
            type="range"
            min={0}
            max={300}
            value={elapsedSeconds}
            onChange={(e) => setElapsedSeconds(Number(e.target.value))}
            className={css({ width: '100%' })}
          />
        </div>
      </div>

      <MatchingGameStoryWrapper phase={phase} theme={theme} elapsedSeconds={elapsedSeconds} />
    </div>
  )
}

// =============================================================================
// Stories - Full Page Context (with navs)
// =============================================================================

export const FullContextPlaying: Story = {
  name: 'Full Context: Playing',
  render: () => <MatchingGameStoryWrapper phase="playing" />,
}

export const FullContextPlayingDark: Story = {
  name: 'Full Context: Playing (Dark)',
  render: () => <MatchingGameStoryWrapper phase="playing" theme="dark" />,
}

export const FullContextSetup: Story = {
  name: 'Full Context: Setup',
  render: () => <MatchingGameStoryWrapper phase="setup" />,
}

export const FullContextResults: Story = {
  name: 'Full Context: Results',
  render: () => <MatchingGameStoryWrapper phase="results" />,
}

// =============================================================================
// Stories - Timer States
// =============================================================================

export const TimerFull: Story = {
  name: 'Timer: Full (5:00 remaining)',
  render: () => <MatchingGameStoryWrapper phase="playing" elapsedSeconds={0} />,
}

export const TimerHalfway: Story = {
  name: 'Timer: Halfway (2:30 remaining)',
  render: () => <MatchingGameStoryWrapper phase="playing" elapsedSeconds={150} />,
}

export const TimerLow: Story = {
  name: 'Timer: Low (1:00 remaining)',
  render: () => <MatchingGameStoryWrapper phase="playing" elapsedSeconds={240} />,
}

export const TimerCritical: Story = {
  name: 'Timer: Critical (0:30 remaining)',
  render: () => <MatchingGameStoryWrapper phase="playing" elapsedSeconds={270} />,
}

// =============================================================================
// Stories - Isolated Game (without navs, for comparison)
// =============================================================================

export const IsolatedPlaying: Story = {
  name: 'Isolated: Playing (No Navs)',
  render: () => <IsolatedGameWrapper phase="playing" />,
}

export const IsolatedPlayingDark: Story = {
  name: 'Isolated: Playing Dark (No Navs)',
  render: () => <IsolatedGameWrapper phase="playing" theme="dark" />,
}

// =============================================================================
// Stories - Interactive (can switch phases and timer)
// =============================================================================

export const Interactive: Story = {
  name: 'Interactive (Switch Phases & Timer)',
  render: () => <InteractiveMatchingGame />,
}

export const InteractiveDark: Story = {
  name: 'Interactive (Dark Mode)',
  render: () => <InteractiveMatchingGame theme="dark" />,
}

// =============================================================================
// Documentation Story
// =============================================================================

export const Documentation: Story = {
  name: 'Documentation',
  render: () => (
    <div
      className={css({
        padding: '2rem',
        backgroundColor: 'white',
        maxWidth: '800px',
        margin: '0 auto',
      })}
    >
      <h1
        className={css({
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
        })}
      >
        Matching Game in Practice Game Break Context
      </h1>

      <p className={css({ marginBottom: '1rem', lineHeight: 1.6 })}>
        These stories render the <strong>REAL</strong> matching game components (not mocks) in a
        simulated game-break practice session context. This is useful for debugging full-screen
        layout issues.
      </p>

      <h2
        className={css({
          fontSize: '1.25rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
        })}
      >
        Full Page Context Stories
      </h2>
      <p className={css({ marginBottom: '1rem', lineHeight: 1.6 })}>
        The &quot;Full Context&quot; stories include:
      </p>
      <ul
        className={css({
          paddingLeft: '1.5rem',
          marginBottom: '1rem',
          lineHeight: 1.8,
        })}
      >
        <li>
          <strong>AppNavBar</strong>: The main navigation bar (80px height)
        </li>
        <li>
          <strong>PracticeSubNav</strong>: With game break HUD showing timer, game name, and
          &quot;Back to Practice&quot; button
        </li>
        <li>
          <strong>Main content area</strong>: Positioned exactly like the real practice page (fixed,
          below both navs)
        </li>
      </ul>

      <h2
        className={css({
          fontSize: '1.25rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
        })}
      >
        Isolated Stories
      </h2>
      <p className={css({ marginBottom: '1rem', lineHeight: 1.6 })}>
        The &quot;Isolated&quot; stories render ONLY the game without any navigation context.
        Compare these with Full Context stories to debug layout issues caused by nav positioning.
      </p>

      <h2
        className={css({
          fontSize: '1.25rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
        })}
      >
        Timer States
      </h2>
      <p className={css({ marginBottom: '1rem', lineHeight: 1.6 })}>
        The game break HUD shows a countdown timer. Test different timer states:
      </p>
      <ul
        className={css({
          paddingLeft: '1.5rem',
          marginBottom: '1rem',
          lineHeight: 1.8,
        })}
      >
        <li>
          <strong>Timer: Full</strong> - 5:00 remaining (green)
        </li>
        <li>
          <strong>Timer: Halfway</strong> - 2:30 remaining
        </li>
        <li>
          <strong>Timer: Low</strong> - 1:00 remaining (yellow warning)
        </li>
        <li>
          <strong>Timer: Critical</strong> - 0:30 remaining (urgent)
        </li>
      </ul>

      <h2
        className={css({
          fontSize: '1.25rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
        })}
      >
        Architecture
      </h2>
      <ul
        className={css({
          paddingLeft: '1.5rem',
          marginBottom: '1rem',
          lineHeight: 1.8,
        })}
      >
        <li>
          <strong>QueryClientProvider</strong>: Pre-populated with viewer ID and room data
        </li>
        <li>
          <strong>PreviewModeContext</strong>: Makes useArcadeSession return mock state (only wraps
          game, NOT nav)
        </li>
        <li>
          <strong>GameModeProvider</strong>: Provides player management with mock player data
        </li>
        <li>
          <strong>FullscreenProvider</strong>: For fullscreen functionality
        </li>
        <li>
          <strong>ViewportProvider</strong>: For responsive sizing
        </li>
      </ul>

      <h2
        className={css({
          fontSize: '1.25rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
        })}
      >
        Game Phases
      </h2>
      <ul
        className={css({
          paddingLeft: '1.5rem',
          marginBottom: '1rem',
          lineHeight: 1.8,
        })}
      >
        <li>
          <strong>Setup</strong>: Game configuration screen (game type, difficulty, players)
        </li>
        <li>
          <strong>Playing</strong>: Active gameplay with card grid
        </li>
        <li>
          <strong>Results</strong>: Game over screen with scores
        </li>
      </ul>

      <p
        className={css({
          fontSize: '0.875rem',
          color: 'gray.600',
          fontStyle: 'italic',
        })}
      >
        Use the &quot;Interactive&quot; story to switch between phases and adjust the timer without
        reloading.
      </p>
    </div>
  ),
}
