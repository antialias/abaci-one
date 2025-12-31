'use client'

import { useCallback, useState } from 'react'
import { PRACTICE_TYPES, type PracticeTypeId } from '@/constants/practiceTypes'
import { css } from '../../../styled-system/css'
import { PhotoUploadZone } from './PhotoUploadZone'

interface OfflineSessionModalProps {
  /** Player ID to create session for */
  playerId: string
  /** Whether modal is open */
  isOpen: boolean
  /** Close modal callback */
  onClose: () => void
  /** Callback when session is successfully created */
  onComplete?: (sessionId: string) => void
}

/**
 * Modal for logging offline practice sessions with photos.
 *
 * Allows selecting:
 * - Date of practice (defaults to today)
 * - Practice types performed (abacus, visualize, linear)
 * - Photos of student work (multiple)
 */
export function OfflineSessionModal({
  playerId,
  isOpen,
  onClose,
  onComplete,
}: OfflineSessionModalProps) {
  // Form state
  const [date, setDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0] // YYYY-MM-DD format
  })
  const [selectedTypes, setSelectedTypes] = useState<Set<PracticeTypeId>>(new Set(['abacus']))
  const [photos, setPhotos] = useState<File[]>([])

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleType = useCallback((type: PracticeTypeId) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (selectedTypes.size === 0) {
      setError('Please select at least one practice type')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('date', date)
      formData.append('practiceTypes', JSON.stringify(Array.from(selectedTypes)))

      for (const photo of photos) {
        formData.append('photos', photo)
      }

      const response = await fetch(`/api/curriculum/${playerId}/offline-sessions`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create session')
      }

      const result = await response.json()
      onComplete?.(result.sessionId)
      onClose()

      // Reset form
      setPhotos([])
      setSelectedTypes(new Set(['abacus']))
      setDate(new Date().toISOString().split('T')[0])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setIsSubmitting(false)
    }
  }, [playerId, date, selectedTypes, photos, onComplete, onClose])

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose()
    }
  }, [isSubmitting, onClose])

  if (!isOpen) return null

  return (
    <div
      data-component="offline-session-modal"
      className={css({
        position: 'fixed',
        inset: 0,
        bg: 'rgba(0, 0, 0, 0.5)',
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
          maxW: '500px',
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
            Log Offline Practice
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className={css({
              fontSize: '2xl',
              color: 'gray.400',
              cursor: 'pointer',
              _hover: { color: 'gray.600' },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className={css({ p: 5 })}>
          {/* Date picker */}
          <div className={css({ mb: 5 })}>
            <label
              className={css({
                display: 'block',
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'gray.700',
                mb: 2,
              })}
            >
              When did the practice happen?
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              disabled={isSubmitting}
              className={css({
                w: '100%',
                px: 3,
                py: 2,
                border: '1px solid',
                borderColor: 'gray.300',
                borderRadius: 'md',
                fontSize: 'md',
                _focus: {
                  outline: 'none',
                  borderColor: 'blue.500',
                  boxShadow: '0 0 0 1px var(--colors-blue-500)',
                },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            />
          </div>

          {/* Practice types */}
          <div className={css({ mb: 5 })}>
            <label
              className={css({
                display: 'block',
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'gray.700',
                mb: 2,
              })}
            >
              What types of practice were done?
            </label>
            <div className={css({ display: 'flex', flexDirection: 'column', gap: 2 })}>
              {PRACTICE_TYPES.map((type) => {
                const isSelected = selectedTypes.has(type.id)
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleType(type.id)}
                    disabled={isSubmitting}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      p: 3,
                      border: '2px solid',
                      borderColor: isSelected ? 'blue.500' : 'gray.200',
                      borderRadius: 'lg',
                      bg: isSelected ? 'blue.50' : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      _hover: {
                        borderColor: isSelected ? 'blue.600' : 'gray.300',
                      },
                      _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                    })}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={css({
                        width: '20px',
                        height: '20px',
                        borderRadius: 'sm',
                        border: '2px solid',
                        borderColor: isSelected ? 'blue.500' : 'gray.300',
                        bg: isSelected ? 'blue.500' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: 'xs',
                        fontWeight: 'bold',
                        flexShrink: 0,
                      })}
                    >
                      {isSelected && '✓'}
                    </div>

                    {/* Icon */}
                    <span className={css({ fontSize: 'xl', flexShrink: 0 })}>{type.icon}</span>

                    {/* Label */}
                    <div>
                      <div
                        className={css({
                          fontWeight: 'medium',
                          color: 'gray.800',
                        })}
                      >
                        {type.label}
                      </div>
                      <div
                        className={css({
                          fontSize: 'sm',
                          color: 'gray.500',
                        })}
                      >
                        {type.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Photo upload */}
          <div className={css({ mb: 5 })}>
            <label
              className={css({
                display: 'block',
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'gray.700',
                mb: 2,
              })}
            >
              Photos of student work{' '}
              <span className={css({ color: 'gray.400', fontWeight: 'normal' })}>(optional)</span>
            </label>
            <PhotoUploadZone photos={photos} onPhotosChange={setPhotos} disabled={isSubmitting} />
          </div>

          {/* Error message */}
          {error && (
            <div
              className={css({
                mb: 4,
                p: 3,
                bg: 'red.50',
                border: '1px solid',
                borderColor: 'red.200',
                borderRadius: 'md',
                color: 'red.700',
                fontSize: 'sm',
              })}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div className={css({ display: 'flex', gap: 3 })}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className={css({
                flex: 1,
                py: 3,
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
              onClick={handleSubmit}
              disabled={isSubmitting || selectedTypes.size === 0}
              className={css({
                flex: 1,
                py: 3,
                bg: 'blue.500',
                color: 'white',
                borderRadius: 'md',
                fontWeight: 'medium',
                cursor: 'pointer',
                _hover: { bg: 'blue.600' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isSubmitting ? 'Saving...' : 'Log Practice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
