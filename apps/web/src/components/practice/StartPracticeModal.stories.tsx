import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/contexts/ThemeContext'
import type {
  MaintenanceMode,
  ProgressionMode as ProgressionModeType,
  RemediationMode as RemediationModeType,
} from '@/lib/curriculum/session-mode'
import { StartPracticeModal } from './StartPracticeModal'
import { css } from '../../../styled-system/css'

// Create a fresh query client for each story
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })
}

// Mock router
const mockRouter = {
  push: (url: string) => console.log('Router push:', url),
  refresh: () => console.log('Router refresh'),
}

// Story wrapper with providers
function StoryWrapper({
  children,
  theme = 'light',
}: {
  children: React.ReactNode
  theme?: 'light' | 'dark'
}) {
  const queryClient = createQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div
          className={css({
            minHeight: '100vh',
            padding: '2rem',
            backgroundColor: theme === 'dark' ? '#1a1a2e' : '#f5f5f5',
          })}
        >
          {children}
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const meta: Meta<typeof StartPracticeModal> = {
  title: 'Practice/StartPracticeModal',
  component: StartPracticeModal,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: {
        push: mockRouter.push,
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof StartPracticeModal>

// Mock session modes for stories
const mockMaintenanceMode: MaintenanceMode = {
  type: 'maintenance',
  focusDescription: 'Mixed practice',
  skillCount: 8,
}

const mockProgressionMode: ProgressionModeType = {
  type: 'progression',
  nextSkill: { skillId: 'add-5', displayName: '+5', pKnown: 0 },
  phase: {
    id: 'L1.add.+5.direct',
    levelId: 1,
    operation: 'addition',
    targetNumber: 5,
    usesFiveComplement: false,
    usesTenComplement: false,
    name: 'Direct Addition 5',
    description: 'Learn to add 5 using direct technique',
    primarySkillId: 'add-5',
    order: 3,
  },
  tutorialRequired: true,
  skipCount: 0,
  focusDescription: 'Learning: +5',
  canSkipTutorial: true,
}

const mockRemediationMode: RemediationModeType = {
  type: 'remediation',
  weakSkills: [
    { skillId: 'add-3', displayName: '+3', pKnown: 0.35 },
    { skillId: 'add-4', displayName: '+4', pKnown: 0.42 },
  ],
  focusDescription: 'Strengthening: +3 and +4',
}

const mockRemediationModeSingleSkill: RemediationModeType = {
  type: 'remediation',
  weakSkills: [{ skillId: 'add-2', displayName: '+2', pKnown: 0.28 }],
  focusDescription: 'Strengthening: +2',
}

const mockRemediationModeManySkills: RemediationModeType = {
  type: 'remediation',
  weakSkills: [
    { skillId: 'add-1', displayName: '+1', pKnown: 0.31 },
    { skillId: 'add-2', displayName: '+2', pKnown: 0.38 },
    { skillId: 'add-3', displayName: '+3', pKnown: 0.25 },
    { skillId: 'add-4', displayName: '+4', pKnown: 0.42 },
    { skillId: 'sub-1', displayName: '-1', pKnown: 0.33 },
    { skillId: 'sub-2', displayName: '-2', pKnown: 0.29 },
  ],
  focusDescription: 'Strengthening: +1, +2, +3, +4, -1, -2',
}

// Mock games for multi-game scenarios
const mockMultipleGames = [
  {
    manifest: {
      name: 'matching',
      displayName: 'Matching Pairs Battle',
      shortName: 'Matching Pairs',
      icon: '⚔️',
    },
  },
  {
    manifest: {
      name: 'memory-quiz',
      displayName: 'Memory Quiz',
      icon: '🧠',
    },
  },
  {
    manifest: {
      name: 'complement-race',
      displayName: 'Complement Race',
      icon: '🏃',
    },
  },
]

// Single game for single-game scenarios
const mockSingleGame = [
  {
    manifest: {
      name: 'matching',
      displayName: 'Matching Pairs Battle',
      shortName: 'Matching Pairs',
      icon: '⚔️',
    },
  },
]

// Mock games WITH practiceBreakConfig for testing difficulty presets and customize
const mockGamesWithConfig = [
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
        lockedFields: [],
        minDurationMinutes: 2,
        maxDurationMinutes: 8,
        difficultyPresets: {
          easy: {
            selectedCount: 2,
            displayTime: 3.0,
            selectedDifficulty: 'beginner',
          },
          medium: {
            selectedCount: 5,
            displayTime: 2.0,
            selectedDifficulty: 'easy',
          },
          hard: {
            selectedCount: 8,
            displayTime: 1.5,
            selectedDifficulty: 'medium',
          },
        },
      },
    },
  },
  {
    manifest: {
      name: 'card-sorting',
      displayName: 'Card Sorting',
      shortName: 'Card Sort',
      icon: '🃏',
      practiceBreakConfig: {
        suggestedConfig: {
          cardCount: 5,
          showNumbers: false,
        },
        lockedFields: ['gameMode'],
        minDurationMinutes: 2,
        maxDurationMinutes: 6,
        difficultyPresets: {
          easy: { cardCount: 5, showNumbers: true },
          medium: { cardCount: 8, showNumbers: false },
          hard: { cardCount: 12, showNumbers: false },
        },
      },
    },
  },
  {
    manifest: {
      name: 'matching',
      displayName: 'Matching Pairs Battle',
      shortName: 'Matching Pairs',
      icon: '⚔️',
      practiceBreakConfig: {
        suggestedConfig: {
          difficulty: 6,
          gameType: 'abacus-numeral',
        },
        lockedFields: [],
        minDurationMinutes: 2,
        maxDurationMinutes: 10,
        difficultyPresets: {
          easy: { difficulty: 6, gameType: 'abacus-numeral' },
          medium: { difficulty: 8, gameType: 'abacus-numeral' },
          hard: { difficulty: 12, gameType: 'complement-pairs' },
        },
      },
    },
  },
]

