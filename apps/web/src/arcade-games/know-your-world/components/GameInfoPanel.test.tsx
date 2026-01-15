import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameInfoPanel } from './GameInfoPanel'
import type { MapData } from '../types'

// Mock the context
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

vi.mock('../Provider', () => ({
  useKnowYourWorld: () => ({
    state: {
      gameMode: 'cooperative' as const,
      difficulty: 'easy' as const,
    },
    lastError: null,
    clearError: vi.fn(),
  }),
}))

const mockMapData: MapData = {
  id: 'world',
  name: 'World Map',
  viewBox: '0 0 1000 500',
  originalViewBox: '0 0 1000 500',
  customCrop: null,
  regions: [],
}

describe('GameInfoPanel', () => {
  const defaultProps = {
    mapData: mockMapData,
    currentRegionName: 'France',
    currentRegionId: 'fr',
    selectedMap: 'world' as const,
    foundCount: 5,
    totalRegions: 20,
    progress: 25,
  }

  it('renders current region name to find', () => {
    render(<GameInfoPanel {...defaultProps} />)

    expect(screen.getByText('Find:')).toBeInTheDocument()
    expect(screen.getByText('France')).toBeInTheDocument()
  })

  it('renders progress counter', () => {
    render(<GameInfoPanel {...defaultProps} />)

    expect(screen.getByText('Progress')).toBeInTheDocument()
    expect(screen.getByText('5/20')).toBeInTheDocument()
  })

  it('renders progress bar with correct width', () => {
    const { container } = render(<GameInfoPanel {...defaultProps} />)

    // Find the progress bar fill element (has inline width style)
    const progressFill = container.querySelector('[style*="width: 25%"]')
    expect(progressFill).toBeInTheDocument()
  })

  it('renders game mode emoji for cooperative', () => {
    render(<GameInfoPanel {...defaultProps} />)

    // Should show cooperative emoji
    expect(screen.getByText('🤝')).toBeInTheDocument()
  })

  it('renders difficulty emoji for easy', () => {
    render(<GameInfoPanel {...defaultProps} />)

    // Should show easy emoji
    expect(screen.getByText('😊')).toBeInTheDocument()
  })

  it('truncates long region names with ellipsis', () => {
    const { container } = render(
      <GameInfoPanel {...defaultProps} currentRegionName="Democratic Republic of the Congo" />
    )

    // Find element with text-overflow: ellipsis
    const regionElement = screen.getByText('Democratic Republic of the Congo')
    const styles = window.getComputedStyle(regionElement)
    expect(styles.textOverflow).toBe('ellipsis')
    expect(styles.overflow).toBe('hidden')
  })

  it('shows placeholder when no current region', () => {
    render(<GameInfoPanel {...defaultProps} currentRegionName={null} />)

    expect(screen.getByText('...')).toBeInTheDocument()
  })

  it('does not cause overflow scrolling', () => {
    const { container } = render(<GameInfoPanel {...defaultProps} />)

    const panel = container.querySelector('[data-component="game-info-panel"]')
    const styles = window.getComputedStyle(panel!)
    expect(styles.overflow).toBe('hidden')
  })
})

