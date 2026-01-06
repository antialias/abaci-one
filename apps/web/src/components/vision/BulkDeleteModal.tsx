'use client'

import { useCallback, useEffect, useState } from 'react'
import { css } from '../../../styled-system/css'
import type { TrainingImageMeta } from './TrainingImageViewer'
import { TimelineRangeSelector } from './TimelineRangeSelector'

export interface BulkDeleteFilters {
  digit?: string
  playerId?: string
  sessionId?: string
  beforeTimestamp?: number
  afterTimestamp?: number
}

export interface BulkDeleteModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback to close the modal */
  onClose: () => void
  /** All available images (for getting unique values) */
  images: TrainingImageMeta[]
  /** Callback to preview delete count */
  onPreview: (filters: BulkDeleteFilters) => Promise<number>
  /** Callback to execute the delete */
  onDelete: (filters: BulkDeleteFilters) => Promise<void>
}

type FilterMode = 'all' | 'session' | 'player' | 'date' | 'digit'

export function BulkDeleteModal({
  isOpen,
  onClose,
  images,
  onPreview,
  onDelete,
}: BulkDeleteModalProps) {
  // Filter state
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [selectedPlayer, setSelectedPlayer] = useState<string>('')
  const [selectedDigit, setSelectedDigit] = useState<string>('')
  const [dateMode, setDateMode] = useState<'before' | 'after' | 'between'>('before')
  const [beforeTimestamp, setBeforeTimestamp] = useState<number | undefined>(undefined)
  const [afterTimestamp, setAfterTimestamp] = useState<number | undefined>(undefined)

  // Preview and execution state
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Unique values
  const uniqueSessions = [...new Set(images.map((i) => i.sessionId))].sort()
  const uniquePlayers = [...new Set(images.map((i) => i.playerId))].sort()

  // Build filters based on mode
  const buildFilters = useCallback((): BulkDeleteFilters => {
    const filters: BulkDeleteFilters = {}

    switch (filterMode) {
      case 'session':
        if (selectedSession) filters.sessionId = selectedSession
        break
      case 'player':
        if (selectedPlayer) filters.playerId = selectedPlayer
        break
      case 'digit':
        if (selectedDigit) filters.digit = selectedDigit
        break
      case 'date':
        if (dateMode === 'before' && beforeTimestamp !== undefined) {
          filters.beforeTimestamp = beforeTimestamp
        } else if (dateMode === 'after' && afterTimestamp !== undefined) {
          filters.afterTimestamp = afterTimestamp
        } else if (
          dateMode === 'between' &&
          beforeTimestamp !== undefined &&
          afterTimestamp !== undefined
        ) {
          filters.beforeTimestamp = beforeTimestamp
          filters.afterTimestamp = afterTimestamp
        }
        break
      case 'all':
        // No filters = delete all
        break
    }

    return filters
  }, [
    filterMode,
    selectedSession,
    selectedPlayer,
    selectedDigit,
    dateMode,
    beforeTimestamp,
    afterTimestamp,
  ])

  // Check if filters are valid for the current mode
  const isFilterValid = useCallback((): boolean => {
    switch (filterMode) {
      case 'session':
        return !!selectedSession
      case 'player':
        return !!selectedPlayer
      case 'digit':
        return !!selectedDigit
      case 'date':
        if (dateMode === 'before') return beforeTimestamp !== undefined
        if (dateMode === 'after') return afterTimestamp !== undefined
        if (dateMode === 'between')
          return beforeTimestamp !== undefined && afterTimestamp !== undefined
        return false
      case 'all':
        return true
    }
  }, [
    filterMode,
    selectedSession,
    selectedPlayer,
    selectedDigit,
    dateMode,
    beforeTimestamp,
    afterTimestamp,
  ])

  // Handle timeline range change
  const handleTimelineChange = useCallback((before?: number, after?: number) => {
    setBeforeTimestamp(before)
    setAfterTimestamp(after)
  }, [])

  // Preview the delete
  const handlePreview = useCallback(async () => {
    if (!isFilterValid()) return

    setPreviewing(true)
    try {
      const count = await onPreview(buildFilters())
      setPreviewCount(count)
    } catch (error) {
      console.error('Preview failed:', error)
      setPreviewCount(null)
    } finally {
      setPreviewing(false)
    }
  }, [buildFilters, isFilterValid, onPreview])

  // Execute the delete
  const handleDelete = useCallback(async () => {
    if (previewCount === null || previewCount === 0) return

    setDeleting(true)
    try {
      await onDelete(buildFilters())
      onClose()
    } catch (error) {
      console.error('Delete failed:', error)
    } finally {
      setDeleting(false)
    }
  }, [buildFilters, onClose, onDelete, previewCount])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFilterMode('all')
      setSelectedSession('')
      setSelectedPlayer('')
      setSelectedDigit('')
      setDateMode('before')
      setBeforeTimestamp(undefined)
      setAfterTimestamp(undefined)
      setPreviewCount(null)
    }
  }, [isOpen])

  // Reset preview when filters change
  useEffect(() => {
    setPreviewCount(null)
  }, [
    filterMode,
    selectedSession,
    selectedPlayer,
    selectedDigit,
    dateMode,
    beforeTimestamp,
    afterTimestamp,
  ])

  if (!isOpen) return null

  return (
    <div
      data-component="bulk-delete-modal"
      className={css({
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {/* Backdrop */}
      <div
        data-element="backdrop"
        onClick={onClose}
        className={css({
          position: 'absolute',
          inset: 0,
          bg: 'black/70',
        })}
      />

      {/* Modal */}
      <div
        data-element="modal"
        className={css({
          position: 'relative',
          bg: 'gray.800',
          borderRadius: 'xl',
          p: 6,
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        })}
      >
        {/* Header */}
        <div className={css({ mb: 6 })}>
          <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'red.400', mb: 2 })}>
            Bulk Delete Training Data
          </h2>
          <p className={css({ color: 'gray.400', fontSize: 'sm' })}>
            This action cannot be undone. Select what you want to delete.
          </p>
        </div>

        {/* Filter Mode Selection */}
        <div className={css({ mb: 4 })}>
          <label className={css({ display: 'block', fontSize: 'sm', color: 'gray.400', mb: 2 })}>
            Delete by:
          </label>
          <div className={css({ display: 'flex', flexWrap: 'wrap', gap: 2 })}>
            {[
              { value: 'all', label: 'All Data' },
              { value: 'session', label: 'Session' },
              { value: 'player', label: 'Player' },
              { value: 'digit', label: 'Digit' },
              { value: 'date', label: 'Date Range' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterMode(opt.value as FilterMode)}
                className={css({
                  px: 3,
                  py: 1.5,
                  borderRadius: 'md',
                  border: '2px solid',
                  borderColor: filterMode === opt.value ? 'red.500' : 'gray.600',
                  bg: filterMode === opt.value ? 'red.900/50' : 'transparent',
                  color: filterMode === opt.value ? 'red.300' : 'gray.300',
                  cursor: 'pointer',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  _hover: { borderColor: 'red.400' },
                })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Options */}
        <div className={css({ mb: 4, minHeight: '80px' })}>
          {filterMode === 'all' && (
            <div
              className={css({
                p: 4,
                bg: 'red.900/30',
                borderRadius: 'lg',
                border: '1px solid',
                borderColor: 'red.700',
              })}
            >
              <p className={css({ color: 'red.300', fontWeight: 'medium' })}>
                This will delete ALL {images.length} training images!
              </p>
            </div>
          )}

          {filterMode === 'session' && (
            <div>
              <label
                className={css({ display: 'block', fontSize: 'sm', color: 'gray.400', mb: 2 })}
              >
                Select session:
              </label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className={css({
                  width: '100%',
                  px: 3,
                  py: 2,
                  bg: 'gray.700',
                  border: '1px solid',
                  borderColor: 'gray.600',
                  borderRadius: 'md',
                  color: 'gray.100',
                })}
              >
                <option value="">Choose a session...</option>
                {uniqueSessions.map((s) => (
                  <option key={s} value={s}>
                    {s} ({images.filter((i) => i.sessionId === s).length} images)
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterMode === 'player' && (
            <div>
              <label
                className={css({ display: 'block', fontSize: 'sm', color: 'gray.400', mb: 2 })}
              >
                Select player:
              </label>
              <select
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className={css({
                  width: '100%',
                  px: 3,
                  py: 2,
                  bg: 'gray.700',
                  border: '1px solid',
                  borderColor: 'gray.600',
                  borderRadius: 'md',
                  color: 'gray.100',
                })}
              >
                <option value="">Choose a player...</option>
                {uniquePlayers.map((p) => (
                  <option key={p} value={p}>
                    {p} ({images.filter((i) => i.playerId === p).length} images)
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterMode === 'digit' && (
            <div>
              <label
                className={css({ display: 'block', fontSize: 'sm', color: 'gray.400', mb: 2 })}
              >
                Select digit:
              </label>
              <select
                value={selectedDigit}
                onChange={(e) => setSelectedDigit(e.target.value)}
                className={css({
                  width: '100%',
                  px: 3,
                  py: 2,
                  bg: 'gray.700',
                  border: '1px solid',
                  borderColor: 'gray.600',
                  borderRadius: 'md',
                  color: 'gray.100',
                })}
              >
                <option value="">Choose a digit...</option>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <option key={d} value={String(d)}>
                    Digit {d} ({images.filter((i) => i.digit === d).length} images)
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterMode === 'date' && (
            <div>
              <label
                className={css({ display: 'block', fontSize: 'sm', color: 'gray.400', mb: 2 })}
              >
                Date range mode:
              </label>
              {/* Date mode selector */}
              <div className={css({ display: 'flex', gap: 2, mb: 4 })}>
                {[
                  { value: 'before', label: 'Before' },
                  { value: 'after', label: 'After' },
                  { value: 'between', label: 'Between' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDateMode(opt.value as 'before' | 'after' | 'between')}
                    className={css({
                      px: 3,
                      py: 1,
                      borderRadius: 'md',
                      border: '1px solid',
                      borderColor: dateMode === opt.value ? 'blue.500' : 'gray.600',
                      bg: dateMode === opt.value ? 'blue.900/50' : 'transparent',
                      color: dateMode === opt.value ? 'blue.300' : 'gray.400',
                      cursor: 'pointer',
                      fontSize: 'sm',
                    })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Timeline range selector */}
              <TimelineRangeSelector
                images={images}
                mode={dateMode}
                beforeTimestamp={beforeTimestamp}
                afterTimestamp={afterTimestamp}
                onChange={handleTimelineChange}
              />
            </div>
          )}
        </div>

        {/* Preview Button */}
        <div className={css({ mb: 4 })}>
          <button
            type="button"
            onClick={handlePreview}
            disabled={!isFilterValid() || previewing}
            className={css({
              width: '100%',
              py: 2,
              bg: 'gray.700',
              color: 'white',
              borderRadius: 'md',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'medium',
              opacity: !isFilterValid() || previewing ? 0.5 : 1,
              _hover: { bg: 'gray.600' },
            })}
          >
            {previewing ? 'Counting...' : 'Preview Delete Count'}
          </button>
        </div>

        {/* Preview Result */}
        {previewCount !== null && (
          <div
            className={css({
              mb: 4,
              p: 4,
              bg: previewCount > 0 ? 'red.900/30' : 'gray.800',
              borderRadius: 'lg',
              border: '1px solid',
              borderColor: previewCount > 0 ? 'red.700' : 'gray.700',
            })}
          >
            <p
              className={css({
                color: previewCount > 0 ? 'red.300' : 'gray.400',
                fontWeight: 'bold',
                fontSize: 'lg',
              })}
            >
              {previewCount > 0
                ? `${previewCount} images will be deleted`
                : 'No images match these filters'}
            </p>
            {previewCount > 0 && (
              <p className={css({ color: 'gray.400', fontSize: 'sm', mt: 2 })}>
                You can undo this action for 5 seconds after deletion.
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className={css({ display: 'flex', gap: 3 })}>
          <button
            type="button"
            onClick={onClose}
            className={css({
              flex: 1,
              py: 2,
              bg: 'gray.700',
              color: 'white',
              borderRadius: 'md',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'medium',
              _hover: { bg: 'gray.600' },
            })}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={previewCount === null || previewCount === 0 || deleting}
            className={css({
              flex: 1,
              py: 2,
              bg: 'red.600',
              color: 'white',
              borderRadius: 'md',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              opacity: previewCount === null || previewCount === 0 || deleting ? 0.5 : 1,
              _hover: { bg: 'red.500' },
            })}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BulkDeleteModal
