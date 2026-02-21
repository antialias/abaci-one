/**
 * GuestProgressBanner Stories
 *
 * Demonstrates the guest "save your progress" banner in all trigger states:
 * - After 3+ sessions (default trigger)
 * - Returning after 24h+ absence
 * - Accuracy improvement between sessions
 * - Persistent variant (dashboard, no dismiss button)
 * - Dark mode variants
 */

import type { Meta, StoryObj } from '@storybook/react'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { billingKeys } from '@/lib/queryKeys'
import { css } from '../../styled-system/css'
import { GuestProgressBanner, recordGuestSession } from './GuestProgressBanner'

// Create a query client that pre-seeds the tier as "guest"
function createGuestQueryClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  qc.setQueryData(billingKeys.tier(), {
    tier: 'guest',
    limits: {
      maxPracticeStudents: 1,
      maxSessionMinutes: 10,
      maxSessionsPerWeek: null,
      maxOfflineParsingPerMonth: 3,
    },
  })
  return qc
}

function createFreeQueryClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  qc.setQueryData(billingKeys.tier(), {
    tier: 'free',
    limits: {
      maxPracticeStudents: 3,
      maxSessionMinutes: 30,
      maxSessionsPerWeek: null,
      maxOfflineParsingPerMonth: 10,
    },
  })
  return qc
}

/**
 * Seeds localStorage with guest progress data.
 * Must render as a component so useEffect runs inside the React tree.
 */
function SeedLocalStorage({
  sessionCount,
  lastVisitHoursAgo,
  dismissed,
  children,
}: {
  sessionCount: number
  lastVisitHoursAgo?: number
  dismissed?: boolean
  children: React.ReactNode
}) {
  useEffect(() => {
    localStorage.setItem('guest-session-count', sessionCount.toString())
    if (lastVisitHoursAgo !== undefined) {
      const ts = Date.now() - lastVisitHoursAgo * 60 * 60 * 1000
      localStorage.setItem('guest-last-visit', ts.toString())
    } else {
      localStorage.removeItem('guest-last-visit')
    }
    if (dismissed) {
      localStorage.setItem('guest-banner-dismissed', '1')
    } else {
      localStorage.removeItem('guest-banner-dismissed')
    }
  }, [sessionCount, lastVisitHoursAgo, dismissed])

  return <>{children}</>
}

/** Page-like container to show banner in context */
function PageShell({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <div
      className={css({
        maxWidth: '600px',
        margin: '0 auto',
      })}
    >
      <div
        className={css({
          padding: '0.5rem 1rem',
          backgroundColor: 'gray.100',
          fontSize: '0.75rem',
          color: 'gray.500',
          textAlign: 'center',
          borderBottom: '1px solid',
          borderColor: 'gray.200',
        })}
      >
        {label}
      </div>
      {children}
      <div
        className={css({
          padding: '2rem',
          color: 'gray.400',
          textAlign: 'center',
          fontSize: '0.875rem',
        })}
      >
        (page content below banner)
      </div>
    </div>
  )
}

