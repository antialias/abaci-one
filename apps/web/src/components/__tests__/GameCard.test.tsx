import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GameCard } from '../GameCard'

// Mock ThemeContext (not used directly by GameCard but may be needed by parent mocks)
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}))

// Mock Panda CSS
vi.mock('../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

// Mock GameModeContext
let mockActivePlayerCount = 1
vi.mock('../../contexts/GameModeContext', () => ({
  useGameMode: () => ({
    gameMode: mockActivePlayerCount === 1 ? 'single' : 'battle',
    players: new Map(),
    activePlayers: new Set(),
    activePlayerCount: mockActivePlayerCount,
    addPlayer: vi.fn(),
    updatePlayer: vi.fn(),
    removePlayer: vi.fn(),
    togglePlayer: vi.fn(),
  }),
}))

const defaultConfig = {
  name: 'Matching',
  fullName: 'Matching Game',
  icon: React.createElement('span', null, '🃏'),
  description: 'Match pairs to win!',
  url: '/games/matching',
  maxPlayers: 2,
  available: true,
  gradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
  borderColor: 'blue.200',
  color: 'blue',
  chips: ['Fun', 'Quick'],
}

describe('GameCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActivePlayerCount = 1
  })

  it('renders the game name', () => {
    render(<GameCard gameType="matching" config={defaultConfig} />)

    // In detailed mode, fullName is shown
    expect(screen.getByText('Matching Game')).toBeInTheDocument()
  })

  it('renders game name (not fullName) in compact variant', () => {
    render(<GameCard gameType="matching" config={defaultConfig} variant="compact" />)

    expect(screen.getByText('Matching')).toBeInTheDocument()
    expect(screen.queryByText('Matching Game')).not.toBeInTheDocument()
  })

  it('renders the description in detailed variant', () => {
    render(<GameCard gameType="matching" config={defaultConfig} />)

    expect(screen.getByText('Match pairs to win!')).toBeInTheDocument()
  })

  it('does not render description in compact variant', () => {
    render(<GameCard gameType="matching" config={defaultConfig} variant="compact" />)

    expect(screen.queryByText('Match pairs to win!')).not.toBeInTheDocument()
  })

  it('renders feature chips in detailed variant', () => {
    render(<GameCard gameType="matching" config={defaultConfig} />)

    expect(screen.getByText('Fun')).toBeInTheDocument()
    expect(screen.getByText('Quick')).toBeInTheDocument()
  })

  it('does not render chips in compact variant', () => {
    render(<GameCard gameType="matching" config={defaultConfig} variant="compact" />)

    expect(screen.queryByText('Fun')).not.toBeInTheDocument()
    expect(screen.queryByText('Quick')).not.toBeInTheDocument()
  })

  it('navigates to game URL when clicked and available', () => {
    render(<GameCard gameType="matching" config={defaultConfig} />)

    fireEvent.click(screen.getByText('Matching Game'))
    expect(mockPush).toHaveBeenCalledWith('/games/matching')
  })

  it('does not navigate when activePlayerCount is 0', () => {
    mockActivePlayerCount = 0

    render(<GameCard gameType="matching" config={defaultConfig} />)

    fireEvent.click(screen.getByText('Matching Game'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not navigate when too many players', () => {
    mockActivePlayerCount = 3

    render(<GameCard gameType="matching" config={{ ...defaultConfig, maxPlayers: 2 }} />)

    fireEvent.click(screen.getByText('Matching Game'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not navigate when config.available is false', () => {
    render(<GameCard gameType="matching" config={{ ...defaultConfig, available: false }} />)

    fireEvent.click(screen.getByText('Matching Game'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows player availability indicator - available', () => {
    mockActivePlayerCount = 1

    render(<GameCard gameType="matching" config={defaultConfig} />)

    // 1/2 players available
    expect(screen.getByText(/1\/2 player/)).toBeInTheDocument()
  })

  it('shows player availability indicator - no players', () => {
    mockActivePlayerCount = 0

    render(<GameCard gameType="matching" config={defaultConfig} />)

    expect(screen.getByText(/Select 2 players/)).toBeInTheDocument()
  })

  it('shows player availability indicator - too many', () => {
    mockActivePlayerCount = 3

    render(<GameCard gameType="matching" config={{ ...defaultConfig, maxPlayers: 2 }} />)

    expect(screen.getByText(/Too many players/)).toBeInTheDocument()
  })

  it('shows singular "player" for maxPlayers=1', () => {
    mockActivePlayerCount = 0

    render(<GameCard gameType="solo" config={{ ...defaultConfig, maxPlayers: 1 }} />)

    expect(screen.getByText(/Select 1 player/)).toBeInTheDocument()
  })

  it('limits chips to 2 max', () => {
    render(
      <GameCard gameType="matching" config={{ ...defaultConfig, chips: ['A', 'B', 'C', 'D'] }} />
    )

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.queryByText('C')).not.toBeInTheDocument()
    expect(screen.queryByText('D')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <GameCard gameType="matching" config={defaultConfig} className="custom-class" />
    )

    const card = container.firstElementChild as HTMLElement
    expect(card.className).toContain('custom-class')
  })

  it('uses name when fullName is not provided', () => {
    const configNoFullName = { ...defaultConfig, fullName: undefined }

    render(<GameCard gameType="matching" config={configNoFullName} />)

    expect(screen.getByText('Matching')).toBeInTheDocument()
  })
})
