'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../../../styled-system/css'

type ModelType = 'column-classifier' | 'boundary-detector'

interface SyncHistoryEntry {
  id: string
  status: 'success' | 'failed' | 'cancelled'
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  filesTransferred: number
  tombstonePruned: number | null
  error: string | null
}

interface SyncHistoryIndicatorProps {
  modelType: ModelType
  /** Trigger a refresh (e.g., increment after sync completes) */
  refreshTrigger?: number
}

/**
 * Compact sync history indicator
 *
 * Shows "Last sync: X ago" with expandable dropdown showing recent syncs.
 * Unobtrusive by default, informative on interaction.
 */
export function SyncHistoryIndicator({
  modelType,
  refreshTrigger = 0,
}: SyncHistoryIndicatorProps) {
  const [history, setHistory] = useState<SyncHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/vision-training/sync/history?modelType=${modelType}&limit=5`
      )
      if (response.ok) {
        const data = await response.json()
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error('[SyncHistoryIndicator] Failed to fetch history:', error)
    } finally {
      setLoading(false)
    }
  }, [modelType])

  // Fetch on mount and when refreshTrigger changes
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory, refreshTrigger])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!expanded) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded])

  // Don't render anything while loading or if no history
  if (loading || history.length === 0) {
    return null
  }

  const lastSync = history[0]
  const lastSyncTime = new Date(lastSync.startedAt)
  const timeAgo = formatTimeAgo(lastSyncTime)
  const isSuccess = lastSync.status === 'success'

  return (
    <div
      ref={containerRef}
      data-component="sync-history-indicator"
      className={css({ position: 'relative' })}
    >
      {/* Compact indicator - clickable */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          bg: 'transparent',
          border: 'none',
          borderRadius: 'md',
          cursor: 'pointer',
          fontSize: 'xs',
          color: isSuccess ? 'gray.500' : 'orange.400',
          _hover: { bg: 'gray.800' },
          transition: 'background 0.15s',
        })}
      >
        <span>{isSuccess ? '✓' : '⚠'}</span>
        <span>
          {isSuccess ? `Last sync: ${timeAgo}` : `Sync failed ${timeAgo}`}
        </span>
        <span
          className={css({
            fontSize: '10px',
            opacity: 0.6,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          })}
        >
          ▼
        </span>
      </button>

      {/* Expanded dropdown */}
      {expanded && (
        <div
          data-element="history-dropdown"
          className={css({
            position: 'absolute',
            top: '100%',
            right: 0,
            mt: 1,
            minWidth: '280px',
            bg: 'gray.850',
            border: '1px solid',
            borderColor: 'gray.700',
            borderRadius: 'lg',
            boxShadow: 'lg',
            zIndex: 50,
            overflow: 'hidden',
          })}
        >
          {/* Header */}
          <div
            className={css({
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'gray.700',
              fontSize: 'xs',
              fontWeight: 'medium',
              color: 'gray.400',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            })}
          >
            Recent Syncs
          </div>

          {/* History entries */}
          <div className={css({ py: 1 })}>
            {history.map((entry) => (
              <SyncHistoryRow key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Single row in the sync history dropdown
 */
function SyncHistoryRow({ entry }: { entry: SyncHistoryEntry }) {
  const time = new Date(entry.startedAt)
  const isSuccess = entry.status === 'success'
  const isFailed = entry.status === 'failed'

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 3,
        py: 2,
        fontSize: 'sm',
        _hover: { bg: 'gray.800' },
      })}
    >
      {/* Status icon */}
      <span
        className={css({
          flexShrink: 0,
          width: '16px',
          textAlign: 'center',
          color: isSuccess ? 'green.400' : isFailed ? 'red.400' : 'gray.500',
        })}
      >
        {isSuccess ? '✓' : isFailed ? '✗' : '○'}
      </span>

      {/* Time */}
      <span
        className={css({
          flexShrink: 0,
          width: '80px',
          color: 'gray.400',
          fontSize: 'xs',
        })}
        title={time.toLocaleString()}
      >
        {formatTimeAgo(time)}
      </span>

      {/* Details */}
      <span
        className={css({
          flex: 1,
          color: isFailed ? 'red.300' : 'gray.300',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        })}
        title={isFailed && entry.error ? entry.error : undefined}
      >
        {isFailed ? (
          truncateError(entry.error || 'Unknown error')
        ) : (
          <>
            {entry.filesTransferred} file{entry.filesTransferred !== 1 ? 's' : ''}
            {entry.durationMs !== null && (
              <span className={css({ color: 'gray.500', ml: 1 })}>
                · {formatDuration(entry.durationMs)}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  )
}

/**
 * Format a date as relative time (e.g., "2h ago", "Yesterday")
 */
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const secs = ms / 1000
  if (secs < 60) return `${secs.toFixed(1)}s`
  const mins = Math.floor(secs / 60)
  const remainingSecs = Math.round(secs % 60)
  return `${mins}m ${remainingSecs}s`
}

/**
 * Truncate error message for display
 */
function truncateError(error: string): string {
  // Extract key part of common errors
  if (error.includes('Cannot connect')) return 'Connection failed'
  if (error.includes('SSH')) return 'SSH error'
  if (error.includes('rsync')) return 'Sync error'
  if (error.includes('timeout')) return 'Timeout'

  // Generic truncation
  if (error.length > 30) return error.substring(0, 27) + '...'
  return error
}
