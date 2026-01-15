'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'

/** Query keys for deployment info */
export const deploymentInfoKeys = {
  all: ['deployment-info'] as const,
  buildInfo: () => [...deploymentInfoKeys.all, 'build-info'] as const,
  health: () => [...deploymentInfoKeys.all, 'health'] as const,
}

/** Instance information from the build-info API */
export interface InstanceInfo {
  hostname: string
  containerId: string
  nodeEnv: string
}

/** Redis status from the build-info API */
export interface RedisStatus {
  configured: boolean
  connected: boolean
  status: string
}

/** Socket.IO status from the build-info API */
export interface SocketIOStatus {
  adapter: 'redis' | 'memory'
}

/** Git information from the build-info API */
export interface GitInfo {
  branch?: string
  commit?: string
  commitShort?: string
  tag?: string
  isDirty?: boolean
}

/** Full build-info API response */
export interface BuildInfoResponse {
  version: string
  buildTimestamp: number
  buildNumber?: string
  environment: string
  nodeVersion: string
  git: GitInfo
  instance: InstanceInfo
  redis: RedisStatus
  socketio: SocketIOStatus
}

/** Database health check result */
export interface DatabaseHealthCheck {
  status: 'ok' | 'error'
  latencyMs?: number
  error?: string
}

/** Health API response */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  checks: {
    database: DatabaseHealthCheck
  }
  version?: string
  commit?: string
}

/**
 * Fetch build info from the API
 */
async function fetchBuildInfo(): Promise<BuildInfoResponse> {
  const res = await api('build-info')
  if (!res.ok) throw new Error('Failed to fetch build info')
  return res.json()
}

/**
 * Fetch health status from the API
 */
async function fetchHealth(): Promise<HealthResponse> {
  const res = await api('health')
  // Note: health endpoint returns 503 when unhealthy, but we still want the data
  return res.json()
}

/**
 * Hook to fetch deployment and instance information.
 *
 * Fetches both build-info (instance details, Redis status, etc.)
 * and health status (database connectivity, etc.).
 *
 * The build info is fetched once and cached, while health status
 * refreshes periodically while the component is mounted.
 *
 * @example
 * ```tsx
 * function DeploymentInfo() {
 *   const { buildInfo, health, isLoadingHealth } = useDeploymentInfo()
 *
 *   if (!buildInfo) return <Loading />
 *
 *   return (
 *     <div>
 *       <p>Instance: {buildInfo.instance.hostname}</p>
 *       <p>Health: {health?.status ?? 'checking...'}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export function useDeploymentInfo() {
  // Fetch build info (instance details) - cached indefinitely as it doesn't change
  const buildInfoQuery = useQuery({
    queryKey: deploymentInfoKeys.buildInfo(),
    queryFn: fetchBuildInfo,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  // Fetch health status - refreshes periodically
  const healthQuery = useQuery({
    queryKey: deploymentInfoKeys.health(),
    queryFn: fetchHealth,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refresh every 30 seconds while mounted
    retry: false, // Don't retry on failure - we'll show the error
  })

  return {
    /** Build and instance information */
    buildInfo: buildInfoQuery.data,
    /** Health check results */
    health: healthQuery.data,
    /** Whether build info is loading */
    isLoadingBuildInfo: buildInfoQuery.isLoading,
    /** Whether health is loading */
    isLoadingHealth: healthQuery.isLoading,
    /** Error from health check (if any) */
    healthError: healthQuery.error,
    /** Error from build info (if any) */
    buildInfoError: buildInfoQuery.error,
    /** Manually refetch health */
    refetchHealth: healthQuery.refetch,
  }
}
