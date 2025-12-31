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
  /** Optional scrollspy section ID for navigation */
  scrollspySection?: string
  /** Handlers */
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onOpenCamera: () => void
  onOpenLightbox: (index: number) => void
  onDeletePhoto: (id: string) => void
}

/**
 * OfflineWorkSection - Photos of offline practice work + Coming Soon placeholder
 *
 * Features:
 * - Photo grid with 150px thumbnails
 * - Click-to-expand in lightbox
 * - Delete button on hover
 * - File upload via button or drag-and-drop
 * - Camera capture button
 * - "Coming Soon" placeholder for AI analysis
 */
export function OfflineWorkSection({
  attachments,
  fileInputRef,
  isUploading,
  uploadError,
  deletingId,
  dragOver,
  isDark,
  scrollspySection,
  onFileSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  onOpenCamera,
  onOpenLightbox,
  onDeletePhoto,
}: OfflineWorkSectionProps) {
  const hasPhotos = attachments.length > 0

  return (
    <div
      data-component="offline-work-section"
      data-scrollspy-section={scrollspySection}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      })}
    >
      {/* Photos Section - Drop Target */}
      <div
        data-section="session-photos"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={css({
          padding: '1.5rem',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '16px',
          border: '2px solid',
          borderColor: dragOver ? 'blue.400' : isDark ? 'gray.700' : 'gray.200',
          borderStyle: dragOver ? 'dashed' : 'solid',
          transition: 'all 0.2s',
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

        {/* Header with action buttons */}
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          })}
        >
          <h3
            className={css({
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: isDark ? 'white' : 'gray.800',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            <span>📝</span> Offline Practice
            {hasPhotos && (
              <span
                className={css({
                  fontSize: '0.875rem',
                  fontWeight: 'normal',
                  color: isDark ? 'gray.400' : 'gray.500',
                })}
              >
                ({attachments.length})
              </span>
            )}
          </h3>

          {/* Action buttons */}
          <div className={css({ display: 'flex', gap: '0.5rem' })}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={css({
                px: 3,
                py: 1.5,
                bg: isDark ? 'blue.600' : 'blue.500',
                color: 'white',
                borderRadius: 'md',
                fontSize: 'sm',
                fontWeight: 'medium',
                cursor: 'pointer',
                _hover: { bg: isDark ? 'blue.500' : 'blue.600' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isUploading ? 'Uploading...' : 'Choose Files'}
            </button>
            <button
              type="button"
              onClick={onOpenCamera}
              disabled={isUploading}
              className={css({
                px: 3,
                py: 1.5,
                bg: isDark ? 'green.600' : 'green.500',
                color: 'white',
                borderRadius: 'md',
                fontSize: 'sm',
                fontWeight: 'medium',
                cursor: 'pointer',
                _hover: { bg: isDark ? 'green.500' : 'green.600' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              📷 Camera
            </button>
          </div>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div
            className={css({
              mb: 3,
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

        {/* Photo grid or empty state */}
        {hasPhotos ? (
          <div
            data-element="photo-grid"
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '0.75rem',
            })}
          >
            {attachments.map((att, index) => (
              <div
                key={att.id}
                data-element="photo-thumbnail"
                className={css({
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: 'lg',
                  overflow: 'hidden',
                  bg: 'gray.100',
                  cursor: 'pointer',
                  '&:hover [data-action="delete-photo"]': {
                    opacity: 1,
                  },
                })}
              >
                {/* Clickable image */}
                <button
                  type="button"
                  onClick={() => onOpenLightbox(index)}
                  className={css({
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    padding: 0,
                    border: 'none',
                    cursor: 'pointer',
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
                    transition: 'opacity 0.2s',
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
              </div>
            ))}
          </div>
        ) : (
          <div
            data-element="empty-photos"
            className={css({
              textAlign: 'center',
              py: 6,
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            <div className={css({ fontSize: '3rem', mb: 2 })}>📷</div>
            <p className={css({ mb: 1 })}>No photos yet</p>
            <p className={css({ fontSize: 'sm' })}>Upload photos of worksheets or practice work</p>
          </div>
        )}
      </div>

      {/* Coming Soon - AI Analysis Placeholder */}
      <div
        data-section="coming-soon"
        className={css({
          padding: '1rem',
          backgroundColor: isDark ? 'gray.800/50' : 'gray.50',
          borderRadius: '12px',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          })}
        >
          <span
            className={css({
              fontSize: '1.5rem',
              lineHeight: 1,
            })}
          >
            🔮
          </span>
          <div>
            <h4
              className={css({
                fontSize: '0.875rem',
                fontWeight: 'bold',
                color: isDark ? 'gray.300' : 'gray.700',
                marginBottom: '0.25rem',
              })}
            >
              Coming Soon
            </h4>
            <p
              className={css({
                fontSize: '0.8125rem',
                color: isDark ? 'gray.400' : 'gray.600',
                lineHeight: 1.4,
              })}
            >
              We'll soon analyze your worksheets and automatically track problems completed, just
              like online practice!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OfflineWorkSection
