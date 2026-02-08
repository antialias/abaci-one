import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ContentBannerSlot,
  NavBannerSlot,
  ProjectingBanner,
} from '../BannerSlots'
import {
  SessionModeBannerProvider,
} from '@/contexts/SessionModeBannerContext'
import type { SessionMode } from '@/lib/curriculum/session-mode'

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}))

// Mock Panda CSS
vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

// Mock react-use-measure to return fixed dimensions
vi.mock('react-use-measure', () => ({
  default: () => [vi.fn(), { width: 400, height: 60 }],
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      style,
      ...props
    }: {
      children: React.ReactNode
      style?: Record<string, unknown>
      [key: string]: unknown
    }) =>
      React.createElement('div', { 'data-testid': 'motion-div', ...props }, children),
  },
  useSpring: (initial: number) => ({
    set: vi.fn(),
    get: () => initial,
  }),
}))

// Mock Z_INDEX constants
vi.mock('@/constants/zIndex', () => ({
  Z_INDEX: {
    SESSION_MODE_BANNER_ANIMATING: 1000,
  },
}))

// Mock child banner components
vi.mock('../SessionModeBanner', () => ({
  SessionModeBanner: ({
    sessionMode,
    variant,
  }: {
    sessionMode: SessionMode
    variant: string
  }) =>
    React.createElement(
      'div',
      {
        'data-testid': 'session-mode-banner',
        'data-mode': sessionMode.type,
        'data-variant': variant,
      },
      `SessionModeBanner: ${sessionMode.type}`
    ),
}))

vi.mock('../CompactBanner', () => ({
  CompactBanner: ({
    sessionMode,
  }: {
    sessionMode: SessionMode
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'compact-banner', 'data-mode': sessionMode.type },
      `CompactBanner: ${sessionMode.type}`
    ),
}))

vi.mock('../ActiveSessionBanner', () => ({
  ActiveSessionBanner: ({
    session,
    variant,
  }: {
    session: { id: string }
    variant: string
  }) =>
    React.createElement(
      'div',
      {
        'data-testid': 'active-session-banner',
        'data-session-id': session.id,
        'data-variant': variant,
      },
      `ActiveSession: ${session.id}`
    ),
}))

// Mock ReadinessReport
vi.mock('../ReadinessReport', () => ({
  ReadinessReport: () => React.createElement('div', { 'data-testid': 'readiness-report' }),
}))

// ============================================================================
// Mock IntersectionObserver
// ============================================================================

let intersectionCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null =
  null

beforeEach(() => {
  // Mock IntersectionObserver
  const mockIntersectionObserver = vi.fn().mockImplementation((callback: any) => {
    intersectionCallback = callback
    return {
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    }
  })
  vi.stubGlobal('IntersectionObserver', mockIntersectionObserver)
})

afterEach(() => {
  intersectionCallback = null
  vi.restoreAllMocks()
})

// ============================================================================
// Fixtures
// ============================================================================

const remediationMode: SessionMode = {
  type: 'remediation',
  weakSkills: [{ skillId: 'basic.+3', displayName: '+3', pKnown: 0.35 }],
  focusDescription: 'Strengthening +3',
}

const maintenanceMode: SessionMode = {
  type: 'maintenance',
  focusDescription: 'All skills strong',
  skillCount: 12,
}

// ============================================================================
// ContentBannerSlot tests
// ============================================================================

