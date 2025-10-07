import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
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

describe('AppNavBar Suspense Fix', () => {
  it('renders nav slot content with Suspense boundary (FIXED)', async () => {
    // Simulate the exact structure that Next.js App Router provides
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

    // Create a lazy component like Next.js does
    const LazyMatchingNav = React.lazy(() => Promise.resolve({ default: MatchingNavContent }))

    // This is what Next.js App Router passes to our component
    const navSlot = <LazyMatchingNav />

    render(<AppNavBar navSlot={navSlot} />)

    // Should show loading state briefly
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Wait for the lazy component to load and render
    await waitFor(() => {
      expect(screen.getByText('🧩 Memory Pairs')).toBeInTheDocument()
    })

    // Loading state should be gone
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()

    // Game name should be visible in the nav
    expect(screen.getByText('🧩 Memory Pairs')).toBeInTheDocument()
  })

  it('demonstrates the original issue was fixed', async () => {
    // This test shows that without our Suspense fix, this would have failed
    const MemoryQuizContent = () => <h1>🧠 Memory Lightning</h1>
    const LazyMemoryQuizNav = React.lazy(() => Promise.resolve({ default: MemoryQuizContent }))

    const navSlot = <LazyMemoryQuizNav />

    render(<AppNavBar navSlot={navSlot} />)

    // Without Suspense boundary in AppNavBar, this would fail to render
    // But now it works because we wrap navSlot in Suspense
    await waitFor(() => {
      expect(screen.getByText('🧠 Memory Lightning')).toBeInTheDocument()
    })
  })

  it('shows that lazy components need Suspense to render', () => {
    // This test shows what happens without Suspense - it should fail
    const TestContent = () => <h1>Test Content</h1>
    const LazyTest = React.lazy(() => Promise.resolve({ default: TestContent }))

    // Trying to render lazy component without Suspense should fail
    expect(() => render(<LazyTest />)).toThrow()
  })

  it('handles nav slot gracefully when null or undefined', () => {
    render(<AppNavBar navSlot={null} />)
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()

    render(<AppNavBar navSlot={undefined} />)
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })
})