// Single game with config for testing
const mockSingleGameWithConfig = [
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
        lockedFields: [],
        minDurationMinutes: 2,
        maxDurationMinutes: 8,
        difficultyPresets: {
          easy: {
            selectedCount: 2,
            displayTime: 3.0,
            selectedDifficulty: 'beginner',
          },
          medium: {
            selectedCount: 5,
            displayTime: 2.0,
            selectedDifficulty: 'easy',
          },
          hard: {
            selectedCount: 8,
            displayTime: 1.5,
            selectedDifficulty: 'medium',
          },
        },
      },
    },
  },
]

// Default props
const defaultProps = {
  studentId: 'test-student-1',
  studentName: 'Sonia',
  focusDescription: 'Mixed practice',
  sessionMode: mockMaintenanceMode,
  secondsPerTerm: 4,
  onClose: () => console.log('Modal closed'),
  onStarted: () => console.log('Practice started'),
  open: true,
}

/**
 * Default state - collapsed, single game (current production state)
 */
export const Default: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal {...defaultProps} practiceApprovedGamesOverride={mockSingleGame} />
    </StoryWrapper>
  ),
}

/**
 * Expanded settings - single game mode
 *
 * Shows the simplified game break UI when only one practice-approved game exists.
 */
export const ExpandedSingleGame: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal
        {...defaultProps}
        practiceApprovedGamesOverride={mockSingleGame}
        initialExpanded={true}
      />
    </StoryWrapper>
  ),
}

/**
 * Expanded settings - multiple games available
 *
 * Shows the full game break UI with selection mode toggle and game dropdown.
 */
export const ExpandedMultipleGames: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal
        {...defaultProps}
        practiceApprovedGamesOverride={mockMultipleGames}
        initialExpanded={true}
      />
    </StoryWrapper>
  ),
}

/**
 * Multiple games - dark theme
 */
export const ExpandedMultipleGamesDark: Story = {
  render: () => (
    <StoryWrapper theme="dark">
      <div data-theme="dark">
        <StartPracticeModal
          {...defaultProps}
          practiceApprovedGamesOverride={mockMultipleGames}
          initialExpanded={true}
        />
      </div>
    </StoryWrapper>
  ),
}

/**
 * Single game - dark theme
 */
export const ExpandedSingleGameDark: Story = {
  render: () => (
    <StoryWrapper theme="dark">
      <div data-theme="dark">
        <StartPracticeModal
          {...defaultProps}
          practiceApprovedGamesOverride={mockSingleGame}
          initialExpanded={true}
        />
      </div>
    </StoryWrapper>
  ),
}

/**
 * With an existing plan that can be resumed
 */
export const WithExistingPlan: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal
        {...defaultProps}
        practiceApprovedGamesOverride={mockMultipleGames}
        existingPlan={{
          id: 'plan-123',
          playerId: 'test-student-1',
          targetDurationMinutes: 10,
          estimatedProblemCount: 15,
          avgTimePerProblemSeconds: 40,
          parts: [],
          summary: {
            focusDescription: 'Five Complements',
            totalProblemCount: 15,
            estimatedMinutes: 10,
            parts: [],
          },
          masteredSkillIds: [],
          status: 'approved',
          currentPartIndex: 0,
          currentSlotIndex: 0,
          sessionHealth: null,
          adjustments: [],
          results: [],
          createdAt: new Date(),
          approvedAt: new Date(),
          startedAt: null,
          completedAt: null,
          isPaused: false,
          pausedAt: null,
          pausedBy: null,
          pauseReason: null,
          retryState: null,
          gameBreakSettings: {
            enabled: true,
            maxDurationMinutes: 5,
            selectionMode: 'kid-chooses',
            selectedGame: null,
          },
        }}
      />
    </StoryWrapper>
  ),
}

