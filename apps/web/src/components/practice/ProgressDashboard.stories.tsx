import type { Meta, StoryObj } from '@storybook/react'
import { css } from '../../../styled-system/css'
import {
  type CurrentPhaseInfo,
  ProgressDashboard,
  type SkillHealthSummary,
} from './ProgressDashboard'
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

// =============================================================================
// BKT-based SkillHealthSummary examples (new system)
// =============================================================================

const remediationHealth: SkillHealthSummary = {
  mode: 'remediation',
  counts: {
    strong: 2,
    developing: 1,
    weak: 2,
    total: 5,
  },
  context: {
    headline: 'Strengthening Skills',
    detail: 'Focus: +3 and +4 five-complements',
  },
  weakestSkill: {
    displayName: '+3 (five-complement)',
    pKnown: 0.28,
  },
}

const progressionTutorialHealth: SkillHealthSummary = {
  mode: 'progression',
  counts: {
    strong: 4,
    developing: 0,
    weak: 0,
    total: 4,
  },
  context: {
    headline: 'Learning: +3 (five-complement)',
    detail: 'Tutorial available',
  },
  nextSkill: {
    displayName: '+3 (five-complement)',
    tutorialRequired: true,
  },
}

const progressionReadyHealth: SkillHealthSummary = {
  mode: 'progression',
  counts: {
    strong: 4,
    developing: 0,
    weak: 0,
    total: 4,
  },
  context: {
    headline: 'Learning: +3 (five-complement)',
    detail: 'Ready to practice',
  },
  nextSkill: {
    displayName: '+3 (five-complement)',
    tutorialRequired: false,
  },
}

const maintenanceHealth: SkillHealthSummary = {
  mode: 'maintenance',
  counts: {
    strong: 7,
    developing: 0,
    weak: 0,
    total: 7,
  },
  context: {
    headline: 'Great progress!',
    detail: 'All Level 1 addition skills mastered',
  },
}

const mixedDevelopingHealth: SkillHealthSummary = {
  mode: 'maintenance',
  counts: {
    strong: 2,
    developing: 4,
    weak: 1,
    total: 7,
  },
  context: {
    headline: 'Great progress!',
    detail: 'Keep practicing to strengthen skills',
  },
}

const handlers = {
  onStartPractice: () => alert('Start Practice clicked!'),
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
      <ProgressDashboard student={sampleStudent} currentPhase={intermediatePhase} {...handlers} />
    </DashboardWrapper>
  ),
}

export const Advanced: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard student={sampleStudent} currentPhase={advancedPhase} {...handlers} />
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
        focusAreas={[
          {
            skillId: 'fiveComplements.3=5-2',
            skillName: '+3 Five Complement',
            bktClassification: 'developing',
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
            bktClassification: 'weak',
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

// Note: Active session resume/start functionality has been moved to the
// SessionModeBanner system (see ActiveSessionBanner.tsx and ProjectingBanner.tsx)

// =============================================================================
// BKT-based SkillHealth Stories (new system)
// =============================================================================

/**
 * Remediation Mode - Student has weak skills that need strengthening
 * Orange accent, shows progress toward 0.5 threshold
 */
export const RemediationMode: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard student={sampleStudent} skillHealth={remediationHealth} {...handlers} />
    </DashboardWrapper>
  ),
}

/**
 * Progression Mode - Ready for new skill, tutorial required
 * Blue accent, shows next skill to learn
 */
export const ProgressionTutorialRequired: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard
        student={sampleStudent}
        skillHealth={progressionTutorialHealth}
        {...handlers}
      />
    </DashboardWrapper>
  ),
}

/**
 * Progression Mode - Tutorial done, ready to practice
 * Blue accent, shows next skill to learn
 */
export const ProgressionReadyToPractice: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard
        student={sampleStudent}
        skillHealth={progressionReadyHealth}
        {...handlers}
      />
    </DashboardWrapper>
  ),
}

/**
 * Maintenance Mode - All skills strong
 * Green accent, shows strong/total ratio
 */
export const MaintenanceMode: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard student={sampleStudent} skillHealth={maintenanceHealth} {...handlers} />
    </DashboardWrapper>
  ),
}

/**
 * Mixed Developing - Most skills developing, few strong/weak
 */
export const MixedDeveloping: Story = {
  render: () => (
    <DashboardWrapper>
      <ProgressDashboard
        student={sampleStudent}
        skillHealth={mixedDevelopingHealth}
        {...handlers}
      />
    </DashboardWrapper>
  ),
}

/**
 * All Three Modes side by side for comparison
 */
export const AllModeComparison: Story = {
  render: () => (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '2rem' })}>
      <div>
        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            color: 'orange.600',
          })}
        >
          Remediation Mode (Orange)
        </h3>
        <DashboardWrapper>
          <ProgressDashboard
            student={sampleStudent}
            skillHealth={remediationHealth}
            {...handlers}
          />
        </DashboardWrapper>
      </div>
      <div>
        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            color: 'blue.600',
          })}
        >
          Progression Mode (Blue)
        </h3>
        <DashboardWrapper>
          <ProgressDashboard
            student={sampleStudent}
            skillHealth={progressionTutorialHealth}
            {...handlers}
          />
        </DashboardWrapper>
      </div>
      <div>
        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            color: 'green.600',
          })}
        >
          Maintenance Mode (Green)
        </h3>
        <DashboardWrapper>
          <ProgressDashboard
            student={sampleStudent}
            skillHealth={maintenanceHealth}
            {...handlers}
          />
        </DashboardWrapper>
      </div>
    </div>
  ),
}
