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

        <h3 className={css({ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' })}>
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

        <h3 className={css({ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' })}>
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
          production, this is determined by which games have{' '}
          <code>practiceBreakReady: true</code> in their manifests AND are in the whitelist.
        </p>
      </div>
    </StoryWrapper>
  ),
}
