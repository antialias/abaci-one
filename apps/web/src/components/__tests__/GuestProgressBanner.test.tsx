import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GuestProgressBanner, recordGuestSession } from '../GuestProgressBanner'

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}))

// Mock Panda CSS
vi.mock('../../../styled-system/css', () => ({
  css: vi.fn((...args: unknown[]) => `mocked-css ${JSON.stringify(args)}`),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Control tier via module-level variable
let mockTier = 'guest'
vi.mock('@/hooks/useTier', () => ({
  useTier: () => ({
    tier: mockTier,
    limits: {
      maxPracticeStudents: 1,
      maxSessionMinutes: 10,
      maxSessionsPerWeek: null,
      maxOfflineParsingPerMonth: 3,
    },
    isLoading: false,
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('GuestProgressBanner', () => {
  let originalLocalStorage: Storage

  beforeEach(() => {
    mockTier = 'guest'
    // Use a simple in-memory storage mock
    const store: Record<string, string> = {}
    originalLocalStorage = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key]
        }),
        clear: vi.fn(() => {
          Object.keys(store).forEach((k) => delete store[k])
        }),
        get length() {
          return Object.keys(store).length
        },
        key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    })
  })

  describe('rendering', () => {
    it('returns null when user is not a guest', () => {
      mockTier = 'free'
      const Wrapper = createWrapper()
      const { container } = render(
        <Wrapper>
          <GuestProgressBanner />
        </Wrapper>
      )
      expect(container.innerHTML).toBe('')
    })

    it('returns null when no trigger conditions are met', () => {
      // No sessions, no previous visit, no accuracy improvement
      const Wrapper = createWrapper()
      const { container } = render(
        <Wrapper>
          <GuestProgressBanner />
        </Wrapper>
      )
      expect(container.innerHTML).toBe('')
    })

    it('shows banner after 3+ sessions', () => {
      // Seed 3 sessions
      localStorage.setItem('guest-session-count', '3')

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <GuestProgressBanner />
        </Wrapper>
      )

      expect(screen.getByText(/You've completed 3 sessions/)).toBeTruthy()
      expect(screen.getByText('Create a free account to keep your progress')).toBeTruthy()
    })

    it('shows returning user banner after 24h+ absence', () => {
      localStorage.setItem('guest-session-count', '2')
      // Set last visit to 25 hours ago
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000
      localStorage.setItem('guest-last-visit', twentyFiveHoursAgo.toString())

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <GuestProgressBanner />
        </Wrapper>
      )

      expect(screen.getByText(/Welcome back!/)).toBeTruthy()
      expect(screen.getByText('Create a free account to keep it safe')).toBeTruthy()
    })
  })

  describe('persistent prop', () => {
    it('hides dismiss button when persistent is true', () => {
      localStorage.setItem('guest-session-count', '5')

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <GuestProgressBanner persistent />
        </Wrapper>
      )

      expect(screen.getByText(/You've completed 5 sessions/)).toBeTruthy()
      expect(screen.queryByLabelText('Dismiss')).toBeNull()
    })

    it('shows dismiss button when persistent is false (default)', () => {
      localStorage.setItem('guest-session-count', '5')

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <GuestProgressBanner />
        </Wrapper>
      )

      expect(screen.getByLabelText('Dismiss')).toBeTruthy()
    })

    it('dismiss button hides banner and sets localStorage flag', () => {
      localStorage.setItem('guest-session-count', '5')

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <GuestProgressBanner />
        </Wrapper>
      )

      const dismissBtn = screen.getByLabelText('Dismiss')
      fireEvent.click(dismissBtn)

      // Banner should disappear
      expect(screen.queryByText(/You've completed 5 sessions/)).toBeNull()
      // Should set dismissed flag
      expect(localStorage.setItem).toHaveBeenCalledWith('guest-banner-dismissed', '1')
    })

    it('does not render when previously dismissed', () => {
      localStorage.setItem('guest-session-count', '10')
      localStorage.setItem('guest-banner-dismissed', '1')

      const Wrapper = createWrapper()
      const { container } = render(
        <Wrapper>
          <GuestProgressBanner />
        </Wrapper>
      )

      expect(container.querySelector('[data-component="guest-progress-banner"]')).toBeNull()
    })
  })

  describe('accuracy improvement trigger', () => {
    it('shows accuracy improvement message when accuracy jumped >= 5pp', () => {
      // Need at least some history for the hook to consider showing
      localStorage.setItem('guest-session-count', '1')

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <GuestProgressBanner sessionAccuracy={0.85} previousAccuracy={0.7} />
        </Wrapper>
      )

      expect(screen.getByText(/accuracy jumped from 70% to 85%/)).toBeTruthy()
      expect(screen.getByText('Create a free account to track your progress')).toBeTruthy()
    })

    it('does not show accuracy message when improvement < 5pp', () => {
      localStorage.setItem('guest-session-count', '1')

      const Wrapper = createWrapper()
      const { container } = render(
        <Wrapper>
          <GuestProgressBanner sessionAccuracy={0.73} previousAccuracy={0.7} />
        </Wrapper>
      )

      // 3pp improvement, should not trigger (and only 1 session so 3+ doesn't trigger either)
      expect(container.querySelector('[data-component="guest-progress-banner"]')).toBeNull()
    })

    it('does not show accuracy message when previousAccuracy is null', () => {
      localStorage.setItem('guest-session-count', '1')

      const Wrapper = createWrapper()
      const { container } = render(
        <Wrapper>
          <GuestProgressBanner sessionAccuracy={0.9} previousAccuracy={null} />
        </Wrapper>
      )

      expect(container.querySelector('[data-component="guest-progress-banner"]')).toBeNull()
    })
  })

  describe('message priority', () => {
    it('returning after 24h+ takes priority over accuracy improvement', () => {
      localStorage.setItem('guest-session-count', '2')
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000
      localStorage.setItem('guest-last-visit', twentyFiveHoursAgo.toString())

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <GuestProgressBanner sessionAccuracy={0.9} previousAccuracy={0.5} />
        </Wrapper>
      )

      // Should show "Welcome back!" not accuracy message
      expect(screen.getByText(/Welcome back!/)).toBeTruthy()
      expect(screen.queryByText(/accuracy jumped/)).toBeNull()
    })

    it('accuracy improvement takes priority over 3+ sessions', () => {
      localStorage.setItem('guest-session-count', '5')

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <GuestProgressBanner sessionAccuracy={0.95} previousAccuracy={0.6} />
        </Wrapper>
      )

      // Should show accuracy message, not "completed 5 sessions"
      expect(screen.getByText(/accuracy jumped from 60% to 95%/)).toBeTruthy()
      expect(screen.queryByText(/completed 5 sessions/)).toBeNull()
    })
  })

  describe('recordGuestSession', () => {
    it('increments session count in localStorage', () => {
      localStorage.setItem('guest-session-count', '2')
      recordGuestSession()
      expect(localStorage.setItem).toHaveBeenCalledWith('guest-session-count', '3')
    })

    it('starts from 0 when no previous count exists', () => {
      recordGuestSession()
      expect(localStorage.setItem).toHaveBeenCalledWith('guest-session-count', '1')
    })
  })

  describe('sign-in link', () => {
    it('links to /auth/signin', () => {
      localStorage.setItem('guest-session-count', '3')

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <GuestProgressBanner />
        </Wrapper>
      )

      const link = screen.getByRole('link')
      expect(link.getAttribute('href')).toBe('/auth/signin')
    })
  })
})
