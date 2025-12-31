'use client'

import { useCallback, useEffect, useState } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { css } from '../../../styled-system/css'

export interface PhotoLightboxPhoto {
  id: string
  url: string
  filename?: string
}

interface PhotoLightboxProps {
  /** Array of photos to display */
  photos: PhotoLightboxPhoto[]
  /** Index of the initially selected photo */
  initialIndex: number
  /** Whether the lightbox is open */
  isOpen: boolean
  /** Callback when lightbox should close */
  onClose: () => void
}

/**
 * PhotoLightbox - Full-screen photo viewer with navigation
 *
 * Features:
 * - Full-screen overlay
 * - Left/right navigation arrows
 * - Keyboard navigation (arrow keys, Escape)
 * - Click outside to close
 * - Photo counter (1 of 3)
 */
export function PhotoLightbox({ photos, initialIndex, isOpen, onClose }: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  // Reset index when opening with new initial index
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
    }
  }, [isOpen, initialIndex])

  // Navigate to previous photo
  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
  }, [photos.length])

  // Navigate to next photo
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
  }, [photos.length])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
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
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, goToPrevious, goToNext])

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

  const currentPhoto = photos[currentIndex]
  const hasMultiple = photos.length > 1

  return (
    <div
      data-component="photo-lightbox"
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
        data-action="close-lightbox"
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
        {/* biome-ignore lint/performance/noImgElement: API-served images in lightbox */}
        <img
          src={currentPhoto.url}
          alt={currentPhoto.filename || `Photo ${currentIndex + 1}`}
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

      {/* Photo counter */}
      {hasMultiple && (
        <div
          data-element="photo-counter"
          className={css({
            position: 'absolute',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
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
    </div>
  )
}

export default PhotoLightbox
