import type { Meta, StoryObj } from '@storybook/react'
import { css } from '../../../styled-system/css'
import { type CurrentPhaseInfo, ProgressDashboard, type SkillProgress } from './ProgressDashboard'
import type { StudentWithProgress } from './StudentSelector'

const meta: Meta<typeof ProgressDashboard> = {
  title: 'Practice/ProgressDashboard',
  component: ProgressDashboard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ProgressDashboard>

// Sample data
const sampleStudent: StudentWithProgress = {
  id: 'student-1',
  name: 'Sonia',
  emoji: '🦋',
  color: '#FFE4E1',
  isActive: true,
  currentLevel: 3,
  currentPhaseId: 'five-complements-1',
  masteryPercent: 75,
  createdAt: new Date(),
}

const beginnerPhase: CurrentPhaseInfo = {
  phaseId: 'basic-addition-1',
  levelName: 'Level 1: Foundation',
  phaseName: 'Basic Addition',
  description: 'Learning to add single digits using direct addition on the abacus',
  skillsToMaster: ['basic.directAddition', 'basic.heavenBead'],
  masteredSkills: 1,
  totalSkills: 2,
}

const intermediatePhase: CurrentPhaseInfo = {
  phaseId: 'five-complements-1',
  levelName: 'Level 3: Five Complements',
  phaseName: 'Adding with Five Complements',
  description: 'Using the five complement technique when direct addition is not possible',
  skillsToMaster: [
    'fiveComplements.4=5-1',
    'fiveComplements.3=5-2',
    'fiveComplements.2=5-3',
    'fiveComplements.1=5-4',
  ],
  masteredSkills: 3,
  totalSkills: 4,
}

const advancedPhase: CurrentPhaseInfo = {
  phaseId: 'ten-complements-1',
  levelName: 'Level 5: Ten Complements',
  phaseName: 'Carrying to the Tens Column',
  description: 'Learning to carry over using ten complements for multi-digit addition',
  skillsToMaster: [
    'tenComplements.9=10-1',
    'tenComplements.8=10-2',
    'tenComplements.7=10-3',
    'tenComplements.6=10-4',
    'tenComplements.5=10-5',
  ],
  masteredSkills: 2,
  totalSkills: 5,
}

const sampleRecentSkills: SkillProgress[] = [
  {
    skillId: 'fiveComplements.4=5-1',
    skillName: '4 = 5 - 1',
    masteryLevel: 'mastered',
    attempts: 45,
    correct: 43,
    consecutiveCorrect: 10,
  },
  {
    skillId: 'fiveComplements.3=5-2',
    skillName: '3 = 5 - 2',
    masteryLevel: 'practicing',
    attempts: 28,
    correct: 22,
    consecutiveCorrect: 3,
  },
  {
    skillId: 'fiveComplements.2=5-3',
    skillName: '2 = 5 - 3',
    masteryLevel: 'learning',
    attempts: 10,
    correct: 6,
    consecutiveCorrect: 1,
  },
]

const handlers = {
  onStartPractice: () => alert('Start Practice clicked!'),
  onViewFullProgress: () => alert('View Full Progress clicked!'),
  onGenerateWorksheet: () => alert('Generate Worksheet clicked!'),
  onChangeStudent: () => alert('Change Student clicked!'),
}

/**
 * Dashboard wrapper for consistent styling
 */
function DashboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={css({
        backgroundColor: 'gray.50',
        padding: '2rem',
        borderRadius: '12px',
        minWidth: '600px',
      })}
    >
      {children}
    </div>
  )
}

export const Beginner: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard student={sampleStudent} currentPhase={beginnerPhase} {...handlers} />
    </DashboardWrapper>
  ),
}

export const Intermediate: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard
        student={sampleStudent}
        currentPhase={intermediatePhase}
        recentSkills={sampleRecentSkills}
        {...handlers}
      />
    </DashboardWrapper>
  ),
}

export const Advanced: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard
        student={sampleStudent}
        currentPhase={advancedPhase}
        recentSkills={sampleRecentSkills}
        {...handlers}
      />
    </DashboardWrapper>
  ),
}

export const WithoutRecentSkills: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard student={sampleStudent} currentPhase={beginnerPhase} {...handlers} />
    </DashboardWrapper>
  ),
}

