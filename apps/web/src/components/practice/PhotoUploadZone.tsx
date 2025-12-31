'use client'

import { useCallback, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'
import { CameraCapture } from '../worksheets/CameraCapture'

interface PhotoUploadZoneProps {
  /** Currently selected photos */
  photos: File[]
  /** Callback when photos change */
  onPhotosChange: (photos: File[]) => void
  /** Maximum number of photos allowed (default: unlimited) */
  maxPhotos?: number
  /** Whether the zone is disabled */
  disabled?: boolean
}

/**
 * Multi-photo upload zone with drag & drop, file picker, and camera capture.
 * Shows preview thumbnails with remove buttons.
 */
export function PhotoUploadZone({
  photos,
  onPhotosChange,
  maxPhotos,
  disabled = false,
}: PhotoUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create object URLs for preview (memoized per photo)
  const [previewUrls, setPreviewUrls] = useState<Map<File, string>>(new Map())

  const getPreviewUrl = useCallback(
    (photo: File): string => {
      if (previewUrls.has(photo)) {
        return previewUrls.get(photo)!
      }
      const url = URL.createObjectURL(photo)
      setPreviewUrls((prev) => new Map(prev).set(photo, url))
      return url
    },
    [previewUrls]
  )

  const addPhotos = useCallback(
    (newFiles: File[]) => {
      setError(null)

      // Filter for images only
      const imageFiles = newFiles.filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length < newFiles.length) {
        setError('Some files were skipped (not images)')
      }

      // Check max limit
      const availableSlots = maxPhotos ? maxPhotos - photos.length : Infinity
      const filesToAdd = imageFiles.slice(0, availableSlots)

      if (filesToAdd.length < imageFiles.length) {
        setError(`Maximum ${maxPhotos} photos allowed`)
      }

      if (filesToAdd.length > 0) {
        onPhotosChange([...photos, ...filesToAdd])
      }
    },
    [photos, onPhotosChange, maxPhotos]
  )

  const removePhoto = useCallback(
    (photoToRemove: File) => {
      // Revoke the object URL to free memory
      const url = previewUrls.get(photoToRemove)
      if (url) {
        URL.revokeObjectURL(url)
        setPreviewUrls((prev) => {
          const next = new Map(prev)
          next.delete(photoToRemove)
          return next
        })
      }
      onPhotosChange(photos.filter((p) => p !== photoToRemove))
    },
    [photos, onPhotosChange, previewUrls]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled) return

      const files = Array.from(e.dataTransfer.files)
      addPhotos(files)
    },
    [addPhotos, disabled]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) {
        setDragOver(true)
      }
    },
    [disabled]
  )

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : []
      addPhotos(files)
      // Reset input so the same file can be selected again
      e.target.value = ''
    },
    [addPhotos]
  )

  const handleCameraCapture = useCallback(
    async (file: File) => {
      addPhotos([file])
      setShowCamera(false)
    },
    [addPhotos]
  )

  const canAddMore = !maxPhotos || photos.length < maxPhotos

  return (
    <div data-component="photo-upload-zone">
      {/* Camera capture modal */}
      {showCamera && (
        <div
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
          onClick={() => setShowCamera(false)}
        >
          <div
            className={css({
              bg: 'white',
              borderRadius: 'lg',
              p: 6,
              maxW: '600px',
              w: '100%',
            })}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 4,
              })}
            >
              <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>Take Photo</h3>
              <button
                type="button"
                onClick={() => setShowCamera(false)}
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
            <CameraCapture onCapture={handleCameraCapture} disabled={disabled} autoStart />
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={css({
          border: '2px dashed',
          borderColor: dragOver ? 'blue.400' : 'gray.300',
          borderRadius: 'lg',
          p: 6,
          textAlign: 'center',
          bg: dragOver ? 'blue.50' : 'gray.50',
          transition: 'all 0.2s',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        })}
        onClick={() => !disabled && canAddMore && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={disabled || !canAddMore}
          className={css({ display: 'none' })}
        />

        <div className={css({ fontSize: '3xl', mb: 2 })}>📷</div>

        {photos.length === 0 ? (
          <>
            <p className={css({ color: 'gray.600', mb: 1 })}>Drop photos here or click to browse</p>
            <p className={css({ fontSize: 'sm', color: 'gray.400' })}>
              JPG, PNG, HEIC • Multiple files supported
            </p>
          </>
        ) : canAddMore ? (
          <p className={css({ color: 'gray.600' })}>Drop more photos or click to add</p>
        ) : (
          <p className={css({ color: 'gray.500' })}>Maximum photos reached ({maxPhotos})</p>
        )}
      </div>

      {/* Action buttons */}
      <div
        className={css({
          display: 'flex',
          gap: 2,
          mt: 3,
          justifyContent: 'center',
        })}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || !canAddMore}
          className={css({
            px: 4,
            py: 2,
            bg: 'blue.500',
            color: 'white',
            borderRadius: 'md',
            fontSize: 'sm',
            fontWeight: 'medium',
            cursor: 'pointer',
            _hover: { bg: 'blue.600' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          Choose Files
        </button>

        <button
          type="button"
          onClick={() => setShowCamera(true)}
          disabled={disabled || !canAddMore}
          className={css({
            px: 4,
            py: 2,
            bg: 'green.500',
            color: 'white',
            borderRadius: 'md',
            fontSize: 'sm',
            fontWeight: 'medium',
            cursor: 'pointer',
            _hover: { bg: 'green.600' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          📷 Camera
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div
          className={css({
            mt: 3,
            p: 2,
            bg: 'orange.50',
            border: '1px solid',
            borderColor: 'orange.200',
            borderRadius: 'md',
            color: 'orange.700',
            fontSize: 'sm',
            textAlign: 'center',
          })}
        >
          {error}
        </div>
      )}

      {/* Photo previews */}
      {photos.length > 0 && (
        <div
          className={css({
            mt: 4,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: 3,
          })}
        >
          {photos.map((photo, idx) => (
            <div
              key={`${photo.name}-${photo.lastModified}-${idx}`}
              className={css({
                position: 'relative',
                aspectRatio: '1',
                borderRadius: 'md',
                overflow: 'hidden',
                bg: 'gray.100',
              })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs don't work with Next Image */}
              {/* biome-ignore lint/performance/noImgElement: blob URLs for previews don't work with Next Image */}
              <img
                src={getPreviewUrl(photo)}
                alt={`Preview ${idx + 1}`}
                className={css({
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                })}
              />

              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removePhoto(photo)
                }}
                disabled={disabled}
                className={css({
                  position: 'absolute',
                  top: 1,
                  right: 1,
                  width: '24px',
                  height: '24px',
                  bg: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
                  borderRadius: 'full',
                  fontSize: 'sm',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  _hover: { bg: 'rgba(0, 0, 0, 0.8)' },
                  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
