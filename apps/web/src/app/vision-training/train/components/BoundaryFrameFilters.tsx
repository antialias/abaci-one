'use client'

import { useCallback, useMemo, useState } from 'react'
import { css } from '../../../../../styled-system/css'
import { TimelineRangeSelector } from '@/components/vision/TimelineRangeSelector'
import type { QuadCorners } from '@/types/vision'

interface BoundaryFrame {
  baseName: string
  deviceId: string
  imagePath: string
  capturedAt: string
  corners: QuadCorners
  frameWidth: number
  frameHeight: number
  sessionId: string | null
  playerId: string | null
}

export type CaptureTypeFilter = 'all' | 'passive' | 'explicit'
export type TimeRangeMode = 'all' | 'before' | 'after' | 'between'

export interface BoundaryFrameFilters {
  /** Filter by capture type */
  captureType: CaptureTypeFilter
  /** Filter by device ID (empty = all) */
  deviceId: string
  /** Filter by session ID (empty = all) */
  sessionId: string
  /** Filter by player ID (empty = all) */
  playerId: string
  /** Time range filter mode */
  timeRangeMode: TimeRangeMode
  /** Before timestamp (for time filtering) */
  beforeTimestamp?: number
  /** After timestamp (for time filtering) */
  afterTimestamp?: number
}

export interface BoundaryFrameFiltersProps {
  /** All frames to filter */
  frames: BoundaryFrame[]
  /** Current filter values */
  filters: BoundaryFrameFilters
  /** Callback when filters change */
  onFiltersChange: (filters: BoundaryFrameFilters) => void
  /** Whether filters panel is expanded */
  isExpanded: boolean
  /** Toggle expansion */
  onToggleExpanded: () => void
}

/**
 * Determines if a device ID represents passive capture
 */
function isPassiveDevice(deviceId: string): boolean {
  return deviceId.startsWith('passive-')
}

/**
 * Apply filters to a list of frames
 */
export function applyFilters(
  frames: BoundaryFrame[],
  filters: BoundaryFrameFilters
): BoundaryFrame[] {
  return frames.filter((frame) => {
    // Capture type filter
    if (filters.captureType !== 'all') {
      const isPassive = isPassiveDevice(frame.deviceId)
      if (filters.captureType === 'passive' && !isPassive) return false
      if (filters.captureType === 'explicit' && isPassive) return false
    }

    // Device filter
    if (filters.deviceId && frame.deviceId !== filters.deviceId) {
      return false
    }

    // Session filter
    if (filters.sessionId && frame.sessionId !== filters.sessionId) {
      return false
    }

    // Player filter
    if (filters.playerId && frame.playerId !== filters.playerId) {
      return false
    }

    // Time range filter
    if (filters.timeRangeMode !== 'all' && frame.capturedAt) {
      const frameTime = new Date(frame.capturedAt).getTime()
      if (filters.timeRangeMode === 'before' && filters.beforeTimestamp !== undefined) {
        if (frameTime >= filters.beforeTimestamp) return false
      } else if (filters.timeRangeMode === 'after' && filters.afterTimestamp !== undefined) {
        if (frameTime <= filters.afterTimestamp) return false
      } else if (
        filters.timeRangeMode === 'between' &&
        filters.afterTimestamp !== undefined &&
        filters.beforeTimestamp !== undefined
      ) {
        if (frameTime <= filters.afterTimestamp || frameTime >= filters.beforeTimestamp) {
          return false
        }
      }
    }

    return true
  })
}

/**
 * Default filter values
 */
export function getDefaultFilters(): BoundaryFrameFilters {
  return {
    captureType: 'all',
    deviceId: '',
    sessionId: '',
    playerId: '',
    timeRangeMode: 'all',
  }
}

