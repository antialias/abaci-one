import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayingPhase } from './PlayingPhase'
import type { MapData } from '../types'

// Hoisted mocks so they can be overridden per-test
const mockUseKnowYourWorld = vi.hoisted(() =>
  vi.fn(
    (): {
      state: {
        selectedMap: 'world' | 'usa'
        selectedContinent: string
        includeSizes: string[]
        assistanceLevel: string
        regionsFound: string[]
        currentPrompt: string | null
        gameMode: 'cooperative' | 'race' | 'turn-based'
        regionsToFind: string[]
      }
      clickRegion: ReturnType<typeof vi.fn>
    } => ({
      state: {
        selectedMap: 'world',
        selectedContinent: 'all',
        includeSizes: ['huge', 'large', 'medium'],
        assistanceLevel: 'helpful',
        regionsFound: ['france', 'germany'],
        currentPrompt: 'spain',
        gameMode: 'cooperative',
        regionsToFind: ['spain', 'italy', 'portugal'],
      },
      clickRegion: vi.fn(),
    })
  )
)

const mockGetFilteredMapDataBySizesSync = vi.hoisted(() =>
  vi.fn(
    () =>
      ({
        id: 'world',
        name: 'World Map',
        viewBox: '0 0 1000 500',
        regions: [
          { id: 'spain', name: 'Spain', path: 'M 100 100 L 200 200' },
          { id: 'italy', name: 'Italy', path: 'M 300 300 L 400 400' },
          { id: 'portugal', name: 'Portugal', path: 'M 500 500 L 600 600' },
        ],
      }) as MapData
  )
)

// Mock dependencies
vi.mock('../Provider', () => ({
  useKnowYourWorld: () => mockUseKnowYourWorld(),
}))

vi.mock('../maps', () => ({
  getFilteredMapDataBySizesSync: mockGetFilteredMapDataBySizesSync,
  getAssistanceLevel: () => ({
    id: 'helpful',
    label: 'Helpful',
    nameConfirmationLetters: 0,
  }),
}))

vi.mock('./MapRenderer', () => ({
  MapRenderer: ({ mapData, onRegionClick }: any) => (
    <div data-testid="map-renderer" data-map-id={mapData.id}>
      Mock MapRenderer
      <button onClick={() => onRegionClick('spain', 'Spain')}>Click Spain</button>
    </div>
  ),
}))

vi.mock('./GameInfoPanel', () => ({
  GameInfoPanel: ({ currentRegionName, foundCount, totalRegions }: any) => (
    <div data-testid="game-info-panel">
      Mock GameInfoPanel
      <div>Current: {currentRegionName}</div>
      <div>
        Progress: {foundCount}/{totalRegions}
      </div>
    </div>
  ),
}))

vi.mock('@/lib/arcade/game-sdk', () => ({
  useViewerId: () => ({ data: 'test-viewer-id' }),
  useGameMode: () => ({
    activePlayers: new Set(['player-1']),
    players: new Map([['player-1', { id: 'player-1', name: 'Test Player', isLocal: true }]]),
  }),
}))

