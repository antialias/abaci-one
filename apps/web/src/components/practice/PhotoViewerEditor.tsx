'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { css } from '../../../styled-system/css'
import { DocumentAdjuster } from './DocumentAdjuster'
import { useDocumentDetection } from './useDocumentDetection'

export interface PhotoViewerEditorPhoto {
  id: string
  url: string
  originalUrl: string | null
  corners: Array<{ x: number; y: number }> | null
  rotation: 0 | 90 | 180 | 270
}

interface PhotoViewerEditorProps {
  /** Array of photos to display */
  photos: PhotoViewerEditorPhoto[]
  /** Index of the initially selected photo */
  initialIndex: number
  /** Initial mode - 'view' shows photo, 'edit' shows crop UI */
  initialMode: 'view' | 'edit'
  /** Whether the viewer is open */
  isOpen: boolean
  /** Callback when viewer should close */
  onClose: () => void
  /** Callback when photo is edited (re-cropped) */
  onEditConfirm: (
    photoId: string,
    croppedFile: File,
    corners: Array<{ x: number; y: number }>,
    rotation: 0 | 90 | 180 | 270
  ) => Promise<void>
}

/**
 * PhotoViewerEditor - Unified photo viewer and editor
 *
 * Combines the PhotoLightbox viewing experience with DocumentAdjuster editing:
 * - View mode: Full-screen photo view with navigation (prev/next, keyboard)
 * - Edit mode: DocumentAdjuster crop/rotate UI
 * - Seamless toggle between modes
 */
