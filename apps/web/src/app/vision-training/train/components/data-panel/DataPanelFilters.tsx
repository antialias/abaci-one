'use client'

import { useCallback, useMemo } from 'react'
import { css } from '../../../../../../styled-system/css'
import { TimelineRangeSelector } from '@/components/vision/TimelineRangeSelector'
import {
  type DataPanelItem,
  type DataPanelFilters as FilterState,
  type CaptureTypeFilter,
  type TimeRangeMode,
  getDefaultFilters,
  applyFilters,
  isPassiveDevice,
} from './types'

export interface DataPanelFiltersProps<T extends DataPanelItem> {
  /** All items to filter */
  items: T[]
  /** Current filter values */
  filters: FilterState
  /** Callback when filters change */
  onFiltersChange: (filters: FilterState) => void
  /** Whether filters panel is expanded */
  isExpanded: boolean
  /** Toggle expansion */
  onToggleExpanded: () => void
  /** Label for items (e.g., "frames", "images") */
  itemLabel?: string
}

/**
 * Shared filter component for data panels.
 * Works with any DataPanelItem type.
 */
export function DataPanelFilters<T extends DataPanelItem>({
  items,
  filters,
  onFiltersChange,
  isExpanded,
  onToggleExpanded,
  itemLabel = 'items',
}: DataPanelFiltersProps<T>) {
  // Extract unique values for dropdowns
  const { devices, sessions, players, passiveCount, explicitCount } = useMemo(() => {
    const deviceSet = new Set<string>()
    const sessionSet = new Set<string>()
    const playerSet = new Set<string>()
    let passive = 0
    let explicit = 0

    for (const item of items) {
      deviceSet.add(item.deviceId)
      if (item.sessionId) sessionSet.add(item.sessionId)
      if (item.playerId) playerSet.add(item.playerId)
      if (isPassiveDevice(item.deviceId)) {
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
  }, [items])

  // Convert items to timeline format
  const timelineImages = useMemo(() => {
    return items
      .filter((item) => item.capturedAt)
      .map((item) => ({
        timestamp: new Date(item.capturedAt).getTime(),
        sessionId: item.sessionId || item.deviceId,
      }))
  }, [items])

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

  const filteredCount = useMemo(() => applyFilters(items, filters).length, [items, filters])

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
    <div data-component="data-panel-filters">
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
            {filteredCount} / {items.length} {itemLabel}
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
                  { value: 'all', label: `All (${items.length})` },
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
