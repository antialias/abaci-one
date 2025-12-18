import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/contexts/ThemeContext'
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

// Default props
const defaultProps = {
  studentId: 'test-student-1',
  studentName: 'Sonia',
  focusDescription: 'Five Complements Addition',
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
 * For a student with slower pace
 */
export const SlowerPace: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal
        {...defaultProps}
        studentName="Alex"
        secondsPerTerm={8}
        focusDescription="Ten Complements Addition"
      />
    </StoryWrapper>
  ),
}

/**
 * For a student with faster pace
 */
export const FasterPace: Story = {
  render: () => (
    <StoryWrapper>
      <StartPracticeModal
        {...defaultProps}
        studentName="Maya"
        secondsPerTerm={2}
        focusDescription="Basic Addition"
      />
    </StoryWrapper>
  ),
}

/**
 * Note: The tutorial gate feature requires the useNextSkillToLearn hook
 * to return data. In a real scenario, you would need to mock the API
 * response or use MSW (Mock Service Worker) to simulate the API.
 *
 * The tutorial gate shows when:
 * 1. useNextSkillToLearn returns a skill with tutorialReady=false
 * 2. getSkillTutorialConfig returns a config for that skill
 *
 * To test the tutorial gate manually:
 * 1. Use the app with a real student who has a new skill to learn
 * 2. The green "New skill available!" banner will appear
 * 3. Click "Learn Now" to see the SkillTutorialLauncher
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
          Tutorial Gate Feature
        </h2>
        <p className={css({ marginBottom: '1rem', lineHeight: 1.6 })}>
          The StartPracticeModal includes a <strong>tutorial gate</strong> that appears when a
          student has a new skill ready to learn. This feature:
        </p>
        <ul className={css({ paddingLeft: '1.5rem', marginBottom: '1rem', lineHeight: 1.8 })}>
          <li>Shows a green banner with the skill name</li>
          <li>Offers "Learn Now" to start the tutorial</li>
          <li>Offers "Practice without it" to skip</li>
          <li>Tracks skip count for teacher visibility</li>
        </ul>
        <p className={css({ fontSize: '0.875rem', color: 'gray.600', fontStyle: 'italic' })}>
          Note: This feature requires API mocking to demonstrate in Storybook. See
          SkillTutorialLauncher stories for the tutorial UI itself.
        </p>
      </div>
    </StoryWrapper>
  ),
}
