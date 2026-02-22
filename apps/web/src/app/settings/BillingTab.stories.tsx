/**
 * Settings BillingTab Stories — Family Coverage States
 *
 * Demonstrates how the billing tab in settings adapts when a free-tier
 * parent's children are covered by another parent's family subscription.
 */

import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { billingKeys } from '@/lib/queryKeys'
import { TIER_LIMITS, type TierName } from '@/lib/tier-limits'
import type { TierResponse, FamilyCoverageResponse } from '@/hooks/useTier'
import SettingsPage from './page'

function tierData(tier: TierName): TierResponse {
  const limits = TIER_LIMITS[tier]
  return {
    tier,
    limits: {
      maxPracticeStudents:
        limits.maxPracticeStudents === Infinity ? null : limits.maxPracticeStudents,
      maxSessionMinutes: limits.maxSessionMinutes,
      maxSessionsPerWeek: limits.maxSessionsPerWeek === Infinity ? null : limits.maxSessionsPerWeek,
      maxOfflineParsingPerMonth: limits.maxOfflineParsingPerMonth,
    },
  }
}

function createQC(tier: TierName, coverage: FamilyCoverageResponse) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  qc.setQueryData(billingKeys.tier(), tierData(tier))
  qc.setQueryData(billingKeys.coverage(), coverage)
  return qc
}

/**
 * Provides a seeded QueryClient that overrides the global one from preview.tsx.
 * All other providers (Fullscreen, AudioManager, etc.) come from the global decorator.
 */
function Wrapper({
  children,
  tier,
  coverage,
}: {
  children: React.ReactNode
  tier: TierName
  coverage: FamilyCoverageResponse
}) {
  const qc = createQC(tier, coverage)
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const meta: Meta<typeof SettingsPage> = {
  title: 'Pages/Settings/Billing Coverage',
  component: SettingsPage,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: { searchParams: { tab: 'billing' } },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SettingsPage>

/**
 * Free-tier parent with NO coverage — standard upgrade CTA.
 */
export const FreeNoCoverage: Story = {
  name: 'Free — No Coverage',
  render: () => (
    <Wrapper
      tier="free"
      coverage={{ isCovered: false, coveredBy: null, coveredChildCount: 0, totalChildCount: 2 }}
    >
      <SettingsPage />
    </Wrapper>
  ),
}

/**
 * Free-tier parent where ALL children are covered.
 * Shows "Covered" badge, coverage info row, and de-emphasized upgrade.
 */
export const FreeFullyCovered: Story = {
  name: 'Free — Fully Covered (2/2)',
  render: () => (
    <Wrapper
      tier="free"
      coverage={{
        isCovered: true,
        coveredBy: { userId: 'mom-id', name: 'Sarah' },
        coveredChildCount: 2,
        totalChildCount: 2,
      }}
    >
      <SettingsPage />
    </Wrapper>
  ),
}

/**
 * Free-tier parent where only SOME children are covered.
 * Shows "1 of 3 students covered by Sarah's Family Plan".
 */
export const FreePartiallyCovered: Story = {
  name: 'Free — Partially Covered (1/3)',
  render: () => (
    <Wrapper
      tier="free"
      coverage={{
        isCovered: true,
        coveredBy: { userId: 'mom-id', name: 'Sarah' },
        coveredChildCount: 1,
        totalChildCount: 3,
      }}
    >
      <SettingsPage />
    </Wrapper>
  ),
}

/**
 * Family-tier parent — shows "Manage Subscription", no coverage info.
 */
export const FamilyTier: Story = {
  name: 'Family — Own Subscription',
  render: () => (
    <Wrapper
      tier="family"
      coverage={{ isCovered: false, coveredBy: null, coveredChildCount: 0, totalChildCount: 2 }}
    >
      <SettingsPage />
    </Wrapper>
  ),
}
