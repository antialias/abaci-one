'use client'

import { useCallback, useState } from 'react'
import type { RefObject } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { ParsingStatus } from '@/db/schema/practice-attachments'
import type { WorksheetParsingResult } from '@/lib/worksheet-parsing'
import { api } from '@/lib/queryClient'
import { css } from '../../../styled-system/css'
import { ParsedProblemsList } from '../worksheet-parsing'

export interface OfflineAttachment {
  id: string
  url: string
  filename?: string
  // Parsing fields
  parsingStatus?: ParsingStatus | null
  rawParsingResult?: WorksheetParsingResult | null
  needsReview?: boolean
  sessionCreated?: boolean
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
  /** ID of photo currently being parsed */
  parsingId: string | null
  /** Whether drag is over the drop zone */
  dragOver: boolean
  /** Dark mode */
  isDark: boolean
  /** Whether the user can upload photos (pre-flight auth check) */
  canUpload?: boolean
  /** Student ID for entry prompt */
  studentId?: string
  /** Student name for remediation message */
  studentName?: string
  /** Classroom ID for entry prompt (when canUpload is false) */
  classroomId?: string
  /** Handlers */
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onOpenCamera: () => void
  /** Open photo viewer/editor at index with specified mode */
  onOpenViewer: (index: number, mode: 'view' | 'edit') => void
  onDeletePhoto: (id: string) => void
  /** Start parsing a worksheet photo */
  onParse?: (id: string) => void
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
  parsingId,
  dragOver,
  isDark,
  canUpload = true,
  studentId,
  studentName,
  classroomId,
  onFileSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  onOpenCamera,
  onOpenViewer,
  onDeletePhoto,
  onParse,
}: OfflineWorkSectionProps) {
  const photoCount = attachments.length
  // Show add tile unless we have 8+ photos (max reasonable gallery size)
  // Also only show if user can upload
  const showAddTile = photoCount < 8 && canUpload
  // Show remediation when user can't upload but is a teacher with enrolled student
  const showRemediation = !canUpload && classroomId && studentId

  // Entry prompt state (for teachers who need student to enter classroom)
  const [promptSent, setPromptSent] = useState(false)

  // Mutation for sending entry prompt
  const sendEntryPrompt = useMutation({
    mutationFn: async (playerId: string) => {
      if (!classroomId) throw new Error('No classroom ID')
      const response = await api(`classrooms/${classroomId}/entry-prompts`, {
        method: 'POST',
        body: JSON.stringify({ playerIds: [playerId] }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send prompt')
      }
      return response.json()
    },
    onSuccess: (data) => {
      if (data.created > 0) {
        setPromptSent(true)
      }
    },
  })

  const handleSendEntryPrompt = useCallback(() => {
    if (studentId) {
      sendEntryPrompt.mutate(studentId)
    }
  }, [sendEntryPrompt, studentId])

  // Find all attachments with parsing results
  const parsedAttachments = attachments.filter(
    (att) =>
      att.rawParsingResult?.problems &&
      att.rawParsingResult.problems.length > 0 &&
      (att.parsingStatus === 'needs_review' || att.parsingStatus === 'approved')
  )

  // Track which parsed result is currently expanded (default to first one)
  const [expandedResultId, setExpandedResultId] = useState<string | null>(
    parsedAttachments[0]?.id ?? null
  )

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

            {/* Parse button - show if not parsed yet OR if failed (to allow retry) */}
            {onParse &&
              (!att.parsingStatus || att.parsingStatus === 'failed') &&
              !att.sessionCreated && (
                <button
                  type="button"
                  data-action="parse-worksheet"
                  onClick={(e) => {
                    e.stopPropagation()
                    onParse(att.id)
                  }}
                  disabled={parsingId === att.id}
                  className={css({
                    position: 'absolute',
                    bottom: '0.5rem',
                    right: '0.5rem',
                    height: '24px',
                    paddingX: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    backgroundColor: att.parsingStatus === 'failed' ? 'orange.500' : 'blue.500',
                    color: 'white',
                    borderRadius: 'full',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.6875rem',
                    fontWeight: '600',
                    transition: 'background-color 0.2s',
                    _hover: {
                      backgroundColor: att.parsingStatus === 'failed' ? 'orange.600' : 'blue.600',
                    },
                    _disabled: {
                      backgroundColor: 'gray.400',
                      cursor: 'wait',
                    },
                  })}
                  aria-label={att.parsingStatus === 'failed' ? 'Retry parsing' : 'Parse worksheet'}
                >
                  {parsingId === att.id ? '⏳' : att.parsingStatus === 'failed' ? '🔄' : '🔍'}{' '}
                  {att.parsingStatus === 'failed' ? 'Retry' : 'Parse'}
                </button>
              )}

            {/* Parsing status badge - don't show for 'failed' since retry button is shown instead */}
            {att.parsingStatus && att.parsingStatus !== 'failed' && (
              <div
                data-element="parsing-status"
                className={css({
                  position: 'absolute',
                  bottom: '0.5rem',
                  right: '0.5rem',
                  height: '24px',
                  paddingX: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  borderRadius: 'full',
                  fontSize: '0.6875rem',
                  fontWeight: '600',
                  backgroundColor:
                    att.parsingStatus === 'processing'
                      ? 'blue.500'
                      : att.parsingStatus === 'needs_review'
                        ? 'yellow.500'
                        : att.parsingStatus === 'approved'
                          ? 'green.500'
                          : 'gray.500',
                  color: att.parsingStatus === 'needs_review' ? 'yellow.900' : 'white',
                })}
              >
                {att.parsingStatus === 'processing' && '⏳'}
                {att.parsingStatus === 'needs_review' && '⚠️'}
                {att.parsingStatus === 'approved' && '✓'}
                {att.parsingStatus === 'processing'
                  ? 'Analyzing...'
                  : att.parsingStatus === 'needs_review'
                    ? `${att.rawParsingResult?.problems?.length ?? '?'} problems`
                    : att.parsingStatus === 'approved'
                      ? `${att.rawParsingResult?.problems?.length ?? '?'} problems`
                      : att.parsingStatus}
              </div>
            )}

            {/* Session created indicator */}
            {att.sessionCreated && (
              <div
                data-element="session-created"
                className={css({
                  position: 'absolute',
                  bottom: '0.5rem',
                  right: '0.5rem',
                  height: '24px',
                  paddingX: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  borderRadius: 'full',
                  fontSize: '0.6875rem',
                  fontWeight: '600',
                  backgroundColor: 'green.600',
                  color: 'white',
                })}
              >
                ✓ Session Created
              </div>
            )}
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

      {/* Remediation banner - shown when teacher can't upload because student isn't present */}
      {showRemediation && (
        <div
          data-element="upload-remediation"
          className={css({
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: isDark ? 'orange.900/30' : 'orange.50',
            border: '2px solid',
            borderColor: isDark ? 'orange.700' : 'orange.300',
            borderRadius: '12px',
          })}
        >
          {!promptSent ? (
            <>
              <h4
                className={css({
                  fontSize: '0.9375rem',
                  fontWeight: '600',
                  color: isDark ? 'orange.300' : 'orange.700',
                  marginBottom: '0.5rem',
                })}
              >
                {studentName || 'This student'} is not in your classroom
              </h4>
              <p
                className={css({
                  fontSize: '0.875rem',
                  color: isDark ? 'gray.300' : 'gray.600',
                  marginBottom: '1rem',
                  lineHeight: '1.5',
                })}
              >
                To upload photos for {studentName || 'this student'}, they need to enter your
                classroom first. Send a notification to their parent to have them join.
              </p>
              <button
                type="button"
                onClick={handleSendEntryPrompt}
                disabled={sendEntryPrompt.isPending}
                data-action="send-entry-prompt"
                className={css({
                  padding: '0.625rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: 'white',
                  backgroundColor: isDark ? 'orange.600' : 'orange.500',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: sendEntryPrompt.isPending ? 'wait' : 'pointer',
                  opacity: sendEntryPrompt.isPending ? 0.7 : 1,
                  transition: 'all 0.15s ease',
                  _hover: {
                    backgroundColor: isDark ? 'orange.500' : 'orange.600',
                  },
                  _disabled: {
                    cursor: 'wait',
                    opacity: 0.7,
                  },
                })}
              >
                {sendEntryPrompt.isPending ? 'Sending...' : 'Send Entry Prompt'}
              </button>
            </>
          ) : (
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              })}
            >
              <span
                className={css({
                  fontSize: '1.25rem',
                })}
              >
                ✓
              </span>
              <p
                className={css({
                  fontSize: '0.9375rem',
                  fontWeight: '500',
                  color: isDark ? 'green.300' : 'green.700',
                })}
              >
                Entry prompt sent to {studentName || 'the student'}&apos;s parent
              </p>
            </div>
          )}
        </div>
      )}

      {/* Parsing hint footer - only show if no parsed results yet */}
      {onParse && parsedAttachments.length === 0 && (
        <div
          data-element="parsing-hint"
          className={css({
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: isDark ? 'gray.400' : 'gray.600',
            fontSize: '0.8125rem',
          })}
        >
          <span>✨</span>
          <span>
            Click &ldquo;Parse&rdquo; on any photo to auto-extract problems from worksheets
          </span>
        </div>
      )}

      {/* Parsed Results Section - show when any photo has parsing results */}
      {parsedAttachments.length > 0 && (
        <div
          data-element="parsed-results-section"
          className={css({
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          {/* Section header with photo selector if multiple parsed photos */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
            })}
          >
            <h4
              className={css({
                fontSize: '0.875rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              })}
            >
              <span>📊</span>
              Extracted Problems
            </h4>

            {/* Photo selector tabs when multiple parsed photos */}
            {parsedAttachments.length > 1 && (
              <div
                className={css({
                  display: 'flex',
                  gap: '0.25rem',
                })}
              >
                {parsedAttachments.map((att, index) => {
                  const photoIndex = attachments.findIndex((a) => a.id === att.id)
                  return (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => setExpandedResultId(att.id)}
                      className={css({
                        px: 2,
                        py: 1,
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        borderRadius: 'md',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        backgroundColor:
                          expandedResultId === att.id
                            ? isDark
                              ? 'blue.600'
                              : 'blue.500'
                            : isDark
                              ? 'gray.700'
                              : 'gray.100',
                        color:
                          expandedResultId === att.id ? 'white' : isDark ? 'gray.300' : 'gray.700',
                        _hover: {
                          backgroundColor:
                            expandedResultId === att.id
                              ? isDark
                                ? 'blue.500'
                                : 'blue.600'
                              : isDark
                                ? 'gray.600'
                                : 'gray.200',
                        },
                      })}
                    >
                      Photo {photoIndex + 1}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Show the selected parsed result */}
          {parsedAttachments.map((att) => {
            if (att.id !== expandedResultId) return null
            if (!att.rawParsingResult) return null

            return <ParsedProblemsList key={att.id} result={att.rawParsingResult} isDark={isDark} />
          })}
        </div>
      )}
    </div>
  )
}

export default OfflineWorkSection
