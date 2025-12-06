import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
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
    isGuest: false,
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
    isGuest: false,
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
    isGuest: false,
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
  isGuest: false,
  createdAt: new Date(),
}

/**
 * Interactive demo with selection
 */
function InteractiveSelectorDemo() {
  const [selected, setSelected] = useState<StudentWithProgress | undefined>()

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
        selectedStudent={selected}
        onSelectStudent={setSelected}
        onAddStudent={() => alert('Add Student clicked!')}
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
    onAddStudent: () => alert('Add Student clicked!'),
    title: 'Who is practicing today?',
  },
}

export const SingleStudent: Story = {
  args: {
    students: [sampleStudents[0]],
    selectedStudent: undefined,
    onSelectStudent: () => {},
    onAddStudent: () => alert('Add Student clicked!'),
  },
}

export const MultipleStudents: Story = {
  args: {
    students: sampleStudents,
    selectedStudent: undefined,
    onSelectStudent: () => {},
    onAddStudent: () => alert('Add Student clicked!'),
  },
}

export const WithSelectedStudent: Story = {
  args: {
    students: sampleStudents,
    selectedStudent: sampleStudents[0],
    onSelectStudent: () => {},
    onAddStudent: () => alert('Add Student clicked!'),
  },
}

export const NewStudentHighlighted: Story = {
  args: {
    students: [...sampleStudents, newStudent],
    selectedStudent: newStudent,
    onSelectStudent: () => {},
    onAddStudent: () => alert('Add Student clicked!'),
  },
}

export const CustomTitle: Story = {
  args: {
    students: sampleStudents,
    selectedStudent: undefined,
    onSelectStudent: () => {},
    onAddStudent: () => alert('Add Student clicked!'),
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
    selectedStudent: undefined,
    onSelectStudent: () => {},
    onAddStudent: () => alert('Add Student clicked!'),
  },
}