const meta: Meta<typeof GuestProgressBanner> = {
  title: 'Billing/GuestProgressBanner',
  component: GuestProgressBanner,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof GuestProgressBanner>

// =============================================================================
// Dismissible variant (Summary page)
// =============================================================================

export const AfterThreeSessions: Story = {
  name: '3+ Sessions (Dismissible)',
  render: () => (
    <QueryClientProvider client={createGuestQueryClient()}>
      <SeedLocalStorage sessionCount={5}>
        <PageShell label="Summary Page (dismissible)">
          <GuestProgressBanner />
        </PageShell>
      </SeedLocalStorage>
    </QueryClientProvider>
  ),
}

export const ReturningAfter24h: Story = {
  name: 'Returning After 24h+',
  render: () => (
    <QueryClientProvider client={createGuestQueryClient()}>
      <SeedLocalStorage sessionCount={2} lastVisitHoursAgo={30}>
        <PageShell label="Summary Page (returning user)">
          <GuestProgressBanner />
        </PageShell>
      </SeedLocalStorage>
    </QueryClientProvider>
  ),
}

export const AccuracyImprovement: Story = {
  name: 'Accuracy Improvement (+15pp)',
  render: () => (
    <QueryClientProvider client={createGuestQueryClient()}>
      <SeedLocalStorage sessionCount={1}>
        <PageShell label="Summary Page (accuracy gain)">
          <GuestProgressBanner sessionAccuracy={0.85} previousAccuracy={0.7} />
        </PageShell>
      </SeedLocalStorage>
    </QueryClientProvider>
  ),
}

// =============================================================================
// Persistent variant (Dashboard)
// =============================================================================

export const PersistentDashboard: Story = {
  name: 'Persistent (Dashboard)',
  render: () => (
    <QueryClientProvider client={createGuestQueryClient()}>
      <SeedLocalStorage sessionCount={4}>
        <PageShell label="Dashboard (persistent, no dismiss button)">
          <GuestProgressBanner persistent />
        </PageShell>
      </SeedLocalStorage>
    </QueryClientProvider>
  ),
}

export const PersistentReturningUser: Story = {
  name: 'Persistent + Returning',
  render: () => (
    <QueryClientProvider client={createGuestQueryClient()}>
      <SeedLocalStorage sessionCount={3} lastVisitHoursAgo={48}>
        <PageShell label="Dashboard (persistent, returning after 48h)">
          <GuestProgressBanner persistent />
        </PageShell>
      </SeedLocalStorage>
    </QueryClientProvider>
  ),
}

export const PersistentAccuracy: Story = {
  name: 'Persistent + Accuracy Gain',
  render: () => (
    <QueryClientProvider client={createGuestQueryClient()}>
      <SeedLocalStorage sessionCount={2}>
        <PageShell label="Dashboard (persistent, accuracy improvement)">
          <GuestProgressBanner persistent sessionAccuracy={0.92} previousAccuracy={0.65} />
        </PageShell>
      </SeedLocalStorage>
    </QueryClientProvider>
  ),
}

// =============================================================================
// Edge cases
// =============================================================================

export const NotAGuest: Story = {
  name: 'Not a Guest (Hidden)',
  render: () => (
    <QueryClientProvider client={createFreeQueryClient()}>
      <SeedLocalStorage sessionCount={10}>
        <PageShell label="Free tier user — banner should be hidden">
          <GuestProgressBanner />
          <div
            className={css({
              padding: '1rem',
              backgroundColor: 'green.50',
              color: 'green.700',
              fontSize: '0.875rem',
              textAlign: 'center',
            })}
          >
            Banner correctly hidden for non-guest user
          </div>
        </PageShell>
      </SeedLocalStorage>
    </QueryClientProvider>
  ),
}

export const NoTrigger: Story = {
  name: 'No Trigger (Hidden)',
  render: () => (
    <QueryClientProvider client={createGuestQueryClient()}>
      <SeedLocalStorage sessionCount={1}>
        <PageShell label="Guest with only 1 session — no trigger met">
          <GuestProgressBanner />
          <div
            className={css({
              padding: '1rem',
              backgroundColor: 'yellow.50',
              color: 'yellow.700',
              fontSize: '0.875rem',
              textAlign: 'center',
            })}
          >
            Banner correctly hidden — only 1 session, no accuracy data, not returning
          </div>
        </PageShell>
      </SeedLocalStorage>
    </QueryClientProvider>
  ),
}

// =============================================================================
// Priority demonstration
// =============================================================================

export const PriorityOrder: Story = {
  name: 'Priority: 24h > Accuracy > Sessions',
  render: () => (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '2rem' })}>
      {/* All three triggers active — should show 24h+ message (highest priority) */}
      <QueryClientProvider client={createGuestQueryClient()}>
        <SeedLocalStorage sessionCount={5} lastVisitHoursAgo={30}>
          <PageShell label="All triggers active — shows '24h+' (highest priority)">
            <GuestProgressBanner sessionAccuracy={0.9} previousAccuracy={0.6} />
          </PageShell>
        </SeedLocalStorage>
      </QueryClientProvider>

      {/* Accuracy + sessions active — should show accuracy message */}
      <QueryClientProvider client={createGuestQueryClient()}>
        <SeedLocalStorage sessionCount={5}>
          <PageShell label="Accuracy + 3+ sessions — shows 'accuracy' (2nd priority)">
            <GuestProgressBanner sessionAccuracy={0.9} previousAccuracy={0.6} />
          </PageShell>
        </SeedLocalStorage>
      </QueryClientProvider>

      {/* Only sessions trigger — should show sessions message */}
      <QueryClientProvider client={createGuestQueryClient()}>
        <SeedLocalStorage sessionCount={5}>
          <PageShell label="Only 3+ sessions — shows 'sessions' (3rd priority)">
            <GuestProgressBanner />
          </PageShell>
        </SeedLocalStorage>
      </QueryClientProvider>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
}
