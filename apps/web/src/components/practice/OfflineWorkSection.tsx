'use client'

import type { RefObject } from 'react'
import { css } from '../../../styled-system/css'

export interface OfflineAttachment {
  id: string
  url: string
  filename?: string
}

export interface OfflineWorkSectionProps {
  /** Attachments to display */
  attachments: OfflineAttachment[]
  /** Ref for hidden file input */
  fileInputRef: RefObject<HTMLInputElement>
  /** Whether file upload is in progress */
  isUploading: boolean
  /** Upload error message */
  uploadError: string | null
  /** ID of photo being deleted */
  deletingId: string | null
  /** Whether drag is over the drop zone */
  dragOver: boolean
  /** Dark mode */
  isDark: boolean
  /** Handlers */
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onOpenCamera: () => void
  /** Open photo viewer/editor at index with specified mode */
  onOpenViewer: (index: number, mode: 'view' | 'edit') => void
  onDeletePhoto: (id: string) => void
}

/**
 * OfflineWorkSection - Unified gallery for offline practice photos
 *
 * Design principles:
 * - Single unified card (not two separate panes)
 * - Gallery-first: add buttons ARE gallery tiles
 * - Accommodates 1-8 scans gracefully
 * - Coming Soon is a subtle footer, not a separate box
 */
