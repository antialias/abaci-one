'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { css } from '../../../styled-system/css'

/**
 * Reusable digit dialpad component with keyboard support
 */
function DigitDialpad({
  currentDigit,
  onSelect,
  onClose,
}: {
  currentDigit?: number // undefined means no current selection (for bulk)
  onSelect: (digit: number) => void
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if it's a digit key
      if (e.key >= '0' && e.key <= '9') {
        const digit = parseInt(e.key, 10)
        if (currentDigit === undefined || digit !== currentDigit) {
          onSelect(digit)
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentDigit, onSelect, onClose])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Delay adding listener to avoid immediate close
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', handleClickOutside)
    }
  }, [onClose])

  return (
    <div
      ref={containerRef}
      className={css({
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        mt: 1,
        bg: 'gray.800',
        borderRadius: 'lg',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        border: '1px solid',
        borderColor: 'gray.600',
        p: 3,
        zIndex: 1000,
      })}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={css({
          fontSize: 'xs',
          color: 'gray.400',
          mb: 2,
          textAlign: 'center',
        })}
      >
        Press 0-9 or click:
      </div>
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 1,
        })}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => {
          const isCurrent = currentDigit !== undefined && d === currentDigit
          return (
            <button
              key={d}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (!isCurrent) {
                  onSelect(d)
                }
              }}
              disabled={isCurrent}
              className={css({
                width: '36px',
                height: '36px',
                borderRadius: 'md',
                border: '2px solid',
                borderColor: isCurrent ? 'green.500' : 'transparent',
                bg: isCurrent ? 'green.900' : 'gray.700',
                color: isCurrent ? 'green.300' : 'white',
                fontWeight: 'bold',
                fontSize: 'md',
                cursor: isCurrent ? 'default' : 'pointer',
                transition: 'all 0.1s',
                _hover: isCurrent ? {} : { bg: 'blue.600', transform: 'scale(1.1)' },
              })}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export interface TrainingImageMeta {
  filename: string
  digit: number
  timestamp: number
  playerId: string
  sessionId: string
  columnIndex: number
  imageUrl: string
}

export type GroupBy = 'digit' | 'player' | 'session' | 'none'

export interface TrainingImageViewerProps {
  /** Images to display */
  images: TrainingImageMeta[]
  /** Loading state */
  loading?: boolean
  /** Error message if any */
  error?: string | null
  /** Current filter for digit */
  filterDigit?: string
  /** Current filter for player */
  filterPlayer?: string
  /** Current filter for session */
  filterSession?: string
  /** How to group images */
  groupBy?: GroupBy
  /** Callback when digit filter changes */
  onFilterDigitChange?: (value: string) => void
  /** Callback when player filter changes */
  onFilterPlayerChange?: (value: string) => void
  /** Callback when session filter changes */
  onFilterSessionChange?: (value: string) => void
  /** Callback when group by changes */
  onGroupByChange?: (value: GroupBy) => void
  /** Callback when refresh is clicked */
  onRefresh?: () => void
  /** Custom renderer for each image (for stories with AbacusStatic) */
  renderImage?: (image: TrainingImageMeta) => ReactNode
  /** Callback when a single image is deleted */
  onDeleteImage?: (image: TrainingImageMeta) => Promise<void>
  /** Callback for bulk delete */
  onBulkDelete?: (images: TrainingImageMeta[]) => Promise<void>
  /** Callback to open bulk delete modal */
  onOpenBulkDeleteModal?: () => void
  /** Whether delete is in progress */
  deleting?: boolean
  /** Callback when a single image is reclassified */
  onReclassifyImage?: (image: TrainingImageMeta, newDigit: number) => Promise<void>
  /** Callback for bulk reclassify */
  onBulkReclassify?: (images: TrainingImageMeta[], newDigit: number) => Promise<void>
  /** Whether reclassify is in progress */
  reclassifying?: boolean
}

/**
 * TrainingImageViewer - Displays collected abacus column training images
 *
 * This is the presentational component for the /vision-training page.
 * It can be used with real API data or mock data in Storybook.
 */
