'use client'

import { createDeploymentInfoHook, type DeploymentData } from '@tidepool/debug-panel'
import { api } from '@/lib/queryClient'

interface BuildInfoResponse {
  version: string
  buildTimestamp: number
  buildNumber?: string
  environment: string
  nodeVersion: string
  git: {
    commit?: string
    commitShort?: string
    branch?: string
    tag?: string
    isDirty?: boolean
  }
  instance: {
    hostname: string
    containerId: string
    nodeEnv: string
  }
  redis: {
    configured: boolean
    connected: boolean
    status: string
  }
  socketio: {
    adapter: 'redis' | 'memory'
  }
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  checks: {
    database: {
      status: 'ok' | 'error'
      latencyMs?: number
      error?: string
    }
  }
  version?: string
  commit?: string
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  const intervals: [string, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ]
  for (const [unit, secs] of intervals) {
    const interval = Math.floor(seconds / secs)
    if (interval >= 1) return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`
  }
  return 'just now'
}

function transformAbacusData(rawBuild: unknown, rawHealth?: unknown): DeploymentData {
  const build = rawBuild as BuildInfoResponse
  const health = rawHealth as HealthResponse | undefined

  const sections: DeploymentData['sections'] = []

  // Build section
  const buildItems: DeploymentData['sections'][0]['items'] = []

  buildItems.push({ label: 'Version', value: build.version, mono: true })

  if (build.buildTimestamp) {
    buildItems.push({
      label: 'Built',
      value: formatTimeAgo(build.buildTimestamp),
      detail: new Date(build.buildTimestamp).toLocaleString(),
    })
  }

  if (build.git.branch) {
    const branchVal = build.git.isDirty ? `${build.git.branch} (dirty)` : build.git.branch
    buildItems.push({ label: 'Branch', value: branchVal, mono: true })
  }

  if (build.git.commitShort) {
    buildItems.push({
      label: 'Commit',
      value: build.git.commitShort,
      mono: true,
      detail: build.git.commit,
    })
  }

  buildItems.push({
    label: 'Environment',
    value: build.environment,
    status: build.environment === 'production' ? 'ok' : 'warn',
  })

  sections.push({ title: 'Build', items: buildItems })

  // Instance section
  const instanceItems: DeploymentData['sections'][0]['items'] = []

  instanceItems.push({ label: 'Hostname', value: build.instance.hostname, mono: true })

  if (build.instance.containerId && build.instance.containerId !== 'unknown') {
    instanceItems.push({
      label: 'Container',
      value: build.instance.containerId.slice(0, 12),
      mono: true,
    })
  }

  instanceItems.push({
    label: 'Socket.IO',
    value: build.socketio?.adapter ?? 'memory',
    status: build.socketio?.adapter === 'redis' ? 'ok' : 'warn',
  })

  instanceItems.push({
    label: 'Redis',
    value: build.redis.connected ? 'Connected' : build.redis.configured ? 'Disconnected' : 'Not configured',
    status: build.redis.connected ? 'ok' : build.redis.configured ? 'error' : 'warn',
  })

  sections.push({ title: 'Instance', items: instanceItems })

  // Health section
  const healthItems: DeploymentData['sections'][0]['items'] = []

  if (health?.status) {
    healthItems.push({
      label: 'Status',
      value: health.status === 'healthy' ? 'Healthy' : 'Unhealthy',
      status: health.status === 'healthy' ? 'ok' : 'error',
    })
  }

  if (health?.checks?.database) {
    const db = health.checks.database
    healthItems.push({
      label: 'Database',
      value: db.status === 'ok' ? 'OK' : db.error || 'Error',
      status: db.status === 'ok' ? 'ok' : 'error',
      detail: db.latencyMs !== undefined ? `${db.latencyMs}ms` : undefined,
    })
  }

  healthItems.push({ label: 'Node', value: build.nodeVersion, mono: true })

  sections.push({ title: 'Health', items: healthItems })

  return { sections }
}

export const useAbacusDeploymentInfo = createDeploymentInfoHook({
  buildInfoUrl: '/api/build-info',
  healthUrl: '/api/health',
  healthPollInterval: 30_000,
  transform: transformAbacusData,
})
