import { render, screen } from '@testing-library/react'
import RootLayout from '../layout'

// Mock AppNavBar to verify it receives the nav prop
const MockAppNavBar = ({ navSlot }: { navSlot?: React.ReactNode }) => (
  <div data-testid="app-nav-bar">
    {navSlot && <div data-testid="nav-slot-content">{navSlot}</div>}
  </div>
)

jest.mock('../../components/AppNavBar', () => ({
  AppNavBar: MockAppNavBar,
}))

// Mock all context providers
jest.mock('../../contexts/AbacusDisplayContext', () => ({
  AbacusDisplayProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../contexts/UserProfileContext', () => ({
  UserProfileProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../contexts/GameModeContext', () => ({
  GameModeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../contexts/FullscreenContext', () => ({
  FullscreenProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('RootLayout with nav slot', () => {
  it('passes nav slot to AppNavBar', () => {
    const navContent = <div>Memory Lightning</div>
    const pageContent = <div>Page content</div>

    render(<RootLayout nav={navContent}>{pageContent}</RootLayout>)

    expect(screen.getByTestId('app-nav-bar')).toBeInTheDocument()
    expect(screen.getByTestId('nav-slot-content')).toBeInTheDocument()
    expect(screen.getByText('Memory Lightning')).toBeInTheDocument()
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('works without nav slot', () => {
    const pageContent = <div>Page content</div>

    render(<RootLayout nav={null}>{pageContent}</RootLayout>)

    expect(screen.getByTestId('app-nav-bar')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-slot-content')).not.toBeInTheDocument()
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })
})