/**
 * Remediation mode - student has weak skills to strengthen (2 skills)
 */
export const RemediationMode: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal
        {...defaultProps}
        studentName="Alex"
        sessionMode={mockRemediationMode}
        focusDescription={mockRemediationMode.focusDescription}
        practiceApprovedGamesOverride={mockMultipleGames}
      />
    </StoryWrapper>
  ),
}

/**
 * Remediation mode with a single weak skill
 */
export const RemediationModeSingleSkill: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal
        {...defaultProps}
        studentName="Jordan"
        sessionMode={mockRemediationModeSingleSkill}
        focusDescription={mockRemediationModeSingleSkill.focusDescription}
        practiceApprovedGamesOverride={mockMultipleGames}
      />
    </StoryWrapper>
  ),
}

/**
 * Remediation mode with many weak skills (shows overflow)
 */
export const RemediationModeManySkills: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal
        {...defaultProps}
        studentName="Riley"
        sessionMode={mockRemediationModeManySkills}
        focusDescription={mockRemediationModeManySkills.focusDescription}
        practiceApprovedGamesOverride={mockMultipleGames}
      />
    </StoryWrapper>
  ),
}

/**
 * Remediation mode - dark theme
 */
export const RemediationModeDark: Story = {
  render: () => (
    <StoryWrapper theme="dark">
      <div data-theme="dark">
        <StartPracticeModal
          {...defaultProps}
          studentName="Alex"
          sessionMode={mockRemediationMode}
          focusDescription={mockRemediationMode.focusDescription}
          practiceApprovedGamesOverride={mockMultipleGames}
        />
      </div>
    </StoryWrapper>
  ),
}

/**
 * Progression mode - student is ready to learn a new skill
 */
export const ProgressionMode: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal
        {...defaultProps}
        studentName="Maya"
        sessionMode={mockProgressionMode}
        focusDescription={mockProgressionMode.focusDescription}
        practiceApprovedGamesOverride={mockMultipleGames}
      />
    </StoryWrapper>
  ),
}

/**
 * Documentation note about the Game Break UI modes
 */
export const GameBreakDocumentation: Story = {
  render: () => (
    <StoryWrapper>
      <div
        className={css({
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '600px',
          margin: '0 auto',
        })}
      >
        <h2
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
          })}
        >
          Game Break UI Modes
        </h2>
        <p className={css({ marginBottom: '1rem', lineHeight: 1.6 })}>
          The Game Break settings adapt based on the number of practice-approved games:
        </p>

        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
          })}
        >
          Single Game Mode
        </h3>
        <ul
          className={css({
            paddingLeft: '1.5rem',
            marginBottom: '1rem',
            lineHeight: 1.8,
          })}
        >
          <li>Game icon + name inline with duration buttons</li>
          <li>Duration options: 2m, 3m, 5m (no 10m)</li>
          <li>No selection mode toggle</li>
          <li>No game dropdown</li>
          <li>"More games coming soon!" teaser</li>
        </ul>

        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
          })}
        >
          Multiple Games Mode
        </h3>
        <ul
          className={css({
            paddingLeft: '1.5rem',
            marginBottom: '1rem',
            lineHeight: 1.8,
          })}
        >
          <li>Duration options: 2m, 3m, 5m, 10m</li>
          <li>Selection mode: Auto-start vs Kid picks</li>
          <li>Game dropdown with Random option</li>
          <li>Helper text explains selected mode</li>
        </ul>

        <p
          className={css({
            fontSize: '0.875rem',
            color: 'gray.600',
            fontStyle: 'italic',
          })}
        >
          Use <code>practiceApprovedGamesOverride</code> prop to test different game counts. In
          production, this is determined by which games have <code>practiceBreakReady: true</code>{' '}
          in their manifests AND are in the whitelist.
        </p>
      </div>
    </StoryWrapper>
  ),
}

// ================================
// GAME BREAK CONFIGURATION STORIES
// ================================

/**
 * Multiple games with practiceBreakConfig - shows difficulty presets and customize option
 *
 * This demonstrates the full game break configuration UI:
 * 1. Select a game from dropdown
 * 2. See Easy/Medium/Hard difficulty presets
 * 3. Click "Customize" to reveal game-specific settings
 */
