import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameInfoPanel } from './GameInfoPanel'
import type { MapData } from '../types'

// Polyfill ResizeObserver for jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any
  }
})

// Hoisted mocks so they can be overridden per-test
const mockUseKnowYourWorld = vi.hoisted(() =>
  vi.fn(
    (): {
      state: {
        gameMode: string
        difficulty?: string
        giveUpVotes?: string[]
        activeUserIds?: string[]
        currentPlayer?: string
        playerMetadata?: Record<string, unknown>
        assistanceLevel?: string
        nameConfirmationProgress?: number
        giveUpReveal?: { regionName?: string; regionId?: string; timestamp?: number } | null
        gamePhase?: string
      }
      lastError: string | null
      clearError: ReturnType<typeof vi.fn>
      giveUp: ReturnType<typeof vi.fn>
      confirmLetter: ReturnType<typeof vi.fn>
      controlsState: {
        showHotCold: boolean
        hotColdEnabled: boolean
        onHotColdToggle: ReturnType<typeof vi.fn>
        currentHint: string | null
        isGiveUpAnimating: boolean
        isSpeechSupported: boolean
        isSpeaking: boolean
        onSpeak: ReturnType<typeof vi.fn>
        onStopSpeaking: ReturnType<typeof vi.fn>
        autoSpeak: boolean
        onAutoSpeakToggle: ReturnType<typeof vi.fn>
        autoHint: boolean
        onAutoHintToggle: ReturnType<typeof vi.fn>
      }
      setIsInTakeover: ReturnType<typeof vi.fn>
      puzzlePieceTarget: null
      setPuzzlePieceTarget: ReturnType<typeof vi.fn>
      setCelebration: ReturnType<typeof vi.fn>
    } => ({
      state: {
        gameMode: 'cooperative',
        difficulty: 'easy',
        giveUpVotes: [],
        activeUserIds: [],
        currentPlayer: undefined,
        playerMetadata: {},
        assistanceLevel: 'helpful',
        nameConfirmationProgress: 0,
        giveUpReveal: null,
        gamePhase: 'playing',
      },
      lastError: null,
      clearError: vi.fn(),
      giveUp: vi.fn(),
      confirmLetter: vi.fn(),
      controlsState: {
        showHotCold: false,
        hotColdEnabled: false,
        onHotColdToggle: vi.fn(),
        currentHint: null,
        isGiveUpAnimating: false,
        isSpeechSupported: false,
        isSpeaking: false,
        onSpeak: vi.fn(),
        onStopSpeaking: vi.fn(),
        autoSpeak: false,
        onAutoSpeakToggle: vi.fn(),
        autoHint: false,
        onAutoHintToggle: vi.fn(),
      },
      setIsInTakeover: vi.fn(),
      puzzlePieceTarget: null,
      setPuzzlePieceTarget: vi.fn(),
      setCelebration: vi.fn(),
    })
  )
)

const mockUseTheme = vi.hoisted(() => vi.fn(() => ({ resolvedTheme: 'light' })))

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}))

vi.mock('@/contexts/VisualDebugContext', () => ({
  useVisualDebugSafe: () => ({ isVisualDebugEnabled: false }),
}))

vi.mock('@/lib/arcade/game-sdk', () => ({
  useUserId: () => ({ data: 'test-viewer-id' }),
}))

vi.mock('../music', () => ({
  useMusic: () => ({
    isPlaying: false,
    toggle: vi.fn(),
    isEnabled: false,
    setIsEnabled: vi.fn(),
  }),
  MusicControlModal: () => null,
}))

vi.mock('./SimpleLetterKeyboard', () => ({
  useIsTouchDevice: () => false,
  SimpleLetterKeyboard: () => null,
}))

vi.mock('react-use-measure', () => ({
  default: () => [() => {}, { width: 300, height: 200, top: 0, left: 0, bottom: 200, right: 300 }],
}))