export function BoundaryFrameFilters({
  frames,
  filters,
  onFiltersChange,
  isExpanded,
  onToggleExpanded,
}: BoundaryFrameFiltersProps) {
  // Extract unique values for dropdowns
  const { devices, sessions, players, passiveCount, explicitCount } = useMemo(() => {
    const deviceSet = new Set<string>()
    const sessionSet = new Set<string>()
    const playerSet = new Set<string>()
    let passive = 0
    let explicit = 0

    for (const frame of frames) {
      deviceSet.add(frame.deviceId)
      if (frame.sessionId) sessionSet.add(frame.sessionId)
      if (frame.playerId) playerSet.add(frame.playerId)
      if (isPassiveDevice(frame.deviceId)) {
        passive++
      } else {
        explicit++
      }
    }

    return {
      devices: Array.from(deviceSet).sort(),
      sessions: Array.from(sessionSet).sort(),
      players: Array.from(playerSet).sort(),
      passiveCount: passive,
      explicitCount: explicit,
    }
  }, [frames])

  // Convert frames to timeline format
  const timelineImages = useMemo(() => {
    return frames
      .filter((f) => f.capturedAt)
      .map((f) => ({
        timestamp: new Date(f.capturedAt).getTime(),
        sessionId: f.sessionId || f.deviceId, // Use deviceId as fallback for grouping
      }))
  }, [frames])

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.captureType !== 'all') count++
    if (filters.deviceId) count++
    if (filters.sessionId) count++
    if (filters.playerId) count++
    if (filters.timeRangeMode !== 'all') count++
    return count
  }, [filters])

  const filteredCount = useMemo(() => applyFilters(frames, filters).length, [frames, filters])

  const handleTimeRangeChange = useCallback(
    (before?: number, after?: number) => {
      onFiltersChange({
        ...filters,
        beforeTimestamp: before,
        afterTimestamp: after,
      })
    },
    [filters, onFiltersChange]
  )

  const handleReset = useCallback(() => {
    onFiltersChange(getDefaultFilters())
  }, [onFiltersChange])

  return (
    <div data-component="boundary-frame-filters">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggleExpanded}
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          p: 3,
          bg: 'gray.800',
          border: '1px solid',
          borderColor: activeFilterCount > 0 ? 'purple.600' : 'gray.700',
          borderRadius: isExpanded ? 'lg lg 0 0' : 'lg',
          cursor: 'pointer',
          color: 'gray.100',
          _hover: { bg: 'gray.750' },
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
          <span>🔍</span>
          <span className={css({ fontWeight: 'medium' })}>Filters</span>
          {activeFilterCount > 0 && (
            <span
              className={css({
                px: 2,
                py: 0.5,
                bg: 'purple.600',
                borderRadius: 'full',
                fontSize: 'xs',
                fontWeight: 'bold',
              })}
            >
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
          <span className={css({ fontSize: 'sm', color: 'gray.400' })}>
            {filteredCount} / {frames.length} frames
          </span>
          <span
            className={css({
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            })}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div
          className={css({
            p: 4,
            bg: 'gray.850',
            border: '1px solid',
            borderTop: 'none',
            borderColor: activeFilterCount > 0 ? 'purple.600' : 'gray.700',
            borderRadius: '0 0 lg lg',
          })}
        >
          {/* Quick filters row */}
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: 3,
              mb: 4,
            })}
          >
            {/* Capture type toggle */}
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              })}
            >
              <label className={css({ fontSize: 'xs', color: 'gray.500' })}>Capture Type</label>
              <div
                className={css({
                  display: 'flex',
                  bg: 'gray.800',
                  borderRadius: 'md',
                  p: '2px',
                })}
              >
                {[
                  { value: 'all', label: `All (${frames.length})` },
                  { value: 'passive', label: `Passive (${passiveCount})` },
                  { value: 'explicit', label: `Explicit (${explicitCount})` },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      onFiltersChange({
                        ...filters,
                        captureType: opt.value as CaptureTypeFilter,
                      })
                    }
                    className={css({
                      px: 2,
                      py: 1,
                      borderRadius: 'sm',
                      border: 'none',
                      fontSize: 'xs',
                      fontWeight: 'medium',
                      cursor: 'pointer',
                      bg: filters.captureType === opt.value ? 'purple.600' : 'transparent',
                      color: filters.captureType === opt.value ? 'white' : 'gray.400',
                      _hover: { color: 'white' },
                    })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Device dropdown */}
            {devices.length > 1 && (
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                })}
              >
                <label className={css({ fontSize: 'xs', color: 'gray.500' })}>Device</label>
                <select
                  value={filters.deviceId}
                  onChange={(e) => onFiltersChange({ ...filters, deviceId: e.target.value })}
                  className={css({
                    px: 2,
                    py: 1.5,
                    bg: 'gray.800',
                    border: '1px solid',
                    borderColor: filters.deviceId ? 'purple.500' : 'gray.700',
                    borderRadius: 'md',
                    color: 'gray.200',
                    fontSize: 'sm',
                    cursor: 'pointer',
                    minWidth: '140px',
                  })}
                >
                  <option value="">All devices</option>
                  {devices.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Session dropdown */}
            {sessions.length > 0 && (
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                })}
              >
                <label className={css({ fontSize: 'xs', color: 'gray.500' })}>Session</label>
                <select
                  value={filters.sessionId}
                  onChange={(e) => onFiltersChange({ ...filters, sessionId: e.target.value })}
                  className={css({
                    px: 2,
                    py: 1.5,
                    bg: 'gray.800',
                    border: '1px solid',
                    borderColor: filters.sessionId ? 'purple.500' : 'gray.700',
                    borderRadius: 'md',
                    color: 'gray.200',
                    fontSize: 'sm',
                    cursor: 'pointer',
                    minWidth: '140px',
                  })}
                >
                  <option value="">All sessions</option>
                  {sessions.map((s) => (
                    <option key={s} value={s}>
                      {s.slice(0, 8)}...
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Player dropdown */}
            {players.length > 0 && (
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                })}
              >
                <label className={css({ fontSize: 'xs', color: 'gray.500' })}>Player</label>
                <select
                  value={filters.playerId}
                  onChange={(e) => onFiltersChange({ ...filters, playerId: e.target.value })}
                  className={css({
                    px: 2,
                    py: 1.5,
                    bg: 'gray.800',
                    border: '1px solid',
                    borderColor: filters.playerId ? 'purple.500' : 'gray.700',
                    borderRadius: 'md',
                    color: 'gray.200',
                    fontSize: 'sm',
                    cursor: 'pointer',
                    minWidth: '140px',
                  })}
                >
                  <option value="">All players</option>
                  {players.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset button */}
            {activeFilterCount > 0 && (
              <div className={css({ display: 'flex', alignItems: 'flex-end' })}>
                <button
                  type="button"
                  onClick={handleReset}
                  className={css({
                    px: 3,
                    py: 1.5,
                    bg: 'gray.700',
                    border: 'none',
                    borderRadius: 'md',
                    color: 'gray.300',
                    fontSize: 'sm',
                    cursor: 'pointer',
                    _hover: { bg: 'gray.600' },
                  })}
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* Time range filter */}
          <div
            className={css({
              borderTop: '1px solid',
              borderColor: 'gray.700',
              pt: 4,
            })}
          >
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                mb: 3,
              })}
            >
              <label className={css({ fontSize: 'sm', color: 'gray.400' })}>Time Range</label>
              <div
                className={css({
                  display: 'flex',
                  bg: 'gray.800',
                  borderRadius: 'md',
                  p: '2px',
                })}
              >
                {[
                  { value: 'all', label: 'All Time' },
                  { value: 'before', label: 'Before' },
                  { value: 'after', label: 'After' },
                  { value: 'between', label: 'Between' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      onFiltersChange({
                        ...filters,
                        timeRangeMode: opt.value as TimeRangeMode,
                      })
                    }
                    className={css({
                      px: 2,
                      py: 1,
                      borderRadius: 'sm',
                      border: 'none',
                      fontSize: 'xs',
                      fontWeight: 'medium',
                      cursor: 'pointer',
                      bg: filters.timeRangeMode === opt.value ? 'purple.600' : 'transparent',
                      color: filters.timeRangeMode === opt.value ? 'white' : 'gray.400',
                      _hover: { color: 'white' },
                    })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline selector */}
            {filters.timeRangeMode !== 'all' && timelineImages.length > 0 && (
              <TimelineRangeSelector
                images={timelineImages}
                mode={filters.timeRangeMode}
                beforeTimestamp={filters.beforeTimestamp}
                afterTimestamp={filters.afterTimestamp}
                onChange={handleTimeRangeChange}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