export function OfflineWorkSection({
  attachments,
  fileInputRef,
  isUploading,
  uploadError,
  deletingId,
  dragOver,
  isDark,
  onFileSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  onOpenCamera,
  onOpenViewer,
  onDeletePhoto,
}: OfflineWorkSectionProps) {
  const photoCount = attachments.length
  // Show add tile unless we have 8+ photos (max reasonable gallery size)
  const showAddTile = photoCount < 8

  return (
    <div
      data-component="offline-work-section"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={css({
        padding: '1.25rem',
        backgroundColor: isDark ? 'gray.800' : 'white',
        borderRadius: '16px',
        border: '2px solid',
        borderColor: dragOver ? 'blue.400' : isDark ? 'gray.700' : 'gray.200',
        borderStyle: dragOver ? 'dashed' : 'solid',
        transition: 'border-color 0.2s, border-style 0.2s',
      })}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFileSelect}
        className={css({ display: 'none' })}
      />

      {/* Header */}
      <h3
        className={css({
          fontSize: '1rem',
          fontWeight: 'bold',
          color: isDark ? 'white' : 'gray.800',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        })}
      >
        <span>📝</span>
        Offline Practice
        {photoCount > 0 && (
          <span
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'normal',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            ({photoCount})
          </span>
        )}
      </h3>

      {/* Upload error */}
      {uploadError && (
        <div
          className={css({
            mb: 3,
            p: 2,
            bg: isDark ? 'red.900/50' : 'red.50',
            border: '1px solid',
            borderColor: isDark ? 'red.700' : 'red.200',
            borderRadius: 'md',
            color: isDark ? 'red.300' : 'red.700',
            fontSize: 'sm',
          })}
        >
          {uploadError}
        </div>
      )}

      {/* Unified Gallery Grid - photos + add tiles together */}
      <div
        data-element="photo-gallery"
        className={css({
          display: 'grid',
          gap: '0.75rem',
          // Responsive columns: 2 on mobile, 3 on tablet, 4 on desktop
          gridTemplateColumns: 'repeat(2, 1fr)',
          '@media (min-width: 480px)': {
            gridTemplateColumns: 'repeat(3, 1fr)',
          },
          '@media (min-width: 768px)': {
            gridTemplateColumns: 'repeat(4, 1fr)',
          },
        })}
      >
        {/* Existing photos */}
        {attachments.map((att, index) => (
          <div
            key={att.id}
            data-element="photo-tile"
            className={css({
              position: 'relative',
              aspectRatio: '1',
              borderRadius: '12px',
              overflow: 'hidden',
              bg: isDark ? 'gray.700' : 'gray.100',
              cursor: 'pointer',
              boxShadow: 'sm',
              transition: 'transform 0.15s, box-shadow 0.15s',
              _hover: {
                transform: 'scale(1.02)',
                boxShadow: 'md',
                '& [data-action="delete-photo"], & [data-action="edit-photo"]': {
                  opacity: 1,
                },
              },
            })}
          >
            <button
              type="button"
              onClick={() => onOpenViewer(index, 'view')}
              className={css({
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                padding: 0,
                border: 'none',
                cursor: 'pointer',
                bg: 'transparent',
              })}
              aria-label={`View photo ${index + 1}`}
            >
              {/* biome-ignore lint/a11y/useAltText: decorative thumbnail */}
              {/* biome-ignore lint/performance/noImgElement: API-served images */}
              <img
                src={att.url}
                className={css({
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                })}
              />
            </button>

            {/* Edit button overlay */}
            <button
              type="button"
              data-action="edit-photo"
              onClick={(e) => {
                e.stopPropagation()
                onOpenViewer(index, 'edit')
              }}
              className={css({
                position: 'absolute',
                top: '0.5rem',
                left: '0.5rem',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                borderRadius: 'full',
                border: 'none',
                cursor: 'pointer',
                opacity: 0,
                transition: 'opacity 0.2s, background-color 0.2s',
                fontSize: '0.875rem',
                _hover: {
                  backgroundColor: 'blue.600',
                },
              })}
              aria-label="Edit photo"
            >
              ✏️
            </button>

            {/* Delete button overlay */}
            <button
              type="button"
              data-action="delete-photo"
              onClick={(e) => {
                e.stopPropagation()
                onDeletePhoto(att.id)
              }}
              disabled={deletingId === att.id}
              className={css({
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                borderRadius: 'full',
                border: 'none',
                cursor: 'pointer',
                opacity: 0,
                transition: 'opacity 0.2s, background-color 0.2s',
                fontSize: '1rem',
                _hover: {
                  backgroundColor: 'red.600',
                },
                _disabled: {
                  opacity: 0.5,
                  cursor: 'not-allowed',
                },
              })}
              aria-label="Delete photo"
            >
              {deletingId === att.id ? '...' : '×'}
            </button>

            {/* Photo number badge */}
            <div
              className={css({
                position: 'absolute',
                bottom: '0.5rem',
                left: '0.5rem',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                borderRadius: 'full',
                fontSize: '0.75rem',
                fontWeight: 'bold',
              })}
            >
              {index + 1}
            </div>
          </div>
        ))}

        {/* Add tile - split into two instant-action zones */}
        {showAddTile && (
          <div
            data-element="add-tile"
            className={css({
              position: 'relative',
              aspectRatio: '1',
              borderRadius: '12px',
              border: '2px dashed',
              borderColor: isDark ? 'gray.600' : 'gray.300',
              backgroundColor: isDark ? 'gray.750' : 'gray.100',
              overflow: 'hidden',
              display: 'flex',
              opacity: isUploading ? 0.5 : 1,
              pointerEvents: isUploading ? 'none' : 'auto',
            })}
          >
            {isUploading ? (
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  gap: '0.25rem',
                })}
              >
                <span className={css({ fontSize: '1.5rem' })}>⏳</span>
                <span
                  className={css({
                    fontSize: '0.6875rem',
                    color: isDark ? 'gray.400' : 'gray.500',
                  })}
                >
                  Uploading...
                </span>
              </div>
            ) : (
              <>
                {/* Left half - Upload file */}
                <button
                  type="button"
                  data-action="upload-file"
                  onClick={() => fileInputRef.current?.click()}
                  className={css({
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                    _hover: {
                      backgroundColor: isDark ? 'gray.700' : 'gray.200',
                    },
                  })}
                  aria-label="Upload file"
                >
                  <span className={css({ fontSize: '1.25rem' })}>📄</span>
                  <span
                    className={css({
                      fontSize: '0.625rem',
                      color: isDark ? 'gray.500' : 'gray.500',
                    })}
                  >
                    Upload
                  </span>
                </button>

                {/* Divider */}
                <div
                  className={css({
                    width: '1px',
                    backgroundColor: isDark ? 'gray.600' : 'gray.300',
                  })}
                />

                {/* Right half - Take photo */}
                <button
                  type="button"
                  data-action="take-photo"
                  onClick={onOpenCamera}
                  className={css({
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                    _hover: {
                      backgroundColor: isDark ? 'gray.700' : 'gray.200',
                    },
                  })}
                  aria-label="Take photo"
                >
                  <span className={css({ fontSize: '1.25rem' })}>📷</span>
                  <span
                    className={css({
                      fontSize: '0.625rem',
                      color: isDark ? 'gray.500' : 'gray.500',
                    })}
                  >
                    Camera
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Coming Soon footer - subtle, integrated */}
      <div
        data-element="coming-soon-hint"
        className={css({
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: isDark ? 'gray.500' : 'gray.500',
          fontSize: '0.8125rem',
        })}
      >
        <span>🔮</span>
        <span>Coming soon: Auto-analyze worksheets to track progress</span>
      </div>
    </div>
  )
}

export default OfflineWorkSection
