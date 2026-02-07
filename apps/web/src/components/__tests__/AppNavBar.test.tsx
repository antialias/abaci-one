import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { vi } from 'vitest'
import { AppNavBar } from '../AppNavBar'

// Mock Next.js hooks
const mockUsePathname = vi.fn(() => '/games/matching')
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
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

describe('AppNavBar', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/games/matching')
  })

  it('renders navSlot in minimal variant for arcade pages', () => {
    // Minimal variant auto-detects for /arcade/* paths
    mockUsePathname.mockReturnValue('/arcade/matching')
    const navSlot = <div data-testid="nav-slot">Memory Pairs</div>

    render(<AppNavBar navSlot={navSlot} />)

    expect(screen.getByTestId('nav-slot')).toBeInTheDocument()
    expect(screen.getByText('Memory Pairs')).toBeInTheDocument()
  })

  it('does not render navSlot in full variant', () => {
    // /games/* path uses full variant (not auto-detected as minimal)
    render(<AppNavBar navSlot={<div data-testid="nav-slot">Slot</div>} />)

    expect(screen.queryByTestId('nav-slot')).not.toBeInTheDocument()
  })

  it('does not render nav branding when navSlot is undefined', () => {
    render(<AppNavBar />)

    expect(screen.queryByTestId('nav-slot')).not.toBeInTheDocument()
  })

  it('renders minimal variant for arcade pages with auto-detection', () => {
    // Auto-detection switches to minimal for /arcade/* paths
    mockUsePathname.mockReturnValue('/arcade/matching')
    const navSlot = <div data-testid="nav-slot">Game Name</div>

    render(<AppNavBar variant="full" navSlot={navSlot} />)

    expect(screen.getByTestId('nav-slot')).toBeInTheDocument()
  })

  it('renders hamburger menu button in full variant', () => {
    render(<AppNavBar />)

    // The hamburger menu renders a button with the ☰ character
    expect(screen.getByText('☰')).toBeInTheDocument()
  })
})
