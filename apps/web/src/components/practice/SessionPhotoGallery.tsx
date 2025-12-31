'use client'

import { useCallback, useEffect, useState } from 'react'
import { css } from '../../../styled-system/css'
import { PhotoUploadZone } from './PhotoUploadZone'

interface Attachment {
  id: string
  filename: string
  mimeType: string
  fileSize: number
  uploadedAt: string
  url: string
}

interface SessionPhotoGalleryProps {
  /** Player ID */
  playerId: string
  /** Session ID to fetch photos for */
  sessionId: string
  /** Whether the gallery is open */
  isOpen: boolean
  /** Close callback */
  onClose: () => void
  /** Start with upload section open */
  initialShowUpload?: boolean
  /** Callback when photos are successfully uploaded */
  onPhotosUploaded?: () => void
}

/**
 * Photo gallery modal for viewing and adding session attachments.
 * Fetches and displays photos for a specific session.
 * Allows adding new photos to the session.
 */
export function SessionPhotoGallery({
  playerId,
  sessionId,
  isOpen,
  onClose,
  initialShowUpload = false,
  onPhotosUploaded,
}: SessionPhotoGalleryProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [showUpload, setShowUpload] = useState(initialShowUpload)
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Fetch attachments
  const fetchAttachments = useCallback(() => {
    setIsLoading(true)
    setError(null)

    fetch(`/api/curriculum/${playerId}/sessions/${sessionId}/attachments`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch photos')
        return res.json()
      })
      .then((data) => {
        setAttachments(data.attachments || [])
        setIsLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setIsLoading(false)
      })
  }, [playerId, sessionId])

  // Fetch attachments and reset state when modal opens
  useEffect(() => {
    if (!isOpen) return
    setShowUpload(initialShowUpload)
    fetchAttachments()
  }, [isOpen, playerId, sessionId, initialShowUpload, fetchAttachments])

  const handleClose = useCallback(() => {
    setSelectedIndex(null)
    setShowUpload(false)
    setPendingPhotos([])
    onClose()
  }, [onClose])

  // Handle uploading new photos
  const handleUploadPhotos = useCallback(async () => {
    if (pendingPhotos.length === 0) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      for (const photo of pendingPhotos) {
        formData.append('photos', photo)
      }

      const response = await fetch(
        `/api/curriculum/${playerId}/sessions/${sessionId}/attachments`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload photos')
      }

      // Clear pending photos and refresh attachments
      setPendingPhotos([])
      setShowUpload(false)
      fetchAttachments()
      onPhotosUploaded?.()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload photos')
    } finally {
      setIsUploading(false)
    }
  }, [pendingPhotos, playerId, sessionId, fetchAttachments, onPhotosUploaded])

  const handlePrev = useCallback(() => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }, [selectedIndex])

  const handleNext = useCallback(() => {
    if (selectedIndex !== null && selectedIndex < attachments.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }, [selectedIndex, attachments.length])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen || selectedIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'Escape') setSelectedIndex(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, handlePrev, handleNext])

  if (!isOpen) return null

  return (
    <div
      data-component="session-photo-gallery"
      className={css({
        position: 'fixed',
        inset: 0,
        bg: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        p: 4,
      })}
      onClick={handleClose}
    >
      <div
        className={css({
          bg: 'white',
          borderRadius: 'xl',
          maxW: '800px',
          w: '100%',
          maxH: '90vh',
          overflowY: 'auto',
          boxShadow: 'xl',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={css({
            p: 5,
            borderBottom: '1px solid',
            borderColor: 'gray.200',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <h2
            className={css({
              fontSize: 'xl',
              fontWeight: 'bold',
              color: 'gray.800',
            })}
          >
            Practice Photos
            {attachments.length > 0 && (
              <span className={css({ fontWeight: 'normal', color: 'gray.500', ml: 2 })}>
                ({attachments.length})
              </span>
            )}
          </h2>
          <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
            {!showUpload && (
              <button
                type="button"
                onClick={() => setShowUpload(true)}
                className={css({
                  px: 3,
                  py: 1.5,
                  bg: 'blue.500',
                  color: 'white',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  _hover: { bg: 'blue.600' },
                })}
              >
                + Add Photos
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className={css({
                fontSize: '2xl',
                color: 'gray.400',
                cursor: 'pointer',
                _hover: { color: 'gray.600' },
              })}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={css({ p: 5 })}>
          {/* Upload Section */}
          {showUpload && (
            <div
              className={css({
                mb: 5,
                p: 4,
                bg: 'blue.50',
                borderRadius: 'lg',
                border: '1px solid',
                borderColor: 'blue.200',
              })}
            >
              <h3
                className={css({
                  fontSize: 'md',
                  fontWeight: 'semibold',
                  color: 'gray.800',
                  mb: 3,
                })}
              >
                Add Photos
              </h3>
              <PhotoUploadZone
                photos={pendingPhotos}
                onPhotosChange={setPendingPhotos}
                disabled={isUploading}
              />
              {uploadError && (
                <div
                  className={css({
                    mt: 3,
                    p: 2,
                    bg: 'red.50',
                    border: '1px solid',
                    borderColor: 'red.200',
                    borderRadius: 'md',
                    color: 'red.700',
                    fontSize: 'sm',
                  })}
                >
                  {uploadError}
                </div>
              )}
              <div className={css({ display: 'flex', gap: 2, mt: 3 })}>
                <button
                  type="button"
                  onClick={() => {
                    setShowUpload(false)
                    setPendingPhotos([])
                    setUploadError(null)
                  }}
                  disabled={isUploading}
                  className={css({
                    flex: 1,
                    py: 2,
                    border: '1px solid',
                    borderColor: 'gray.300',
                    borderRadius: 'md',
                    color: 'gray.700',
                    fontWeight: 'medium',
                    cursor: 'pointer',
                    _hover: { bg: 'gray.50' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUploadPhotos}
                  disabled={isUploading || pendingPhotos.length === 0}
                  className={css({
                    flex: 1,
                    py: 2,
                    bg: 'blue.500',
                    color: 'white',
                    borderRadius: 'md',
                    fontWeight: 'medium',
                    cursor: 'pointer',
                    _hover: { bg: 'blue.600' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  {isUploading
                    ? 'Uploading...'
                    : `Upload ${pendingPhotos.length} Photo${pendingPhotos.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div
              className={css({
                textAlign: 'center',
                py: 8,
                color: 'gray.500',
              })}
            >
              Loading photos...
            </div>
          ) : error ? (
            <div
              className={css({
                textAlign: 'center',
                py: 8,
                color: 'red.500',
              })}
            >
              {error}
            </div>
          ) : attachments.length === 0 ? (
            <div
              className={css({
                textAlign: 'center',
                py: 8,
                color: 'gray.500',
              })}
            >
              No photos for this session
            </div>
          ) : (
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 4,
              })}
            >
              {attachments.map((att, idx) => (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={css({
                    aspectRatio: '1',
                    borderRadius: 'lg',
                    overflow: 'hidden',
                    bg: 'gray.100',
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    transition: 'all 0.15s',
                    _hover: {
                      borderColor: 'blue.500',
                      transform: 'scale(1.02)',
                    },
                  })}
                >
                  {/* biome-ignore lint/a11y/useAltText: decorative thumbnail */}
                  {/* biome-ignore lint/performance/noImgElement: API-served images can't use Next Image */}
                  <img
                    src={att.url}
                    className={css({
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    })}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox overlay for selected image */}
      {selectedIndex !== null && attachments[selectedIndex] && (
        <div
          className={css({
            position: 'fixed',
            inset: 0,
            bg: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
          })}
          onClick={() => setSelectedIndex(null)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setSelectedIndex(null)}
            className={css({
              position: 'absolute',
              top: 4,
              right: 4,
              fontSize: '3xl',
              color: 'white',
              cursor: 'pointer',
              zIndex: 10,
              _hover: { color: 'gray.300' },
            })}
          >
            ×
          </button>

          {/* Previous button */}
          {selectedIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handlePrev()
              }}
              className={css({
                position: 'absolute',
                left: 4,
                fontSize: '4xl',
                color: 'white',
                cursor: 'pointer',
                zIndex: 10,
                _hover: { color: 'gray.300' },
              })}
            >
              ‹
            </button>
          )}

          {/* Next button */}
          {selectedIndex < attachments.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleNext()
              }}
              className={css({
                position: 'absolute',
                right: 4,
                fontSize: '4xl',
                color: 'white',
                cursor: 'pointer',
                zIndex: 10,
                _hover: { color: 'gray.300' },
              })}
            >
              ›
            </button>
          )}

          {/* Image */}
          {/* biome-ignore lint/a11y/useAltText: full-size image view */}
          {/* biome-ignore lint/performance/noImgElement: API-served images can't use Next Image */}
          <img
            src={attachments[selectedIndex].url}
            onClick={(e) => e.stopPropagation()}
            className={css({
              maxW: '90vw',
              maxH: '90vh',
              objectFit: 'contain',
              borderRadius: 'lg',
            })}
          />

          {/* Counter */}
          <div
            className={css({
              position: 'absolute',
              bottom: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'white',
              fontSize: 'sm',
              bg: 'rgba(0, 0, 0, 0.5)',
              px: 3,
              py: 1,
              borderRadius: 'full',
            })}
          >
            {selectedIndex + 1} / {attachments.length}
          </div>
        </div>
      )}
    </div>
  )
}
