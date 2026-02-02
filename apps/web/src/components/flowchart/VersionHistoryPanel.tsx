'use client'

import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'
import {
  useRestoreVersion,
  useVersionHistory,
  type FlowchartVersion,
} from '../../hooks/useVersionHistory'

interface VersionHistoryPanelProps {
  sessionId: string
  onRestore: () => void
  onPreview: (version: FlowchartVersion | null) => void
  previewingVersion: FlowchartVersion | null
}

export function VersionHistoryPanel({
  sessionId,
  onRestore,
  onPreview,
  previewingVersion,
}: VersionHistoryPanelProps) {
  const { data, isLoading, error } = useVersionHistory(sessionId)

  const restoreMutation = useRestoreVersion(sessionId)

  const versions = data?.versions ?? []
  const currentVersion = data?.currentVersion ?? 0

  // Handle restore
  const handleRestore = async (versionNumber: number) => {
    if (versionNumber === currentVersion) return

    try {
      await restoreMutation.mutateAsync(versionNumber)
      // Clear preview if we were previewing the version we just restored
      onPreview(null)
      // Notify parent to refresh session data
      onRestore()
    } catch (err) {
      console.error('Failed to restore version:', err)
    }
  }

  // Format timestamp
  const formatTime = (date: string | Date) => {
    const d = new Date(date)
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (date: string | Date) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className={css({ padding: '4', textAlign: 'center' })}>
        <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
          Loading history...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={css({ padding: '4', textAlign: 'center' })}>
        <p className={css({ color: { base: 'red.600', _dark: 'red.400' } })}>
          {error instanceof Error ? error.message : 'Failed to fetch versions'}
        </p>
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className={css({ padding: '4', textAlign: 'center' })}>
        <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
          No version history yet. Generate or refine the flowchart to create versions.
        </p>
      </div>
    )
  }

  return (
    <div
      data-component="version-history-panel"
      className={vstack({ gap: '3', alignItems: 'stretch' })}
    >
      <p
        className={css({
          fontSize: 'sm',
          color: { base: 'gray.600', _dark: 'gray.400' },
        })}
      >
        {versions.length} version{versions.length !== 1 ? 's' : ''} saved
      </p>

      <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
        {versions.map((version) => {
          const isPreviewing = previewingVersion?.versionNumber === version.versionNumber

          return (
            <div
              key={version.id}
              data-element="version-item"
              data-version={version.versionNumber}
              data-current={version.isCurrent}
              data-previewing={isPreviewing}
              className={css({
                padding: '3',
                borderRadius: 'lg',
                border: '2px solid',
                borderColor: isPreviewing
                  ? { base: 'amber.400', _dark: 'amber.500' }
                  : version.isCurrent
                    ? { base: 'blue.300', _dark: 'blue.600' }
                    : { base: 'gray.200', _dark: 'gray.700' },
                backgroundColor: isPreviewing
                  ? { base: 'amber.50', _dark: 'amber.900/30' }
                  : version.isCurrent
                    ? { base: 'blue.50', _dark: 'blue.900/30' }
                    : { base: 'white', _dark: 'gray.800' },
              })}
            >
              <div className={hstack({ gap: '2', justifyContent: 'space-between' })}>
                <div className={hstack({ gap: '2', alignItems: 'center' })}>
                  {/* Version badge */}
                  <span
                    className={css({
                      padding: '0.5 2',
                      borderRadius: 'full',
                      fontSize: 'xs',
                      fontWeight: 'bold',
                      backgroundColor: version.isCurrent
                        ? { base: 'blue.500', _dark: 'blue.400' }
                        : { base: 'gray.200', _dark: 'gray.700' },
                      color: version.isCurrent ? 'white' : { base: 'gray.600', _dark: 'gray.400' },
                    })}
                  >
                    v{version.versionNumber}
                  </span>

                  {/* Source icon */}
                  <span title={version.source === 'generate' ? 'Generated' : 'Refined'}>
                    {version.source === 'generate' ? '✨' : '🔧'}
                  </span>

                  {/* Current indicator */}
                  {version.isCurrent && (
                    <span
                      className={css({
                        fontSize: 'xs',
                        color: { base: 'blue.600', _dark: 'blue.400' },
                        fontWeight: 'medium',
                      })}
                    >
                      Current
                    </span>
                  )}

                  {/* Previewing indicator */}
                  {isPreviewing && (
                    <span
                      className={css({
                        fontSize: 'xs',
                        color: { base: 'amber.600', _dark: 'amber.400' },
                        fontWeight: 'medium',
                      })}
                    >
                      Viewing
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className={hstack({ gap: '1' })}>
                  {/* Preview/Stop Preview button */}
                  <button
                    data-action={isPreviewing ? 'stop-preview' : 'preview-version'}
                    onClick={() => onPreview(isPreviewing ? null : version)}
                    className={css({
                      padding: '1 2',
                      fontSize: 'xs',
                      borderRadius: 'md',
                      backgroundColor: isPreviewing
                        ? { base: 'amber.100', _dark: 'amber.900' }
                        : { base: 'gray.100', _dark: 'gray.700' },
                      color: isPreviewing
                        ? { base: 'amber.700', _dark: 'amber.300' }
                        : { base: 'gray.700', _dark: 'gray.300' },
                      border: 'none',
                      cursor: 'pointer',
                      _hover: {
                        backgroundColor: isPreviewing
                          ? { base: 'amber.200', _dark: 'amber.800' }
                          : { base: 'gray.200', _dark: 'gray.600' },
                      },
                    })}
                  >
                    {isPreviewing ? 'Stop' : 'Preview'}
                  </button>

                  {/* Restore button - only for non-current versions */}
                  {!version.isCurrent && (
                    <button
                      data-action="restore-version"
                      onClick={() => handleRestore(version.versionNumber)}
                      disabled={restoreMutation.isPending}
                      className={css({
                        padding: '1 2',
                        fontSize: 'xs',
                        borderRadius: 'md',
                        backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
                        color: { base: 'blue.700', _dark: 'blue.300' },
                        border: 'none',
                        cursor: 'pointer',
                        _hover: {
                          backgroundColor: { base: 'blue.200', _dark: 'blue.800' },
                        },
                        _disabled: {
                          opacity: 0.5,
                          cursor: 'not-allowed',
                        },
                      })}
                    >
                      {restoreMutation.isPending &&
                      restoreMutation.variables === version.versionNumber
                        ? 'Restoring...'
                        : 'Restore'}
                    </button>
                  )}
                </div>
              </div>

              {/* Source request (truncated) */}
              {version.sourceRequest && (
                <p
                  className={css({
                    marginTop: '2',
                    fontSize: 'sm',
                    color: { base: 'gray.600', _dark: 'gray.400' },
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineClamp: 2,
                  })}
                >
                  {version.sourceRequest}
                </p>
              )}

              {/* Validation status and timestamp */}
              <div
                className={hstack({
                  gap: '2',
                  marginTop: '2',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                })}
              >
                <div className={hstack({ gap: '2' })}>
                  {version.validationPassed !== null && (
                    <span
                      className={css({
                        fontSize: 'xs',
                        color: version.validationPassed
                          ? { base: 'green.600', _dark: 'green.400' }
                          : { base: 'red.600', _dark: 'red.400' },
                      })}
                    >
                      {version.validationPassed ? '✓ Valid' : '✗ Invalid'}
                    </span>
                  )}
                  {version.coveragePercent !== null && (
                    <span
                      className={css({
                        fontSize: 'xs',
                        color: { base: 'gray.500', _dark: 'gray.500' },
                      })}
                    >
                      {version.coveragePercent}% coverage
                    </span>
                  )}
                </div>

                <span
                  className={css({
                    fontSize: 'xs',
                    color: { base: 'gray.400', _dark: 'gray.500' },
                  })}
                >
                  {formatDate(version.createdAt)} {formatTime(version.createdAt)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
