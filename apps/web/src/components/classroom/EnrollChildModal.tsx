'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { useTheme } from '@/contexts/ThemeContext'
import {
  useClassroomByCode,
  useCreateEnrollmentRequest,
  useEnrolledClassrooms,
} from '@/hooks/useClassroom'
import { css } from '../../../styled-system/css'

interface EnrollChildModalProps {
  isOpen: boolean
  onClose: () => void
  playerId: string
  playerName: string
}

/**
 * Modal for enrolling a specific child in a classroom
 *
 * Flow:
 * 1. Enter classroom code
 * 2. See classroom info (name, teacher)
 * 3. Submit enrollment request
 * 4. Success message
 *
 * Unlike EnrollChildFlow, this modal already knows which child
 * to enroll (playerId/playerName passed as props).
 */
export function EnrollChildModal({ isOpen, onClose, playerId, playerName }: EnrollChildModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Form state
  const [code, setCode] = useState('')

  // Look up classroom by code
  const { data: classroom, isLoading: lookingUp } = useClassroomByCode(code)

  // Enrollment mutation
  const createRequest = useCreateEnrollmentRequest()

  // Check enrolled classrooms to detect if teacher already approved
  const { data: enrolledClassrooms } = useEnrolledClassrooms(playerId)

  // Check if the classroom we just requested enrollment for is now in the enrolled list
  // This means the teacher approved it while we were waiting
  const isNowEnrolled =
    createRequest.isSuccess && classroom && enrolledClassrooms?.some((c) => c.id === classroom.id)

  // Auto-close countdown when enrollment is complete
  const AUTO_CLOSE_SECONDS = 3
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownStartedRef = useRef(false)
  const [isClosing, setIsClosing] = useState(false)

  // Reset state when modal closes
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Start closing animation
        setIsClosing(true)
        // After animation completes, actually close
        setTimeout(() => {
          setCode('')
          setCountdown(null)
          countdownStartedRef.current = false
          setIsClosing(false)
          createRequest.reset()
          onClose()
        }, 200) // Match CSS transition duration
      }
    },
    [onClose, createRequest]
  )

  // Start countdown when enrollment is confirmed
  useEffect(() => {
    if (isNowEnrolled && !countdownStartedRef.current) {
      countdownStartedRef.current = true
      setCountdown(AUTO_CLOSE_SECONDS)
    }
  }, [isNowEnrolled])

  // Tick down the countdown
  useEffect(() => {
    if (countdown === null || countdown <= 0) return

    const timer = setTimeout(() => {
      setCountdown((c) => (c !== null ? c - 1 : null))
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown])

  // Auto-close when countdown reaches 0
  useEffect(() => {
    if (countdown === 0) {
      handleOpenChange(false)
    }
  }, [countdown, handleOpenChange])

  const handleSubmit = useCallback(async () => {
    if (!classroom) return

    try {
      await createRequest.mutateAsync({
        classroomId: classroom.id,
        playerId,
      })
    } catch {
      // Error handled by mutation state
    }
  }, [classroom, playerId, createRequest])

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: Z_INDEX.TOOLTIP, // 15000 - above modals (10001) but below toasts (20000)
            transition: 'opacity 0.2s ease-out',
            opacity: isClosing ? 0 : 1,
          })}
        />
        <Dialog.Content
          data-component="enroll-child-modal"
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: isClosing
              ? 'translate(-50%, -50%) scale(0.95)'
              : 'translate(-50%, -50%) scale(1)',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '16px',
            padding: '24px',
            width: 'calc(100% - 2rem)',
            maxWidth: '420px',
            boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.4)',
            zIndex: Z_INDEX.TOOLTIP, // Same as overlay - siblings in same stacking context
            outline: 'none',
            transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
            opacity: isClosing ? 0 : 1,
          })}
        >
          <Dialog.Title
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'white' : 'gray.800',
              marginBottom: '8px',
            })}
          >
            Enroll {playerName} in a Classroom
          </Dialog.Title>
          <Dialog.Description
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '20px',
            })}
          >
            Enter the classroom code from the teacher.
          </Dialog.Description>

          {/* Success state */}
          {createRequest.isSuccess ? (
            <div data-section="enrollment-success">
              <div
                className={css({
                  padding: '20px',
                  backgroundColor: isDark ? 'green.900/20' : 'green.50',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: isDark ? 'green.700' : 'green.200',
                  marginBottom: '20px',
                  textAlign: 'center',
                })}
              >
                {isNowEnrolled ? (
                  <>
                    <p
                      className={css({
                        fontWeight: 'bold',
                        fontSize: '1.125rem',
                        color: isDark ? 'green.300' : 'green.700',
                        marginBottom: '4px',
                      })}
                    >
                      Enrolled!
                    </p>
                    <p
                      className={css({
                        fontSize: '0.875rem',
                        color: isDark ? 'green.400' : 'green.600',
                      })}
                    >
                      {playerName} is now enrolled in {classroom?.name}.
                    </p>
                  </>
                ) : (
                  <>
                    <p
                      className={css({
                        fontWeight: 'bold',
                        color: isDark ? 'green.300' : 'green.700',
                        marginBottom: '4px',
                      })}
                    >
                      Enrollment Request Sent!
                    </p>
                    <p
                      className={css({
                        fontSize: '0.875rem',
                        color: isDark ? 'green.400' : 'green.600',
                      })}
                    >
                      The teacher will review and approve the enrollment.
                    </p>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                data-action="done"
                className={css({
                  width: '100%',
                  padding: '12px',
                  backgroundColor: isDark ? 'green.900' : 'green.100',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  _hover: {
                    '& > span:first-child': {
                      backgroundColor: isDark ? 'green.600' : 'green.600',
                    },
                  },
                })}
              >
                {/* Progress bar fill */}
                <span
                  className={css({
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    backgroundColor: isDark ? 'green.700' : 'green.500',
                    transition: 'width 1s linear',
                    borderRadius: '8px',
                  })}
                  style={{
                    width:
                      countdown !== null ? `${(countdown / AUTO_CLOSE_SECONDS) * 100}%` : '100%',
                  }}
                />
                {/* Button text */}
                <span
                  className={css({
                    position: 'relative',
                    zIndex: 1,
                  })}
                >
                  Done
                </span>
              </button>
            </div>
          ) : (
            <>
              {/* Code input */}
              <div className={css({ marginBottom: '20px' })}>
                <label
                  htmlFor="classroom-code-input"
                  className={css({
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 'medium',
                    color: isDark ? 'gray.300' : 'gray.700',
                    marginBottom: '6px',
                  })}
                >
                  Classroom Code
                </label>
                <input
                  id="classroom-code-input"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g., ABC123"
                  maxLength={6}
                  autoFocus
                  data-input="classroom-code"
                  className={css({
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: isDark ? 'gray.700' : 'gray.50',
                    border: '2px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.200',
                    borderRadius: '8px',
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    letterSpacing: '0.15em',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    color: isDark ? 'white' : 'gray.800',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                    _focus: {
                      borderColor: isDark ? 'blue.500' : 'blue.400',
                    },
                    _placeholder: {
                      color: isDark ? 'gray.500' : 'gray.400',
                      fontWeight: 'normal',
                      letterSpacing: 'normal',
                    },
                  })}
                />

                {/* Lookup status */}
                {code.length >= 4 && (
                  <div className={css({ marginTop: '12px' })}>
                    {lookingUp && (
                      <p
                        className={css({
                          fontSize: '0.875rem',
                          color: isDark ? 'gray.400' : 'gray.500',
                        })}
                      >
                        Looking up classroom...
                      </p>
                    )}

                    {!lookingUp && !classroom && code.length >= 6 && (
                      <p className={css({ fontSize: '0.875rem', color: 'red.500' })}>
                        No classroom found with this code
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Classroom found */}
              {classroom && (
                <div
                  data-section="classroom-found"
                  className={css({
                    padding: '16px',
                    backgroundColor: isDark ? 'green.900/20' : 'green.50',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: isDark ? 'green.700' : 'green.200',
                    marginBottom: '20px',
                  })}
                >
                  <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                    <span className={css({ fontSize: '1.25rem' })}>🏫</span>
                    <div>
                      <p
                        className={css({
                          fontWeight: 'bold',
                          color: isDark ? 'green.300' : 'green.700',
                        })}
                      >
                        {classroom.name}
                      </p>
                      <p
                        className={css({
                          fontSize: '0.8125rem',
                          color: isDark ? 'green.400' : 'green.600',
                        })}
                      >
                        Teacher:{' '}
                        {(classroom as { teacher?: { name?: string } }).teacher?.name ?? 'Teacher'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error display */}
              {createRequest.error && (
                <p
                  className={css({
                    fontSize: '0.8125rem',
                    color: 'red.500',
                    marginBottom: '12px',
                  })}
                >
                  {createRequest.error.message}
                </p>
              )}

              {/* Actions */}
              <div className={css({ display: 'flex', gap: '12px' })}>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  disabled={createRequest.isPending}
                  data-action="cancel-enroll"
                  className={css({
                    flex: 1,
                    padding: '12px',
                    backgroundColor: isDark ? 'gray.700' : 'gray.200',
                    color: isDark ? 'gray.300' : 'gray.700',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 'medium',
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
                  onClick={handleSubmit}
                  disabled={!classroom || createRequest.isPending}
                  data-action="submit-enrollment"
                  className={css({
                    flex: 2,
                    padding: '12px',
                    backgroundColor: classroom
                      ? isDark
                        ? 'green.700'
                        : 'green.500'
                      : isDark
                        ? 'gray.700'
                        : 'gray.300',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: classroom ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                    _hover: {
                      backgroundColor: classroom ? (isDark ? 'green.600' : 'green.600') : undefined,
                    },
                    _disabled: {
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  {createRequest.isPending ? 'Enrolling...' : `Enroll ${playerName}`}
                </button>
              </div>
            </>
          )}

          {/* Close button */}
          <Dialog.Close asChild>
            <button
              type="button"
              data-action="close-enroll-modal"
              className={css({
                position: 'absolute',
                top: '12px',
                right: '12px',
                padding: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isDark ? 'gray.500' : 'gray.400',
                fontSize: '20px',
                lineHeight: 1,
                _hover: {
                  color: isDark ? 'gray.300' : 'gray.600',
                },
              })}
            >
              ×
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
