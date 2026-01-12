'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { css } from '../../../../../../styled-system/css'
import type { ModelType } from '../wizard/types'
import type { QuadCorners } from '@/types/vision'
import { BOUNDARY_SAMPLE_CHANNEL } from '@/lib/vision/saveBoundarySample'
import { NumeralSelector } from '../NumeralSelector'
import {
  type AnyDataItem,
  type BoundaryDataItem,
  type ColumnDataItem,
  type DataPanelFilters as FilterState,
  type SyncStatus,
  type SyncProgress,
  getDefaultFilters,
  applyFilters,
  isBoundaryDataItem,
  isColumnDataItem,
} from './types'
import { DataPanelHeader } from './DataPanelHeader'
import { DataPanelFilters } from './DataPanelFilters'
import { DataPanelDetailPanel } from './DataPanelDetailPanel'
import { DataPanelCapturePanel } from './DataPanelCapturePanel'
import { BoundaryGridItem } from './BoundaryGridItem'
import { ColumnGridItem } from './ColumnGridItem'

type MobileTab = 'browse' | 'capture'
type RightPanelMode = 'capture' | 'detail'

export interface UnifiedDataPanelProps {
  /** Model type determines which UI elements to show */
  modelType: ModelType
  /** Callback when data changes (for parent refresh) */
  onDataChanged?: () => void
}

/**
 * Unified Data Panel
 *
 * A shared component for managing training data for both model types.
 * Provides consistent layout with model-specific content.
 *
 * Layout:
 * - Header: Model name, count, quality, sync button
 * - Numeral selector (column-classifier only)
 * - Filter bar (collapsible)
 * - Split view: Browse grid (left) + Capture/Detail panel (right)
 * - Mobile: Tab toggle between browse and capture/detail
 */
