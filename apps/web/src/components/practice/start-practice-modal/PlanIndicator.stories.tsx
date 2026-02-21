import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/contexts/ThemeContext'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { billingKeys } from '@/lib/queryKeys'
import { TIER_LIMITS, type TierName } from '@/lib/tier-limits'
import type { EffectiveTierResponse } from '@/hooks/useTier'
import { css } from '../../../../styled-system/css'
import { StartPracticeModalProvider } from '../StartPracticeModalContext'
import { PlanIndicator } from './PlanIndicator'

const STUDENT_ID = 'test-student-1'

function tierResponse(
  tier: TierName,
  providedBy: { name: string } | null = null
): EffectiveTierResponse {
  const limits = TIER_LIMITS[tier]
  return {
    tier,
    limits: {
      maxPracticeStudents: limits.maxPracticeStudents === Infinity ? null : limits.maxPracticeStudents,
      maxSessionMinutes: limits.maxSessionMinutes,
      maxSessionsPerWeek: limits.maxSessionsPerWeek === Infinity ? null : limits.maxSessionsPerWeek,
      maxOfflineParsingPerMonth: limits.maxOfflineParsingPerMonth,
    },
    providedBy,
  }
}

function createSeededQueryClient(tier: TierName, providedBy: { name: string } | null = null) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  qc.setQueryData(billingKeys.effectiveTier(STUDENT_ID), tierResponse(tier, providedBy))
  return qc
}

const defaultSessionMode: SessionMode = {
  type: 'maintenance',
  focusDescription: 'Mixed practice',
  skillCount: 8,
}

function Wrapper({
  children,
  tier,
  providedBy = null,
  theme = 'light',
}: {
  children: React.ReactNode
  tier: TierName
  providedBy?: { name: string } | null
  theme?: 'light' | 'dark'
}) {
  const qc = createSeededQueryClient(tier, providedBy)
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <StartPracticeModalProvider
          studentId={STUDENT_ID}
          studentName="Sonia"
          focusDescription="Mixed practice"
          sessionMode={defaultSessionMode}
          secondsPerTerm={4}
        >
          <div
            className={css({ padding: '2rem', maxWidth: '360px' })}
            style={{
              background: theme === 'dark'
                ? 'linear-gradient(150deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)'
                : 'linear-gradient(150deg, #ffffff 0%, #f8fafc 60%, #f0f9ff 100%)',
            }}
          >
            {children}
          </div>
        </StartPracticeModalProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const meta: Meta<typeof PlanIndicator> = {
  title: 'Practice/StartPracticeModal/PlanIndicator',
  component: PlanIndicator,
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof PlanIndicator>

/**
 * Own Family Plan — user is the subscriber.
 * Shows "Family Plan" badge in blue.
 */
export const OwnFamilyPlan: Story = {
  render: () => (
    <Wrapper tier="family">
      <PlanIndicator />
    </Wrapper>
  ),
}

/**
 * Inherited Family Plan — another parent provides the subscription.
 * Shows "Using Mom's Family Plan" in blue.
 */
export const InheritedFamilyPlan: Story = {
  render: () => (
    <Wrapper tier="family" providedBy={{ name: 'Mom' }}>
      <PlanIndicator />
    </Wrapper>
  ),
}

/**
 * Free tier — shows limits summary + Upgrade link.
 */
export const FreePlan: Story = {
  render: () => (
    <Wrapper tier="free">
      <PlanIndicator />
    </Wrapper>
  ),
}

/**
 * Guest tier — anonymous user, no upgrade link.
 */
export const GuestTier: Story = {
  render: () => (
    <Wrapper tier="guest">
      <PlanIndicator />
    </Wrapper>
  ),
}

/**
 * Own Family Plan — dark mode.
 */
export const OwnFamilyPlanDark: Story = {
  render: () => (
    <Wrapper tier="family" theme="dark">
      <div data-theme="dark">
        <PlanIndicator />
      </div>
    </Wrapper>
  ),
}

/**
 * Inherited Family Plan — dark mode.
 */
export const InheritedFamilyPlanDark: Story = {
  render: () => (
    <Wrapper tier="family" providedBy={{ name: 'Mom' }} theme="dark">
      <div data-theme="dark">
        <PlanIndicator />
      </div>
    </Wrapper>
  ),
}

/**
 * Free tier — dark mode.
 */
export const FreePlanDark: Story = {
  render: () => (
    <Wrapper tier="free" theme="dark">
      <div data-theme="dark">
        <PlanIndicator />
      </div>
    </Wrapper>
  ),
}