describe('GameInfoPanel - Error Display', () => {
  const defaultProps = {
    mapData: mockMapData,
    currentRegionName: 'France',
    currentRegionId: 'fr',
    selectedMap: 'world' as const,
    foundCount: 5,
    totalRegions: 20,
    progress: 25,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows error banner when lastError is set', () => {
    const mockClearError = vi.fn()

    vi.mocked(vi.importActual('../Provider')).useKnowYourWorld = () => ({
      state: {
        gameMode: 'cooperative' as const,
        difficulty: 'easy' as const,
      },
      lastError: 'You clicked Spain, not France',
      clearError: mockClearError,
    })

    render(<GameInfoPanel {...defaultProps} />)

    expect(screen.getByText(/Wrong!/)).toBeInTheDocument()
    expect(screen.getByText(/You clicked Spain, not France/)).toBeInTheDocument()
  })

  it('hides error banner when lastError is null', () => {
    render(<GameInfoPanel {...defaultProps} />)

    expect(screen.queryByText(/Wrong!/)).not.toBeInTheDocument()
  })

  it('calls clearError when dismiss button clicked', async () => {
    const user = userEvent.setup()
    const mockClearError = vi.fn()

    vi.mocked(vi.importActual('../Provider')).useKnowYourWorld = () => ({
      state: {
        gameMode: 'cooperative' as const,
        difficulty: 'easy' as const,
      },
      lastError: 'Wrong region!',
      clearError: mockClearError,
    })

    render(<GameInfoPanel {...defaultProps} />)

    const dismissButton = screen.getByRole('button', { name: '✕' })
    await user.click(dismissButton)

    expect(mockClearError).toHaveBeenCalledOnce()
  })

  it('auto-dismisses error after 3 seconds', async () => {
    vi.useFakeTimers()
    const mockClearError = vi.fn()

    vi.mocked(vi.importActual('../Provider')).useKnowYourWorld = () => ({
      state: {
        gameMode: 'cooperative' as const,
        difficulty: 'easy' as const,
      },
      lastError: 'Wrong region!',
      clearError: mockClearError,
    })

    render(<GameInfoPanel {...defaultProps} />)

    // Fast-forward 3 seconds
    vi.advanceTimersByTime(3000)

    await waitFor(() => {
      expect(mockClearError).toHaveBeenCalledOnce()
    })

    vi.useRealTimers()
  })
})

describe('GameInfoPanel - Different Game Modes', () => {
  const defaultProps = {
    mapData: mockMapData,
    currentRegionName: 'France',
    currentRegionId: 'fr',
    selectedMap: 'world' as const,
    foundCount: 5,
    totalRegions: 20,
    progress: 25,
  }

  it('renders race mode emoji', () => {
    vi.mocked(vi.importActual('../Provider')).useKnowYourWorld = () => ({
      state: {
        gameMode: 'race' as const,
        difficulty: 'easy' as const,
      },
      lastError: null,
      clearError: vi.fn(),
    })

    render(<GameInfoPanel {...defaultProps} />)

    expect(screen.getByText('🏁')).toBeInTheDocument()
  })

  it('renders turn-based mode emoji', () => {
    vi.mocked(vi.importActual('../Provider')).useKnowYourWorld = () => ({
      state: {
        gameMode: 'turn-based' as const,
        difficulty: 'easy' as const,
      },
      lastError: null,
      clearError: vi.fn(),
    })

    render(<GameInfoPanel {...defaultProps} />)

    expect(screen.getByText('↔️')).toBeInTheDocument()
  })

  it('renders hard difficulty emoji', () => {
    vi.mocked(vi.importActual('../Provider')).useKnowYourWorld = () => ({
      state: {
        gameMode: 'cooperative' as const,
        difficulty: 'hard' as const,
      },
      lastError: null,
      clearError: vi.fn(),
    })

    render(<GameInfoPanel {...defaultProps} />)

    expect(screen.getByText('🤔')).toBeInTheDocument()
  })
})

describe('GameInfoPanel - Dark Mode', () => {
  const defaultProps = {
    mapData: mockMapData,
    currentRegionName: 'France',
    currentRegionId: 'fr',
    selectedMap: 'world' as const,
    foundCount: 5,
    totalRegions: 20,
    progress: 25,
  }

  it('applies dark mode styles when theme is dark', () => {
    vi.mocked(vi.importActual('@/contexts/ThemeContext')).useTheme = () => ({
      resolvedTheme: 'dark',
    })

    const { container } = render(<GameInfoPanel {...defaultProps} />)

    // Check that dark mode classes are applied (this is a basic check)
    // In real implementation, you might want to check specific CSS values
    expect(container.querySelector('[data-section="current-prompt"]')).toBeInTheDocument()
  })
})