export const FullProgress: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard
        student={sampleStudent}
        currentPhase={{
          ...intermediatePhase,
          masteredSkills: 4,
          totalSkills: 4,
        }}
        recentSkills={sampleRecentSkills.map((s) => ({
          ...s,
          masteryLevel: 'mastered' as const,
        }))}
        {...handlers}
      />
    </DashboardWrapper>
  ),
}

export const NewStudent: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard
        student={{
          id: 'student-new',
          name: 'New Learner',
          emoji: '🌟',
          color: '#FFFACD',
          isActive: true,
          createdAt: new Date(),
        }}
        currentPhase={{
          phaseId: 'intro',
          levelName: 'Getting Started',
          phaseName: 'Introduction',
          description: 'Welcome to soroban practice! Let us begin your math journey.',
          skillsToMaster: ['basic.directAddition'],
          masteredSkills: 0,
          totalSkills: 1,
        }}
        {...handlers}
      />
    </DashboardWrapper>
  ),
}

/**
 * Different student avatars
 */
export const DifferentStudents: Story = {
  render: () => (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '2rem' })}>
      {[
        { name: 'Marcus', emoji: '🦖', color: '#E0FFE0' },
        { name: 'Luna', emoji: '🌙', color: '#E0E0FF' },
        { name: 'Kai', emoji: '🐬', color: '#E0FFFF' },
      ].map((student) => (
        <DashboardWrapper key={student.name}>
          <ProgressDashboard
            student={{
              id: `student-${student.name}`,
              ...student,
              isActive: true,
              createdAt: new Date(),
            }}
            currentPhase={intermediatePhase}
            {...handlers}
          />
        </DashboardWrapper>
      ))}
    </div>
  ),
}

/**
 * With Focus Areas - showing skills needing reinforcement
 */
export const WithFocusAreas: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard
        student={sampleStudent}
        currentPhase={intermediatePhase}
        recentSkills={sampleRecentSkills}
        focusAreas={[
          {
            skillId: 'fiveComplements.3=5-2',
            skillName: '+3 Five Complement',
            masteryLevel: 'practicing',
            attempts: 15,
            correct: 10,
            consecutiveCorrect: 1,
            needsReinforcement: true,
            lastHelpLevel: 2,
            reinforcementStreak: 1,
          },
          {
            skillId: 'tenComplements.8=10-2',
            skillName: '+8 Ten Complement',
            masteryLevel: 'learning',
            attempts: 8,
            correct: 4,
            consecutiveCorrect: 0,
            needsReinforcement: true,
            lastHelpLevel: 3,
            reinforcementStreak: 0,
          },
        ]}
        onClearReinforcement={(skillId) => alert(`Clear reinforcement for ${skillId}`)}
        onClearAllReinforcement={() => alert('Clear all reinforcement')}
        {...handlers}
      />
    </DashboardWrapper>
  ),
}

/**
 * With Active Session - shows resume button instead of start
 */
export const WithActiveSession: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard
        student={sampleStudent}
        currentPhase={intermediatePhase}
        recentSkills={sampleRecentSkills}
        activeSession={{
          id: 'session-123',
          status: 'in_progress',
          completedCount: 12,
          totalCount: 30,
          hasSkillMismatch: false,
          skillsAdded: 0,
          skillsRemoved: 0,
        }}
        onResumePractice={() => alert('Resume Practice clicked!')}
        onStartOver={() => alert('Start over clicked!')}
        {...handlers}
      />
    </DashboardWrapper>
  ),
}

/**
 * With Active Session and Skill Mismatch - shows warning
 */
export const WithActiveSessionMismatch: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard
        student={sampleStudent}
        currentPhase={intermediatePhase}
        recentSkills={sampleRecentSkills}
        activeSession={{
          id: 'session-123',
          status: 'in_progress',
          completedCount: 5,
          totalCount: 30,
          hasSkillMismatch: true,
          skillsAdded: 2,
          skillsRemoved: 1,
        }}
        onResumePractice={() => alert('Resume Practice clicked!')}
        onStartOver={() => alert('Start over clicked!')}
        {...handlers}
      />
    </DashboardWrapper>
  ),
}
