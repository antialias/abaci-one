/**
 * Tests for GameBreakCustomConfig component.
 * Shows the customize toggle and dynamic form for game-specific settings.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { CurriculumPhase } from '@/lib/curriculum/definitions'
import { StartPracticeModalProvider, useStartPracticeModal } from '../StartPracticeModalContext'
import { GameBreakCustomConfig } from '../start-practice-modal/GameBreakCustomConfig'

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}))

// Mock hooks and dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}))

vi.mock('@/hooks/useSessionPlan', () => ({
  useGenerateSessionPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useApproveSessionPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useStartSessionPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  ActiveSessionExistsClientError: class extends Error {
    existingPlan = null
  },
  NoSkillsEnabledClientError: class extends Error {},
  sessionPlanKeys: {
    active: (id: string) => ['session-plan', 'active', id],
  },
}))

vi.mock('@/lib/arcade/practice-approved-games', () => ({
  getPracticeApprovedGames: () => [],
}))

vi.mock('@/lib/curriculum/skill-tutorial-config', () => ({
  getSkillTutorialConfig: () => null,
}))

// Mock curriculum phase for tests
const mockPhase: CurriculumPhase = {
  id: 'L1.add.+1.direct',
  levelId: 1,
  operation: 'addition',
  targetNumber: 1,
  usesFiveComplement: false,
  usesTenComplement: false,
  name: 'Direct +1',
  description: 'Learn direct addition of +1',
  primarySkillId: 'add-direct-1',
  order: 1,
}

const defaultSessionMode: SessionMode = {
  type: 'progression',
  nextSkill: { skillId: 'test-skill', displayName: 'Test Skill', pKnown: 0.8 },
  tutorialRequired: false,
  phase: mockPhase,
  skipCount: 0,
  focusDescription: 'Test focus',
}

// Games with different field types
const gamesWithConfig = [
  {
    manifest: {
      name: 'memory-quiz',
      displayName: 'Memory Quiz',
      shortName: 'Memory Quiz',
      icon: '🧠',
      practiceBreakConfig: {
        suggestedConfig: {
          selectedCount: 5,
          displayTime: 2.0,
          selectedDifficulty: 'easy',
        },
        lockedFields: [] as string[],
        difficultyPresets: {
          easy: { selectedCount: 2, displayTime: 3.0 },
          medium: { selectedCount: 5, displayTime: 2.0 },
          hard: { selectedCount: 8, displayTime: 1.5 },
        },
      },
    },
  },
  {
    manifest: {
      name: 'card-sorting',
      displayName: 'Card Sorting',
      icon: '🃏',
      practiceBreakConfig: {
        suggestedConfig: {
          cardCount: 5,
          showNumbers: false,
          gameMode: 'solo',
        },
        lockedFields: ['gameMode'], // gameMode is locked
        difficultyPresets: {
          easy: { cardCount: 5, showNumbers: true },
          medium: { cardCount: 8, showNumbers: false },
          hard: { cardCount: 12, showNumbers: false },
        },
      },
    },
  },
]

const gamesWithAllFieldsLocked = [
  {
    manifest: {
      name: 'locked-game',
      displayName: 'Locked Game',
      icon: '🔒',
      practiceBreakConfig: {
        suggestedConfig: {
          setting1: 'value1',
          setting2: 'value2',
        },
        lockedFields: ['setting1', 'setting2'], // All fields locked
        difficultyPresets: {},
      },
    },
  },
]

const gamesWithNoConfig = [
  {
    manifest: {
      name: 'no-config',
      displayName: 'No Config Game',
      icon: '🎮',
      // No practiceBreakConfig
    },
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createWrapper(games: any[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StartPracticeModalProvider
        studentId="test-student"
        studentName="Test Student"
        focusDescription="Test focus"
        sessionMode={defaultSessionMode}
        practiceApprovedGamesOverride={games}
      >
        {children}
      </StartPracticeModalProvider>
    )
  }
}

describe('GameBreakCustomConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Visibility', () => {
    it('should not render when no game is selected', () => {
      const { container } = render(<GameBreakCustomConfig />, {
        wrapper: createWrapper(gamesWithConfig),
      })

      expect(container.querySelector('[data-element="game-break-customize"]')).toBeNull()
    })

    it('should not render when game has no practiceBreakConfig', () => {
      const TestComponent = () => {
        const context = useStartPracticeModal()
        if (context.gameBreakSelectedGame !== 'no-config') {
          context.setGameBreakSelectedGame('no-config')
        }
        return <GameBreakCustomConfig />
      }

      const { container } = render(<TestComponent />, {
        wrapper: createWrapper(gamesWithNoConfig),
      })

      expect(container.querySelector('[data-element="game-break-customize"]')).toBeNull()
    })

    it('should not render when all fields are locked', () => {
      const TestComponent = () => {
        const context = useStartPracticeModal()
        if (context.gameBreakSelectedGame !== 'locked-game') {
          context.setGameBreakSelectedGame('locked-game')
        }
        return <GameBreakCustomConfig />
      }

      const { container } = render(<TestComponent />, {
        wrapper: createWrapper(gamesWithAllFieldsLocked),
      })

      expect(container.querySelector('[data-element="game-break-customize"]')).toBeNull()
    })

    it('should render Customize button when game with config is selected', () => {
      const TestComponent = () => {
        const context = useStartPracticeModal()
        if (context.gameBreakSelectedGame !== 'memory-quiz') {
          context.setGameBreakSelectedGame('memory-quiz')
        }
        return <GameBreakCustomConfig />
      }

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithConfig),
      })

      expect(screen.getByText('Customize')).toBeInTheDocument()
    })
  })

  describe('Toggle Behavior', () => {
    it('should show customize form when clicking Customize button', () => {
      const TestComponent = () => {
        const context = useStartPracticeModal()
        if (context.gameBreakSelectedGame !== 'memory-quiz') {
          context.setGameBreakSelectedGame('memory-quiz')
        }
        return <GameBreakCustomConfig />
      }

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithConfig),
      })

      // Initially form is hidden
      expect(screen.queryByTestId('game-break-custom-form')).toBeNull()

      // Click customize
      fireEvent.click(screen.getByRole('button', { name: /customize/i }))

      // Form should now be visible
      expect(screen.getByRole('button', { name: /customize/i })).toHaveAttribute(
        'data-expanded',
        'true'
      )
    })

    it('should toggle showCustomize state', () => {
      const TestComponent = () => {
        const context = useStartPracticeModal()
        if (context.gameBreakSelectedGame !== 'memory-quiz') {
          context.setGameBreakSelectedGame('memory-quiz')
        }
        return (
          <div>
            <GameBreakCustomConfig />
            <div data-testid="show-customize">{String(context.gameBreakShowCustomize)}</div>
          </div>
        )
      }

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithConfig),
      })

      expect(screen.getByTestId('show-customize').textContent).toBe('false')

      fireEvent.click(screen.getByRole('button', { name: /customize/i }))

      expect(screen.getByTestId('show-customize').textContent).toBe('true')
    })
  })

  describe('Form Fields', () => {
    it('should show field labels from FIELD_CONFIG when expanded', () => {
      const TestComponent = () => {
        const context = useStartPracticeModal()
        if (context.gameBreakSelectedGame !== 'memory-quiz') {
          context.setGameBreakSelectedGame('memory-quiz')
        }
        if (!context.gameBreakShowCustomize) {
          context.setGameBreakShowCustomize(true)
        }
        return <GameBreakCustomConfig />
      }

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithConfig),
      })

      // Check for labeled fields (from FIELD_CONFIG)
      expect(screen.getByText('Cards')).toBeInTheDocument() // selectedCount label
      expect(screen.getByText('Display Time')).toBeInTheDocument() // displayTime label
      expect(screen.getByText('Number Range')).toBeInTheDocument() // selectedDifficulty label
    })

    it('should exclude locked fields from the form', () => {
      const TestComponent = () => {
        const context = useStartPracticeModal()
        if (context.gameBreakSelectedGame !== 'card-sorting') {
          context.setGameBreakSelectedGame('card-sorting')
        }
        if (!context.gameBreakShowCustomize) {
          context.setGameBreakShowCustomize(true)
        }
        return <GameBreakCustomConfig />
      }

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithConfig),
      })

      // Should show cardCount and showNumbers
      expect(screen.getByText('Cards')).toBeInTheDocument()
      expect(screen.getByText('Show Numbers')).toBeInTheDocument()

      // Should NOT show gameMode (it's locked)
      expect(screen.queryByText('gameMode')).toBeNull()
    })
  })

  describe('Field Interactions', () => {
    it('should update boolean field when clicking Yes/No', () => {
      const TestComponent = () => {
        const context = useStartPracticeModal()
        if (context.gameBreakSelectedGame !== 'card-sorting') {
          context.setGameBreakSelectedGame('card-sorting')
        }
        if (!context.gameBreakShowCustomize) {
          context.setGameBreakShowCustomize(true)
        }
        return (
          <div>
            <GameBreakCustomConfig />
            <div data-testid="custom-config">{JSON.stringify(context.gameBreakCustomConfig)}</div>
          </div>
        )
      }

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithConfig),
      })

      // showNumbers starts as false (from config)
      const noButton = screen.getByRole('button', { name: /no/i })
      expect(noButton).toBeInTheDocument()

      // Click it to toggle to Yes
      fireEvent.click(noButton)

      // Custom config should now have showNumbers: true
      const configText = screen.getByTestId('custom-config').textContent
      expect(JSON.parse(configText ?? '{}')).toHaveProperty('showNumbers', true)
    })

    it('should update number field when clicking +/- buttons', () => {
      const TestComponent = () => {
        const context = useStartPracticeModal()
        if (context.gameBreakSelectedGame !== 'memory-quiz') {
          context.setGameBreakSelectedGame('memory-quiz')
        }
        if (!context.gameBreakShowCustomize) {
          context.setGameBreakShowCustomize(true)
        }
        return (
          <div>
            <GameBreakCustomConfig />
            <div data-testid="custom-config">{JSON.stringify(context.gameBreakCustomConfig)}</div>
          </div>
        )
      }

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithConfig),
      })

      // Find displayTime field - it should have + and - buttons
      const plusButtons = screen.getAllByRole('button', { name: '+' })
      expect(plusButtons.length).toBeGreaterThan(0)

      // Click a + button
      fireEvent.click(plusButtons[0])

      // Check that custom config was updated
      const configText = screen.getByTestId('custom-config').textContent
      expect(configText).not.toBe('{}')
    })

    it('should update select field when clicking an option', () => {
      const TestComponent = () => {
        const context = useStartPracticeModal()
        if (context.gameBreakSelectedGame !== 'memory-quiz') {
          context.setGameBreakSelectedGame('memory-quiz')
        }
        if (!context.gameBreakShowCustomize) {
          context.setGameBreakShowCustomize(true)
        }
        return (
          <div>
            <GameBreakCustomConfig />
            <div data-testid="custom-config">{JSON.stringify(context.gameBreakCustomConfig)}</div>
          </div>
        )
      }

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithConfig),
      })

      // Find a select option - the Cards field has options like 2, 5, 8, 12, 15
      const eightOption = screen.getByRole('button', { name: '8' })
      fireEvent.click(eightOption)

      // Check that custom config was updated with selectedCount: 8
      const configText = screen.getByTestId('custom-config').textContent
      expect(JSON.parse(configText ?? '{}')).toHaveProperty('selectedCount', 8)
    })
  })

  describe('Resolved Config Integration', () => {
    it('should update resolvedGameConfig when custom config changes', () => {
      const TestComponent = () => {
        const context = useStartPracticeModal()
        if (context.gameBreakSelectedGame !== 'memory-quiz') {
          context.setGameBreakSelectedGame('memory-quiz')
        }
        if (!context.gameBreakShowCustomize) {
          context.setGameBreakShowCustomize(true)
        }
        return (
          <div>
            <GameBreakCustomConfig />
            <div data-testid="resolved-config">{JSON.stringify(context.resolvedGameConfig)}</div>
          </div>
        )
      }

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithConfig),
      })

      // Change a value
      const eightOption = screen.getByRole('button', { name: '8' })
      fireEvent.click(eightOption)

      // Resolved config should reflect the change
      const resolvedText = screen.getByTestId('resolved-config').textContent
      expect(JSON.parse(resolvedText ?? '{}')).toHaveProperty('selectedCount', 8)
    })
  })
})
