'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import { useSessionObserver } from '@/hooks/useSessionObserver'
import { css } from '../../../styled-system/css'
import { AbacusDock } from '../AbacusDock'
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
 * - Dock for teacher's MyAbacus (syncs to student when manipulated)
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
  const { requestDock, dock, setDockedValue, isDockedByUser } = useMyAbacus()

  // Subscribe to the session's socket channel
  const { state, isConnected, isObserving, error, sendControl, sendPause, sendResume } =
    useSessionObserver(
      isOpen ? session.sessionId : undefined,
      isOpen ? observerId : undefined,
      isOpen
    )

  // Track if we've paused the session (teacher controls resume)
  const [hasPausedSession, setHasPausedSession] = useState(false)

  // Ref for measuring problem container height (same pattern as ActiveSession)
  const problemRef = useRef<HTMLDivElement>(null)
  const [problemHeight, setProblemHeight] = useState<number | null>(null)

  // Measure problem container height with ResizeObserver (same as ActiveSession)
  useLayoutEffect(() => {
    const element = problemRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
        setProblemHeight(height)
      }
    })

    observer.observe(element)
    setProblemHeight(element.offsetHeight)

    return () => observer.disconnect()
  }, [state?.currentProblem?.answer])

  // Handle teacher manipulating their docked abacus - sync to student
  const handleTeacherAbacusChange = useCallback(
    (newValue: number) => {
      // Send control to sync student's abacus to this value
      sendControl({ type: 'set-abacus-value', value: newValue })
    },
    [sendControl]
  )

  // Dock both teacher's and student's abaci
  const handleDockBothAbaci = useCallback(() => {
    // Dock teacher's MyAbacus into the modal's AbacusDock (only if not already docked)
    if (dock && !isDockedByUser) {
      requestDock()
    }
    // Send control to dock student's abacus
    sendControl({ type: 'show-abacus' })
  }, [dock, isDockedByUser, requestDock, sendControl])

  // Pause the student's session
  const handlePauseSession = useCallback(() => {
    sendPause('Your teacher needs your attention.')
    setHasPausedSession(true)
  }, [sendPause])

  // Resume the student's session
  const handleResumeSession = useCallback(() => {
    sendResume()
    setHasPausedSession(false)
  }, [sendResume])

  // Two-way sync: When student's abacus changes, sync teacher's docked abacus
  useEffect(() => {
    if (!isDockedByUser || !state?.studentAnswer) return

    const parsedValue = parseInt(state.studentAnswer, 10)
    if (!Number.isNaN(parsedValue) && parsedValue >= 0) {
      setDockedValue(parsedValue)
    }
  }, [state?.studentAnswer, isDockedByUser, setDockedValue])

  // Calculate columns for the abacus based on the answer (same as ActiveSession)
  const abacusColumns = state?.currentProblem
    ? String(Math.abs(state.currentProblem.answer)).length
    : 3

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
          zIndex: Z_INDEX.TOOLTIP, // 15000 - above parent modals when nested
        })}
        onClick={onClose}
      />

      {/* Modal - wider to fit abacus side by side */}
      <div
        data-component="session-observer-modal"
        className={css({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '800px',
          maxHeight: '85vh',
          backgroundColor: isDark ? 'gray.900' : 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: Z_INDEX.TOOLTIP + 1, // Above the overlay
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

          {/* Problem display with abacus dock - matches ActiveSession layout */}
          {state && (
            <div
              data-element="observer-content"
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              })}
            >
              {/* Purpose badge with tooltip - matches student's view */}
              <PurposeBadge purpose={state.purpose} complexity={state.complexity} />

              {/* Problem container with absolutely positioned AbacusDock */}
              <div
                data-element="problem-with-dock"
                className={css({
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-start',
                })}
              >
                {/* Problem - ref for height measurement */}
                <div ref={problemRef}>
                  <VerticalProblem
                    terms={state.currentProblem.terms}
                    userAnswer={state.studentAnswer}
                    isFocused={state.phase === 'problem'}
                    isCompleted={state.phase === 'feedback'}
                    correctAnswer={state.currentProblem.answer}
                    size="large"
                  />
                </div>

                {/* AbacusDock - positioned exactly like ActiveSession */}
                {state.phase === 'problem' && (problemHeight ?? 0) > 0 && (
                  <AbacusDock
                    id="teacher-observer-dock"
                    columns={abacusColumns}
                    interactive={true}
                    showNumbers={false}
                    animated={true}
                    onValueChange={handleTeacherAbacusChange}
                    className={css({
                      position: 'absolute',
                      left: '100%',
                      top: 0,
                      width: '100%',
                      marginLeft: '1.5rem',
                    })}
                    style={{ height: problemHeight }}
                  />
                )}
              </div>

              {/* Feedback message */}
              {state.studentAnswer && state.phase === 'feedback' && (
                <PracticeFeedback
                  isCorrect={state.isCorrect ?? false}
                  correctAnswer={state.currentProblem.answer}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer with connection status and controls */}
        <div
          className={css({
            padding: '12px 20px',
            borderTop: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
          })}
        >
          {/* Connection status */}
          <div className={css({ display: 'flex', alignItems: 'center', gap: '6px' })}>
            <span
              className={css({
                width: '8px',
                height: '8px',
                borderRadius: '50%',
              })}
              style={{
                backgroundColor: isObserving ? '#10b981' : isConnected ? '#eab308' : '#6b7280',
              }}
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

          {/* Teacher controls: pause/resume and dock abaci */}
          <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
            {/* Pause/Resume button */}
            {isObserving && (
              <button
                type="button"
                data-action={hasPausedSession ? 'resume-session' : 'pause-session'}
                onClick={hasPausedSession ? handleResumeSession : handlePauseSession}
                className={css({
                  padding: '8px 12px',
                  backgroundColor: hasPausedSession
                    ? isDark
                      ? 'green.700'
                      : 'green.100'
                    : isDark
                      ? 'amber.700'
                      : 'amber.100',
                  color: hasPausedSession
                    ? isDark
                      ? 'green.200'
                      : 'green.700'
                    : isDark
                      ? 'amber.200'
                      : 'amber.700',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  _hover: {
                    backgroundColor: hasPausedSession
                      ? isDark
                        ? 'green.600'
                        : 'green.200'
                      : isDark
                        ? 'amber.600'
                        : 'amber.200',
                  },
                })}
              >
                {hasPausedSession ? '▶️ Resume' : '⏸️ Pause'}
              </button>
            )}

            {/* Dock both abaci button */}
            {state && state.phase === 'problem' && (
              <button
                type="button"
                data-action="dock-both-abaci"
                onClick={handleDockBothAbaci}
                disabled={!isObserving}
                className={css({
                  padding: '8px 12px',
                  backgroundColor: isDark ? 'blue.700' : 'blue.100',
                  color: isDark ? 'blue.200' : 'blue.700',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  _hover: { backgroundColor: isDark ? 'blue.600' : 'blue.200' },
                  _disabled: { opacity: 0.4, cursor: 'not-allowed' },
                })}
              >
                🧮 Dock Abaci
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
