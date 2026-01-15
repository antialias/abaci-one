'use client'

import {
  Activity,
  CheckCircle,
  Clock,
  Database,
  GitBranch,
  GitCommit,
  Package,
  Server,
  XCircle,
  Wifi,
  AlertCircle,
} from 'lucide-react'
import type React from 'react'
import { css } from '../../styled-system/css'
import { hstack, vstack } from '../../styled-system/patterns'
import {
  useDeploymentInfo,
  type BuildInfoResponse,
  type HealthResponse,
} from '@/hooks/useDeploymentInfo'
import buildInfoStatic from '@/generated/build-info.json'

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

function getTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  }

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit)
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`
    }
  }
  return 'just now'
}

/** Status badge component */
function StatusBadge({
  status,
  dataElement,
}: {
  status: 'healthy' | 'unhealthy' | 'loading' | 'error'
  dataElement?: string
}) {
  const colors = {
    healthy: {
      bg: { base: 'green.100', _dark: 'green.900' },
      color: { base: 'green.700', _dark: 'green.300' },
    },
    unhealthy: {
      bg: { base: 'red.100', _dark: 'red.900' },
      color: { base: 'red.700', _dark: 'red.300' },
    },
    loading: {
      bg: { base: 'yellow.100', _dark: 'yellow.900' },
      color: { base: 'yellow.700', _dark: 'yellow.300' },
    },
    error: {
      bg: { base: 'red.100', _dark: 'red.900' },
      color: { base: 'red.700', _dark: 'red.300' },
    },
  }

  const icons = {
    healthy: <CheckCircle size={14} />,
    unhealthy: <XCircle size={14} />,
    loading: <Activity size={14} className={css({ animation: 'pulse 1s infinite' })} />,
    error: <AlertCircle size={14} />,
  }

  const labels = {
    healthy: 'Healthy',
    unhealthy: 'Unhealthy',
    loading: 'Checking...',
    error: 'Error',
  }

  return (
    <span
      data-element={dataElement}
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '1',
        fontFamily: 'mono',
        fontSize: 'xs',
        fontWeight: 'medium',
        padding: '1 2',
        borderRadius: 'full',
        bg: colors[status].bg,
        color: colors[status].color,
      })}
    >
      {icons[status]}
      {labels[status]}
    </span>
  )
}

/** Skeleton loader for async content */
function Skeleton({ width = '100px' }: { width?: string }) {
  return (
    <span
      className={css({
        display: 'inline-block',
        width,
        height: '1em',
        borderRadius: 'sm',
        bg: 'bg.muted',
        animation: 'pulse 1.5s ease-in-out infinite',
      })}
    />
  )
}

/** Section header component */
function SectionHeader({
  icon,
  title,
  dataElement,
}: {
  icon: React.ReactNode
  title: string
  dataElement?: string
}) {
  return (
    <div
      data-element={dataElement}
      className={hstack({
        gap: '2',
        paddingY: '2',
        marginTop: '2',
        borderTop: '1px solid',
        borderColor: 'border.default',
        color: 'text.secondary',
      })}
    >
      {icon}
      <span
        className={css({
          fontWeight: 'semibold',
          fontSize: 'sm',
          textTransform: 'uppercase',
          letterSpacing: 'wide',
        })}
      >
        {title}
      </span>
    </div>
  )
}

/** Info row component */
function InfoRow({
  icon,
  label,
  value,
  dataElement,
}: {
  icon?: React.ReactNode
  label: string
  value: React.ReactNode
  dataElement?: string
}) {
  return (
    <div
      data-element={dataElement ? `row-${dataElement}` : undefined}
      className={hstack({
        justifyContent: 'space-between',
        gap: '4',
        paddingY: '2',
        borderBottom: '1px solid',
        borderColor: 'border.muted',
      })}
    >
      <div
        data-element={dataElement ? `label-${dataElement}` : undefined}
        className={hstack({ gap: '2', color: 'text.secondary' })}
      >
        {icon}
        <span className={css({ fontWeight: 'medium', fontSize: 'sm' })}>{label}</span>
      </div>
      <div
        data-element={dataElement ? `value-${dataElement}` : undefined}
        className={css({ textAlign: 'right', flex: '1', color: 'text.primary' })}
      >
        {value}
      </div>
    </div>
  )
}

/** Code/mono text badge */
function CodeBadge({
  children,
  variant = 'default',
  dataElement,
}: {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error'
  dataElement?: string
}) {
  const variants = {
    default: { bg: 'bg.subtle', color: 'text.primary' },
    success: {
      bg: { base: 'green.100', _dark: 'green.900' },
      color: { base: 'green.700', _dark: 'green.300' },
    },
    warning: {
      bg: { base: 'yellow.100', _dark: 'yellow.900' },
      color: { base: 'yellow.700', _dark: 'yellow.300' },
    },
    error: {
      bg: { base: 'red.100', _dark: 'red.900' },
      color: { base: 'red.700', _dark: 'red.300' },
    },
  }

  return (
    <span
      data-element={dataElement}
      className={css({
        fontFamily: 'mono',
        fontSize: 'sm',
        padding: '1 2',
        borderRadius: 'sm',
        bg: variants[variant].bg,
        color: variants[variant].color,
      })}
    >
      {children}
    </span>
  )
}

export interface DeploymentInfoContentProps {
  /** Override build info for testing/stories */
  buildInfoOverride?: BuildInfoResponse
  /** Override health data for testing/stories */
  healthOverride?: HealthResponse
  /** Force loading state for testing/stories */
  forceLoading?: boolean
  /** Force health error for testing/stories */
  forceHealthError?: boolean
}

export function DeploymentInfoContent({
  buildInfoOverride,
  healthOverride,
  forceLoading = false,
  forceHealthError = false,
}: DeploymentInfoContentProps = {}) {
  const {
    buildInfo: fetchedBuildInfo,
    health: fetchedHealth,
    isLoadingHealth,
    healthError,
  } = useDeploymentInfo()

  // Use overrides if provided, otherwise use fetched data
  const buildInfo = buildInfoOverride ?? fetchedBuildInfo
  const health = forceHealthError ? undefined : (healthOverride ?? fetchedHealth)
  // Only show loading if forceLoading is true OR (no healthOverride, not forcing error, and hook is loading)
  const showHealthLoading =
    forceLoading || (!healthOverride && !forceHealthError && isLoadingHealth)
  const showHealthError = forceHealthError || (!healthOverride && !!healthError)

  // Fall back to static build info for basic fields
  const version = buildInfo?.version ?? buildInfoStatic.version
  const buildTimestamp = buildInfo?.buildTimestamp ?? buildInfoStatic.buildTimestamp
  const git = buildInfo?.git ?? buildInfoStatic.git
  const environment = buildInfo?.environment ?? buildInfoStatic.environment
  const nodeVersion = buildInfo?.nodeVersion ?? buildInfoStatic.nodeVersion

  return (
    <div data-component="deployment-info" className={vstack({ alignItems: 'stretch', gap: '1' })}>
      {/* Build Info Section */}
      <InfoRow
        dataElement="version"
        icon={<Package size={16} />}
        label="Version"
        value={<CodeBadge dataElement="version-value">{version}</CodeBadge>}
      />

      <InfoRow
        dataElement="build-time"
        icon={<Clock size={16} />}
        label="Build Time"
        value={
          <div className={vstack({ alignItems: 'flex-end', gap: '0' })}>
            <span
              data-element="build-time-ago"
              className={css({ fontSize: 'sm', color: 'text.primary' })}
            >
              {getTimeAgo(buildTimestamp)}
            </span>
            <span
              data-element="build-timestamp"
              className={css({ fontSize: 'xs', color: 'text.muted' })}
            >
              {formatTimestamp(buildTimestamp)}
            </span>
          </div>
        }
      />

      {git.branch && (
        <InfoRow
          dataElement="branch"
          icon={<GitBranch size={16} />}
          label="Branch"
          value={
            <CodeBadge dataElement="branch-value">
              {git.branch}
              {git.isDirty && (
                <span
                  data-element="dirty-indicator"
                  className={css({
                    color: { base: 'orange.600', _dark: 'orange.400' },
                    marginLeft: '1',
                  })}
                >
                  (dirty)
                </span>
              )}
            </CodeBadge>
          }
        />
      )}

      {git.commitShort && (
        <InfoRow
          dataElement="commit"
          icon={<GitCommit size={16} />}
          label="Commit"
          value={
            <div className={vstack({ alignItems: 'flex-end', gap: '0' })}>
              <CodeBadge dataElement="commit-short">{git.commitShort}</CodeBadge>
              {git.commit && (
                <span
                  data-element="commit-full"
                  className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'text.muted' })}
                >
                  {git.commit}
                </span>
              )}
            </div>
          }
        />
      )}

      <InfoRow
        dataElement="environment"
        icon={<Server size={16} />}
        label="Environment"
        value={
          <CodeBadge
            dataElement="environment-value"
            variant={environment === 'production' ? 'success' : 'warning'}
          >
            {environment}
          </CodeBadge>
        }
      />

      {/* Instance Section */}
      {buildInfo?.instance && (
        <>
          <SectionHeader
            icon={<Server size={14} />}
            title="Instance"
            dataElement="section-instance"
          />

          <InfoRow
            dataElement="hostname"
            label="Hostname"
            value={
              <CodeBadge dataElement="hostname-value">{buildInfo.instance.hostname}</CodeBadge>
            }
          />

          {buildInfo.instance.containerId && buildInfo.instance.containerId !== 'unknown' && (
            <InfoRow
              dataElement="container-id"
              label="Container"
              value={
                <CodeBadge dataElement="container-id-value">
                  {buildInfo.instance.containerId.slice(0, 12)}
                </CodeBadge>
              }
            />
          )}

          <InfoRow
            dataElement="socketio-adapter"
            icon={<Wifi size={16} />}
            label="Socket.IO"
            value={
              <CodeBadge
                dataElement="socketio-adapter-value"
                variant={buildInfo.socketio?.adapter === 'redis' ? 'success' : 'warning'}
              >
                {buildInfo.socketio?.adapter ?? 'memory'}
              </CodeBadge>
            }
          />

          <InfoRow
            dataElement="redis-status"
            icon={<Database size={16} />}
            label="Redis"
            value={
              buildInfo.redis ? (
                <CodeBadge
                  dataElement="redis-status-value"
                  variant={
                    buildInfo.redis.connected
                      ? 'success'
                      : buildInfo.redis.configured
                        ? 'error'
                        : 'warning'
                  }
                >
                  {buildInfo.redis.connected
                    ? 'Connected'
                    : buildInfo.redis.configured
                      ? 'Disconnected'
                      : 'Not configured'}
                </CodeBadge>
              ) : (
                <Skeleton width="80px" />
              )
            }
          />
        </>
      )}

      {/* Health Section */}
      <SectionHeader icon={<Activity size={14} />} title="Health" dataElement="section-health" />

      <InfoRow
        dataElement="health-status"
        label="Status"
        value={
          showHealthLoading ? (
            <StatusBadge status="loading" dataElement="health-status-value" />
          ) : showHealthError ? (
            <StatusBadge status="error" dataElement="health-status-value" />
          ) : (
            <StatusBadge
              status={health?.status === 'healthy' ? 'healthy' : 'unhealthy'}
              dataElement="health-status-value"
            />
          )
        }
      />

      <InfoRow
        dataElement="database-health"
        icon={<Database size={16} />}
        label="Database"
        value={
          showHealthLoading ? (
            <Skeleton width="100px" />
          ) : showHealthError ? (
            <CodeBadge dataElement="database-health-value" variant="error">
              Check failed
            </CodeBadge>
          ) : health?.checks?.database ? (
            <span className={hstack({ gap: '2' })}>
              <CodeBadge
                dataElement="database-health-value"
                variant={health.checks.database.status === 'ok' ? 'success' : 'error'}
              >
                {health.checks.database.status === 'ok' ? 'OK' : 'Error'}
              </CodeBadge>
              {health.checks.database.latencyMs !== undefined && (
                <span
                  data-element="database-latency"
                  className={css({ fontSize: 'xs', color: 'text.muted' })}
                >
                  {health.checks.database.latencyMs}ms
                </span>
              )}
            </span>
          ) : (
            <Skeleton width="80px" />
          )
        }
      />

      {/* Footer */}
      <InfoRow
        dataElement="node-version"
        label="Node"
        value={
          <span
            data-element="node-version-value"
            className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'text.muted' })}
          >
            {nodeVersion}
          </span>
        }
      />
    </div>
  )
}
