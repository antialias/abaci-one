import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/contexts/ThemeContext'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { CurriculumPhase } from '@/lib/curriculum/definitions'
import { css } from '../../../../styled-system/css'
import { StartPracticeModalProvider } from '../StartPracticeModalContext'
import { PracticeModesSelector } from './PracticeModesSelector'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  })
}

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
  canSkipTutorial: true,
}

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
          data-theme={theme}
          className={css({
            minHeight: '200px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
            backgroundColor: theme === 'dark' ? '#1a1a2e' : '#f5f5f5',
          })}
        >
          <StartPracticeModalProvider
            studentId="story-student"
            studentName="Story Student"
            focusDescription="Test focus"
            sessionMode={defaultSessionMode}
            initialExpanded={true}
            practiceApprovedGamesOverride={[
              { manifest: { name: 'game1', displayName: 'Game One', icon: '🎮' } },
            ]}
          >
            {children}
          </StartPracticeModalProvider>
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const meta: Meta<typeof PracticeModesSelector> = {
  title: 'Practice/PracticeModesSelector',
  component: PracticeModesSelector,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof PracticeModesSelector>

/**
 * Default state: abacus=2, visualization=1, linear=0.
 * Tap segments to cycle weights (0 → 1 → 2 → 0).
 */
export const Default: Story = {
  render: () => (
    <StoryWrapper>
      <div className={css({ maxWidth: '400px' })}>
        <PracticeModesSelector />
      </div>
    </StoryWrapper>
  ),
}

/**
 * Dark theme variant
 */
export const DefaultDark: Story = {
  render: () => (
    <StoryWrapper theme="dark">
      <div className={css({ maxWidth: '400px' })}>
        <PracticeModesSelector />
      </div>
    </StoryWrapper>
  ),
}

/**
 * Full-width rendering
 */
export const FullWidth: Story = {
  render: () => (
    <StoryWrapper>
      <PracticeModesSelector />
    </StoryWrapper>
  ),
}

/**
 * Full-width dark theme
 */
export const FullWidthDark: Story = {
  render: () => (
    <StoryWrapper theme="dark">
      <PracticeModesSelector />
    </StoryWrapper>
  ),
}