export function TrainingImageViewer({
  images,
  loading = false,
  error = null,
  filterDigit = '',
  filterPlayer = '',
  filterSession = '',
  groupBy = 'digit',
  onFilterDigitChange,
  onFilterPlayerChange,
  onFilterSessionChange,
  onGroupByChange,
  onRefresh,
  renderImage,
  onDeleteImage,
  onBulkDelete,
  onOpenBulkDeleteModal,
  deleting = false,
  onReclassifyImage,
  onBulkReclassify,
  reclassifying = false,
}: TrainingImageViewerProps) {
  // Selection state for bulk operations
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  // Inline reclassify state (which image is showing reclassify dropdown)
  const [reclassifyingImage, setReclassifyingImage] = useState<string | null>(null)
  // Bulk reclassify dropdown state
  const [showBulkReclassify, setShowBulkReclassify] = useState(false)

  // Get unique values for filter dropdowns
  const uniquePlayers = useMemo(() => [...new Set(images.map((i) => i.playerId))].sort(), [images])
  const uniqueSessions = useMemo(
    () => [...new Set(images.map((i) => i.sessionId))].sort(),
    [images]
  )

  // Toggle selection of an image
  const toggleSelection = useCallback((filename: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) {
        next.delete(filename)
      } else {
        next.add(filename)
      }
      return next
    })
  }, [])

  // Select all visible images
  const selectAll = useCallback(() => {
    setSelectedImages(new Set(images.map((img) => img.filename)))
  }, [images])

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedImages(new Set())
  }, [])

  // Get selected image objects
  const selectedImageObjects = useMemo(
    () => images.filter((img) => selectedImages.has(img.filename)),
    [images, selectedImages]
  )

  // Handle bulk delete of selected
  const handleBulkDeleteSelected = useCallback(async () => {
    if (selectedImageObjects.length === 0 || !onBulkDelete) return
    await onBulkDelete(selectedImageObjects)
    clearSelection()
    setSelectionMode(false)
  }, [selectedImageObjects, onBulkDelete, clearSelection])

  // Handle inline reclassify of single image
  const handleInlineReclassify = useCallback(
    async (image: TrainingImageMeta, newDigit: number) => {
      if (!onReclassifyImage) return
      setReclassifyingImage(null)
      await onReclassifyImage(image, newDigit)
    },
    [onReclassifyImage]
  )

  // Handle bulk reclassify of selected images
  const handleBulkReclassifySelected = useCallback(
    async (newDigit: number) => {
      if (selectedImageObjects.length === 0 || !onBulkReclassify) return
      setShowBulkReclassify(false)
      await onBulkReclassify(selectedImageObjects, newDigit)
      clearSelection()
      setSelectionMode(false)
    },
    [selectedImageObjects, onBulkReclassify, clearSelection]
  )

  // Exit selection mode
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    clearSelection()
  }, [clearSelection])

  // Group images
  const groupedImages = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Images': images }
    }

    const groups: Record<string, TrainingImageMeta[]> = {}

    for (const img of images) {
      let key: string
      switch (groupBy) {
        case 'digit':
          key = `Digit ${img.digit}`
          break
        case 'player':
          key = `Player ${img.playerId}`
          break
        case 'session':
          key = `Session ${img.sessionId}`
          break
        default:
          key = 'All'
      }

      if (!groups[key]) groups[key] = []
      groups[key].push(img)
    }

    return groups
  }, [images, groupBy])

  // Stats
  const stats = useMemo(() => {
    const digitCounts: Record<number, number> = {}
    for (const img of images) {
      digitCounts[img.digit] = (digitCounts[img.digit] || 0) + 1
    }
    return {
      total: images.length,
      players: uniquePlayers.length,
      sessions: uniqueSessions.length,
      digitCounts,
    }
  }, [images, uniquePlayers, uniqueSessions])

  return (
    <div
      data-component="training-image-viewer"
      className={css({
        minHeight: '100vh',
        bg: 'gray.900',
        color: 'gray.100',
        p: 4,
      })}
    >
      <header className={css({ mb: 6 })}>
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
          })}
        >
          <div>
            <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 2 })}>
              Vision Training Data
            </h1>
            <p className={css({ color: 'gray.400', fontSize: 'sm' })}>
              Collected abacus column images for training the classifier model
            </p>
          </div>
          <div className={css({ display: 'flex', gap: 2 })}>
            {(onBulkDelete || onOpenBulkDeleteModal) && (
              <>
                {!selectionMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectionMode(true)}
                      disabled={images.length === 0}
                      className={css({
                        px: 4,
                        py: 2,
                        bg: 'gray.700',
                        color: 'white',
                        fontWeight: 'medium',
                        borderRadius: 'md',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: images.length === 0 ? 0.5 : 1,
                        _hover: { bg: 'gray.600' },
                      })}
                    >
                      Select
                    </button>
                    {onOpenBulkDeleteModal && (
                      <button
                        type="button"
                        onClick={onOpenBulkDeleteModal}
                        disabled={images.length === 0}
                        className={css({
                          px: 4,
                          py: 2,
                          bg: 'red.700',
                          color: 'white',
                          fontWeight: 'medium',
                          borderRadius: 'md',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: images.length === 0 ? 0.5 : 1,
                          _hover: { bg: 'red.600' },
                        })}
                      >
                        Bulk Delete...
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={selectAll}
                      className={css({
                        px: 3,
                        py: 2,
                        bg: 'gray.700',
                        color: 'white',
                        borderRadius: 'md',
                        border: 'none',
                        cursor: 'pointer',
                        _hover: { bg: 'gray.600' },
                      })}
                    >
                      Select All ({images.length})
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={selectedImages.size === 0}
                      className={css({
                        px: 3,
                        py: 2,
                        bg: 'gray.700',
                        color: 'white',
                        borderRadius: 'md',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: selectedImages.size === 0 ? 0.5 : 1,
                        _hover: { bg: 'gray.600' },
                      })}
                    >
                      Clear
                    </button>
                    {onBulkReclassify && (
                      <div className={css({ position: 'relative' })}>
                        <button
                          type="button"
                          onClick={() => setShowBulkReclassify(!showBulkReclassify)}
                          disabled={selectedImages.size === 0 || reclassifying}
                          className={css({
                            px: 3,
                            py: 2,
                            bg: 'blue.600',
                            color: 'white',
                            borderRadius: 'md',
                            border: 'none',
                            cursor: 'pointer',
                            opacity: selectedImages.size === 0 || reclassifying ? 0.5 : 1,
                            _hover: { bg: 'blue.500' },
                          })}
                        >
                          {reclassifying
                            ? 'Reclassifying...'
                            : `Reclassify (${selectedImages.size})`}
                        </button>
                        {showBulkReclassify && (
                          <DigitDialpad
                            onSelect={handleBulkReclassifySelected}
                            onClose={() => setShowBulkReclassify(false)}
                          />
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleBulkDeleteSelected}
                      disabled={selectedImages.size === 0 || deleting}
                      className={css({
                        px: 3,
                        py: 2,
                        bg: 'red.600',
                        color: 'white',
                        borderRadius: 'md',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: selectedImages.size === 0 || deleting ? 0.5 : 1,
                        _hover: { bg: 'red.500' },
                      })}
                    >
                      {deleting ? 'Deleting...' : `Delete (${selectedImages.size})`}
                    </button>
                    <button
                      type="button"
                      onClick={exitSelectionMode}
                      className={css({
                        px: 3,
                        py: 2,
                        bg: 'gray.600',
                        color: 'white',
                        borderRadius: 'md',
                        border: 'none',
                        cursor: 'pointer',
                        _hover: { bg: 'gray.500' },
                      })}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </>
            )}
            <Link
              href="/vision-training/train"
              className={css({
                px: 4,
                py: 2,
                bg: 'green.600',
                color: 'white',
                fontWeight: 'semibold',
                borderRadius: 'md',
                textDecoration: 'none',
                _hover: { bg: 'green.700' },
              })}
            >
              Train Model
            </Link>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div
        data-element="stats"
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          mb: 6,
          p: 4,
          bg: 'gray.800',
          borderRadius: 'lg',
        })}
      >
        <div>
          <div
            className={css({
              fontSize: 'xs',
              color: 'gray.500',
              textTransform: 'uppercase',
            })}
          >
            Total Images
          </div>
          <div className={css({ fontSize: '2xl', fontWeight: 'bold' })}>{stats.total}</div>
        </div>
        <div>
          <div
            className={css({
              fontSize: 'xs',
              color: 'gray.500',
              textTransform: 'uppercase',
            })}
          >
            Players
          </div>
          <div className={css({ fontSize: '2xl', fontWeight: 'bold' })}>{stats.players}</div>
        </div>
        <div>
          <div
            className={css({
              fontSize: 'xs',
              color: 'gray.500',
              textTransform: 'uppercase',
            })}
          >
            Sessions
          </div>
          <div className={css({ fontSize: '2xl', fontWeight: 'bold' })}>{stats.sessions}</div>
        </div>
        <div className={css({ flex: 1, minWidth: '200px' })}>
          <div
            className={css({
              fontSize: 'xs',
              color: 'gray.500',
              textTransform: 'uppercase',
              mb: 1,
            })}
          >
            By Digit
          </div>
          <div className={css({ display: 'flex', gap: 2, flexWrap: 'wrap' })}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <div
                key={d}
                className={css({
                  px: 2,
                  py: 1,
                  bg: 'gray.700',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  fontFamily: 'mono',
                })}
              >
                {d}: {stats.digitCounts[d] || 0}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        data-element="filters"
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          mb: 6,
          p: 4,
          bg: 'gray.800',
          borderRadius: 'lg',
        })}
      >
        <div>
          <label
            className={css({
              display: 'block',
              fontSize: 'xs',
              color: 'gray.500',
              mb: 1,
            })}
          >
            Digit
          </label>
          <select
            value={filterDigit}
            onChange={(e) => onFilterDigitChange?.(e.target.value)}
            className={css({
              px: 3,
              py: 2,
              bg: 'gray.700',
              border: '1px solid',
              borderColor: 'gray.600',
              borderRadius: 'md',
              color: 'gray.100',
              minWidth: '120px',
            })}
          >
            <option value="">All digits</option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className={css({
              display: 'block',
              fontSize: 'xs',
              color: 'gray.500',
              mb: 1,
            })}
          >
            Player
          </label>
          <select
            value={filterPlayer}
            onChange={(e) => onFilterPlayerChange?.(e.target.value)}
            className={css({
              px: 3,
              py: 2,
              bg: 'gray.700',
              border: '1px solid',
              borderColor: 'gray.600',
              borderRadius: 'md',
              color: 'gray.100',
              minWidth: '120px',
            })}
          >
            <option value="">All players</option>
            {uniquePlayers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className={css({
              display: 'block',
              fontSize: 'xs',
              color: 'gray.500',
              mb: 1,
            })}
          >
            Session
          </label>
          <select
            value={filterSession}
            onChange={(e) => onFilterSessionChange?.(e.target.value)}
            className={css({
              px: 3,
              py: 2,
              bg: 'gray.700',
              border: '1px solid',
              borderColor: 'gray.600',
              borderRadius: 'md',
              color: 'gray.100',
              minWidth: '120px',
            })}
          >
            <option value="">All sessions</option>
            {uniqueSessions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className={css({
              display: 'block',
              fontSize: 'xs',
              color: 'gray.500',
              mb: 1,
            })}
          >
            Group by
          </label>
          <select
            value={groupBy}
            onChange={(e) => onGroupByChange?.(e.target.value as GroupBy)}
            className={css({
              px: 3,
              py: 2,
              bg: 'gray.700',
              border: '1px solid',
              borderColor: 'gray.600',
              borderRadius: 'md',
              color: 'gray.100',
              minWidth: '120px',
            })}
          >
            <option value="digit">Digit</option>
            <option value="player">Player</option>
            <option value="session">Session</option>
            <option value="none">No grouping</option>
          </select>
        </div>

        {onRefresh && (
          <div className={css({ display: 'flex', alignItems: 'flex-end' })}>
            <button
              type="button"
              onClick={onRefresh}
              className={css({
                px: 4,
                py: 2,
                bg: 'blue.600',
                color: 'white',
                borderRadius: 'md',
                border: 'none',
                cursor: 'pointer',
                _hover: { bg: 'blue.700' },
              })}
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Loading / Error states */}
      {loading && (
        <div className={css({ textAlign: 'center', py: 8, color: 'gray.500' })}>Loading...</div>
      )}

      {error && (
        <div
          className={css({
            p: 4,
            bg: 'red.900/50',
            border: '1px solid',
            borderColor: 'red.700',
            borderRadius: 'lg',
            color: 'red.200',
            mb: 4,
          })}
        >
          {error}
        </div>
      )}

      {/* Image groups */}
      {!loading && !error && (
        <div
          data-element="image-groups"
          className={css({ display: 'flex', flexDirection: 'column', gap: 6 })}
        >
          {Object.entries(groupedImages).map(([groupName, groupImages]) => (
            <div key={groupName} data-group={groupName}>
              <h2
                className={css({
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  mb: 3,
                  pb: 2,
                  borderBottom: '1px solid',
                  borderColor: 'gray.700',
                })}
              >
                {groupName}{' '}
                <span className={css({ color: 'gray.500', fontWeight: 'normal' })}>
                  ({groupImages.length})
                </span>
              </h2>

              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: 3,
                })}
              >
                {groupImages.map((img) => {
                  const isSelected = selectedImages.has(img.filename)
                  const hasOpenDialpad = reclassifyingImage === img.filename
                  return (
                    <div
                      key={img.filename}
                      data-image={img.filename}
                      data-selected={isSelected}
                      onClick={selectionMode ? () => toggleSelection(img.filename) : undefined}
                      className={css({
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        p: 2,
                        bg: isSelected ? 'blue.900' : 'gray.800',
                        borderRadius: 'lg',
                        transition: 'all 0.15s',
                        cursor: selectionMode ? 'pointer' : 'default',
                        border: '2px solid',
                        borderColor: isSelected ? 'blue.500' : 'transparent',
                        // Ensure tile with open dialpad stays on top
                        zIndex: hasOpenDialpad ? 100 : 'auto',
                        _hover: {
                          bg: isSelected ? 'blue.800' : 'gray.700',
                          transform: selectionMode ? 'none' : 'scale(1.05)',
                        },
                      })}
                    >
                      {/* Selection checkbox */}
                      {selectionMode && (
                        <div
                          className={css({
                            position: 'absolute',
                            top: 1,
                            left: 1,
                            width: '20px',
                            height: '20px',
                            borderRadius: 'sm',
                            border: '2px solid',
                            borderColor: isSelected ? 'blue.400' : 'gray.500',
                            bg: isSelected ? 'blue.500' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'xs',
                            color: 'white',
                          })}
                        >
                          {isSelected && '✓'}
                        </div>
                      )}
                      {/* Delete button (visible on hover when not in selection mode) */}
                      {!selectionMode && onDeleteImage && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteImage(img)
                          }}
                          data-action="delete-image"
                          className={css({
                            position: 'absolute',
                            top: 1,
                            right: 1,
                            width: '24px',
                            height: '24px',
                            borderRadius: 'full',
                            border: 'none',
                            bg: 'red.600',
                            color: 'white',
                            fontSize: 'sm',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            _hover: { bg: 'red.500', transform: 'scale(1.1)' },
                          })}
                        >
                          ✕
                        </button>
                      )}
                      {renderImage ? (
                        renderImage(img)
                      ) : (
                        /* biome-ignore lint/performance/noImgElement: Training images from API, not suitable for next/image optimization */
                        <img
                          src={img.imageUrl}
                          alt={`Digit ${img.digit}`}
                          className={css({
                            width: '64px',
                            height: '128px',
                            objectFit: 'contain',
                            bg: 'black',
                            borderRadius: 'md',
                            mb: 1,
                          })}
                        />
                      )}
                      {/* Image metadata - context-aware based on grouping */}
                      <div
                        className={css({
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 0.5,
                          width: '100%',
                        })}
                      >
                        {/* Digit - only show prominently when NOT grouped by digit */}
                        {groupBy !== 'digit' && (
                          <>
                            {!selectionMode && onReclassifyImage ? (
                              <div className={css({ position: 'relative' })}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setReclassifyingImage(
                                      reclassifyingImage === img.filename ? null : img.filename
                                    )
                                  }}
                                  className={css({
                                    fontSize: 'xl',
                                    fontWeight: 'bold',
                                    fontFamily: 'mono',
                                    bg: 'transparent',
                                    border: '1px dashed',
                                    borderColor:
                                      reclassifyingImage === img.filename
                                        ? 'blue.400'
                                        : 'transparent',
                                    borderRadius: 'md',
                                    px: 2,
                                    py: 0.5,
                                    cursor: 'pointer',
                                    color: 'inherit',
                                    _hover: {
                                      borderColor: 'blue.400',
                                      bg: 'gray.700',
                                    },
                                  })}
                                  title="Click to reclassify"
                                >
                                  {img.digit}
                                </button>
                                {reclassifyingImage === img.filename && (
                                  <DigitDialpad
                                    currentDigit={img.digit}
                                    onSelect={(d) => handleInlineReclassify(img, d)}
                                    onClose={() => setReclassifyingImage(null)}
                                  />
                                )}
                              </div>
                            ) : (
                              <div
                                className={css({
                                  fontSize: 'xl',
                                  fontWeight: 'bold',
                                  fontFamily: 'mono',
                                })}
                              >
                                {img.digit}
                              </div>
                            )}
                          </>
                        )}

                        {/* When grouped by digit: show reclassify button (small) and session info */}
                        {groupBy === 'digit' && (
                          <>
                            {!selectionMode && onReclassifyImage && (
                              <div className={css({ position: 'relative' })}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setReclassifyingImage(
                                      reclassifyingImage === img.filename ? null : img.filename
                                    )
                                  }}
                                  className={css({
                                    fontSize: 'xs',
                                    bg: 'gray.700',
                                    border: 'none',
                                    borderRadius: 'sm',
                                    px: 1.5,
                                    py: 0.5,
                                    cursor: 'pointer',
                                    color: 'gray.400',
                                    _hover: { bg: 'blue.600', color: 'white' },
                                  })}
                                  title="Reclassify this image"
                                >
                                  ✏️ fix
                                </button>
                                {reclassifyingImage === img.filename && (
                                  <DigitDialpad
                                    currentDigit={img.digit}
                                    onSelect={(d) => handleInlineReclassify(img, d)}
                                    onClose={() => setReclassifyingImage(null)}
                                  />
                                )}
                              </div>
                            )}
                            {/* Show session ID snippet when grouped by digit */}
                            <div
                              className={css({
                                fontSize: 'xs',
                                color: 'gray.500',
                                textAlign: 'center',
                                fontFamily: 'mono',
                              })}
                              title={`Session: ${img.sessionId}`}
                            >
                              {img.sessionId.slice(0, 6)}
                            </div>
                          </>
                        )}

                        {/* Show player when grouped by session */}
                        {groupBy === 'session' && (
                          <div
                            className={css({
                              fontSize: 'xs',
                              color: 'gray.500',
                              textAlign: 'center',
                              fontFamily: 'mono',
                            })}
                            title={`Player: ${img.playerId}`}
                          >
                            {img.playerId.slice(0, 6)}
                          </div>
                        )}

                        {/* Show column index when useful (not when it's redundant) */}
                        {groupBy !== 'digit' && (
                          <div
                            className={css({
                              fontSize: 'xs',
                              color: 'gray.500',
                              textAlign: 'center',
                            })}
                          >
                            col {img.columnIndex}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {Object.keys(groupedImages).length === 0 && (
            <div className={css({ textAlign: 'center', py: 8, color: 'gray.500' })}>
              No images collected yet. Enable vision mode and answer some problems correctly!
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TrainingImageViewer
