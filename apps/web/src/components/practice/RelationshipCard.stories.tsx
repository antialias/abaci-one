import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { stakeholdersKeys } from '@/hooks/useStudentStakeholders'
import type {
  FamilyEventInfo,
  ParentInfo,
  StudentStakeholders,
  ViewerRelationshipSummary,
} from '@/types/student'
import { css } from '../../../styled-system/css'
import { RelationshipCard } from './RelationshipCard'

const PLAYER_ID = 'story-player-1'

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

const mockParents: ParentInfo[] = [
  { id: 'user-me', name: 'Sarah Chen', isMe: true },
  { id: 'user-2', name: 'David Chen', email: 'david@example.com', isMe: false },
]

const mockParents4: ParentInfo[] = [
  { id: 'user-me', name: 'Sarah Chen', isMe: true },
  { id: 'user-2', name: 'David Chen', isMe: false },
  { id: 'user-3', name: 'Maria Lopez', isMe: false },
  { id: 'user-4', name: 'James Wilson', isMe: false },
]

const now = new Date().toISOString()
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

const mockEvents: FamilyEventInfo[] = [
  {
    id: 'evt-1',
    eventType: 'parent_linked',
    actorName: 'David Chen',
    targetName: 'David Chen',
    createdAt: twoHoursAgo,
  },
  {
    id: 'evt-2',
    eventType: 'code_regenerated',
    actorName: 'Sarah Chen',
    targetName: null,
    createdAt: oneDayAgo,
  },
  {
    id: 'evt-3',
    eventType: 'parent_unlinked',
    actorName: 'Sarah Chen',
    targetName: 'Alex Kim',
    createdAt: threeDaysAgo,
  },
]

const parentViewer: ViewerRelationshipSummary = {
  type: 'parent',
  description: 'Your child',
}

const teacherViewer: ViewerRelationshipSummary = {
  type: 'teacher',
  description: 'Enrolled in Math 101',
  classroomName: 'Math 101',
}

function buildStakeholders(overrides: Partial<StudentStakeholders> = {}): StudentStakeholders {
  return {
    parents: mockParents,
    enrolledClassrooms: [
      {
        id: 'class-1',
        name: 'Math 101',
        teacherName: 'Mr. Thompson',
        isMyClassroom: false,
      },
    ],
    pendingEnrollments: [],
    currentPresence: null,
    recentFamilyEvents: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSeededClient(
  stakeholders: StudentStakeholders,
  viewerRelationship: ViewerRelationshipSummary
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  qc.setQueryData(stakeholdersKeys.player(PLAYER_ID), {
    stakeholders,
    viewerRelationship,
  })
  return qc
}

function Wrapper({
  children,
  stakeholders,
  viewerRelationship = parentViewer,
  theme = 'light',
}: {
  children: React.ReactNode
  stakeholders: StudentStakeholders
  viewerRelationship?: ViewerRelationshipSummary
  theme?: 'light' | 'dark'
}) {
  const qc = createSeededClient(stakeholders, viewerRelationship)
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <div
          data-theme={theme}
          className={css({
            padding: '2rem',
            maxWidth: '420px',
            backgroundColor: theme === 'dark' ? '#1a1a2e' : '#f5f5f5',
            minHeight: '200px',
          })}
        >
          {children}
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof RelationshipCard> = {
  title: 'Practice/RelationshipCard',
  component: RelationshipCard,
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof RelationshipCard>

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Parent viewer, two parents, one classroom, no activity events. */
export const Default: Story = {
  render: () => (
    <Wrapper stakeholders={buildStakeholders()}>
      <RelationshipCard playerId={PLAYER_ID} editable playerName="Sonia" />
    </Wrapper>
  ),
}

/** Shows the Recent Activity section with link/unlink/regenerate events. */
export const WithRecentActivity: Story = {
  render: () => (
    <Wrapper stakeholders={buildStakeholders({ recentFamilyEvents: mockEvents })}>
      <RelationshipCard playerId={PLAYER_ID} editable playerName="Sonia" />
    </Wrapper>
  ),
}

/** Four parents linked — max capacity. */
export const MaxParentsLinked: Story = {
  render: () => (
    <Wrapper
      stakeholders={buildStakeholders({
        parents: mockParents4,
        recentFamilyEvents: [
          {
            id: 'evt-recent',
            eventType: 'parent_linked',
            actorName: 'James Wilson',
            targetName: 'James Wilson',
            createdAt: now,
          },
          ...mockEvents,
        ],
      })}
    >
      <RelationshipCard playerId={PLAYER_ID} editable playerName="Sonia" />
    </Wrapper>
  ),
}

/** Teacher viewing a student — no edit controls. */
export const TeacherView: Story = {
  render: () => (
    <Wrapper stakeholders={buildStakeholders()} viewerRelationship={teacherViewer}>
      <RelationshipCard playerId={PLAYER_ID} playerName="Sonia" />
    </Wrapper>
  ),
}

/** Compact variant (used in hover cards). */
export const Compact: Story = {
  render: () => (
    <Wrapper stakeholders={buildStakeholders({ recentFamilyEvents: mockEvents })}>
      <RelationshipCard playerId={PLAYER_ID} compact playerName="Sonia" />
    </Wrapper>
  ),
}

/** Dark mode with activity events. */
export const DarkMode: Story = {
  render: () => (
    <Wrapper
      stakeholders={buildStakeholders({ recentFamilyEvents: mockEvents })}
      theme="dark"
    >
      <RelationshipCard playerId={PLAYER_ID} editable playerName="Sonia" />
    </Wrapper>
  ),
}
