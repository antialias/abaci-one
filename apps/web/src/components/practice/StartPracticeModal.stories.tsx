import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/contexts/ThemeContext'
import type {
  MaintenanceMode,
  ProgressionMode,
  RemediationMode,
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

const mockProgressionMode: ProgressionMode = {
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

const mockRemediationMode: RemediationMode = {
  type: 'remediation',
  weakSkills: [
    { skillId: 'add-3', displayName: '+3', pKnown: 0.35 },
    { skillId: 'add-4', displayName: '+4', pKnown: 0.42 },
  ],
  focusDescription: 'Strengthening: +3 and +4',
}

const mockRemediationModeSingleSkill: RemediationMode = {
  type: 'remediation',
  weakSkills: [{ skillId: 'add-2', displayName: '+2', pKnown: 0.28 }],
  focusDescription: 'Strengthening: +2',
}

const mockRemediationModeManySkills: RemediationMode = {
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
 * Default state - no existing plan, no new skill ready
 */
export const Default: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal {...defaultProps} />
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
        }}
      />
    </StoryWrapper>
  ),
}

/**
 * Dark theme variant
 */
export const DarkTheme: Story = {
  render: () => (
    <StoryWrapper theme="dark">
      <div data-theme="dark">
        <StartPracticeModal {...defaultProps} />
      </div>
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
      />
    </StoryWrapper>
  ),
}

/**
 * Documentation note about the SessionMode system
 */
export const DocumentationNote: Story = {
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
        <h2 className={css({ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' })}>
          Session Mode System
        </h2>
        <p className={css({ marginBottom: '1rem', lineHeight: 1.6 })}>
          The StartPracticeModal receives a <strong>sessionMode</strong> prop that determines the
          type of session:
        </p>
        <ul className={css({ paddingLeft: '1.5rem', marginBottom: '1rem', lineHeight: 1.8 })}>
          <li>
            <strong>Maintenance:</strong> All skills are strong, mixed practice
          </li>
          <li>
            <strong>Remediation:</strong> Weak skills need strengthening (shown in targeting info)
          </li>
          <li>
            <strong>Progression:</strong> Ready to learn new skill, may include tutorial gate
          </li>
        </ul>
        <p className={css({ fontSize: '0.875rem', color: 'gray.600', fontStyle: 'italic' })}>
          The sessionMode is fetched via useSessionMode() hook and passed to the modal. See
          SessionModeBanner stories for the dashboard banner component.
        </p>
      </div>
    </StoryWrapper>
  ),
}
