'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import { useSessionObserver } from '@/hooks/useSessionObserver'
import { css } from '../../../styled-system/css'
import { AbacusDock } from '../AbacusDock'
import { SessionShareButton } from './SessionShareButton'
import { LiveResultsPanel } from '../practice/LiveResultsPanel'
import { LiveSessionReportInline } from '../practice/LiveSessionReportModal'
import { PracticeFeedback } from '../practice/PracticeFeedback'
import { PurposeBadge } from '../practice/PurposeBadge'
import { SessionProgressIndicator } from '../practice/SessionProgressIndicator'
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
  /** Whether the observer can share this session (parents only) */
  canShare?: boolean
}

interface SessionObserverViewProps {
  session: ActiveSessionInfo
  student: SessionObserverModalProps['student']
  observerId: string
  /** Optional share token for public/guest observation (bypasses user auth) */
  shareToken?: string
  /** If true, hide all control buttons (pause/resume, dock abacus, share) */
  isViewOnly?: boolean
  /** Whether the observer can share this session (parents only) */
  canShare?: boolean
  onClose?: () => void
  onRequestFullscreen?: () => void
  renderCloseButton?: (button: ReactElement) => ReactElement
  variant?: 'modal' | 'page'
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
  canShare,
}: SessionObserverModalProps) {
  const router = useRouter()

  const handleFullscreen = useCallback(() => {
    router.push(`/practice/${session.playerId}/observe`, { scroll: false })
  }, [router, session.playerId])

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-element="observer-modal-overlay"
          className={css({
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: Z_INDEX.NESTED_MODAL_BACKDROP,
          })}
        />

        <Dialog.Content
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
            zIndex: Z_INDEX.NESTED_MODAL,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            outline: 'none',
          })}
        >
          <SessionObserverView
            session={session}
            student={student}
            observerId={observerId}
            canShare={canShare}
            onClose={onClose}
            onRequestFullscreen={handleFullscreen}
            renderCloseButton={(button) => <Dialog.Close asChild>{button}</Dialog.Close>}
            variant="modal"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function SessionObserverView({
  session,
  student,
  observerId,
  shareToken,
  isViewOnly = false,
  canShare = false,
  onClose,
  onRequestFullscreen,
  renderCloseButton,
  variant = 'modal',
}: SessionObserverViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { requestDock, dock, setDockedValue, isDockedByUser } = useMyAbacus()

  // Subscribe to the session's socket channel
  const { state, results, isConnected, isObserving, error, sendControl, sendPause, sendResume } =
    useSessionObserver(session.sessionId, observerId, session.playerId, true, shareToken)

  // Track if we've paused the session (teacher controls resume)
  const [hasPausedSession, setHasPausedSession] = useState(false)

  // Track if showing full report view (inline, not modal)
  const [showFullReport, setShowFullReport] = useState(false)

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

  const defaultCloseButton = (
    <button
      type="button"
      data-action="close-observer"
      onClick={onClose}
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
  )

  const closeButton = renderCloseButton ? renderCloseButton(defaultCloseButton) : defaultCloseButton

  return (
    <div
      data-component="session-observer-view"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: variant === 'page' ? (isDark ? 'gray.900' : 'white') : undefined,
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
          gap: '12px',
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 })}>
          <span
            className={css({
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              flexShrink: 0,
            })}
            style={{ backgroundColor: student.color }}
          >
            {student.emoji}
          </span>
          <div className={css({ minWidth: 0 })}>
            {/* Use Dialog.Title/Description only when inside a Dialog (modal variant) */}
            {variant === 'modal' ? (
              <>
                <Dialog.Title
                  className={css({
                    fontWeight: 'bold',
                    color: isDark ? 'white' : 'gray.800',
                    fontSize: '1rem',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  })}
                >
                  Observing {student.name}
                </Dialog.Title>
                <Dialog.Description
                  className={css({
                    fontSize: '0.8125rem',
                    color: isDark ? 'gray.400' : 'gray.500',
                    margin: 0,
                  })}
                >
                  Problem {state?.currentProblemNumber ?? session.completedProblems + 1} of{' '}
                  {state?.totalProblems ?? session.totalProblems}
                </Dialog.Description>
              </>
            ) : (
              <>
                <h1
                  className={css({
                    fontWeight: 'bold',
                    color: isDark ? 'white' : 'gray.800',
                    fontSize: '1rem',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  })}
                >
                  Observing {student.name}
                </h1>
                <p
                  className={css({
                    fontSize: '0.8125rem',
                    color: isDark ? 'gray.400' : 'gray.500',
                    margin: 0,
                  })}
                >
                  Problem {state?.currentProblemNumber ?? session.completedProblems + 1} of{' '}
                  {state?.totalProblems ?? session.totalProblems}
                </p>
              </>
            )}
          </div>
        </div>

        <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 })}>
          {onRequestFullscreen && (
            <button
              type="button"
              data-action="fullscreen-observer"
              onClick={onRequestFullscreen}
              className={css({
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                color: isDark ? 'white' : 'gray.700',
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                _hover: {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.15)',
                },
              })}
              title="Open full-screen observation"
            >
              ⛶
            </button>
          )}

          {closeButton}
        </div>
      </div>

      {/* Session Progress Indicator - same component shown to student */}
      {state?.sessionParts &&
        state.currentPartIndex !== undefined &&
        state.currentSlotIndex !== undefined && (
          <div
            data-element="progress-indicator"
            className={css({
              padding: '0 20px 12px',
              borderBottom: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
            })}
          >
            <SessionProgressIndicator
              parts={state.sessionParts}
              results={state.slotResults ?? []}
              currentPartIndex={state.currentPartIndex}
              currentSlotIndex={state.currentSlotIndex}
              isBrowseMode={false}
              isDark={isDark}
              compact
            />
          </div>
        )}

      {/* Content */}
      <div
        className={css({
          flex: 1,
          padding: variant === 'page' ? '28px' : '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          backgroundColor: variant === 'page' ? (isDark ? 'gray.900' : 'white') : undefined,
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

        {/* Main content - either problem view or full report view */}
        {state && !showFullReport && (
          <div
            data-element="observer-main-content"
            className={css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: '24px',
              width: '100%',
              justifyContent: 'center',
            })}
          >
            {/* Live results panel - left side */}
            <div
              className={css({
                width: '220px',
                flexShrink: 0,
              })}
            >
              <LiveResultsPanel
                results={results}
                totalProblems={state.totalProblems}
                isDark={isDark}
                onExpandFullReport={() => setShowFullReport(true)}
              />
            </div>

            {/* Problem area - center/right */}
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
                    style={{ height: problemHeight ?? undefined }}
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
          </div>
        )}

        {/* Full Report View - inline */}
        {state && showFullReport && (
          <LiveSessionReportInline
            results={results}
            totalProblems={state.totalProblems}
            sessionStartTime={state.timing.startedAt}
            isDark={isDark}
            onBack={() => setShowFullReport(false)}
          />
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

        {/* Teacher controls: pause/resume and dock abaci (hidden for view-only observers) */}
        {!isViewOnly && (
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

            {/* Share session link button (parents only) */}
            {canShare && <SessionShareButton sessionId={session.sessionId} isDark={isDark} />}
          </div>
        )}
      </div>
    </div>
  )
}
