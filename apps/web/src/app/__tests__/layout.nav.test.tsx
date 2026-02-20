import { render, screen } from '@testing-library/react'
import RootLayout from '../layout'

// Mock next/headers server functions (used by getRequestLocale)
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Map([['x-locale', 'en']]))),
  cookies: vi.fn(() => Promise.resolve({ get: () => undefined })),
}))

// Mock i18n helpers to avoid server-only dependencies
vi.mock('../../i18n/request', () => ({
  getRequestLocale: vi.fn(() => Promise.resolve('en')),
}))

vi.mock('../../i18n/messages', () => ({
  getMessages: vi.fn(() => Promise.resolve({})),
}))

// Mock auth and feature flags (layout imports these server-side modules)
vi.mock('../../auth', () => ({
  auth: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('../../lib/auth/admin-emails', () => ({
  isAdminEmail: vi.fn(() => false),
}))

vi.mock('../../lib/feature-flags', () => ({
  getAllFlags: vi.fn(() => Promise.resolve({})),
}))

// Mock ClientProviders
vi.mock('../../components/ClientProviders', () => ({
  ClientProviders: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="client-providers">{children}</div>
  ),
}))

describe('RootLayout', () => {
  it('renders children with ClientProviders', async () => {
    const pageContent = <div>Page content</div>

    // RootLayout is an async server component; await its JSX before rendering
    const jsx = await RootLayout({ children: pageContent })
    render(jsx)

    expect(screen.getByTestId('client-providers')).toBeInTheDocument()
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('renders html and body tags', async () => {
    const pageContent = <div>Test content</div>

    const jsx = await RootLayout({ children: pageContent })
    const { container } = render(jsx)

    const html = container.querySelector('html')
    const body = container.querySelector('body')

    expect(html).toBeInTheDocument()
    expect(html).toHaveAttribute('lang', 'en')
    expect(body).toBeInTheDocument()
  })
})
