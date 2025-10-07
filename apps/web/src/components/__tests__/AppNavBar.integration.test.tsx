import { render, screen, waitFor } from '@testing-library/react'
import React, { Suspense } from 'react'
import { vi } from 'vitest'
import { AppNavBar } from '../AppNavBar'

// Mock Next.js hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/games/matching',
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

    // Initially should show loading fallback
    expect(screen.getByTestId('nav-loading')).toBeInTheDocument()

    // Wait for lazy component to load and render
    await waitFor(() => {
      expect(screen.getByText('🧩 Memory Pairs')).toBeInTheDocument()
    })

    // Verify loading state is gone
    expect(screen.queryByTestId('nav-loading')).not.toBeInTheDocument()
  })

  it('reproduces the issue: lazy component without Suspense boundary fails to render', async () => {
    // This test reproduces the actual issue - lazy components need Suspense
    const MatchingNavContent = () => <h1>🧩 Memory Pairs</h1>

    const LazyMatchingNav = React.lazy(() => Promise.resolve({ default: MatchingNavContent }))

    // This is what's happening in the actual app - lazy component without Suspense
    const navSlot = <LazyMatchingNav />

    // This should throw an error or not render properly
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      render(<AppNavBar navSlot={navSlot} />)

      // The lazy component should not render without Suspense
      expect(screen.queryByText('🧩 Memory Pairs')).not.toBeInTheDocument()
    } catch (error) {
      // Expected to fail - lazy components need Suspense boundary
      expect(error.message).toContain('Suspense')
    }

    consoleSpy.mockRestore()
  })

  it('simulates Next.js App Router parallel route slot structure', async () => {
    // This mimics the actual navSlot structure from Next.js App Router
    const mockParallelRouteSlot = {
      $$typeof: Symbol.for('react.element'),
      type: {
        $$typeof: Symbol.for('react.lazy'),
        _payload: Promise.resolve({
          default: () => <h1>🧩 Memory Pairs</h1>,
        }),
        _init: (payload: any) => payload.then((module: any) => module.default),
      },
      key: null,
      ref: null,
      props: {
        parallelRouterKey: 'nav',
        segmentPath: ['nav'],
        template: {},
        notFoundStyles: [],
      },
    }

    // This is the structure we're actually receiving from Next.js
    render(<AppNavBar navSlot={mockParallelRouteSlot as any} />)

    // This should fail to render the content without proper handling
    expect(screen.queryByText('🧩 Memory Pairs')).not.toBeInTheDocument()
  })
})
