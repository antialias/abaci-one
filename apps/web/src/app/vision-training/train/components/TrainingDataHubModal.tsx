'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { css } from '../../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import { NumeralSelector } from './NumeralSelector'
import { DigitImageBrowser, type TrainingImageMeta } from './DigitImageBrowser'
import { DigitCapturePanel } from './DigitCapturePanel'
import { isColumnClassifierSamples, type SamplesData } from './wizard/types'

interface SyncStatus {
  available: boolean
  remote?: { host: string; totalImages: number }
  local?: { totalImages: number }
  needsSync?: boolean
  newOnRemote?: number
  newOnLocal?: number
  excludedByDeletion?: number
  error?: string
}

interface SyncProgress {
  phase: 'idle' | 'connecting' | 'syncing' | 'complete' | 'error'
  message: string
  filesTransferred?: number
  bytesTransferred?: number
}

interface TrainingDataHubModalProps {
  isOpen: boolean
  onClose: () => void
  samples: SamplesData | null
  onDataChanged: () => void
  syncStatus: SyncStatus | null
  syncProgress: SyncProgress
  onStartSync: () => void
  onCancelSync: () => void
}

type MobileTab = 'browse' | 'capture'

/**
 * Numeral-centric Training Data Hub Modal
 *
 * Organized around the 10 digits (0-9) with:
 * - Numeral selector bar at top showing counts/health
 * - Split view: image browser (left) + capture panel (right)
 * - Mobile: tab toggle between browse and capture
 */