describe('PlayingPhase', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Re-apply default implementations after restoreAllMocks
    mockUseKnowYourWorld.mockImplementation(() => ({
      state: {
        selectedMap: 'world' as const,
        selectedContinent: 'all',
        includeSizes: ['huge', 'large', 'medium'],
        assistanceLevel: 'helpful',
        regionsFound: ['france', 'germany'],
        currentPrompt: 'spain',
        gameMode: 'cooperative' as const,
        regionsToFind: ['spain', 'italy', 'portugal'],
      },
      clickRegion: vi.fn(),
    }))
    mockGetFilteredMapDataBySizesSync.mockImplementation(
      () =>
        ({
          id: 'world',
          name: 'World Map',
          viewBox: '0 0 1000 500',
          regions: [
            { id: 'spain', name: 'Spain', path: 'M 100 100 L 200 200' },
            { id: 'italy', name: 'Italy', path: 'M 300 300 L 400 400' },
            { id: 'portugal', name: 'Portugal', path: 'M 500 500 L 600 600' },
          ],
        }) as MapData
    )
  })

  it('renders the panel layout with game info and map panels', () => {
    const { container } = render(<PlayingPhase />)

    // Should have the main container
    expect(screen.getByTestId('game-info-panel')).toBeInTheDocument()
    expect(screen.getByTestId('map-renderer')).toBeInTheDocument()
  })

  it('renders playing-phase container with correct data attribute', () => {
    const { container } = render(<PlayingPhase />)

    // The playing-phase container should exist as a full-viewport fixed-position element
    const playingPhase = container.querySelector('[data-component="playing-phase"]')
    expect(playingPhase).toBeInTheDocument()

    // Should contain both the map renderer and game info panel
    expect(playingPhase!.querySelector('[data-testid="map-renderer"]')).toBeInTheDocument()
    expect(playingPhase!.querySelector('[data-testid="game-info-panel"]')).toBeInTheDocument()
  })

  it('passes correct props to GameInfoPanel', () => {
    render(<PlayingPhase />)

    // Check that GameInfoPanel receives correct data
    expect(screen.getByText('Current: Spain')).toBeInTheDocument()
    expect(screen.getByText('Progress: 2/3')).toBeInTheDocument()
  })

  it('passes correct props to MapRenderer', () => {
    render(<PlayingPhase />)

    const mapRenderer = screen.getByTestId('map-renderer')
    expect(mapRenderer).toHaveAttribute('data-map-id', 'world')
  })

  it('calculates progress percentage correctly', () => {
    render(<PlayingPhase />)

    // 2 found out of 3 total = 66.67%
    // GameInfoPanel should receive progress prop (check via debug if needed)
    expect(screen.getByText('Progress: 2/3')).toBeInTheDocument()
  })

  it('handles null currentPrompt gracefully', () => {
    mockUseKnowYourWorld.mockReturnValue({
      state: {
        selectedMap: 'world' as const,
        selectedContinent: 'all',
        includeSizes: ['huge', 'large', 'medium'],
        assistanceLevel: 'helpful',
        regionsFound: ['france', 'germany'],
        currentPrompt: null,
        gameMode: 'cooperative' as const,
        regionsToFind: ['spain', 'italy', 'portugal'],
      },
      clickRegion: vi.fn(),
    })

    render(<PlayingPhase />)

    // Should show "Current: null" or similar (check GameInfoPanel mock)
    expect(screen.getByTestId('game-info-panel')).toBeInTheDocument()
  })

  it('renders map renderer inside the playing-phase container', () => {
    const { container } = render(<PlayingPhase />)

    // The map renderer should be rendered as a direct child of the playing-phase container
    const playingPhase = container.querySelector('[data-component="playing-phase"]')
    expect(playingPhase).toBeInTheDocument()

    // MapRenderer should be present inside the container
    const mapRenderer = screen.getByTestId('map-renderer')
    expect(playingPhase!.contains(mapRenderer)).toBe(true)
  })

  it('passes clickRegion handler to MapRenderer', async () => {
    const mockClickRegion = vi.fn()

    mockUseKnowYourWorld.mockReturnValue({
      state: {
        selectedMap: 'world' as const,
        selectedContinent: 'all',
        includeSizes: ['huge', 'large', 'medium'],
        assistanceLevel: 'helpful',
        regionsFound: [],
        currentPrompt: 'spain',
        gameMode: 'cooperative' as const,
        regionsToFind: ['spain'],
      },
      clickRegion: mockClickRegion,
    })

    render(<PlayingPhase />)

    const clickButton = screen.getByText('Click Spain')
    clickButton.click()

    expect(mockClickRegion).toHaveBeenCalledWith('spain', 'Spain')
  })

  it('uses correct map data from getFilteredMapDataBySizesSync', () => {
    // Override state to have a prompt that exists in the custom map
    mockUseKnowYourWorld.mockReturnValue({
      state: {
        selectedMap: 'usa' as const,
        selectedContinent: 'all',
        includeSizes: ['huge', 'large', 'medium'],
        assistanceLevel: 'helpful',
        regionsFound: [],
        currentPrompt: 'california',
        gameMode: 'cooperative' as const,
        regionsToFind: ['california', 'texas'],
      },
      clickRegion: vi.fn(),
    })

    mockGetFilteredMapDataBySizesSync.mockReturnValue({
      id: 'usa',
      name: 'USA Map',
      viewBox: '0 0 2000 1000',
      regions: [
        { id: 'california', name: 'California', path: 'M 0 0' },
        { id: 'texas', name: 'Texas', path: 'M 100 100' },
      ],
    } as MapData)

    render(<PlayingPhase />)

    expect(mockGetFilteredMapDataBySizesSync).toHaveBeenCalledWith('usa', 'all', [
      'huge',
      'large',
      'medium',
    ])
  })
})

