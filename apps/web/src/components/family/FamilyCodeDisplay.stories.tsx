import type { Meta, StoryObj } from '@storybook/react'
import { useEffect } from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'
import { FamilyCodeDisplay } from './FamilyCodeDisplay'

const PLAYER_ID = 'story-player-1'

// ---------------------------------------------------------------------------
// Fetch mock decorator — intercepts /api/family/children/.../code calls
// ---------------------------------------------------------------------------

function withMockedFetch(linkedParentCount: number, maxParents: number) {
  return function MockFetchDecorator({ children }: { children: React.ReactNode }) {
    useEffect(() => {
      const originalFetch = window.fetch
      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()

        if (url.includes('/api/family/children/') && url.endsWith('/code')) {
          const method = init?.method?.toUpperCase() ?? 'GET'
          if (method === 'GET' || method === 'POST') {
            return new Response(
              JSON.stringify({
                familyCode: method === 'POST' ? 'NEW-REGEN' : 'FAM-AB12',
                linkedParentCount,
                maxParents,
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
          <FamilyCodeDisplay
            playerId={PLAYER_ID}
            playerName="Sonia"
            isOpen
            onClose={() => {}}
          />
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
          <FamilyCodeDisplay
            playerId={PLAYER_ID}
            playerName="Sonia"
            isOpen
            onClose={() => {}}
          />
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
          <FamilyCodeDisplay
            playerId={PLAYER_ID}
            playerName="Sonia"
            isOpen
            onClose={() => {}}
          />
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
          <FamilyCodeDisplay
            playerId={PLAYER_ID}
            playerName="Sonia"
            isOpen
            onClose={() => {}}
          />
        </MockFetch>
      </StoryShell>
    )
  },
}