describe('ContentBannerSlot', () => {
  it('renders nothing when no sessionMode or activeSession', () => {
    const { container } = render(
      <SessionModeBannerProvider sessionMode={null} isLoading={false}>
        <ContentBannerSlot />
      </SessionModeBannerProvider>
    )
    const slot = container.querySelector('[data-slot="content-banner"]')
    expect(slot).not.toBeInTheDocument()
  })

  it('renders banner when sessionMode is provided', () => {
    render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <ContentBannerSlot />
      </SessionModeBannerProvider>
    )
    const slot = document.querySelector('[data-slot="content-banner"]')
    expect(slot).toBeInTheDocument()
    expect(screen.getByTestId('session-mode-banner')).toBeInTheDocument()
  })

  it('renders SessionModeBanner with dashboard variant', () => {
    render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <ContentBannerSlot />
      </SessionModeBannerProvider>
    )
    const banner = screen.getByTestId('session-mode-banner')
    expect(banner).toHaveAttribute('data-variant', 'dashboard')
  })

  it('marks slot as active when content slot is active', () => {
    render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <ContentBannerSlot />
      </SessionModeBannerProvider>
    )
    const slot = document.querySelector('[data-slot="content-banner"]')
    expect(slot).toHaveAttribute('data-active', 'true')
  })

  it('applies className prop', () => {
    render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <ContentBannerSlot className="custom-class" />
      </SessionModeBannerProvider>
    )
    const slot = document.querySelector('[data-slot="content-banner"]')
    expect(slot).toHaveClass('custom-class')
  })

  it('renders activeSession banner when activeSession is provided', () => {
    const activeSession = {
      id: 'session-123',
      completedCount: 5,
      totalCount: 10,
      createdAt: new Date(),
      startedAt: new Date(),
      lastActivityAt: new Date(),
      focusDescription: 'Practice session',
      sessionSkillIds: ['basic.+3'],
      skillChanges: null,
    }
    render(
      <SessionModeBannerProvider
        sessionMode={null}
        isLoading={false}
        activeSession={activeSession}
      >
        <ContentBannerSlot />
      </SessionModeBannerProvider>
    )
    const banner = screen.getByTestId('active-session-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveAttribute('data-session-id', 'session-123')
    expect(banner).toHaveAttribute('data-variant', 'dashboard')
  })

  it('prioritizes activeSession over sessionMode', () => {
    const activeSession = {
      id: 'session-123',
      completedCount: 5,
      totalCount: 10,
      createdAt: new Date(),
      startedAt: new Date(),
      lastActivityAt: new Date(),
      focusDescription: 'Practice session',
      sessionSkillIds: ['basic.+3'],
      skillChanges: null,
    }
    render(
      <SessionModeBannerProvider
        sessionMode={remediationMode}
        isLoading={false}
        activeSession={activeSession}
      >
        <ContentBannerSlot />
      </SessionModeBannerProvider>
    )
    // Active session should take priority
    expect(screen.getByTestId('active-session-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('session-mode-banner')).not.toBeInTheDocument()
  })
})

// ============================================================================
// NavBannerSlot tests
// ============================================================================

describe('NavBannerSlot', () => {
  it('renders nothing when outside provider', () => {
    const { container } = render(<NavBannerSlot />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no sessionMode or activeSession', () => {
    const { container } = render(
      <SessionModeBannerProvider sessionMode={null} isLoading={false}>
        <NavBannerSlot />
      </SessionModeBannerProvider>
    )
    const slot = container.querySelector('[data-slot="nav-banner"]')
    expect(slot).not.toBeInTheDocument()
  })

  it('renders when sessionMode is provided', () => {
    render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <NavBannerSlot />
      </SessionModeBannerProvider>
    )
    const slot = document.querySelector('[data-slot="nav-banner"]')
    expect(slot).toBeInTheDocument()
  })

  it('renders CompactBanner for session mode', () => {
    render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <NavBannerSlot />
      </SessionModeBannerProvider>
    )
    expect(screen.getByTestId('compact-banner')).toBeInTheDocument()
  })

  it('renders ActiveSessionBanner for active session with nav variant', () => {
    const activeSession = {
      id: 'session-456',
      completedCount: 3,
      totalCount: 8,
      createdAt: new Date(),
      startedAt: new Date(),
      lastActivityAt: new Date(),
      focusDescription: 'Test session',
      sessionSkillIds: [],
      skillChanges: null,
    }
    render(
      <SessionModeBannerProvider
        sessionMode={null}
        isLoading={false}
        activeSession={activeSession}
      >
        <NavBannerSlot />
      </SessionModeBannerProvider>
    )
    const banner = screen.getByTestId('active-session-banner')
    expect(banner).toHaveAttribute('data-variant', 'nav')
  })

  it('applies className prop', () => {
    render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <NavBannerSlot className="nav-class" />
      </SessionModeBannerProvider>
    )
    const slot = document.querySelector('[data-slot="nav-banner"]')
    expect(slot).toHaveClass('nav-class')
  })
})

// ============================================================================
// Slot activation logic
// ============================================================================

describe('BannerSlots - slot activation', () => {
  it('content slot is active when only content slot is registered', () => {
    render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <ContentBannerSlot />
      </SessionModeBannerProvider>
    )
    const slot = document.querySelector('[data-slot="content-banner"]')
    expect(slot).toHaveAttribute('data-active', 'true')
  })

  it('both slots rendered with content active by default', () => {
    render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <ContentBannerSlot />
        <NavBannerSlot />
      </SessionModeBannerProvider>
    )
    const contentSlot = document.querySelector('[data-slot="content-banner"]')
    const navSlot = document.querySelector('[data-slot="nav-banner"]')
    expect(contentSlot).toHaveAttribute('data-active', 'true')
    expect(navSlot).toHaveAttribute('data-active', 'false')
  })

  it('nav slot collapses when content is active (height: 0)', () => {
    render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <ContentBannerSlot />
        <NavBannerSlot />
      </SessionModeBannerProvider>
    )
    const navSlot = document.querySelector('[data-slot="nav-banner"]') as HTMLElement
    expect(navSlot.style.height).toBe('0px')
  })
})

// ============================================================================
// ProjectingBanner tests
// ============================================================================

describe('ProjectingBanner', () => {
  it('renders nothing when outside provider', () => {
    const { container } = render(<ProjectingBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when not animating', () => {
    const { container } = render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <ProjectingBanner />
      </SessionModeBannerProvider>
    )
    // ProjectingBanner should not render anything when not animating
    expect(document.querySelector('[data-component="animating-overlay"]')).not.toBeInTheDocument()
  })
})

// ============================================================================
// Re-exports
// ============================================================================

describe('BannerSlots - re-exports', () => {
  it('exports ContentSlot as alias for ContentBannerSlot', async () => {
    const { ContentSlot } = await import('../BannerSlots')
    expect(ContentSlot).toBe(ContentBannerSlot)
  })

  it('exports NavSlot as alias for NavBannerSlot', async () => {
    const { NavSlot } = await import('../BannerSlots')
    expect(NavSlot).toBe(NavBannerSlot)
  })
})

// ============================================================================
// Edge cases
// ============================================================================

describe('BannerSlots - edge cases', () => {
  it('content slot hides interaction when not active (pointerEvents: none)', () => {
    render(
      <SessionModeBannerProvider sessionMode={remediationMode} isLoading={false}>
        <ContentBannerSlot />
        <NavBannerSlot />
      </SessionModeBannerProvider>
    )
    // Content is active by default, so pointerEvents should not be 'none'
    const contentSlot = document.querySelector('[data-slot="content-banner"]') as HTMLElement
    expect(contentSlot.style.pointerEvents).not.toBe('none')
  })

  it('renders different session mode types correctly', () => {
    render(
      <SessionModeBannerProvider sessionMode={maintenanceMode} isLoading={false}>
        <ContentBannerSlot />
      </SessionModeBannerProvider>
    )
    const banner = screen.getByTestId('session-mode-banner')
    expect(banner).toHaveAttribute('data-mode', 'maintenance')
  })
})