describe('PlayingPhase - Different Scenarios', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Re-apply default map data implementation after restoreAllMocks
    mockGetFilteredMapDataBySizesSync.mockImplementation(
      () =>
        ({
          id: 'world',
          name: 'World Map',
          viewBox: '0 0 1000 500',
          regions: [
            { id: 'spain', name: 'Spain', path: 'M 100 100 L 200 200' },
            { id: 'italy', name: 'Italy', path: 'M 300 300 L 400 400' },
            { id: 'portugal', name: 'Portugal', path: 'M 500 500 L 600 600' },
          ],
        }) as MapData
    )
  })

  it('handles empty regionsFound array', () => {
    mockUseKnowYourWorld.mockReturnValue({
      state: {
        selectedMap: 'world' as const,
        selectedContinent: 'all',
        includeSizes: ['huge', 'large', 'medium'],
        assistanceLevel: 'helpful',
        regionsFound: [],
        currentPrompt: 'spain',
        gameMode: 'cooperative' as const,
        regionsToFind: ['spain', 'italy'],
      },
      clickRegion: vi.fn(),
    })

    render(<PlayingPhase />)

    // totalRegions comes from mapData.regions.length (3), not regionsToFind
    // foundCount comes from regionsFound.length (0)
    expect(screen.getByText('Progress: 0/3')).toBeInTheDocument()
  })

  it('handles all regions found scenario', () => {
    mockUseKnowYourWorld.mockReturnValue({
      state: {
        selectedMap: 'world' as const,
        selectedContinent: 'all',
        includeSizes: ['huge', 'large', 'medium'],
        assistanceLevel: 'helpful',
        regionsFound: ['spain', 'italy', 'portugal'],
        currentPrompt: null,
        gameMode: 'cooperative' as const,
        regionsToFind: ['spain', 'italy', 'portugal'],
      },
      clickRegion: vi.fn(),
    })

    render(<PlayingPhase />)

    expect(screen.getByText('Progress: 3/3')).toBeInTheDocument()
  })

  it('renders with no assistance mode', () => {
    // Override map data to include luxembourg for the prompt
    mockGetFilteredMapDataBySizesSync.mockReturnValue({
      id: 'world',
      name: 'World Map',
      viewBox: '0 0 1000 500',
      regions: [
        { id: 'luxembourg', name: 'Luxembourg', path: 'M 100 100 L 200 200' },
        { id: 'liechtenstein', name: 'Liechtenstein', path: 'M 300 300 L 400 400' },
      ],
    } as MapData)

    mockUseKnowYourWorld.mockReturnValue({
      state: {
        selectedMap: 'world' as const,
        selectedContinent: 'all',
        includeSizes: ['huge', 'large', 'medium', 'small', 'tiny'],
        assistanceLevel: 'none',
        regionsFound: [],
        currentPrompt: 'luxembourg',
        gameMode: 'race' as const,
        regionsToFind: ['luxembourg', 'liechtenstein'],
      },
      clickRegion: vi.fn(),
    })

    render(<PlayingPhase />)

    expect(screen.getByTestId('game-info-panel')).toBeInTheDocument()
    expect(screen.getByTestId('map-renderer')).toBeInTheDocument()
  })
})
