/**
 * PricingPage Stories — Family Coverage States
 *
 * Demonstrates how the pricing page adapts when a free-tier parent's
 * children are covered by another parent's family subscription.
 */

import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { billingKeys } from '@/lib/queryKeys'
import { TIER_LIMITS, type TierName } from '@/lib/tier-limits'
import type { TierResponse, FamilyCoverageResponse } from '@/hooks/useTier'
import PricingPage from './page'

function tierData(tier: TierName): TierResponse {
  const limits = TIER_LIMITS[tier]
  return {
    tier,
    limits: {
      maxPracticeStudents: limits.maxPracticeStudents === Infinity ? null : limits.maxPracticeStudents,
      maxSessionMinutes: limits.maxSessionMinutes,
      maxSessionsPerWeek: limits.maxSessionsPerWeek === Infinity ? null : limits.maxSessionsPerWeek,
      maxOfflineParsingPerMonth: limits.maxOfflineParsingPerMonth,
    },
  }
}

const DEFAULT_PRICES = {
  family: {
    monthly: { amount: 600, display: 6 },
    annual: { amount: 3768, display: 37.68, monthlyEquivalent: 3.14 },
  },
}

function createQC(tier: TierName, coverage: FamilyCoverageResponse) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  qc.setQueryData(billingKeys.tier(), tierData(tier))
  qc.setQueryData(billingKeys.coverage(), coverage)
  qc.setQueryData(billingKeys.prices(), DEFAULT_PRICES)
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

const meta: Meta<typeof PricingPage> = {
  title: 'Pages/Pricing/Family Coverage',
  component: PricingPage,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof PricingPage>

/**
 * Free-tier parent with NO coverage — default upgrade CTA.
 */
export const FreeNoCoverage: Story = {
  name: 'Free — No Coverage',
  render: () => (
    <Wrapper
      tier="free"
      coverage={{ isCovered: false, coveredBy: null, coveredChildCount: 0, totalChildCount: 2 }}
    >
      <PricingPage />
    </Wrapper>
  ),
}

/**
 * Free-tier parent where ALL children are covered by co-parent's family plan.
 * Shows blue banner + dimmed "Already Covered" CTA + "Subscribe anyway" link.
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
      <PricingPage />
    </Wrapper>
  ),
}

/**
 * Free-tier parent where only SOME children are covered.
 * Still shows coverage banner since at least one is covered.
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
      <PricingPage />
    </Wrapper>
  ),
}

/**
 * Family-tier parent — no coverage banner, shows "Manage Subscription".
 * Coverage data is irrelevant when user already has their own subscription.
 */
export const FamilyTier: Story = {
  name: 'Family — Own Subscription',
  render: () => (
    <Wrapper
      tier="family"
      coverage={{ isCovered: false, coveredBy: null, coveredChildCount: 0, totalChildCount: 2 }}
    >
      <PricingPage />
    </Wrapper>
  ),
}

/**
 * Guest user — no coverage, shows "Get Started Free" CTA.
 */
export const Guest: Story = {
  name: 'Guest — No Coverage',
  render: () => (
    <Wrapper
      tier="guest"
      coverage={{ isCovered: false, coveredBy: null, coveredChildCount: 0, totalChildCount: 0 }}
    >
      <PricingPage />
    </Wrapper>
  ),
}
