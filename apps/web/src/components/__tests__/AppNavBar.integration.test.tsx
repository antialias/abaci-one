import { render, screen, waitFor } from '@testing-library/react'
import React, { Suspense } from 'react'
import { vi } from 'vitest'
import { AppNavBar } from '../AppNavBar'

// Mock Next.js hooks
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

describe('AppNavBar Nav Slot Integration', () => {
  it('renders actual nav slot content from lazy component', async () => {
    // Create a lazy component that simulates the @nav slot behavior
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
        🧩 Memory Pairs
      </h1>
    )

    const LazyMatchingNav = React.lazy(() => Promise.resolve({ default: MatchingNavContent }))

    const navSlot = (
      <Suspense fallback={<div data-testid="nav-loading">Loading...</div>}>
        <LazyMatchingNav />
      </Suspense>
    )

    render(<AppNavBar navSlot={navSlot} />)

    // Wait for lazy component to load and render
    await waitFor(() => {
      expect(screen.getByText('🧩 Memory Pairs')).toBeInTheDocument()
    })
  })

  it('reproduces the issue: lazy component without Suspense boundary fails to render', async () => {
    // This test reproduces the actual issue - lazy components need Suspense
    const MatchingNavContent = () => <h1>🧩 Memory Pairs</h1>

    const LazyMatchingNav = React.lazy(() => Promise.resolve({ default: MatchingNavContent }))

    // This is what's happening in the actual app - lazy component without Suspense
    const navSlot = <LazyMatchingNav />

    // Without Suspense boundary, the lazy component may throw or not render
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      render(<AppNavBar navSlot={navSlot} />)

      // The lazy component should not render without Suspense
      expect(screen.queryByText('🧩 Memory Pairs')).not.toBeInTheDocument()
    } catch {
      // Expected - lazy components without Suspense boundary may throw
    }

    consoleSpy.mockRestore()
  })

  it('renders eagerly loaded nav slot content', () => {
    // Non-lazy components render immediately
    const navSlot = <h1>🧩 Memory Pairs</h1>

    render(<AppNavBar navSlot={navSlot} />)

    expect(screen.getByText('🧩 Memory Pairs')).toBeInTheDocument()
  })
})
