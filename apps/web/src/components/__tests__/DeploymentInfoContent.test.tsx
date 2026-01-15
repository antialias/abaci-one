import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DeploymentInfoContent } from '../DeploymentInfoContent'
import type { BuildInfoResponse, HealthResponse } from '@/hooks/useDeploymentInfo'

// Mock the useDeploymentInfo hook
vi.mock('@/hooks/useDeploymentInfo', () => ({
  useDeploymentInfo: vi.fn(() => ({
    buildInfo: null,
    health: null,
    isLoadingBuildInfo: false,
    isLoadingHealth: true,
    healthError: null,
    buildInfoError: null,
    refetchHealth: vi.fn(),
  })),
}))

// Mock the static build info
vi.mock('@/generated/build-info.json', () => ({
  default: {
    version: '1.0.0',
    buildTimestamp: 1704067200000, // Jan 1, 2024
    environment: 'development',
    nodeVersion: 'v20.10.0',
    git: {
      branch: 'main',
      commit: 'abc123def456789',
      commitShort: 'abc123d',
      isDirty: false,
    },
  },
}))

// Create mock data factories
const createMockBuildInfo = (overrides?: Partial<BuildInfoResponse>): BuildInfoResponse => ({
  version: '1.2.3',
  buildTimestamp: Date.now() - 3600000, // 1 hour ago
  environment: 'production',
  nodeVersion: 'v20.10.0',
  git: {
    branch: 'main',
    commit: '4fbdb3fe50076ce1517266adb7bcb1bd18c5a7db',
    commitShort: '4fbdb3f',
    isDirty: false,
  },
  instance: {
    hostname: 'abaci-blue',
    containerId: 'abc123def456',
    nodeEnv: 'production',
  },
  redis: {
    configured: true,
    connected: true,
    status: 'ready',
  },
  socketio: {
    adapter: 'redis',
  },
  ...overrides,
})

const createMockHealth = (overrides?: Partial<HealthResponse>): HealthResponse => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  checks: {
    database: {
      status: 'ok',
      latencyMs: 5,
    },
  },
  ...overrides,
})

// Wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('DeploymentInfoContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the component with data-component attribute', () => {
      const { container } = render(
        <DeploymentInfoContent buildInfoOverride={createMockBuildInfo()} />,
        {
          wrapper: createWrapper(),
        }
      )

      expect(container.querySelector('[data-component="deployment-info"]')).toBeTruthy()
    })

    it('renders version from build info', () => {
      render(
        <DeploymentInfoContent buildInfoOverride={createMockBuildInfo({ version: '2.0.0' })} />,
        {
          wrapper: createWrapper(),
        }
      )

      expect(screen.getByText('2.0.0')).toBeInTheDocument()
    })

    it('renders branch name', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo({
            git: { branch: 'feature-branch', commitShort: 'abc123', isDirty: false },
          })}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('feature-branch')).toBeInTheDocument()
    })

    it('renders dirty indicator when branch is dirty', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo({
            git: { branch: 'main', commitShort: 'abc123', isDirty: true },
          })}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('(dirty)')).toBeInTheDocument()
    })

    it('renders environment badge with correct variant', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo({ environment: 'production' })}
        />,
        {
          wrapper: createWrapper(),
        }
      )

      expect(screen.getByText('production')).toBeInTheDocument()
    })
  })

  describe('instance section', () => {
    it('renders hostname from instance info', () => {
      render(<DeploymentInfoContent buildInfoOverride={createMockBuildInfo()} />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText('abaci-blue')).toBeInTheDocument()
    })

    it('renders truncated container ID', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo({
            instance: {
              hostname: 'test',
              containerId: 'abc123def456789xyz',
              nodeEnv: 'production',
            },
          })}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('abc123def456')).toBeInTheDocument()
    })

    it('renders Socket.IO adapter status', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo({ socketio: { adapter: 'redis' } })}
        />,
        {
          wrapper: createWrapper(),
        }
      )

      expect(screen.getByText('redis')).toBeInTheDocument()
    })

    it('renders Redis connection status', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo({
            redis: { configured: true, connected: true, status: 'ready' },
          })}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    it('shows Redis disconnected when configured but not connected', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo({
            redis: { configured: true, connected: false, status: 'error' },
          })}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })

    it('shows Redis not configured when not configured', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo({
            redis: { configured: false, connected: false, status: 'not configured' },
          })}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('Not configured')).toBeInTheDocument()
    })
  })

  describe('health section', () => {
    it('shows loading state for health check', () => {
      render(<DeploymentInfoContent buildInfoOverride={createMockBuildInfo()} forceLoading />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText('Checking...')).toBeInTheDocument()
    })

    it('shows healthy status when health check passes', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo()}
          healthOverride={createMockHealth()}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('Healthy')).toBeInTheDocument()
    })

    it('shows unhealthy status when health check fails', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo()}
          healthOverride={createMockHealth({ status: 'unhealthy' })}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('Unhealthy')).toBeInTheDocument()
    })

    it('shows error status when health fetch fails', () => {
      render(<DeploymentInfoContent buildInfoOverride={createMockBuildInfo()} forceHealthError />, {
        wrapper: createWrapper(),
      })

      expect(screen.getByText('Error')).toBeInTheDocument()
    })

    it('shows database latency when available', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo()}
          healthOverride={createMockHealth({
            checks: { database: { status: 'ok', latencyMs: 12 } },
          })}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('12ms')).toBeInTheDocument()
    })

    it('shows database OK status', () => {
      render(
        <DeploymentInfoContent
          buildInfoOverride={createMockBuildInfo()}
          healthOverride={createMockHealth({
            checks: { database: { status: 'ok', latencyMs: 5 } },
          })}
        />,
        { wrapper: createWrapper() }
      )

      expect(screen.getByText('OK')).toBeInTheDocument()
    })
  })

  describe('data attributes', () => {
    it('has data-component on root element', () => {
      const { container } = render(
        <DeploymentInfoContent buildInfoOverride={createMockBuildInfo()} />,
        {
          wrapper: createWrapper(),
        }
      )

      expect(container.querySelector('[data-component="deployment-info"]')).toBeTruthy()
    })

    it('has data-element on section headers', () => {
      const { container } = render(
        <DeploymentInfoContent buildInfoOverride={createMockBuildInfo()} />,
        {
          wrapper: createWrapper(),
        }
      )

      expect(container.querySelector('[data-element="section-instance"]')).toBeTruthy()
      expect(container.querySelector('[data-element="section-health"]')).toBeTruthy()
    })

    it('has data-element on info rows', () => {
      const { container } = render(
        <DeploymentInfoContent buildInfoOverride={createMockBuildInfo()} />,
        {
          wrapper: createWrapper(),
        }
      )

      expect(container.querySelector('[data-element="row-version"]')).toBeTruthy()
      expect(container.querySelector('[data-element="row-hostname"]')).toBeTruthy()
      expect(container.querySelector('[data-element="row-health-status"]')).toBeTruthy()
    })
  })

  describe('fallback to static build info', () => {
    it('uses static version when buildInfo is not available', () => {
      render(<DeploymentInfoContent />, { wrapper: createWrapper() })

      // Should fall back to mocked static build info
      expect(screen.getByText('1.0.0')).toBeInTheDocument()
    })

    it('uses static environment when buildInfo is not available', () => {
      render(<DeploymentInfoContent />, { wrapper: createWrapper() })

      expect(screen.getByText('development')).toBeInTheDocument()
    })
  })
})
