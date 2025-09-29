import React from 'react'
import { render, screen } from '@testing-library/react'
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

describe('AppNavBar', () => {
  it('renders navSlot when provided', () => {
    const navSlot = <div data-testid="nav-slot">🧩 Memory Pairs</div>

    render(<AppNavBar navSlot={navSlot} />)

    expect(screen.getByTestId('nav-slot')).toBeInTheDocument()
    expect(screen.getByText('🧩 Memory Pairs')).toBeInTheDocument()
  })

  it('does not render nav branding when navSlot is null', () => {
    render(<AppNavBar navSlot={null} />)

    expect(screen.queryByTestId('nav-slot')).not.toBeInTheDocument()
  })

  it('does not render nav branding when navSlot is undefined', () => {
    render(<AppNavBar />)

    expect(screen.queryByTestId('nav-slot')).not.toBeInTheDocument()
  })

  it('renders minimal variant for game pages', () => {
    const navSlot = <div data-testid="nav-slot">Game Name</div>

    render(<AppNavBar variant="full" navSlot={navSlot} />)

    // Should auto-detect minimal variant for /games/matching path
    expect(screen.getByTestId('nav-slot')).toBeInTheDocument()
  })

  it('renders fullscreen toggle button', () => {
    const navSlot = <div data-testid="nav-slot">Game Name</div>

    render(<AppNavBar navSlot={navSlot} />)

    // Check that fullscreen toggle button is present
    expect(screen.getByTitle('Enter Fullscreen')).toBeInTheDocument()
  })
})