export const GameBreakWithDifficultyPresets: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal
        {...defaultProps}
        practiceApprovedGamesOverride={mockGamesWithConfig}
        initialExpanded={true}
      />
    </StoryWrapper>
  ),
}

/**
 * Game break config in dark mode
 */
export const GameBreakWithDifficultyPresetsDark: Story = {
  render: () => (
    <StoryWrapper theme="dark">
      <div data-theme="dark">
        <StartPracticeModal
          {...defaultProps}
          practiceApprovedGamesOverride={mockGamesWithConfig}
          initialExpanded={true}
        />
      </div>
    </StoryWrapper>
  ),
}

/**
 * Single game with practiceBreakConfig
 *
 * Shows simplified single-game mode with difficulty presets.
 * The game is auto-selected, and user can choose difficulty.
 */
export const SingleGameWithDifficultyPresets: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal
        {...defaultProps}
        practiceApprovedGamesOverride={mockSingleGameWithConfig}
        initialExpanded={true}
      />
    </StoryWrapper>
  ),
}

/**
 * Single game with config - dark mode
 */
export const SingleGameWithDifficultyPresetsDark: Story = {
  render: () => (
    <StoryWrapper theme="dark">
      <div data-theme="dark">
        <StartPracticeModal
          {...defaultProps}
          practiceApprovedGamesOverride={mockSingleGameWithConfig}
          initialExpanded={true}
        />
      </div>
    </StoryWrapper>
  ),
}

/**
 * Documentation for Game Break Configuration
 */
export const GameBreakConfigDocumentation: Story = {
  render: () => (
    <StoryWrapper>
      <div
        className={css({
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '700px',
          margin: '0 auto',
        })}
      >
        <h2
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
          })}
        >
          Game Break Configuration UI
        </h2>

        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
          })}
        >
          Overview
        </h3>
        <p className={css({ marginBottom: '1rem', lineHeight: 1.6 })}>
          When a game has <code>practiceBreakConfig</code> in its manifest, additional configuration
          options appear in the practice setup modal.
        </p>

        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
          })}
        >
          Difficulty Presets
        </h3>
        <ul
          className={css({
            paddingLeft: '1.5rem',
            marginBottom: '1rem',
            lineHeight: 1.8,
          })}
        >
          <li>
            <strong>Easy / Medium / Hard</strong> buttons appear below game selection
          </li>
          <li>Selecting a preset applies predefined config values</li>
          <li>Default selection is "Medium"</li>
          <li>Presets are hidden when "Customize" is expanded</li>
        </ul>

        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
          })}
        >
          Customize Form
        </h3>
        <ul
          className={css({
            paddingLeft: '1.5rem',
            marginBottom: '1rem',
            lineHeight: 1.8,
          })}
        >
          <li>
            Click <strong>"Customize"</strong> to reveal game-specific settings
          </li>
          <li>Form fields are generated from the game's config schema</li>
          <li>
            <strong>Number fields</strong>: +/- stepper buttons
          </li>
          <li>
            <strong>Boolean fields</strong>: Yes/No toggle button
          </li>
          <li>
            <strong>Select fields</strong>: Chip-style option buttons
          </li>
          <li>
            <strong>Locked fields</strong>: Hidden from the form (not user-editable)
          </li>
        </ul>

        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
          })}
        >
          Config Resolution
        </h3>
        <ul
          className={css({
            paddingLeft: '1.5rem',
            marginBottom: '1rem',
            lineHeight: 1.8,
          })}
        >
          <li>If customize is closed: Uses selected preset config</li>
          <li>If customize is open: Uses custom form values</li>
          <li>
            Base config comes from game's <code>suggestedConfig</code>
          </li>
          <li>Preset or custom values override the base</li>
        </ul>

        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
          })}
        >
          When Random Game Selected
        </h3>
        <p className={css({ marginBottom: '1rem', lineHeight: 1.6 })}>
          No presets or customize options shown - the random game will use its own defaults.
        </p>

        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
          })}
        >
          Data Structure
        </h3>
        <pre
          className={css({
            backgroundColor: 'gray.100',
            padding: '1rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            overflow: 'auto',
          })}
        >
          {`practiceBreakConfig: {
  suggestedConfig: {
    cardCount: 5,
    showNumbers: false,
    // ... game-specific fields
  },
  lockedFields: ['gameMode'], // Fields user can't change
  difficultyPresets: {
    easy: { cardCount: 5, showNumbers: true },
    medium: { cardCount: 8, showNumbers: false },
    hard: { cardCount: 12, showNumbers: false },
  },
}`}
        </pre>
      </div>
    </StoryWrapper>
  ),
}
