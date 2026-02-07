import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { vi } from 'vitest'
import { AppNavBar } from '../AppNavBar'

// Mock Next.js hooks - use /arcade path to get minimal variant which renders navSlot
vi.mock('next/navigation', () => ({
  usePathname: () => '/arcade/matching',
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock contexts
vi.mock('../../contexts/FullscreenContext', () => ({
  useFullscreen: () => ({
    isFullscreen: false,
    toggleFullscreen: vi.fn(),
    exitFullscreen: vi.fn(),
  }),
}))

vi.mock('../../contexts/DeploymentInfoContext', () => ({
  useDeploymentInfo: () => ({
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
  }),
}))

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark',
    resolvedTheme: 'dark',
    setTheme: vi.fn(),
  }),
}))

vi.mock('../../contexts/VisualDebugContext', () => ({
  useVisualDebug: () => ({
    isVisualDebugEnabled: false,
    toggleVisualDebug: vi.fn(),
    isDevelopment: false,
    isDebugAllowed: false,
  }),
}))

// Mock AbacusDisplayDropdown
vi.mock('../AbacusDisplayDropdown', () => ({
  AbacusDisplayDropdown: () => <div data-testid="abacus-dropdown">Dropdown</div>,
}))

describe('AppNavBar Suspense Fix', () => {
  it('renders nav slot content when wrapped in Suspense by caller', async () => {
    // Next.js App Router wraps lazy components in Suspense before passing as navSlot
    const MatchingNavContent = () => (
      <h1
        style={{
          fontSize: '18px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
          backgroundClip: 'text',
          color: 'transparent',
          margin: 0,
        }}
      >
        Memory Pairs
      </h1>
    )

    const LazyMatchingNav = React.lazy(() => Promise.resolve({ default: MatchingNavContent }))

    // Caller wraps in Suspense (like Next.js does)
    const navSlot = (
      <React.Suspense fallback={<div>Loading...</div>}>
        <LazyMatchingNav />
      </React.Suspense>
    )

    render(<AppNavBar navSlot={navSlot} />)

    // Wait for the lazy component to load and render
    await waitFor(() => {
      expect(screen.getByText('Memory Pairs')).toBeInTheDocument()
    })
  })

  it('renders eagerly loaded nav slot content', () => {
    // Non-lazy components render immediately
    const navSlot = <h1>Memory Lightning</h1>

    render(<AppNavBar navSlot={navSlot} />)

    expect(screen.getByText('Memory Lightning')).toBeInTheDocument()
  })

  it('handles nav slot gracefully when null or undefined', () => {
    const { unmount } = render(<AppNavBar navSlot={null} />)
    // Should render without crashing
    unmount()

    render(<AppNavBar navSlot={undefined} />)
    // Should render without crashing
  })
})
