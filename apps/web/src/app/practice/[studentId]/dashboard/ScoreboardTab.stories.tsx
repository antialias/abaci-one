'use client'

import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ScoreboardTab } from './ScoreboardTab'

/**
 * Stories for ScoreboardTab - the dashboard tab showing game results and leaderboard
 *
 * Shows:
 * - Personal bests grid (best score per game)
 * - Recent games table (last 10 games)
 * - Classroom leaderboard (if enrolled)
 * - Empty states for each section
 * - Dark/light mode variations
 */

// Create a query client for storybook
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })

// Wrapper component to provide QueryClient
const QueryWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const meta: Meta<typeof ScoreboardTab> = {
  title: 'Practice/Dashboard/ScoreboardTab',
  component: ScoreboardTab,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <QueryWrapper>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Story />
        </div>
      </QueryWrapper>
    ),
  ],
  argTypes: {
    isDark: {
      control: 'boolean',
      description: 'Dark mode toggle',
    },
    classroomId: {
      control: 'text',
      description: 'Classroom ID for leaderboard (null/undefined hides leaderboard)',
    },
  },
}

export default meta

type Story = StoryObj<typeof ScoreboardTab>

// ============================================================================
// Mock Data Helpers
// ============================================================================

// Note: Since ScoreboardTab uses React Query hooks internally,
// these stories will show loading states by default.
// For full mock data, we'd need to set up MSW or mock the hooks.

// ============================================================================
// Stories
// ============================================================================

/**
 * Light mode with classroom - shows all sections
 */
export const LightModeWithClassroom: Story = {
  args: {
    studentId: 'student-1',
    classroomId: 'classroom-1',
    isDark: false,
  },
}

/**
 * Dark mode with classroom
 */
export const DarkModeWithClassroom: Story = {
  args: {
    studentId: 'student-1',
    classroomId: 'classroom-1',
    isDark: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
}

/**
 * Light mode without classroom - hides leaderboard
 */
export const LightModeNoClassroom: Story = {
  args: {
    studentId: 'student-1',
    classroomId: null,
    isDark: false,
  },
}

/**
 * Dark mode without classroom
 */
export const DarkModeNoClassroom: Story = {
  args: {
    studentId: 'student-1',
    classroomId: null,
    isDark: true,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
}

/**
 * With undefined classroomId (equivalent to null)
 */
export const UndefinedClassroom: Story = {
  args: {
    studentId: 'student-1',
    classroomId: undefined,
    isDark: false,
  },
}
