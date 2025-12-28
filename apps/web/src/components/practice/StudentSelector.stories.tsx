import type { Meta, StoryObj } from '@storybook/react'
import { css } from '../../../styled-system/css'
import { StudentSelector, type StudentWithProgress } from './StudentSelector'

const meta: Meta<typeof StudentSelector> = {
  title: 'Practice/StudentSelector',
  component: StudentSelector,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof StudentSelector>

// Sample student data
const sampleStudents: StudentWithProgress[] = [
  {
    id: 'student-1',
    name: 'Sonia',
    emoji: '🦋',
    color: '#FFE4E1',
    currentLevel: 3,
    currentPhaseId: 'five-complements-1',
    masteryPercent: 75,
    createdAt: new Date(),
  },
  {
    id: 'student-2',
    name: 'Marcus',
    emoji: '🦖',
    color: '#E0FFE0',
    currentLevel: 2,
    currentPhaseId: 'basic-addition-2',
    masteryPercent: 45,
    createdAt: new Date(),
  },
  {
    id: 'student-3',
    name: 'Luna',
    emoji: '🌙',
    color: '#E0E0FF',
    currentLevel: 1,
    masteryPercent: 20,
    createdAt: new Date(),
  },
]

const newStudent: StudentWithProgress = {
  id: 'student-new',
  name: 'New Learner',
  emoji: '🌟',
  color: '#FFFACD',
  createdAt: new Date(),
}

/**
 * Interactive demo - clicking a student logs to console
 */
function InteractiveSelectorDemo() {
  return (
    <div
      className={css({
        backgroundColor: 'gray.50',
        padding: '2rem',
        borderRadius: '12px',
        minWidth: '600px',
      })}
    >
      <StudentSelector
        students={sampleStudents}
        onSelectStudent={(student) => console.log('Selected:', student.name)}
        onToggleSelection={(student) => console.log('Toggled:', student.name)}
      />
    </div>
  )
}

export const Interactive: Story = {
  render: () => <InteractiveSelectorDemo />,
}

export const NoStudents: Story = {
  args: {
    students: [],
    onSelectStudent: () => {},
    title: 'Who is practicing today?',
  },
}

export const SingleStudent: Story = {
  args: {
    students: [sampleStudents[0]],
    onSelectStudent: () => {},
  },
}

export const MultipleStudents: Story = {
  args: {
    students: sampleStudents,
    onSelectStudent: () => {},
  },
}

export const WithNewStudent: Story = {
  args: {
    students: [...sampleStudents, newStudent],
    onSelectStudent: () => {},
  },
}

export const CustomTitle: Story = {
  args: {
    students: sampleStudents,
    onSelectStudent: () => {},
    title: "Let's Practice Math!",
  },
}

/**
 * Shows students without mastery progress
 */
export const StudentsWithoutProgress: Story = {
  args: {
    students: sampleStudents.map((s) => ({
      ...s,
      masteryPercent: undefined,
      currentLevel: undefined,
    })),
    onSelectStudent: () => {},
  },
}