export function TrainingDataHubModal({
  isOpen,
  onClose,
  samples,
  onDataChanged,
  syncStatus,
  syncProgress,
  onStartSync,
  onCancelSync,
}: TrainingDataHubModalProps) {
  // Selected digit (0-9)
  const [selectedDigit, setSelectedDigit] = useState(0)

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<MobileTab>('capture')

  // Images for the selected digit
  const [images, setImages] = useState<TrainingImageMeta[]>([])
  const [imagesLoading, setImagesLoading] = useState(false)

  // Digit counts from samples or computed from loaded images
  // (only available for column classifier samples)
  const digitCounts = useMemo(() => {
    if (samples && isColumnClassifierSamples(samples)) {
      const counts: Record<number, number> = {}
      for (let i = 0; i <= 9; i++) {
        counts[i] = samples.digits[i]?.count || 0
      }
      return counts
    }
    return { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
  }, [samples])

  // Total image count
  const totalImages = useMemo(() => {
    return Object.values(digitCounts).reduce((sum, count) => sum + count, 0)
  }, [digitCounts])

  // Load images for selected digit
  // showLoading: set to false when refreshing after capture (to avoid flash of loading state)
  const loadImages = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setImagesLoading(true)
      }
      try {
        const response = await fetch(`/api/vision-training/images?digit=${selectedDigit}`)
        if (response.ok) {
          const data = await response.json()
          setImages(data.images || [])
        }
      } catch (error) {
        console.error('Failed to load images:', error)
      } finally {
        if (showLoading) {
          setImagesLoading(false)
        }
      }
    },
    [selectedDigit]
  )

  // Load images when digit changes or modal opens
  useEffect(() => {
    if (isOpen) {
      loadImages()
    }
  }, [isOpen, selectedDigit, loadImages])

  // Handle capture success - refresh data without showing loading state
  const handleCaptureSuccess = useCallback(
    (capturedCount: number) => {
      onDataChanged()
      // Don't show loading state - keeps existing images visible while new ones are fetched
      loadImages(false)
    },
    [onDataChanged, loadImages]
  )

  // Handle image deletion
  const handleDeleteImage = useCallback(
    async (image: TrainingImageMeta) => {
      // Optimistically remove from state
      setImages((prev) => prev.filter((img) => img.filename !== image.filename))

      try {
        const response = await fetch('/api/vision-training/images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filenames: [{ digit: image.digit, filename: image.filename }],
            confirm: true,
          }),
        })
        if (response.ok) {
          onDataChanged()
          loadImages(false)
        } else {
          loadImages(false)
        }
      } catch (error) {
        console.error('Failed to delete image:', error)
        loadImages(false)
      }
    },
    [onDataChanged, loadImages]
  )

  // Handle bulk image deletion
  const handleBulkDeleteImages = useCallback(
    async (imagesToDelete: TrainingImageMeta[]) => {
      // Optimistically remove deleted images from state
      const deletedFilenames = new Set(imagesToDelete.map((img) => img.filename))
      setImages((prev) => prev.filter((img) => !deletedFilenames.has(img.filename)))

      try {
        const response = await fetch('/api/vision-training/images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filenames: imagesToDelete.map((img) => ({
              digit: img.digit,
              filename: img.filename,
            })),
            confirm: true,
          }),
        })
        if (response.ok) {
          onDataChanged()
          // Refresh in background without loading state
          loadImages(false)
        } else {
          // Revert on failure
          loadImages(false)
        }
      } catch (error) {
        console.error('Failed to bulk delete images:', error)
        // Revert on failure
        loadImages(false)
      }
    },
    [onDataChanged, loadImages]
  )

  // Handle image reclassification
  const handleReclassifyImage = useCallback(
    async (image: TrainingImageMeta, newDigit: number) => {
      // Optimistically remove from current view (it's moving to another digit)
      setImages((prev) => prev.filter((img) => img.filename !== image.filename))

      try {
        const response = await fetch(
          `/api/vision-training/images/${image.digit}/${image.filename}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newDigit }),
          }
        )
        if (response.ok) {
          onDataChanged()
          loadImages(false)
        } else {
          loadImages(false)
        }
      } catch (error) {
        console.error('Failed to reclassify image:', error)
        loadImages(false)
      }
    },
    [onDataChanged, loadImages]
  )

  // Handle bulk image reclassification
  const handleBulkReclassifyImages = useCallback(
    async (imagesToMove: TrainingImageMeta[], newDigit: number) => {
      // Optimistically remove reclassified images from current view (they're moving to another digit)
      const movedFilenames = new Set(imagesToMove.map((img) => img.filename))
      setImages((prev) => prev.filter((img) => !movedFilenames.has(img.filename)))

      try {
        const response = await fetch('/api/vision-training/images', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: imagesToMove.map((img) => ({
              digit: img.digit,
              filename: img.filename,
            })),
            newDigit,
          }),
        })
        if (response.ok) {
          onDataChanged()
          // Refresh in background without loading state
          loadImages(false)
        } else {
          // Revert on failure
          loadImages(false)
        }
      } catch (error) {
        console.error('Failed to bulk reclassify images:', error)
        // Revert on failure
        loadImages(false)
      }
    },
    [onDataChanged, loadImages]
  )

  const isSyncing = syncProgress.phase === 'connecting' || syncProgress.phase === 'syncing'
  const hasNewOnRemote = (syncStatus?.newOnRemote ?? 0) > 0

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: 'fixed',
            inset: 0,
            bg: 'black/80',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease',
          })}
          style={{ zIndex: Z_INDEX.MODAL }}
        />
        <Dialog.Content
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { base: '100vw', lg: '95vw' },
            maxWidth: '1400px',
            height: { base: '100vh', lg: '90vh' },
            maxHeight: '900px',
            bg: 'gray.900',
            borderRadius: { base: '0', lg: 'xl' },
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.3s ease',
          })}
          style={{ zIndex: Z_INDEX.MODAL + 1 }}
        >
          {/* Accessible title (visually hidden) */}
          <Dialog.Title className={css({ srOnly: true })}>Training Data Hub</Dialog.Title>
          <Dialog.Description className={css({ srOnly: true })}>
            Manage and capture training data for the digit classifier
          </Dialog.Description>

          {/* ═══════════════════════════════════════════════════════════════════
              HEADER
              ═══════════════════════════════════════════════════════════════════ */}
          <div
            data-element="modal-header"
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: { base: 3, lg: 5 },
              py: 3,
              borderBottom: '1px solid',
              borderColor: 'gray.800',
              bg: 'gray.850',
            })}
          >
            <div
              data-element="header-title-group"
              className={css({ display: 'flex', alignItems: 'center', gap: 3 })}
            >
              <span data-element="header-icon" className={css({ fontSize: 'xl' })}>
                🎯
              </span>
              <div data-element="header-text">
                <h2
                  data-element="header-title"
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'bold',
                    color: 'gray.100',
                  })}
                >
                  Training Data Hub
                </h2>
                <div
                  data-element="header-subtitle"
                  className={css({ fontSize: 'sm', color: 'gray.500' })}
                >
                  {totalImages.toLocaleString()} images • {samples?.dataQuality || 'unknown'}{' '}
                  quality
                </div>
              </div>
            </div>

            <div
              data-element="header-actions"
              className={css({ display: 'flex', alignItems: 'center', gap: 2 })}
            >
              {/* Sync button */}
              {syncStatus?.available && (
                <button
                  type="button"
                  data-action="sync"
                  data-status={isSyncing ? 'syncing' : hasNewOnRemote ? 'has-new' : 'in-sync'}
                  onClick={isSyncing ? onCancelSync : onStartSync}
                  disabled={!hasNewOnRemote && !isSyncing}
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 3,
                    py: 2,
                    bg: isSyncing ? 'blue.800' : hasNewOnRemote ? 'blue.600' : 'gray.700',
                    color: hasNewOnRemote || isSyncing ? 'white' : 'gray.500',
                    borderRadius: 'lg',
                    border: 'none',
                    cursor: hasNewOnRemote || isSyncing ? 'pointer' : 'not-allowed',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    _hover: hasNewOnRemote ? { bg: 'blue.500' } : {},
                  })}
                >
                  {isSyncing ? (
                    <>
                      <span
                        className={css({
                          animation: 'spin 1s linear infinite',
                        })}
                      >
                        🔄
                      </span>
                      <span
                        className={css({
                          display: { base: 'none', md: 'inline' },
                        })}
                      >
                        {syncProgress.message}
                      </span>
                    </>
                  ) : hasNewOnRemote ? (
                    <>
                      <span>☁️</span>
                      <span
                        className={css({
                          display: { base: 'none', md: 'inline' },
                        })}
                      >
                        Sync {syncStatus.newOnRemote} new
                      </span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span
                        className={css({
                          display: { base: 'none', md: 'inline' },
                        })}
                      >
                        In sync
                      </span>
                    </>
                  )}
                </button>
              )}

              {/* Close button */}
              <Dialog.Close asChild>
                <button
                  type="button"
                  data-action="close-modal"
                  className={css({
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bg: 'transparent',
                    color: 'gray.500',
                    borderRadius: 'lg',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'lg',
                    _hover: { bg: 'gray.800', color: 'gray.300' },
                  })}
                >
                  ✕
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              NUMERAL SELECTOR BAR
              ═══════════════════════════════════════════════════════════════════ */}
          <div
            data-element="numeral-selector-bar"
            className={css({
              px: { base: 2, lg: 5 },
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

          {/* ═══════════════════════════════════════════════════════════════════
              MAIN CONTENT - SPLIT VIEW
              ═══════════════════════════════════════════════════════════════════ */}
          <div
            data-element="main-content"
            className={css({
              flex: 1,
              display: 'flex',
              flexDirection: { base: 'column', lg: 'row' },
              minHeight: 0,
              overflow: 'hidden',
            })}
          >
            {/* Mobile tab toggle */}
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
                data-action="select-capture-tab"
                data-active={mobileTab === 'capture'}
                onClick={() => setMobileTab('capture')}
                className={css({
                  flex: 1,
                  py: 3,
                  bg: 'transparent',
                  color: mobileTab === 'capture' ? 'blue.400' : 'gray.500',
                  borderBottom: '2px solid',
                  borderColor: mobileTab === 'capture' ? 'blue.400' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'medium',
                  fontSize: 'sm',
                })}
              >
                📸 Capture
              </button>
              <button
                type="button"
                data-action="select-browse-tab"
                data-active={mobileTab === 'browse'}
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
                🖼 Browse ({digitCounts[selectedDigit] || 0})
              </button>
            </div>

            {/* Left: Image Browser (desktop always, mobile when tab selected) */}
            {/* This is the ONLY scrollable section - takes remaining space */}
            <div
              data-element="browse-panel"
              data-visible={mobileTab === 'browse'}
              className={css({
                display: {
                  base: mobileTab === 'browse' ? 'flex' : 'none',
                  lg: 'flex',
                },
                flexDirection: 'column',
                flex: 1,
                minWidth: 0,
                borderRight: { lg: '1px solid' },
                borderColor: { lg: 'gray.800' },
                bg: 'gray.850',
                overflow: 'hidden',
              })}
            >
              {/* Scrollable image grid */}
              <div
                data-element="browse-scroll-area"
                className={css({ flex: 1, overflow: 'auto', p: 3 })}
              >
                <DigitImageBrowser
                  digit={selectedDigit}
                  images={images}
                  loading={imagesLoading}
                  onDeleteImage={handleDeleteImage}
                  onBulkDeleteImages={handleBulkDeleteImages}
                  onReclassifyImage={handleReclassifyImage}
                  onBulkReclassifyImages={handleBulkReclassifyImages}
                />
              </div>
            </div>

            {/* Right: Capture Panel (desktop always, mobile when tab selected) */}
            {/* No scrolling - camera takes full height, sized to content */}
            <div
              data-element="capture-panel"
              data-visible={mobileTab === 'capture'}
              className={css({
                display: {
                  base: mobileTab === 'capture' ? 'flex' : 'none',
                  lg: 'flex',
                },
                flexDirection: 'column',
                flexShrink: 0,
                width: { lg: 'auto' },
                maxWidth: { lg: '50%' },
                minHeight: 0,
                overflow: 'hidden',
                bg: 'gray.900',
              })}
            >
              <DigitCapturePanel
                digit={selectedDigit}
                onCaptureSuccess={handleCaptureSuccess}
                columnCount={4}
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default TrainingDataHubModal