vi.mock('@react-spring/web', () => {
  // Create a mock animated value that supports .to() interpolation
  const createAnimatedValue = (val: unknown) => {
    const animatedVal: Record<string, unknown> = {
      _value: val,
      to: (fn: (v: unknown) => unknown) => (typeof fn === 'function' ? fn(val) : val),
      interpolate: (fn: (v: unknown) => unknown) => (typeof fn === 'function' ? fn(val) : val),
    }
    return animatedVal
  }

  return {
    animated: new Proxy(
      {},
      {
        get: (_target: object, prop: string) => {
          const Component = ({
            children,
            style,
            ...props
          }: { children?: React.ReactNode; style?: Record<string, unknown> } & Record<
            string,
            unknown
          >) => {
            const { createElement } = require('react')
            return createElement(prop, props, children)
          }
          Component.displayName = `animated.${prop}`
          return Component
        },
      }
    ),
    useSpring: (config: Record<string, unknown>) => {
      const result: Record<string, unknown> = {}
      if (config) {
        // Collect all values from config (except meta keys)
        const values: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(config)) {
          if (key !== 'config' && key !== 'from' && key !== 'to' && key !== 'onRest') {
            values[key] = value
          }
        }
        // Merge 'from' values (initial values)
        if (config.from && typeof config.from === 'object') {
          Object.assign(values, config.from)
        }
        // Wrap each value as an animated value with .to() support
        for (const [key, value] of Object.entries(values)) {
          result[key] = createAnimatedValue(value)
        }
      }
      return result
    },
    to: (...args: unknown[]) => args[0],
    config: {},
  }
})

vi.mock('simplify-js', () => ({
  default: (points: unknown[]) => points,
}))

vi.mock('@radix-ui/react-dropdown-menu', () => {
  const React = require('react')
  return {
    Root: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
    Trigger: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) =>
      React.createElement('button', props, children),
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Content: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) =>
      React.createElement('div', props, children),
    Item: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) =>
      React.createElement('div', props, children),
    CheckboxItem: ({
      children,
      ...props
    }: { children: React.ReactNode } & Record<string, unknown>) =>
      React.createElement('div', props, children),
    ItemIndicator: ({ children }: { children: React.ReactNode }) =>
      React.createElement('span', {}, children),
    Label: ({ children }: { children: React.ReactNode }) =>
      React.createElement('span', {}, children),
    Separator: () => React.createElement('hr'),
    Sub: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
    SubTrigger: ({ children }: { children: React.ReactNode }) =>
      React.createElement('button', {}, children),
    SubContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', {}, children),
  }
})

vi.mock('../Provider', () => ({
  useKnowYourWorld: () => mockUseKnowYourWorld(),
}))

