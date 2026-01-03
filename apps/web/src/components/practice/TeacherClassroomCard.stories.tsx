import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import type { Classroom } from '@/db/schema'
import type { StudentView } from './ViewSelector'
import { TeacherClassroomCard } from './StudentFilterBar'
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
          data-theme={theme}
          className={css({
            minHeight: '200px',
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

// Mock classroom data
const mockClassroom: Classroom = {
  id: 'classroom-1',
  teacherId: 'teacher-1',
  name: "Mrs. Smith's Class",
  code: 'ABC123',
  createdAt: new Date('2024-01-15'),
  entryPromptExpiryMinutes: null,
}

const mockClassroomWithCustomExpiry: Classroom = {
  ...mockClassroom,
  id: 'classroom-2',
  name: 'Math 101',
  code: 'MATH42',
  entryPromptExpiryMinutes: 60,
}

const mockClassroomLongName: Classroom = {
  ...mockClassroom,
  id: 'classroom-3',
  name: 'Advanced Mathematics and Problem Solving - Period 3',
  code: 'ADVMT3',
}

// Available views for teacher
const teacherViews: StudentView[] = ['enrolled', 'in-classroom', 'in-classroom-active']

const meta: Meta<typeof TeacherClassroomCard> = {
  title: 'Practice/TeacherClassroomCard',
  component: TeacherClassroomCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof TeacherClassroomCard>

// =============================================================================
// Basic Usage
// =============================================================================

/**
 * Default state with enrolled view selected
 */
export const Default: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('enrolled')
    return (
      <StoryWrapper>
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 12,
              'in-classroom': 8,
              'in-classroom-active': 3,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

/**
 * With "In Classroom" view selected (showing present students)
 */
export const InClassroomView: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('in-classroom')
    return (
      <StoryWrapper>
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 12,
              'in-classroom': 8,
              'in-classroom-active': 3,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

/**
 * With "Active Sessions" view selected
 */
export const ActiveSessionsView: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('in-classroom-active')
    return (
      <StoryWrapper>
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 12,
              'in-classroom': 8,
              'in-classroom-active': 3,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

// =============================================================================
// View Count Variations
// =============================================================================

/**
 * Empty classroom - no students enrolled yet
 */
export const EmptyClassroom: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('enrolled')
    return (
      <StoryWrapper>
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 0,
              'in-classroom': 0,
              'in-classroom-active': 0,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

/**
 * Large classroom with many students
 */
export const LargeClassroom: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('enrolled')
    return (
      <StoryWrapper>
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 35,
              'in-classroom': 28,
              'in-classroom-active': 15,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

/**
 * No students present (all enrolled but none in classroom)
 */
export const NonePresent: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('enrolled')
    return (
      <StoryWrapper>
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 20,
              'in-classroom': 0,
              'in-classroom-active': 0,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

// =============================================================================
// Custom Settings
// =============================================================================

/**
 * Classroom with custom entry prompt expiry time
 */
export const CustomExpiryTime: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('enrolled')
    return (
      <StoryWrapper>
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroomWithCustomExpiry}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 10,
              'in-classroom': 5,
              'in-classroom-active': 2,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

/**
 * Classroom with a very long name (tests truncation)
 */
export const LongClassName: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('enrolled')
    return (
      <StoryWrapper>
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroomLongName}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 15,
              'in-classroom': 10,
              'in-classroom-active': 4,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

// =============================================================================
// Without Add Student Button
// =============================================================================

/**
 * Without the add student button (read-only view)
 */
export const WithoutAddButton: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('enrolled')
    return (
      <StoryWrapper>
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 12,
              'in-classroom': 8,
              'in-classroom-active': 3,
            }}
          />
        </div>
      </StoryWrapper>
    )
  },
}

// =============================================================================
// Dark Theme
// =============================================================================

/**
 * Dark theme variant
 */
export const DarkTheme: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('enrolled')
    return (
      <StoryWrapper theme="dark">
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 12,
              'in-classroom': 8,
              'in-classroom-active': 3,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

/**
 * Dark theme with "In Classroom" view
 */
export const DarkThemeInClassroom: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('in-classroom')
    return (
      <StoryWrapper theme="dark">
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 12,
              'in-classroom': 8,
              'in-classroom-active': 3,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

/**
 * Dark theme - empty classroom
 */
export const DarkThemeEmpty: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('enrolled')
    return (
      <StoryWrapper theme="dark">
        <div className={css({ width: '400px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 0,
              'in-classroom': 0,
              'in-classroom-active': 0,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

// =============================================================================
// Responsive Widths
// =============================================================================

/**
 * Narrow container (tests responsiveness)
 */
export const NarrowContainer: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('enrolled')
    return (
      <StoryWrapper>
        <div className={css({ width: '300px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 12,
              'in-classroom': 8,
              'in-classroom-active': 3,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}

/**
 * Wide container
 */
export const WideContainer: Story = {
  render: () => {
    const [currentView, setCurrentView] = useState<StudentView>('enrolled')
    return (
      <StoryWrapper>
        <div className={css({ width: '600px' })}>
          <TeacherClassroomCard
            classroom={mockClassroom}
            currentView={currentView}
            onViewChange={setCurrentView}
            availableViews={teacherViews}
            viewCounts={{
              enrolled: 12,
              'in-classroom': 8,
              'in-classroom-active': 3,
            }}
            onAddStudentToClassroom={() => console.log('Add student clicked')}
          />
        </div>
      </StoryWrapper>
    )
  },
}