export function UnifiedDataPanel({ modelType, onDataChanged }: UnifiedDataPanelProps) {
  // === State ===

  // Items
  const [items, setItems] = useState<AnyDataItem[]>([])
  const [loading, setLoading] = useState(true)

  // Selection - multi-select support
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)
  const [focusedItem, setFocusedItem] = useState<AnyDataItem | null>(null) // For detail panel
  const [selectedDigit, setSelectedDigit] = useState(0) // column-classifier only

  // Bulk action state
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false)

  // Filters
  const [filters, setFilters] = useState<FilterState>(getDefaultFilters)
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  // UI state
  const [mobileTab, setMobileTab] = useState<MobileTab>('capture')
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('capture')

  // Actions
  const [deleting, setDeleting] = useState<string | null>(null)
  const [reclassifying, setReclassifying] = useState(false)

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ phase: 'idle', message: '' })
  const [syncHistoryRefreshTrigger, setSyncHistoryRefreshTrigger] = useState(0)

  // Live capture tracking (boundary only)
  const [newSamplesCount, setNewSamplesCount] = useState(0)
  const lastRefreshTimeRef = useRef<number>(Date.now())

  // === Computed values ===

  // Apply filters to items
  const filteredItems = useMemo(() => {
    let result = applyFilters(items, filters)

    // For column classifier, also filter by selected digit
    if (modelType === 'column-classifier') {
      result = result.filter((item) => isColumnDataItem(item) && item.digit === selectedDigit)
    }

    return result
  }, [items, filters, modelType, selectedDigit])

  // Digit counts for column classifier
  const digitCounts = useMemo(() => {
    if (modelType !== 'column-classifier') return {}
    const counts: Record<number, number> = {}
    for (let i = 0; i <= 9; i++) {
      counts[i] = items.filter((item) => isColumnDataItem(item) && item.digit === i).length
    }
    return counts
  }, [items, modelType])

  // Total count and quality
  const totalCount = items.length
  const dataQuality = useMemo(() => {
    if (totalCount === 0) return 'none'
    if (totalCount < 50) return 'insufficient'
    if (totalCount < 200) return 'minimal'
    if (totalCount < 500) return 'good'
    return 'excellent'
  }, [totalCount])

  // Item label for filters
  const itemLabel = modelType === 'boundary-detector' ? 'frames' : 'images'

  // Selected items (objects, not just IDs)
  const selectedItems = useMemo(
    () => filteredItems.filter((item) => selectedIds.has(item.id)),
    [filteredItems, selectedIds]
  )

  // === Data fetching ===

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      if (modelType === 'boundary-detector') {
        const response = await fetch('/api/vision-training/boundary-samples?list=true')
        if (response.ok) {
          const data = await response.json()
          const frames: BoundaryDataItem[] = (data.frames || []).map(
            (f: {
              baseName: string
              deviceId: string
              imagePath: string
              capturedAt: string
              corners: QuadCorners
              frameWidth: number
              frameHeight: number
              sessionId: string | null
              playerId: string | null
            }) => ({
              type: 'boundary' as const,
              id: f.baseName,
              baseName: f.baseName,
              deviceId: f.deviceId,
              imagePath: f.imagePath,
              capturedAt: f.capturedAt,
              corners: f.corners,
              frameWidth: f.frameWidth,
              frameHeight: f.frameHeight,
              sessionId: f.sessionId,
              playerId: f.playerId,
            })
          )
          setItems(frames)
          setNewSamplesCount(0)
          lastRefreshTimeRef.current = Date.now()
        }
      } else {
        // Column classifier - fetch all digits
        const allImages: ColumnDataItem[] = []
        for (let digit = 0; digit <= 9; digit++) {
          const response = await fetch(`/api/vision-training/images?digit=${digit}`)
          if (response.ok) {
            const data = await response.json()
            const images: ColumnDataItem[] = (data.images || []).map(
              (img: {
                filename: string
                digit: number
                timestamp?: number
                playerId?: string
                sessionId?: string
              }) => ({
                type: 'column' as const,
                id: `${digit}-${img.filename}`,
                filename: img.filename,
                digit: img.digit,
                imagePath: `/api/vision-training/images/${digit}/${img.filename}`,
                // Convert Unix timestamp to ISO string for timeline
                capturedAt: img.timestamp ? new Date(img.timestamp).toISOString() : '',
                deviceId: img.playerId || 'unknown',
                sessionId: img.sessionId || null,
                playerId: img.playerId || null,
              })
            )
            allImages.push(...images)
          }
        }
        setItems(allImages)
      }
    } catch (error) {
      console.error('[UnifiedDataPanel] Failed to load items:', error)
    } finally {
      setLoading(false)
    }
  }, [modelType])

  // Load items on mount
  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Fetch sync status (works for both model types)
  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        const response = await fetch(`/api/vision-training/sync?modelType=${modelType}`)
        if (response.ok) {
          const data = await response.json()
          setSyncStatus(data)
        }
      } catch (error) {
        console.error('[UnifiedDataPanel] Failed to fetch sync status:', error)
      }
    }

    fetchSyncStatus()
  }, [modelType])

  // Listen for cross-tab notifications (boundary only)
  useEffect(() => {
    if (modelType !== 'boundary-detector') return
    if (typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel(BOUNDARY_SAMPLE_CHANNEL)

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'sample-saved') {
        setNewSamplesCount((prev) => prev + 1)
        loadItems()
      }
    }

    channel.addEventListener('message', handleMessage)

    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [modelType, loadItems])

  // === Handlers ===

  // Toggle selection with shift+click support for range selection
  // Also opens detail panel for the clicked item (unless shift-clicking)
  const toggleSelect = useCallback(
    (id: string, index: number, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)

        // Shift+click for range selection/deselection
        if (shiftKey && lastClickedIndex !== null) {
          const start = Math.min(lastClickedIndex, index)
          const end = Math.max(lastClickedIndex, index)
          const shouldSelect = !prev.has(id)
          for (let i = start; i <= end; i++) {
            if (filteredItems[i]) {
              if (shouldSelect) {
                next.add(filteredItems[i].id)
              } else {
                next.delete(filteredItems[i].id)
              }
            }
          }
        } else {
          // Normal toggle
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
        }

        return next
      })

      // Update last clicked index (but not for shift clicks to allow extending range)
      if (!shiftKey) {
        setLastClickedIndex(index)

        // Also open detail panel for the clicked item (not for shift+click range selection)
        const clickedItem = filteredItems[index]
        if (clickedItem) {
          setFocusedItem(clickedItem)
          setRightPanelMode('detail')
        }
      }
    },
    [lastClickedIndex, filteredItems]
  )

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredItems.map((item) => item.id)))
  }, [filteredItems])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setLastClickedIndex(null)
  }, [])

  // Open detail panel for an item (double-click or dedicated button)
  const handleViewDetails = useCallback((item: AnyDataItem) => {
    setFocusedItem(item)
    setRightPanelMode('detail')
  }, [])

  const handleCloseDetail = useCallback(() => {
    setFocusedItem(null)
    setRightPanelMode('capture')
  }, [])

  // Delete a single item
  const handleDelete = useCallback(
    async (item: AnyDataItem) => {
      if (!confirm('Delete this item? This cannot be undone.')) return

      setDeleting(item.id)
      try {
        if (isBoundaryDataItem(item)) {
          const response = await fetch(
            `/api/vision-training/boundary-samples?deviceId=${item.deviceId}&baseName=${item.baseName}`,
            { method: 'DELETE' }
          )
          if (response.ok) {
            setItems((prev) => prev.filter((i) => i.id !== item.id))
            setSelectedIds((prev) => {
              const next = new Set(prev)
              next.delete(item.id)
              return next
            })
            if (focusedItem?.id === item.id) {
              handleCloseDetail()
            }
            onDataChanged?.()
          } else {
            alert('Failed to delete frame')
          }
        } else if (isColumnDataItem(item)) {
          const response = await fetch('/api/vision-training/images', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filenames: [{ digit: item.digit, filename: item.filename }],
              confirm: true,
            }),
          })
          if (response.ok) {
            setItems((prev) => prev.filter((i) => i.id !== item.id))
            setSelectedIds((prev) => {
              const next = new Set(prev)
              next.delete(item.id)
              return next
            })
            if (focusedItem?.id === item.id) {
              handleCloseDetail()
            }
            onDataChanged?.()
          } else {
            alert('Failed to delete image')
          }
        }
      } catch (error) {
        console.error('[UnifiedDataPanel] Delete error:', error)
        alert('Failed to delete item')
      } finally {
        setDeleting(null)
      }
    },
    [focusedItem, handleCloseDetail, onDataChanged]
  )

  // Bulk delete selected items
  const handleBulkDelete = useCallback(async () => {
    if (selectedItems.length === 0) return
    if (!confirm(`Delete ${selectedItems.length} ${itemLabel}? This cannot be undone.`)) return

    setBulkActionInProgress(true)

    // Optimistically remove from UI
    const idsToDelete = new Set(selectedItems.map((item) => item.id))
    setItems((prev) => prev.filter((item) => !idsToDelete.has(item.id)))
    setSelectedIds(new Set())

    try {
      if (modelType === 'boundary-detector') {
        // Delete boundary frames one by one (API doesn't support bulk)
        for (const item of selectedItems) {
          if (isBoundaryDataItem(item)) {
            await fetch(
              `/api/vision-training/boundary-samples?deviceId=${item.deviceId}&baseName=${item.baseName}`,
              { method: 'DELETE' }
            )
          }
        }
      } else {
        // Column classifier supports bulk delete
        const filenames = selectedItems
          .filter(isColumnDataItem)
          .map((item) => ({ digit: item.digit, filename: item.filename }))

        await fetch('/api/vision-training/images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames, confirm: true }),
        })
      }

      // Close detail if focused item was deleted
      if (focusedItem && idsToDelete.has(focusedItem.id)) {
        handleCloseDetail()
      }

      onDataChanged?.()
      // Reload to get accurate counts
      loadItems()
    } catch (error) {
      console.error('[UnifiedDataPanel] Bulk delete error:', error)
      alert('Failed to delete some items')
      // Reload to restore state
      loadItems()
    } finally {
      setBulkActionInProgress(false)
    }
  }, [
    selectedItems,
    itemLabel,
    modelType,
    focusedItem,
    handleCloseDetail,
    onDataChanged,
    loadItems,
  ])

  // Bulk reclassify selected column items to a new digit
  const handleBulkReclassify = useCallback(
    async (newDigit: number) => {
      const columnItems = selectedItems.filter(isColumnDataItem)
      if (columnItems.length === 0 || newDigit === selectedDigit) return

      setBulkActionInProgress(true)

      // Optimistically remove from current view
      const idsToMove = new Set(columnItems.map((item) => item.id))
      setItems((prev) => prev.filter((item) => !idsToMove.has(item.id)))
      setSelectedIds(new Set())

      try {
        const response = await fetch('/api/vision-training/images', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: columnItems.map((item) => ({
              digit: item.digit,
              filename: item.filename,
            })),
            newDigit,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to reclassify images')
        }

        // Close detail if focused item was moved
        if (focusedItem && idsToMove.has(focusedItem.id)) {
          handleCloseDetail()
        }

        onDataChanged?.()
        // Reload to get accurate counts
        loadItems()
      } catch (error) {
        console.error('[UnifiedDataPanel] Bulk reclassify error:', error)
        alert('Failed to reclassify some images')
        // Reload to restore state
        loadItems()
      } finally {
        setBulkActionInProgress(false)
      }
    },
    [selectedItems, selectedDigit, focusedItem, handleCloseDetail, onDataChanged, loadItems]
  )

  // Reclassify a single column item
  const handleReclassify = useCallback(
    async (item: ColumnDataItem, newDigit: number) => {
      setReclassifying(true)
      try {
        const response = await fetch(`/api/vision-training/images/${item.digit}/${item.filename}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newDigit }),
        })
        if (response.ok) {
          // Remove from current view, clear from selection, and close detail
          setItems((prev) => prev.filter((i) => i.id !== item.id))
          setSelectedIds((prev) => {
            const next = new Set(prev)
            next.delete(item.id)
            return next
          })
          handleCloseDetail()
          onDataChanged?.()
          // Reload to get updated counts
          loadItems()
        } else {
          alert('Failed to reclassify image')
        }
      } catch (error) {
        console.error('[UnifiedDataPanel] Reclassify error:', error)
        alert('Failed to reclassify image')
      } finally {
        setReclassifying(false)
      }
    },
    [handleCloseDetail, onDataChanged, loadItems]
  )

  const handleCaptureComplete = useCallback(() => {
    loadItems()
    onDataChanged?.()
  }, [loadItems, onDataChanged])

  const handleStartSync = useCallback(async () => {
    setSyncProgress({ phase: 'connecting', message: 'Connecting...' })
    try {
      const response = await fetch(`/api/vision-training/sync?modelType=${modelType}`, {
        method: 'POST',
      })
      if (response.ok) {
        setSyncProgress({ phase: 'complete', message: 'Sync complete!' })
        loadItems()
        onDataChanged?.()
      } else {
        setSyncProgress({ phase: 'error', message: 'Sync failed' })
      }
    } catch (error) {
      setSyncProgress({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Sync failed',
      })
    }
    setSyncHistoryRefreshTrigger((prev) => prev + 1)
  }, [modelType, loadItems, onDataChanged])

  const handleCancelSync = useCallback(() => {
    setSyncProgress({ phase: 'idle', message: '' })
  }, [])

  // === Render ===

  return (
    <div
      data-component="unified-data-panel"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bg: 'gray.900',
      })}
    >
      {/* Header */}
      <DataPanelHeader
        modelType={modelType}
        totalCount={totalCount}
        dataQuality={dataQuality}
        syncStatus={syncStatus}
        syncProgress={syncProgress}
        onStartSync={handleStartSync}
        onCancelSync={handleCancelSync}
        syncHistoryRefreshTrigger={syncHistoryRefreshTrigger}
      />

      {/* Numeral selector (column-classifier only) */}
      {modelType === 'column-classifier' && (
        <div
          data-element="numeral-selector-bar"
          className={css({
            px: { base: 2, lg: 4 },
            py: 3,
            borderBottom: '1px solid',
            borderColor: 'gray.800',
            bg: 'gray.875',
            overflowX: 'auto',
          })}
        >
          <NumeralSelector
            digitCounts={digitCounts}
            selectedDigit={selectedDigit}
            onSelectDigit={setSelectedDigit}
            compact={false}
          />
        </div>
      )}

      {/* Filter bar */}
      <div className={css({ px: { base: 2, lg: 4 }, py: 3 })}>
        <DataPanelFilters
          items={items}
          filters={filters}
          onFiltersChange={setFilters}
          isExpanded={filtersExpanded}
          onToggleExpanded={() => setFiltersExpanded(!filtersExpanded)}
          itemLabel={itemLabel}
        />
      </div>

      {/* Live capture indicator (boundary only) */}
      {modelType === 'boundary-detector' && newSamplesCount > 0 && (
        <div
          data-element="live-capture-indicator"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 4,
            py: 2,
            mx: 4,
            mb: 2,
            bg: 'green.900/30',
            border: '1px solid',
            borderColor: 'green.700/50',
            borderRadius: 'lg',
          })}
        >
          <span
            className={css({
              width: '10px',
              height: '10px',
              borderRadius: 'full',
              bg: 'green.400',
              animation: 'pulse 1.5s ease-in-out infinite',
            })}
          />
          <span className={css({ color: 'green.300', fontWeight: 'medium', fontSize: 'sm' })}>
            Live Capture Active
          </span>
          <span className={css({ color: 'green.400', fontSize: 'sm' })}>
            +{newSamplesCount} new frame{newSamplesCount !== 1 ? 's' : ''} captured
          </span>
        </div>
      )}

      {/* Mobile tab bar */}
      <div
        data-element="mobile-tab-bar"
        className={css({
          display: { base: 'flex', lg: 'none' },
          borderBottom: '1px solid',
          borderColor: 'gray.800',
        })}
      >
        <button
          type="button"
          onClick={() => setMobileTab('browse')}
          className={css({
            flex: 1,
            py: 3,
            bg: 'transparent',
            color: mobileTab === 'browse' ? 'purple.400' : 'gray.500',
            borderBottom: '2px solid',
            borderColor: mobileTab === 'browse' ? 'purple.400' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'medium',
            fontSize: 'sm',
          })}
        >
          🖼 Browse ({filteredItems.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('capture')}
          className={css({
            flex: 1,
            py: 3,
            bg: 'transparent',
            color: mobileTab === 'capture' ? 'green.400' : 'gray.500',
            borderBottom: '2px solid',
            borderColor: mobileTab === 'capture' ? 'green.400' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'medium',
            fontSize: 'sm',
          })}
        >
          📸 {rightPanelMode === 'detail' ? 'Details' : 'Capture'}
        </button>
      </div>

      {/* Main content - split view */}
      <div
        data-element="main-content"
        className={css({
          flex: 1,
          display: 'flex',
          flexDirection: { base: 'column', lg: 'row' },
          minHeight: 0,
          overflow: 'hidden',
          gap: 4,
          p: 4,
        })}
      >
        {/* Browse panel */}
        <div
          data-element="browse-panel"
          className={css({
            display: {
              base: mobileTab === 'browse' ? 'flex' : 'none',
              lg: 'flex',
            },
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
            bg: 'gray.850',
            borderRadius: 'lg',
            overflow: 'hidden',
          })}
        >
          {loading ? (
            <div
              className={css({
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <div className={css({ textAlign: 'center' })}>
                <div className={css({ fontSize: '2xl', animation: 'spin 1s linear infinite' })}>
                  ⏳
                </div>
                <div className={css({ color: 'gray.400', mt: 2 })}>Loading {itemLabel}...</div>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div
              className={css({
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <div className={css({ textAlign: 'center', p: 4 })}>
                <div className={css({ fontSize: '3xl', mb: 3 })}>📷</div>
                <div className={css({ color: 'gray.300', mb: 2 })}>
                  {items.length === 0
                    ? `No ${itemLabel} captured yet`
                    : `No ${itemLabel} match filters`}
                </div>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters(getDefaultFilters())}
                    className={css({
                      mt: 2,
                      px: 4,
                      py: 2,
                      bg: 'gray.700',
                      color: 'gray.200',
                      border: 'none',
                      borderRadius: 'md',
                      cursor: 'pointer',
                      _hover: { bg: 'gray.600' },
                    })}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Selection bar */}
              <div
                data-element="selection-bar"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 3,
                  py: 2,
                  borderBottom: '1px solid',
                  borderColor: 'gray.800',
                  bg: 'gray.875',
                  flexShrink: 0,
                })}
              >
                <div
                  data-element="item-count"
                  className={css({ fontSize: 'sm', color: 'gray.400' })}
                >
                  <strong className={css({ color: 'gray.200' })}>{filteredItems.length}</strong>{' '}
                  {itemLabel}
                  {selectedIds.size > 0 && (
                    <span
                      data-element="selection-count"
                      className={css({ color: 'blue.400', ml: 2 })}
                    >
                      ({selectedIds.size} selected)
                    </span>
                  )}
                </div>

                <div data-element="selection-actions" className={css({ display: 'flex', gap: 2 })}>
                  {selectedIds.size === 0 && (
                    <button
                      type="button"
                      data-action="select-all"
                      onClick={selectAll}
                      className={css({
                        px: 2,
                        py: 1,
                        fontSize: 'xs',
                        color: 'gray.400',
                        bg: 'transparent',
                        border: '1px solid',
                        borderColor: 'gray.700',
                        borderRadius: 'md',
                        cursor: 'pointer',
                        _hover: { borderColor: 'gray.600', color: 'gray.300' },
                      })}
                    >
                      Select All
                    </button>
                  )}
                </div>
              </div>

              {/* Grid */}
              <div
                data-element="grid-scroll-container"
                className={css({
                  flex: 1,
                  overflow: 'auto',
                  minHeight: 0,
                })}
              >
                <div
                  data-element="grid"
                  className={css({
                    p: 3,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: 2,
                    alignContent: 'start',
                  })}
                >
                  {filteredItems.map((item, index) =>
                    isBoundaryDataItem(item) ? (
                      <BoundaryGridItem
                        key={item.id}
                        item={item}
                        isSelected={selectedIds.has(item.id)}
                        isFocused={focusedItem?.id === item.id}
                        onSelect={(shiftKey) => toggleSelect(item.id, index, shiftKey)}
                        onViewDetails={() => handleViewDetails(item)}
                        onDelete={() => handleDelete(item)}
                      />
                    ) : isColumnDataItem(item) ? (
                      <ColumnGridItem
                        key={item.id}
                        item={item}
                        isSelected={selectedIds.has(item.id)}
                        isFocused={focusedItem?.id === item.id}
                        onSelect={(shiftKey) => toggleSelect(item.id, index, shiftKey)}
                        onViewDetails={() => handleViewDetails(item)}
                        onDelete={() => handleDelete(item)}
                      />
                    ) : null
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right panel: Bulk Selection, Detail, or Capture */}
        <div
          data-element="right-panel"
          className={css({
            display: {
              base: mobileTab === 'capture' ? 'flex' : 'none',
              lg: 'flex',
            },
            flexDirection: 'column',
            width: { lg: selectedIds.size > 1 || rightPanelMode === 'detail' ? 'auto' : '400px' },
            maxWidth: { lg: '50%' },
            flexShrink: 0,
            minHeight: 0,
            overflow: 'auto',
          })}
        >
          {selectedIds.size > 1 ? (
            /* Bulk selection panel */
            <div
              data-element="bulk-selection-panel"
              className={css({
                p: 4,
                bg: 'gray.850',
                borderRadius: 'lg',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              })}
            >
              {/* Header */}
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                })}
              >
                <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
                  <span className={css({ fontSize: 'xl' })}>📦</span>
                  <span className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'gray.100' })}>
                    {selectedIds.size} {itemLabel} selected
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className={css({
                    px: 2,
                    py: 1,
                    fontSize: 'sm',
                    color: 'gray.400',
                    bg: 'transparent',
                    border: '1px solid',
                    borderColor: 'gray.700',
                    borderRadius: 'md',
                    cursor: 'pointer',
                    _hover: { borderColor: 'gray.600', color: 'gray.300' },
                  })}
                >
                  Clear Selection
                </button>
              </div>

              {/* Bulk actions */}
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  p: 4,
                  bg: 'gray.900',
                  borderRadius: 'md',
                })}
              >
                <div className={css({ fontSize: 'sm', color: 'gray.400', mb: 1 })}>
                  Bulk Actions
                </div>

                {/* Bulk delete */}
                <button
                  type="button"
                  data-action="bulk-delete"
                  onClick={handleBulkDelete}
                  disabled={bulkActionInProgress}
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    py: 3,
                    px: 4,
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: 'red.300',
                    bg: 'red.900/30',
                    border: '1px solid',
                    borderColor: 'red.700/50',
                    borderRadius: 'md',
                    cursor: bulkActionInProgress ? 'not-allowed' : 'pointer',
                    opacity: bulkActionInProgress ? 0.5 : 1,
                    _hover: { bg: 'red.900/50', borderColor: 'red.600' },
                  })}
                >
                  <span>🗑️</span>
                  <span>
                    Delete {selectedIds.size} {itemLabel}
                  </span>
                </button>

                {/* Bulk reclassify (column-classifier only) */}
                {modelType === 'column-classifier' && (
                  <div className={css({ display: 'flex', flexDirection: 'column', gap: 2 })}>
                    <div className={css({ fontSize: 'sm', color: 'gray.400' })}>Move to digit:</div>
                    <div
                      className={css({
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: 2,
                      })}
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                        <button
                          key={d}
                          type="button"
                          data-action="bulk-reclassify-to"
                          data-target-digit={d}
                          onClick={() => handleBulkReclassify(d)}
                          disabled={d === selectedDigit || bulkActionInProgress}
                          className={css({
                            py: 2,
                            fontSize: 'lg',
                            fontWeight: 'bold',
                            fontFamily: 'mono',
                            color: d === selectedDigit ? 'gray.600' : 'gray.100',
                            bg: d === selectedDigit ? 'gray.800' : 'blue.900/30',
                            border: '1px solid',
                            borderColor: d === selectedDigit ? 'gray.700' : 'blue.700/50',
                            borderRadius: 'md',
                            cursor:
                              d === selectedDigit || bulkActionInProgress
                                ? 'not-allowed'
                                : 'pointer',
                            opacity: bulkActionInProgress ? 0.5 : 1,
                            _hover:
                              d === selectedDigit || bulkActionInProgress
                                ? {}
                                : { bg: 'blue.600', borderColor: 'blue.500', color: 'white' },
                          })}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Selection tip */}
              <div
                className={css({
                  fontSize: 'xs',
                  color: 'gray.500',
                  textAlign: 'center',
                })}
              >
                Tip: Shift+click to select a range of {itemLabel}
              </div>
            </div>
          ) : rightPanelMode === 'detail' && focusedItem ? (
            <DataPanelDetailPanel
              modelType={modelType}
              selectedItem={focusedItem}
              onClose={handleCloseDetail}
              onDelete={handleDelete}
              isDeleting={deleting === focusedItem.id}
              onReclassify={handleReclassify}
              isReclassifying={reclassifying}
            />
          ) : (
            <DataPanelCapturePanel
              modelType={modelType}
              onCaptureComplete={handleCaptureComplete}
              selectedDigit={selectedDigit}
            />
          )}
        </div>
      </div>
    </div>
  )
}
