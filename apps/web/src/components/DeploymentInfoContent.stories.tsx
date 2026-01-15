import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { css } from '../../styled-system/css'
import { DeploymentInfoContent } from './DeploymentInfoContent'
import type { BuildInfoResponse, HealthResponse } from '@/hooks/useDeploymentInfo'

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
    containerId: 'abc123def456789xyz',
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

const Wrapper = createWrapper()

const meta: Meta<typeof DeploymentInfoContent> = {
  title: 'Components/DeploymentInfoContent',
  component: DeploymentInfoContent,
  decorators: [
    (Story) => (
      <Wrapper>
        <div
          className={css({
            maxWidth: '400px',
            margin: '0 auto',
            padding: '4',
            bg: 'bg.surface',
            borderRadius: 'lg',
            boxShadow: 'lg',
          })}
        >
          <Story />
        </div>
      </Wrapper>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof DeploymentInfoContent>

// =============================================================================
// Default States
// =============================================================================

export const Default: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo()}
      healthOverride={createMockHealth()}
    />
  ),
}

export const BlueInstance: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo({
        instance: {
          hostname: 'abaci-blue',
          containerId: 'blue123def456',
          nodeEnv: 'production',
        },
      })}
      healthOverride={createMockHealth()}
    />
  ),
}

export const GreenInstance: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo({
        instance: {
          hostname: 'abaci-green',
          containerId: 'green789abc123',
          nodeEnv: 'production',
        },
      })}
      healthOverride={createMockHealth()}
    />
  ),
}

// =============================================================================
// Environment Variants
// =============================================================================

export const Development: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo({
        environment: 'development',
        instance: {
          hostname: 'localhost',
          containerId: 'unknown',
          nodeEnv: 'development',
        },
      })}
      healthOverride={createMockHealth()}
    />
  ),
}

export const DirtyBranch: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo({
        git: {
          branch: 'feature/new-feature',
          commit: 'abc123def456789',
          commitShort: 'abc123d',
          isDirty: true,
        },
      })}
      healthOverride={createMockHealth()}
    />
  ),
}

// =============================================================================
// Loading States
// =============================================================================

export const Loading: Story = {
  render: () => <DeploymentInfoContent buildInfoOverride={createMockBuildInfo()} forceLoading />,
}

// =============================================================================
// Health States
// =============================================================================

export const Healthy: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo()}
      healthOverride={createMockHealth({ status: 'healthy' })}
    />
  ),
}

export const Unhealthy: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo()}
      healthOverride={createMockHealth({
        status: 'unhealthy',
        checks: {
          database: {
            status: 'error',
            error: 'Connection refused',
          },
        },
      })}
    />
  ),
}

export const HealthError: Story = {
  render: () => (
    <DeploymentInfoContent buildInfoOverride={createMockBuildInfo()} forceHealthError />
  ),
}

export const HighLatency: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo()}
      healthOverride={createMockHealth({
        checks: {
          database: {
            status: 'ok',
            latencyMs: 450,
          },
        },
      })}
    />
  ),
}

// =============================================================================
// Redis States
// =============================================================================

export const RedisConnected: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo({
        redis: { configured: true, connected: true, status: 'ready' },
        socketio: { adapter: 'redis' },
      })}
      healthOverride={createMockHealth()}
    />
  ),
}

export const RedisDisconnected: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo({
        redis: { configured: true, connected: false, status: 'error' },
        socketio: { adapter: 'redis' },
      })}
      healthOverride={createMockHealth()}
    />
  ),
}

export const NoRedis: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo({
        redis: { configured: false, connected: false, status: 'not configured' },
        socketio: { adapter: 'memory' },
      })}
      healthOverride={createMockHealth()}
    />
  ),
}

// =============================================================================
// Dark Mode
// =============================================================================

export const DarkMode: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <Wrapper>
        <div
          data-color-mode="dark"
          className={css({
            maxWidth: '400px',
            margin: '0 auto',
            padding: '4',
            bg: 'gray.900',
            borderRadius: 'lg',
            boxShadow: 'lg',
            colorScheme: 'dark',
          })}
        >
          <Story />
        </div>
      </Wrapper>
    ),
  ],
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo()}
      healthOverride={createMockHealth()}
    />
  ),
}

// =============================================================================
// Edge Cases
// =============================================================================

export const LongBranchName: Story = {
  render: () => (
    <DeploymentInfoContent
      buildInfoOverride={createMockBuildInfo({
        git: {
          branch: 'feature/very-long-branch-name-that-might-overflow-the-container',
          commitShort: 'abc123d',
          isDirty: false,
        },
      })}
      healthOverride={createMockHealth()}
    />
  ),
}

export const NoInstanceInfo: Story = {
  render: () => {
    const buildInfo = createMockBuildInfo()
    // Remove instance to simulate static-only build info
    const { instance: _instance, redis: _redis, socketio: _socketio, ...staticOnly } = buildInfo
    return (
      <DeploymentInfoContent
        buildInfoOverride={staticOnly as BuildInfoResponse}
        healthOverride={createMockHealth()}
      />
    )
  },
}