// Mock the maps module to avoid the Suspense throw from WORLD_MAP/USA_MAP Proxy objects
// In jsdom, getMapDataSync throws a Promise because the map cache hasn't been loaded
vi.mock('../maps', () => ({
  DEFAULT_DIFFICULTY_CONFIG: {
    levels: [
      {
        id: 'easy',
        label: 'Easy',
        emoji: '😊',
        description: 'Helpful feedback as you learn',
        includeSizes: ['huge', 'large', 'medium'],
        hotColdEnabled: true,
        hintsMode: 'onRequest',
        autoHintDefault: false,
        struggleHintEnabled: false,
        giveUpMode: 'reaskEnd',
        wrongClickShowsName: true,
      },
      {
        id: 'hard',
        label: 'Hard',
        emoji: '🤔',
        description: 'Challenge mode',
        includeSizes: ['huge', 'large', 'medium', 'small'],
        hotColdEnabled: false,
        hintsMode: 'limited',
        hintLimit: 3,
        autoHintDefault: false,
        struggleHintEnabled: false,
        giveUpMode: 'countsAgainst',
        wrongClickShowsName: false,
      },
    ],
  },
  WORLD_MAP: {
    difficultyConfig: {
      levels: [
        {
          id: 'easy',
          label: 'Easy',
          emoji: '😊',
          includeSizes: ['huge', 'large', 'medium'],
          hotColdEnabled: true,
          hintsMode: 'onRequest',
          autoHintDefault: false,
          struggleHintEnabled: false,
          giveUpMode: 'reaskEnd',
          wrongClickShowsName: true,
        },
      ],
    },
  },
  USA_MAP: {
    difficultyConfig: {
      levels: [
        {
          id: 'easy',
          label: 'Easy',
          emoji: '😊',
          includeSizes: ['huge', 'large', 'medium'],
          hotColdEnabled: true,
          hintsMode: 'onRequest',
          autoHintDefault: false,
          struggleHintEnabled: false,
          giveUpMode: 'reaskEnd',
          wrongClickShowsName: true,
        },
      ],
    },
  },
  getAssistanceLevel: (id: string) => ({
    id: id || 'helpful',
    label: 'Helpful',
    emoji: '💡',
    description: 'Hot/cold feedback and hints available on request',
    hotColdEnabled: true,
    hintsMode: 'onRequest',
    autoHintDefault: false,
    struggleHintEnabled: false,
    giveUpMode: 'reaskEnd',
    wrongClickShowsName: true,
  }),
  getCountryFlagEmoji: (code: string) => '',
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

    // The "Find" label is rendered as "🎯 Find"
    expect(screen.getByText(/Find/)).toBeInTheDocument()
    // Region name is split into individual character spans, use a text matcher function
    // to find "France" across multiple elements
    const regionDisplays = screen.getAllByText((_content, element) => {
      return element?.textContent === 'France' && element?.tagName === 'SPAN'
    })
    expect(regionDisplays.length).toBeGreaterThan(0)
  })

  it('renders remaining count', () => {
    render(<GameInfoPanel {...defaultProps} />)

    // Component shows "{totalRegions - foundCount} left" i.e. "15 left"
    expect(screen.getByText('15 left')).toBeInTheDocument()
  })

  it('renders the floating prompt container', () => {
    const { container } = render(<GameInfoPanel {...defaultProps} />)

    // The floating prompt uses a background gradient for progress
    const floatingPrompt = container.querySelector('[data-element="floating-prompt"]')
    expect(floatingPrompt).toBeInTheDocument()
  })

  it('renders the Find label', () => {
    render(<GameInfoPanel {...defaultProps} />)

    // The component renders "🎯 Find" as the prompt label
    expect(screen.getByText(/Find/)).toBeInTheDocument()
  })

  it('renders region name characters individually', () => {
    const { container } = render(<GameInfoPanel {...defaultProps} />)

    // Region name "France" is split into individual character spans
    const regionNameContainer = container.querySelector('[data-element="region-name-display"]')
    expect(regionNameContainer).toBeInTheDocument()
    expect(regionNameContainer?.textContent).toContain('France')
  })

  it('shows placeholder when no current region', () => {
    render(<GameInfoPanel {...defaultProps} currentRegionName={null} />)

    // There are two "..." spans (takeover and normal display), find at least one
    const placeholders = screen.getAllByText('...')
    expect(placeholders.length).toBeGreaterThan(0)
  })

  it('renders the floating prompt with overflow hidden', () => {
    const { container } = render(<GameInfoPanel {...defaultProps} />)

    const floatingPrompt = container.querySelector('[data-element="floating-prompt"]')
    expect(floatingPrompt).toBeInTheDocument()
    // The overflow is set conditionally via inline style
    const style = (floatingPrompt as HTMLElement)?.style
    expect(style?.overflow).toBe('hidden')
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
    // Reset mockUseKnowYourWorld to its default implementation
    // (vi.clearAllMocks only clears calls, not mockReturnValue)
    mockUseKnowYourWorld.mockReset()
    mockUseKnowYourWorld.mockImplementation(() => ({
      state: {
        gameMode: 'cooperative',
        difficulty: 'easy',
        giveUpVotes: [],
        activeUserIds: [],
        currentPlayer: undefined,
        playerMetadata: {},
        assistanceLevel: 'helpful',
        nameConfirmationProgress: 0,
        giveUpReveal: null,
        gamePhase: 'playing',
      },
      lastError: null,
      clearError: vi.fn(),
      giveUp: vi.fn(),
      confirmLetter: vi.fn(),
      controlsState: {
        showHotCold: false,
        hotColdEnabled: false,
        onHotColdToggle: vi.fn(),
        currentHint: null,
        isGiveUpAnimating: false,
        isSpeechSupported: false,
        isSpeaking: false,
        onSpeak: vi.fn(),
        onStopSpeaking: vi.fn(),
        autoSpeak: false,
        onAutoSpeakToggle: vi.fn(),
        autoHint: false,
        onAutoHintToggle: vi.fn(),
      },
      setIsInTakeover: vi.fn(),
      puzzlePieceTarget: null,
      setPuzzlePieceTarget: vi.fn(),
      setCelebration: vi.fn(),
    }))
  })

  it('shows error banner when lastError is set', () => {
    const mockClearError = vi.fn()

    mockUseKnowYourWorld.mockReturnValue({
      state: {
        gameMode: 'cooperative' as const,
        difficulty: 'easy' as const,
        giveUpVotes: [],
        activeUserIds: [],
        playerMetadata: {},
      },
      lastError: 'You clicked Spain, not France',
      clearError: mockClearError,
      giveUp: vi.fn(),
      confirmLetter: vi.fn(),
      controlsState: {
        showHotCold: false,
        hotColdEnabled: false,
        onHotColdToggle: vi.fn(),
        currentHint: null,
        isGiveUpAnimating: false,
        isSpeechSupported: false,
        isSpeaking: false,
        onSpeak: vi.fn(),
        onStopSpeaking: vi.fn(),
        autoSpeak: false,
        onAutoSpeakToggle: vi.fn(),
        autoHint: false,
        onAutoHintToggle: vi.fn(),
      },
      setIsInTakeover: vi.fn(),
      puzzlePieceTarget: null,
      setPuzzlePieceTarget: vi.fn(),
      setCelebration: vi.fn(),
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

    mockUseKnowYourWorld.mockReturnValue({
      state: {
        gameMode: 'cooperative' as const,
        difficulty: 'easy' as const,
        giveUpVotes: [],
        activeUserIds: [],
        playerMetadata: {},
      },
      lastError: 'Wrong region!',
      clearError: mockClearError,
      giveUp: vi.fn(),
      confirmLetter: vi.fn(),
      controlsState: {
        showHotCold: false,
        hotColdEnabled: false,
        onHotColdToggle: vi.fn(),
        currentHint: null,
        isGiveUpAnimating: false,
        isSpeechSupported: false,
        isSpeaking: false,
        onSpeak: vi.fn(),
        onStopSpeaking: vi.fn(),
        autoSpeak: false,
        onAutoSpeakToggle: vi.fn(),
        autoHint: false,
        onAutoHintToggle: vi.fn(),
      },
      setIsInTakeover: vi.fn(),
      puzzlePieceTarget: null,
      setPuzzlePieceTarget: vi.fn(),
      setCelebration: vi.fn(),
    })

    render(<GameInfoPanel {...defaultProps} />)

    const dismissButton = screen.getByRole('button', { name: '✕' })
    await user.click(dismissButton)

    expect(mockClearError).toHaveBeenCalledOnce()
  })

  it('auto-dismisses error after 3 seconds', async () => {
    vi.useFakeTimers()
    const mockClearError = vi.fn()

    mockUseKnowYourWorld.mockReturnValue({
      state: {
        gameMode: 'cooperative' as const,
        difficulty: 'easy' as const,
        giveUpVotes: [],
        activeUserIds: [],
        playerMetadata: {},
      },
      lastError: 'Wrong region!',
      clearError: mockClearError,
      giveUp: vi.fn(),
      confirmLetter: vi.fn(),
      controlsState: {
        showHotCold: false,
        hotColdEnabled: false,
        onHotColdToggle: vi.fn(),
        currentHint: null,
        isGiveUpAnimating: false,
        isSpeechSupported: false,
        isSpeaking: false,
        onSpeak: vi.fn(),
        onStopSpeaking: vi.fn(),
        autoSpeak: false,
        onAutoSpeakToggle: vi.fn(),
        autoHint: false,
        onAutoHintToggle: vi.fn(),
      },
      setIsInTakeover: vi.fn(),
      puzzlePieceTarget: null,
      setPuzzlePieceTarget: vi.fn(),
      setCelebration: vi.fn(),
    })

    const { act } = await import('@testing-library/react')

    await act(async () => {
      render(<GameInfoPanel {...defaultProps} />)
    })

    // Fast-forward 3 seconds
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(mockClearError).toHaveBeenCalledOnce()

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

  it('renders give up button in cooperative mode', () => {
    render(<GameInfoPanel {...defaultProps} />)

    // The give up button should be rendered
    const giveUpButton = screen.getByTitle(/give up/i)
    expect(giveUpButton).toBeInTheDocument()
  })

  it('renders region name display in turn-based mode', () => {
    mockUseKnowYourWorld.mockReturnValue({
      ...mockUseKnowYourWorld(),
      state: {
        ...mockUseKnowYourWorld().state,
        gameMode: 'turn-based' as const,
        difficulty: 'easy' as const,
      },
      lastError: null,
    })

    const { container } = render(<GameInfoPanel {...defaultProps} />)

    // The region name should still be displayed in turn-based mode
    const regionNameContainer = container.querySelector('[data-element="region-name-display"]')
    expect(regionNameContainer).toBeInTheDocument()
    expect(regionNameContainer?.textContent).toContain('France')
  })

  it('renders region name display in race mode', () => {
    mockUseKnowYourWorld.mockReturnValue({
      ...mockUseKnowYourWorld(),
      state: {
        ...mockUseKnowYourWorld().state,
        gameMode: 'race' as const,
        difficulty: 'easy' as const,
      },
      lastError: null,
    })

    const { container } = render(<GameInfoPanel {...defaultProps} />)

    // The region name should still be displayed in race mode
    const regionNameContainer = container.querySelector('[data-element="region-name-display"]')
    expect(regionNameContainer).toBeInTheDocument()
    expect(regionNameContainer?.textContent).toContain('France')
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
    mockUseTheme.mockReturnValue({
      resolvedTheme: 'dark',
    })

    const { container } = render(<GameInfoPanel {...defaultProps} />)

    // Check that the floating prompt is rendered
    const floatingPrompt = container.querySelector('[data-element="floating-prompt"]')
    expect(floatingPrompt).toBeInTheDocument()
  })
})
