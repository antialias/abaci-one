'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { EmojiPicker } from '@/components/EmojiPicker'
import { LinkChildForm } from '@/components/family'
import { PLAYER_EMOJIS } from '@/constants/playerEmojis'
import { useDirectEnrollStudent } from '@/hooks/useClassroom'
import { ApiError, useCreatePlayer } from '@/hooks/useUserPlayers'
import { css } from '../../../styled-system/css'

// Available colors for student avatars
const AVAILABLE_COLORS = [
  '#FFB3BA', // light pink
  '#FFDFBA', // light orange
  '#FFFFBA', // light yellow
  '#BAFFC9', // light green
  '#BAE1FF', // light blue
  '#DCC6E0', // light purple
  '#F0E68C', // khaki
  '#98D8C8', // mint
  '#F7DC6F', // gold
  '#BB8FCE', // orchid
  '#85C1E9', // sky blue
  '#F8B500', // amber
]

interface AddStudentModalProps {
  isOpen: boolean
  onClose: () => void
  isDark: boolean
  /** If provided, student will be auto-enrolled in this classroom */
  classroomId?: string
  /** Name of the classroom for display */
  classroomName?: string
}

/**
 * Modal for adding a new student
 * Uses React Query mutation for proper cache management
 */
export function AddStudentModal({
  isOpen,
  onClose,
  isDark,
  classroomId,
  classroomName,
}: AddStudentModalProps) {
  // Form state
  const [formName, setFormName] = useState('')
  const [formEmoji, setFormEmoji] = useState(PLAYER_EMOJIS[0])
  const [formColor, setFormColor] = useState(AVAILABLE_COLORS[0])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showLinkForm, setShowLinkForm] = useState(false)

  // React Query mutations
  const createPlayer = useCreatePlayer()
  const directEnroll = useDirectEnrollStudent()

  // Reset form and pick random emoji/color when opened
  useEffect(() => {
    if (isOpen) {
      setFormName('')
      setFormEmoji(PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)])
      setFormColor(AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)])
      setShowEmojiPicker(false)
      setShowLinkForm(false)
    }
  }, [isOpen])

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (!formName.trim()) return

    createPlayer.mutate(
      {
        name: formName.trim(),
        emoji: formEmoji,
        color: formColor,
      },
      {
        onSuccess: (player) => {
          // If classroomId is provided, auto-enroll the new student
          if (classroomId && player) {
            directEnroll.mutate(
              { classroomId, playerId: player.id },
              {
                onSettled: () => {
                  onClose()
                },
              }
            )
          } else {
            onClose()
          }
        },
      }
    )
  }, [formName, formEmoji, formColor, createPlayer, classroomId, directEnroll, onClose])

  const isPending = createPlayer.isPending || directEnroll.isPending

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEmojiPicker) {
          setShowEmojiPicker(false)
        } else {
          onClose()
        }
      } else if (e.key === 'Enter' && formName.trim() && !isPending && !showEmojiPicker) {
        handleSubmit()
      }
    },
    [formName, isPending, handleSubmit, onClose, showEmojiPicker]
  )

  if (!isOpen) return null

  // Show the shared EmojiPicker as a full-screen overlay when picking emoji
  if (showEmojiPicker) {
    return (
      <EmojiPicker
        currentEmoji={formEmoji}
        onEmojiSelect={(emoji) => {
          setFormEmoji(emoji)
          setShowEmojiPicker(false)
        }}
        onClose={() => setShowEmojiPicker(false)}
        title="Choose Avatar"
        accentColor="green"
        isDark={isDark}
      />
    )
  }

  return (
    <div
      data-component="add-student-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-student-title"
      onKeyDown={handleKeyDown}
      className={css({
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        padding: '1rem',
      })}
    >
      {/* Backdrop click to close */}
      <button
        type="button"
        data-element="modal-backdrop"
        onClick={onClose}
        className={css({
          position: 'absolute',
          inset: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        })}
        aria-label="Close modal"
      />

      {/* Modal content */}
      <div
        data-element="modal-content"
        className={css({
          position: 'relative',
          width: '100%',
          maxWidth: '400px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '16px',
          boxShadow: 'lg',
        })}
      >
        {/* Header */}
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: classroomId ? '0.75rem' : '1.5rem',
          })}
        >
          <h2
            id="add-student-title"
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
            })}
          >
            {classroomId ? 'Add Student to Classroom' : 'Add New Student'}
          </h2>
          <button
            type="button"
            data-action="close-modal"
            onClick={onClose}
            className={css({
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              color: isDark ? 'gray.400' : 'gray.500',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              _hover: {
                backgroundColor: isDark ? 'gray.700' : 'gray.100',
              },
            })}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Classroom notice - shown when adding to a classroom */}
        {classroomId && (
          <div
            data-element="classroom-enrollment-notice"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              marginBottom: '1rem',
              backgroundColor: isDark ? 'blue.900/50' : 'blue.50',
              border: '1px solid',
              borderColor: isDark ? 'blue.700' : 'blue.200',
              borderRadius: '8px',
            })}
          >
            <span className={css({ fontSize: '16px', flexShrink: 0 })}>📚</span>
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'blue.200' : 'blue.700',
                lineHeight: '1.4',
              })}
            >
              This student will be automatically enrolled in{' '}
              <strong>{classroomName || 'your classroom'}</strong>.
            </p>
          </div>
        )}

        {/* Avatar Preview - clickable to open full picker */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '1.5rem',
          })}
        >
          <button
            type="button"
            onClick={() => setShowEmojiPicker(true)}
            data-element="avatar-preview"
            className={css({
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              boxShadow: 'md',
              border: '3px solid',
              borderColor: isDark ? 'gray.600' : 'gray.300',
              cursor: 'pointer',
              transition: 'all 0.15s',
              _hover: {
                borderColor: 'blue.500',
                transform: 'scale(1.05)',
              },
            })}
            style={{ backgroundColor: formColor }}
            title="Click to choose avatar"
          >
            {formEmoji}
          </button>
          <span
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.500' : 'gray.400',
            })}
          >
            Tap to change avatar
          </span>
        </div>

        {/* Name input */}
        <div className={css({ marginBottom: '1.25rem' })}>
          <label
            htmlFor="new-student-name"
            className={css({
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.300' : 'gray.700',
              marginBottom: '0.5rem',
            })}
          >
            Name
          </label>
          <input
            id="new-student-name"
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Enter student name"
            // biome-ignore lint/a11y/noAutofocus: Modal just opened, focusing input is expected UX
            autoFocus
            className={css({
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: isDark ? 'gray.600' : 'gray.300',
              backgroundColor: isDark ? 'gray.700' : 'white',
              color: isDark ? 'gray.100' : 'gray.800',
              _focus: {
                outline: 'none',
                borderColor: 'blue.500',
                boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.3)',
              },
            })}
          />
        </div>

        {/* Color selector */}
        <div className={css({ marginBottom: '1.5rem' })}>
          <label
            className={css({
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.300' : 'gray.700',
              marginBottom: '0.5rem',
            })}
          >
            Color
          </label>
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
            })}
          >
            {AVAILABLE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormColor(color)}
                className={css({
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: '3px solid',
                  borderColor: formColor === color ? 'blue.500' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  _hover: {
                    transform: 'scale(1.1)',
                  },
                })}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Player limit error */}
        {createPlayer.error instanceof ApiError &&
          createPlayer.error.code === 'PRACTICE_STUDENT_LIMIT_REACHED' && (
            <div
              data-element="player-limit-error"
              className={css({
                padding: '0.75rem',
                marginBottom: '1rem',
                borderRadius: '8px',
                textAlign: 'center',
                backgroundColor: isDark ? 'rgba(251, 191, 36, 0.12)' : 'rgba(251, 191, 36, 0.08)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(251, 191, 36, 0.25)' : 'rgba(251, 191, 36, 0.15)',
              })}
            >
              <p
                className={css({
                  fontSize: '0.875rem',
                  color: isDark ? '#fcd34d' : '#b45309',
                  marginBottom: '0.5rem',
                })}
              >
                Student limit reached
              </p>
              <p
                className={css({
                  fontSize: '0.75rem',
                  color: isDark ? '#d4d4d4' : '#525252',
                  marginBottom: '0.5rem',
                })}
              >
                Upgrade to Family for unlimited students.
              </p>
              <Link
                href="/pricing"
                data-action="upgrade-for-students"
                className={css({
                  display: 'inline-block',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                  color: 'white',
                  backgroundColor: isDark ? '#7c3aed' : '#8b5cf6',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  _hover: {
                    backgroundColor: isDark ? '#6d28d9' : '#7c3aed',
                  },
                })}
              >
                View Plans
              </Link>
            </div>
          )}

        {/* Form actions */}
        <div
          className={css({
            display: 'flex',
            gap: '0.75rem',
          })}
        >
          <button
            type="button"
            data-action="cancel"
            onClick={onClose}
            disabled={isPending}
            className={css({
              flex: 1,
              padding: '0.75rem',
              fontSize: '1rem',
              color: isDark ? 'gray.300' : 'gray.600',
              backgroundColor: isDark ? 'gray.700' : 'gray.200',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              _hover: {
                backgroundColor: isDark ? 'gray.600' : 'gray.300',
              },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            })}
          >
            Cancel
          </button>
          <button
            type="button"
            data-action="add-student"
            onClick={handleSubmit}
            disabled={isPending || !formName.trim()}
            className={css({
              flex: 2,
              padding: '0.75rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: isPending ? 'gray.400' : 'green.500',
              borderRadius: '8px',
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              _hover: {
                backgroundColor: isPending ? 'gray.400' : 'green.600',
              },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            })}
          >
            {isPending
              ? classroomId
                ? 'Adding & Enrolling...'
                : 'Adding...'
              : classroomId
                ? 'Add & Enroll'
                : 'Add Student'}
          </button>
        </div>

        {/* Link existing child option - only show in parent mode (not classroom mode) */}
        {!classroomId && (
          <div
            className={css({
              marginTop: '1.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              textAlign: 'center',
            })}
          >
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.500',
                marginBottom: '0.5rem',
              })}
            >
              Have a family code from another parent?
            </p>
            <button
              type="button"
              onClick={() => setShowLinkForm(true)}
              data-action="show-link-form"
              className={css({
                padding: '8px 16px',
                fontSize: '0.875rem',
                color: isDark ? 'blue.400' : 'blue.600',
                backgroundColor: 'transparent',
                border: '1px solid',
                borderColor: isDark ? 'blue.700' : 'blue.300',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                _hover: {
                  backgroundColor: isDark ? 'blue.900/50' : 'blue.50',
                  borderColor: isDark ? 'blue.600' : 'blue.400',
                },
              })}
            >
              Link Existing Child
            </button>
          </div>
        )}
      </div>

      {/* Link Child Form Modal - only used in parent mode */}
      {!classroomId && (
        <LinkChildForm
          isOpen={showLinkForm}
          onClose={() => setShowLinkForm(false)}
          onSuccess={onClose}
        />
      )}
    </div>
  )
}