export function PhotoViewerEditor({
  photos,
  initialIndex,
  initialMode,
  isOpen,
  onClose,
  onEditConfirm,
}: PhotoViewerEditorProps): ReactNode {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode)
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false)
  const [editState, setEditState] = useState<{
    sourceCanvas: HTMLCanvasElement
    corners: Array<{ x: number; y: number }>
    rotation: 0 | 90 | 180 | 270
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // Flag to prevent auto-reload after saving (which clears editState)
  const [editCompleted, setEditCompleted] = useState(false)

  const { isReady: isDetectionReady, detectQuadsInImage, loadImageToCanvas, cv: opencvRef } = useDocumentDetection()

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      setMode(initialMode)
      setEditState(null)
      setEditCompleted(false)
    }
  }, [isOpen, initialIndex, initialMode])

  // Auto-load original for edit mode on open
  // Don't auto-load if edit was completed (user clicked Done) - prevents re-triggering edit mode
  useEffect(() => {
    if (isOpen && initialMode === 'edit' && !editState && isDetectionReady && !editCompleted) {
      loadOriginalForEditing()
    }
  }, [isOpen, initialMode, editState, isDetectionReady, editCompleted])

  const currentPhoto = photos[currentIndex]
  const hasMultiple = photos.length > 1

  // Navigate to previous photo (view mode only)
  const goToPrevious = useCallback(() => {
    if (mode === 'view') {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
    }
  }, [mode, photos.length])

  // Navigate to next photo (view mode only)
  const goToNext = useCallback(() => {
    if (mode === 'view') {
      setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
    }
  }, [mode, photos.length])

  // Load original image for editing
  const loadOriginalForEditing = useCallback(async () => {
    if (!currentPhoto || !isDetectionReady) return

    setIsLoadingOriginal(true)
    try {
      // Fetch original image (falls back to cropped for legacy attachments)
      const originalUrl = currentPhoto.originalUrl || currentPhoto.url
      const response = await fetch(originalUrl)
      if (!response.ok) throw new Error('Failed to load original image')

      const blob = await response.blob()
      const file = new File([blob], 'original.jpg', { type: blob.type })

      const canvas = await loadImageToCanvas(file)
      if (!canvas) throw new Error('Failed to load image to canvas')

      // Use saved corners if available, otherwise detect
      let corners: Array<{ x: number; y: number }>
      if (currentPhoto.corners && currentPhoto.corners.length === 4) {
        corners = currentPhoto.corners
      } else {
        const result = detectQuadsInImage(canvas)
        corners = result.corners
      }

      // Use saved rotation if available
      const rotation = currentPhoto.rotation || 0

      setEditState({ sourceCanvas: canvas, corners, rotation })
      setMode('edit')
    } catch (err) {
      console.error('Failed to load original for editing:', err)
    } finally {
      setIsLoadingOriginal(false)
    }
  }, [currentPhoto, isDetectionReady, loadImageToCanvas, detectQuadsInImage])

  // Handle entering edit mode
  const handleEnterEditMode = useCallback(() => {
    if (editState) {
      // Already loaded, just switch mode
      setMode('edit')
    } else {
      // Need to load original
      loadOriginalForEditing()
    }
  }, [editState, loadOriginalForEditing])

  // Handle edit confirm
  const handleEditConfirm = useCallback(
    async (croppedFile: File, corners: Array<{ x: number; y: number }>, rotation: 0 | 90 | 180 | 270) => {
      if (!currentPhoto) return

      setIsSaving(true)
      try {
        await onEditConfirm(currentPhoto.id, croppedFile, corners, rotation)
        // Mark edit as completed before clearing state to prevent auto-reload
        setEditCompleted(true)
        // After saving, clear edit state so it reloads with new data next time
        setEditState(null)

        // If opened directly in edit mode, close the viewer entirely
        // Otherwise, return to view mode
        if (initialMode === 'edit') {
          onClose()
        } else {
          setMode('view')
        }
      } catch (err) {
        console.error('Failed to save edit:', err)
      } finally {
        setIsSaving(false)
      }
    },
    [currentPhoto, onEditConfirm, initialMode, onClose]
  )

  // Handle edit cancel - return to view mode, or close if opened directly in edit mode
  const handleEditCancel = useCallback(() => {
    if (initialMode === 'edit') {
      onClose()
    } else {
      setMode('view')
    }
  }, [initialMode, onClose])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (mode === 'edit') {
        // In edit mode, Escape cancels - close if opened in edit mode, otherwise go to view
        if (e.key === 'Escape') {
          if (initialMode === 'edit') {
            onClose()
          } else {
            setMode('view')
          }
        }
        return
      }

      // View mode keyboard shortcuts
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          goToPrevious()
          break
        case 'ArrowRight':
          goToNext()
          break
        case 'e':
        case 'E':
          handleEnterEditMode()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, mode, initialMode, onClose, goToPrevious, goToNext, handleEnterEditMode])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  if (!isOpen || photos.length === 0) return null

  // Edit mode loading - show loading screen while preparing editor
  if (mode === 'edit' && (!editState || !opencvRef || isLoadingOriginal)) {
    return (
      <div
        data-component="photo-viewer-editor"
        data-mode="edit-loading"
        className={css({
          position: 'fixed',
          inset: 0,
          zIndex: Z_INDEX.MODAL,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 'lg',
        })}
      >
        Loading editor...
      </div>
    )
  }

  // Edit mode - show DocumentAdjuster
  if (mode === 'edit' && editState && opencvRef) {
    return (
      <div
        data-component="photo-viewer-editor"
        data-mode="edit"
        className={css({
          position: 'fixed',
          inset: 0,
          zIndex: Z_INDEX.MODAL,
        })}
      >
        <DocumentAdjuster
          sourceCanvas={editState.sourceCanvas}
          initialCorners={editState.corners}
          initialRotation={editState.rotation}
          onConfirm={handleEditConfirm}
          onCancel={handleEditCancel}
          cv={opencvRef}
          detectQuadsInImage={detectQuadsInImage}
        />
        {isSaving && (
          <div
            className={css({
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bg: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              fontSize: 'xl',
            })}
          >
            Saving...
          </div>
        )}
      </div>
    )
  }

  // View mode - show lightbox-style viewer
  return (
    <div
      data-component="photo-viewer-editor"
      data-mode="view"
      className={css({
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: Z_INDEX.MODAL,
        padding: '1rem',
      })}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        data-action="close-viewer"
        onClick={onClose}
        className={css({
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          color: 'white',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          _hover: {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          },
        })}
        aria-label="Close"
      >
        ×
      </button>

      {/* Edit button */}
      <button
        type="button"
        data-action="enter-edit-mode"
        onClick={(e) => {
          e.stopPropagation()
          handleEnterEditMode()
        }}
        disabled={isLoadingOriginal || !isDetectionReady}
        className={css({
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          px: 4,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          fontSize: 'sm',
          fontWeight: 'medium',
          color: 'white',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: 'lg',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          _hover: {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          },
          _disabled: {
            opacity: 0.5,
            cursor: 'not-allowed',
          },
        })}
        aria-label="Edit photo"
      >
        {isLoadingOriginal ? (
          'Loading...'
        ) : (
          <>
            <span>✏️</span>
            <span>Edit</span>
          </>
        )}
      </button>

      {/* Previous button */}
      {hasMultiple && (
        <button
          type="button"
          data-action="previous-photo"
          onClick={(e) => {
            e.stopPropagation()
            goToPrevious()
          }}
          className={css({
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            _hover: {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
          })}
          aria-label="Previous photo"
        >
          ◀
        </button>
      )}

      {/* Photo container */}
      <div
        className={css({
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 120px)',
          padding: '0 60px',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* biome-ignore lint/performance/noImgElement: API-served images */}
        <img
          src={currentPhoto.url}
          alt={`Photo ${currentIndex + 1}`}
          className={css({
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          })}
        />
      </div>

      {/* Next button */}
      {hasMultiple && (
        <button
          type="button"
          data-action="next-photo"
          onClick={(e) => {
            e.stopPropagation()
            goToNext()
          }}
          className={css({
            position: 'absolute',
            right: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            _hover: {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
          })}
          aria-label="Next photo"
        >
          ▶
        </button>
      )}

      {/* Photo counter and keyboard hint */}
      <div
        data-element="viewer-footer"
        className={css({
          position: 'absolute',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        })}
      >
        {hasMultiple && (
          <div
            data-element="photo-counter"
            className={css({
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '20px',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: '500',
            })}
          >
            {currentIndex + 1} / {photos.length}
          </div>
        )}
        <div
          data-element="keyboard-hint"
          className={css({
            color: 'gray.500',
            fontSize: 'xs',
          })}
        >
          Press E to edit • Arrow keys to navigate • Esc to close
        </div>
      </div>
    </div>
  )
}

export default PhotoViewerEditor
