import type { Meta, StoryObj } from '@storybook/react'
import { useEffect } from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'
import { FamilyCodeDisplay } from './FamilyCodeDisplay'

const PLAYER_ID = 'story-player-1'

// ---------------------------------------------------------------------------
// Fetch mock decorator — intercepts /api/family/children/.../code calls
// ---------------------------------------------------------------------------

interface MockFetchOptions {
  linkedParentCount: number
  maxParents: number
  /** ISO string for when the code expires, or null */
  expiresAt?: string | null
  /** ISO string for when the code was generated, or null */
  generatedAt?: string | null
}

function withMockedFetch(
  linkedParentCountOrOpts: number | MockFetchOptions,
  maxParentsArg?: number
) {
  const opts: MockFetchOptions =
    typeof linkedParentCountOrOpts === 'number'
      ? {
          linkedParentCount: linkedParentCountOrOpts,
          maxParents: maxParentsArg ?? 4,
        }
      : linkedParentCountOrOpts

  return function MockFetchDecorator({ children }: { children: React.ReactNode }) {
    useEffect(() => {
      const originalFetch = window.fetch
      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()

        if (url.includes('/api/family/children/') && url.endsWith('/code')) {
          const method = init?.method?.toUpperCase() ?? 'GET'
          if (method === 'POST') {
            // Regenerate always returns fresh 7-day expiry
            const now = new Date()
            const freshExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            return new Response(
              JSON.stringify({
                familyCode: 'NEW-REGEN',
                generatedAt: now.toISOString(),
                expiresAt: freshExpiry.toISOString(),
                linkedParentCount: opts.linkedParentCount,
                maxParents: opts.maxParents,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
          if (method === 'GET') {
            return new Response(
              JSON.stringify({
                familyCode: 'FAM-AB12',
                generatedAt: opts.generatedAt ?? null,
                expiresAt: opts.expiresAt ?? null,
                linkedParentCount: opts.linkedParentCount,
                maxParents: opts.maxParents,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          }
        }
        return originalFetch(input, init)
      }) as typeof window.fetch

      return () => {
        window.fetch = originalFetch
      }
    }, [])

    return <>{children}</>
  }
}

// ---------------------------------------------------------------------------
// Wrappers
// ---------------------------------------------------------------------------

function StoryShell({
  children,
  theme = 'light',
}: {
  children: React.ReactNode
  theme?: 'light' | 'dark'
}) {
  return (
    <ThemeProvider>
      <div
        data-theme={theme}
        className={css({
          padding: '2rem',
          minHeight: '400px',
          backgroundColor: theme === 'dark' ? '#1a1a2e' : '#f5f5f5',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        })}
      >
        {children}
      </div>
    </ThemeProvider>
  )
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof FamilyCodeDisplay> = {
  title: 'Family/FamilyCodeDisplay',
  component: FamilyCodeDisplay,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof FamilyCodeDisplay>

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Two of four parents linked — normal state. */
export const TwoOfFourParents: Story = {
  render: () => {
    const MockFetch = withMockedFetch(2, 4)
    return (
      <StoryShell>
        <MockFetch>
          <FamilyCodeDisplay playerId={PLAYER_ID} playerName="Sonia" isOpen onClose={() => {}} />
        </MockFetch>
      </StoryShell>
    )
  },
}

/** All four parent slots used — shows warning. */
export const AtCapacity: Story = {
  render: () => {
    const MockFetch = withMockedFetch(4, 4)
    return (
      <StoryShell>
        <MockFetch>
          <FamilyCodeDisplay playerId={PLAYER_ID} playerName="Sonia" isOpen onClose={() => {}} />
        </MockFetch>
      </StoryShell>
    )
  },
}

/** Only one parent — plenty of room. */
export const SingleParent: Story = {
  render: () => {
    const MockFetch = withMockedFetch(1, 4)
    return (
      <StoryShell>
        <MockFetch>
          <FamilyCodeDisplay playerId={PLAYER_ID} playerName="Sonia" isOpen onClose={() => {}} />
        </MockFetch>
      </StoryShell>
    )
  },
}

/** Dark mode — at capacity with warning. */
export const DarkModeAtCapacity: Story = {
  render: () => {
    const MockFetch = withMockedFetch(4, 4)
    return (
      <StoryShell theme="dark">
        <MockFetch>
          <FamilyCodeDisplay playerId={PLAYER_ID} playerName="Sonia" isOpen onClose={() => {}} />
        </MockFetch>
      </StoryShell>
    )
  },
}

// ---------------------------------------------------------------------------
// Expiry stories
// ---------------------------------------------------------------------------

/** Code expires in 5 days — normal countdown. */
export const ExpiresInFiveDays: Story = {
  render: () => {
    const now = new Date()
    const generatedAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    const expiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    const MockFetch = withMockedFetch({
      linkedParentCount: 1,
      maxParents: 4,
      generatedAt: generatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
    return (
      <StoryShell>
        <MockFetch>
          <FamilyCodeDisplay playerId={PLAYER_ID} playerName="Sonia" isOpen onClose={() => {}} />
        </MockFetch>
      </StoryShell>
    )
  },
}

/** Code expires tomorrow — amber warning. */
export const ExpiresTomorrow: Story = {
  render: () => {
    const now = new Date()
    const generatedAt = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) // 6 days ago
    const expiresAt = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000) // 1 day from now
    const MockFetch = withMockedFetch({
      linkedParentCount: 2,
      maxParents: 4,
      generatedAt: generatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
    return (
      <StoryShell>
        <MockFetch>
          <FamilyCodeDisplay playerId={PLAYER_ID} playerName="Sonia" isOpen onClose={() => {}} />
        </MockFetch>
      </StoryShell>
    )
  },
}

/** Code has expired — red badge, dimmed code, regenerate prompt. */
export const Expired: Story = {
  render: () => {
    const now = new Date()
    const generatedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
    const expiresAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    const MockFetch = withMockedFetch({
      linkedParentCount: 1,
      maxParents: 4,
      generatedAt: generatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
    return (
      <StoryShell>
        <MockFetch>
          <FamilyCodeDisplay playerId={PLAYER_ID} playerName="Sonia" isOpen onClose={() => {}} />
        </MockFetch>
      </StoryShell>
    )
  },
}
