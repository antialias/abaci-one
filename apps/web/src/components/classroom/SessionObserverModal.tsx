'use client'

import { Z_INDEX } from '@/constants/zIndex'
import { useTheme } from '@/contexts/ThemeContext'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import { useSessionObserver } from '@/hooks/useSessionObserver'
import { css } from '../../../styled-system/css'
import { PracticeFeedback } from '../practice/PracticeFeedback'
import { PurposeBadge } from '../practice/PurposeBadge'
import { VerticalProblem } from '../practice/VerticalProblem'

interface SessionObserverModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Close the modal */
  onClose: () => void
  /** Session info from the active sessions list */
  session: ActiveSessionInfo
  /** Student info for display */
  student: {
    name: string
    emoji: string
    color: string
  }
  /** Observer ID (e.g., teacher's user ID) */
  observerId: string
}

/**
 * Modal for teachers to observe a student's practice session in real-time
 *
 * Shows:
 * - Current problem the student is working on
 * - Student's answer as they type/submit
 * - Feedback (correct/incorrect) when shown
 * - Progress indicator
 */
export function SessionObserverModal({
  isOpen,
  onClose,
  session,
  student,
  observerId,
}: SessionObserverModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Subscribe to the session's socket channel
  const { state, isConnected, isObserving, error } = useSessionObserver(
    isOpen ? session.sessionId : undefined,
    isOpen ? observerId : undefined,
    isOpen
  )

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        data-element="modal-backdrop"
        className={css({
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: Z_INDEX.MODAL_BACKDROP,
        })}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        data-component="session-observer-modal"
        className={css({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '500px',
          maxHeight: '85vh',
          backgroundColor: isDark ? 'gray.900' : 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: Z_INDEX.MODAL,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        })}
      >
        {/* Header */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <div className={css({ display: 'flex', alignItems: 'center', gap: '12px' })}>
            <span
              className={css({
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
              })}
              style={{ backgroundColor: student.color }}
            >
              {student.emoji}
            </span>
            <div>
              <h2
                className={css({
                  fontWeight: 'bold',
                  color: isDark ? 'white' : 'gray.800',
                  fontSize: '1rem',
                })}
              >
                Observing {student.name}
              </h2>
              <p
                className={css({
                  fontSize: '0.8125rem',
                  color: isDark ? 'gray.400' : 'gray.500',
                })}
              >
                Problem {session.completedProblems + 1} of {session.totalProblems}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-action="close-observer"
            className={css({
              padding: '8px 16px',
              backgroundColor: isDark ? 'gray.700' : 'gray.200',
              color: isDark ? 'gray.200' : 'gray.700',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 'medium',
              cursor: 'pointer',
              _hover: { backgroundColor: isDark ? 'gray.600' : 'gray.300' },
            })}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div
          className={css({
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          })}
        >
          {/* Connection status */}
          {!isConnected && !error && (
            <div
              className={css({
                textAlign: 'center',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              <p className={css({ fontSize: '1rem', marginBottom: '8px' })}>Connecting...</p>
            </div>
          )}

          {error && (
            <div
              className={css({
                textAlign: 'center',
                color: isDark ? 'red.400' : 'red.600',
                padding: '16px',
                backgroundColor: isDark ? 'red.900/30' : 'red.50',
                borderRadius: '8px',
              })}
            >
              <p>{error}</p>
            </div>
          )}

          {isObserving && !state && (
            <div
              className={css({
                textAlign: 'center',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              <p className={css({ fontSize: '1rem', marginBottom: '8px' })}>
                Waiting for student activity...
              </p>
              <p className={css({ fontSize: '0.875rem' })}>
                You&apos;ll see their problem when they start working
              </p>
            </div>
          )}

          {/* Problem display */}
          {state && (
            <>
              {/* Purpose badge with tooltip - matches student's view */}
              <PurposeBadge purpose={state.purpose} />

              {/* Problem */}
              <VerticalProblem
                terms={state.currentProblem.terms}
                userAnswer={state.studentAnswer}
                isFocused={state.phase === 'problem'}
                isCompleted={state.phase === 'feedback'}
                correctAnswer={state.currentProblem.answer}
                size="large"
              />

              {/* Feedback message */}
              {state.studentAnswer && state.phase === 'feedback' && (
                <PracticeFeedback
                  isCorrect={state.isCorrect ?? false}
                  correctAnswer={state.currentProblem.answer}
                />
              )}
            </>
          )}
        </div>

        {/* Footer with connection status */}
        <div
          className={css({
            padding: '12px 20px',
            borderTop: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          })}
        >
          <span
            className={css({
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isObserving ? 'green.500' : isConnected ? 'yellow.500' : 'gray.500',
            })}
          />
          <span
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            {isObserving ? 'Live' : isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </>
  )
}
