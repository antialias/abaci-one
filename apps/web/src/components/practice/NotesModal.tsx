'use client'

import { animated, useSpring } from '@react-spring/web'
import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'

interface NotesModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Student info */
  student: {
    id: string
    name: string
    emoji: string
    color: string
    notes: string | null
    isArchived?: boolean
  }
  /** Bounding rect of the source tile for zoom animation */
  sourceBounds: DOMRect | null
  /** Called when the modal should close */
  onClose: () => void
  /** Called when notes are saved */
  onSave: (notes: string) => Promise<void>
  /** Called when archive status is toggled */
  onToggleArchive?: () => Promise<void>
  /** Dark mode */
  isDark: boolean
}

/**
 * NotesModal - Full-featured modal for viewing/editing student notes
 *
 * Features:
 * - Zoom animation from source tile
 * - Prominent student emoji and name header
 * - Scrollable notes content
 * - Edit mode with save/cancel
 */
export function NotesModal({
  isOpen,
  student,
  sourceBounds,
  onClose,
  onSave,
  onToggleArchive,
  isDark,
}: NotesModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedNotes, setEditedNotes] = useState(student.notes ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset edit state when modal opens/closes or student changes
  useEffect(() => {
    if (isOpen) {
      setEditedNotes(student.notes ?? '')
      setIsEditing(false)
    }
  }, [isOpen, student.notes])

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false)
          setEditedNotes(student.notes ?? '')
        } else {
          onClose()
        }
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isEditing, student.notes, onClose])

  // Track previous open state to detect open transitions
  const wasOpenRef = useRef(false)
  const isOpening = !wasOpenRef.current && isOpen

  useEffect(() => {
    wasOpenRef.current = isOpen
  }, [isOpen])

  // Calculate animation values
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 800
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 600

  // Modal target dimensions and position (centered)
  const modalWidth = Math.min(500, windowWidth - 40)
  const modalHeight = Math.min(600, windowHeight - 80)
  const targetX = (windowWidth - modalWidth) / 2
  const targetY = (windowHeight - modalHeight) / 2

  // Source position (from tile) or fallback to center
  const sourceX = sourceBounds?.left ?? targetX
  const sourceY = sourceBounds?.top ?? targetY
  const sourceWidth = sourceBounds?.width ?? modalWidth
  const sourceHeight = sourceBounds?.height ?? modalHeight

  // Spring animation for the modal
  // Reset when opening to start from the new tile position
  const springProps = useSpring({
    from: {
      x: sourceX,
      y: sourceY,
      width: sourceWidth,
      height: sourceHeight,
      opacity: 0,
      scale: 0.95,
    },
    to: {
      x: isOpen ? targetX : sourceX,
      y: isOpen ? targetY : sourceY,
      width: isOpen ? modalWidth : sourceWidth,
      height: isOpen ? modalHeight : sourceHeight,
      opacity: isOpen ? 1 : 0,
      scale: isOpen ? 1 : 0.95,
    },
    reset: isOpening,
    config: { tension: 300, friction: 30 },
  })

  // Backdrop spring
  const backdropSpring = useSpring({
    opacity: isOpen ? 1 : 0,
    config: { tension: 300, friction: 30 },
  })

  const handleStartEditing = useCallback(() => {
    setEditedNotes(student.notes ?? '')
    setIsEditing(true)
  }, [student.notes])

  const handleCancel = useCallback(() => {
    setEditedNotes(student.notes ?? '')
    setIsEditing(false)
  }, [student.notes])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await onSave(editedNotes)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save notes:', error)
    } finally {
      setIsSaving(false)
    }
  }, [editedNotes, onSave])

  return (
    <>
      {/* Backdrop - use pointerEvents to allow clicks through when closing */}
      <animated.div
        data-element="notes-modal-backdrop"
        onClick={onClose}
        style={{
          opacity: backdropSpring.opacity,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        className={css({
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 1000,
        })}
      />

      {/* Modal - use pointerEvents to allow clicks through when closing */}
      <animated.div
        ref={modalRef}
        data-component="notes-modal"
        style={{
          position: 'fixed',
          left: springProps.x,
          top: springProps.y,
          width: springProps.width,
          height: springProps.height,
          opacity: springProps.opacity,
          transform: springProps.scale.to((s) => `scale(${s})`),
          transformOrigin: 'center center',
          zIndex: 1001,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        className={css({
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        })}
      >
        {/* Header with student info */}
        <div
          data-element="notes-modal-header"
          className={css({
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
          style={{ backgroundColor: student.color }}
        >
          {/* Large emoji avatar */}
          <div
            className={css({
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              flexShrink: 0,
            })}
          >
            {student.emoji}
          </div>

          {/* Name and label */}
          <div className={css({ flex: 1, minWidth: 0 })}>
            <h2
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: 'white',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                marginBottom: '0.25rem',
              })}
            >
              {student.name}
            </h2>
            <span
              className={css({
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.8)',
              })}
            >
              Teacher Notes
            </span>
          </div>

          {/* Close button */}
          <button
            type="button"
            data-action="close-notes-modal"
            onClick={onClose}
            className={css({
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              fontSize: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              _hover: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
            })}
          >
            ✕
          </button>
        </div>

        {/* Content area */}
        <div
          data-element="notes-modal-content"
          className={css({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: isDark ? 'gray.800' : 'white',
            overflow: 'hidden',
          })}
        >
          {isEditing ? (
            /* Edit mode */
            <div
              className={css({
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '1rem',
                gap: '1rem',
              })}
            >
              <textarea
                ref={textareaRef}
                data-element="notes-textarea"
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Add notes about this student... observations, learning preferences, areas to focus on, etc."
                className={css({
                  flex: 1,
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  backgroundColor: isDark ? 'gray.700' : 'gray.50',
                  color: isDark ? 'gray.100' : 'gray.900',
                  fontSize: '0.9375rem',
                  lineHeight: '1.6',
                  resize: 'none',
                  fontFamily: 'inherit',
                  _focus: {
                    outline: 'none',
                    borderColor: 'blue.500',
                  },
                  _placeholder: {
                    color: isDark ? 'gray.500' : 'gray.400',
                  },
                })}
              />

              {/* Edit action buttons */}
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                })}
              >
                <button
                  type="button"
                  data-action="cancel-edit"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className={css({
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'gray.700' : 'gray.200',
                    color: isDark ? 'gray.300' : 'gray.700',
                    fontSize: '0.875rem',
                    fontWeight: 'medium',
                    border: 'none',
                    cursor: 'pointer',
                    _hover: {
                      backgroundColor: isDark ? 'gray.600' : 'gray.300',
                    },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-action="save-notes"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={css({
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'green.700' : 'green.500',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: 'medium',
                    border: 'none',
                    cursor: 'pointer',
                    _hover: {
                      backgroundColor: isDark ? 'green.600' : 'green.600',
                    },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  {isSaving ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          ) : (
            /* View mode */
            <>
              <div
                data-element="notes-scroll-area"
                className={css({
                  flex: 1,
                  overflow: 'auto',
                  padding: '1.25rem',
                })}
              >
                {student.notes ? (
                  <div
                    className={css({
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.9375rem',
                      lineHeight: '1.7',
                      color: isDark ? 'gray.200' : 'gray.700',
                    })}
                  >
                    {student.notes}
                  </div>
                ) : (
                  <div
                    className={css({
                      textAlign: 'center',
                      padding: '3rem 1rem',
                      color: isDark ? 'gray.500' : 'gray.400',
                    })}
                  >
                    <div
                      className={css({
                        fontSize: '3rem',
                        marginBottom: '1rem',
                      })}
                    >
                      📝
                    </div>
                    <p className={css({ fontStyle: 'italic' })}>
                      No notes yet. Click "Edit Notes" to add observations about this student.
                    </p>
                  </div>
                )}
              </div>

              {/* View mode action buttons */}
              <div
                className={css({
                  padding: '1rem',
                  borderTop: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                })}
              >
                {/* Archive button on the left */}
                {onToggleArchive && (
                  <button
                    type="button"
                    data-action="toggle-archive"
                    onClick={onToggleArchive}
                    className={css({
                      padding: '0.625rem 1rem',
                      borderRadius: '8px',
                      backgroundColor: student.isArchived
                        ? isDark
                          ? 'green.900'
                          : 'green.100'
                        : isDark
                          ? 'gray.700'
                          : 'gray.100',
                      color: student.isArchived
                        ? isDark
                          ? 'green.300'
                          : 'green.700'
                        : isDark
                          ? 'gray.300'
                          : 'gray.600',
                      fontSize: '0.875rem',
                      fontWeight: 'medium',
                      border: '1px solid',
                      borderColor: student.isArchived
                        ? isDark
                          ? 'green.700'
                          : 'green.300'
                        : isDark
                          ? 'gray.600'
                          : 'gray.300',
                      cursor: 'pointer',
                      _hover: {
                        backgroundColor: student.isArchived
                          ? isDark
                            ? 'green.800'
                            : 'green.200'
                          : isDark
                            ? 'gray.600'
                            : 'gray.200',
                      },
                    })}
                  >
                    {student.isArchived ? '📦 Unarchive' : '📦 Archive'}
                  </button>
                )}

                {/* Edit notes button on the right */}
                <button
                  type="button"
                  data-action="edit-notes"
                  onClick={handleStartEditing}
                  className={css({
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'blue.900' : 'blue.500',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: 'medium',
                    border: 'none',
                    cursor: 'pointer',
                    marginLeft: 'auto',
                    _hover: {
                      backgroundColor: isDark ? 'blue.800' : 'blue.600',
                    },
                  })}
                >
                  {student.notes ? 'Edit Notes' : 'Add Notes'}
                </button>
              </div>
            </>
          )}
        </div>
      </animated.div>
    </>
  )
}
