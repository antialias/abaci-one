'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Z_INDEX } from '@/constants/zIndex'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/components/common/ToastContext'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import { useSessionObserver } from '@/hooks/useSessionObserver'
import { api } from '@/lib/queryClient'
import { css } from '../../../styled-system/css'
import { AbacusDock } from '../AbacusDock'
import { SessionShareButton } from './SessionShareButton'
import { LiveResultsPanel } from '../practice/LiveResultsPanel'
import { LiveSessionReportInline } from '../practice/LiveSessionReportModal'
import { ObserverTransitionView } from '../practice/ObserverTransitionView'
import { PracticeFeedback } from '../practice/PracticeFeedback'
import { PurposeBadge } from '../practice/PurposeBadge'
import { SessionProgressIndicator } from '../practice/SessionProgressIndicator'
import { VerticalProblem } from '../practice/VerticalProblem'
import { ObserverVisionFeed } from '../vision/ObserverVisionFeed'

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
  /** Classroom ID for entry prompts (teachers only) */
  classroomId?: string
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
  /** Classroom ID for entry prompts (teachers only) */
  classroomId?: string
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
  classroomId,
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
            classroomId={classroomId}
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
  classroomId,
  onClose,
  onRequestFullscreen,
  renderCloseButton,
  variant = 'modal',
}: SessionObserverViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { requestDock, dock, setDockedValue, isDockedByUser } = useMyAbacus()
  const { showSuccess, showError } = useToast()

  // Subscribe to the session's socket channel
  const {
    state,
    results,
    transitionState,
    visionFrame,
    isConnected,
    isObserving,
    error,
    sendControl,
    sendPause,
    sendResume,
  } = useSessionObserver(session.sessionId, observerId, session.playerId, true, shareToken)

  // Track if we've paused the session (teacher controls resume)
  const [hasPausedSession, setHasPausedSession] = useState(false)

  // Track if showing full report view (inline, not modal)
  const [showFullReport, setShowFullReport] = useState(false)

  // Track if entry prompt was sent (for authorization error case)
  const [promptSent, setPromptSent] = useState(false)

  // Mutation to send entry prompt to parents (for authorization error case)
  const sendEntryPrompt = useMutation({
    mutationFn: async () => {
      if (!classroomId) throw new Error('No classroom ID')
      const response = await api(`classrooms/${classroomId}/entry-prompts`, {
        method: 'POST',
        body: JSON.stringify({ playerIds: [session.playerId] }),
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
        showSuccess('Entry prompt sent', `${student.name}'s parent has been notified.`)
      } else if (data.skipped?.length > 0) {
        const reason = data.skipped[0]?.reason
        if (reason === 'pending_prompt_exists') {
          showError('Prompt already pending', `${student.name} already has a pending entry prompt.`)
        } else if (reason === 'already_present') {
          showSuccess('Already in classroom', `${student.name} is now in the classroom!`)
        } else {
          showError('Could not send prompt', reason || 'Unknown error')
        }
      }
    },
    onError: (err) => {
      showError(
        'Failed to send prompt',
        err instanceof Error ? err.message : 'An unexpected error occurred'
      )
    },
  })

  // Check if this is an authorization error that might be due to student not being present
  const isNotAuthorizedError = error === 'Not authorized to observe this session'

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
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: 0,
          })}
        >
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

        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          })}
        >
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

        {error && !isNotAuthorizedError && (
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

        {/* Authorization error - show helpful UI for teachers to send entry prompt */}
        {isNotAuthorizedError && (
          <div
            data-element="not-present-error"
            className={css({
              textAlign: 'center',
              maxWidth: '400px',
              width: '100%',
            })}
          >
            <p
              className={css({
                fontSize: '1rem',
                color: isDark ? 'gray.300' : 'gray.600',
                marginBottom: '1.5rem',
                lineHeight: '1.6',
              })}
            >
              {student.name} is enrolled in your class, but you can only observe their practice
              sessions when they are present in your classroom.
            </p>

            {/* Entry prompt section - only show for teachers with classroomId */}
            {classroomId && !promptSent && (
              <div
                data-element="entry-prompt-section"
                className={css({
                  backgroundColor: isDark ? 'orange.900/30' : 'orange.50',
                  border: '2px solid',
                  borderColor: isDark ? 'orange.700' : 'orange.300',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1rem',
                })}
              >
                <h3
                  className={css({
                    fontSize: '0.9375rem',
                    fontWeight: '600',
                    color: isDark ? 'orange.300' : 'orange.700',
                    marginBottom: '0.5rem',
                  })}
                >
                  Notify {student.name}&apos;s parent
                </h3>
                <p
                  className={css({
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.300' : 'gray.600',
                    marginBottom: '1rem',
                    lineHeight: '1.5',
                  })}
                >
                  Send a notification asking them to enter the classroom.
                </p>
                <button
                  type="button"
                  onClick={() => sendEntryPrompt.mutate()}
                  disabled={sendEntryPrompt.isPending}
                  data-action="send-entry-prompt"
                  className={css({
                    width: '100%',
                    padding: '0.75rem 1rem',
                    fontSize: '1rem',
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
              </div>
            )}

            {/* Prompt sent confirmation */}
            {classroomId && promptSent && (
              <div
                data-element="prompt-sent-confirmation"
                className={css({
                  backgroundColor: isDark ? 'green.900/30' : 'green.50',
                  border: '2px solid',
                  borderColor: isDark ? 'green.700' : 'green.300',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1rem',
                })}
              >
                <p
                  className={css({
                    fontSize: '0.9375rem',
                    fontWeight: '500',
                    color: isDark ? 'green.300' : 'green.700',
                  })}
                >
                  Entry prompt sent to {student.name}&apos;s parent
                </p>
              </div>
            )}

            {/* Manual instructions (secondary) */}
            <div
              className={css({
                backgroundColor: isDark ? 'gray.800' : 'gray.100',
                border: '1px solid',
                borderColor: isDark ? 'gray.700' : 'gray.200',
                borderRadius: '12px',
                padding: '1rem',
                textAlign: 'left',
              })}
            >
              <h3
                className={css({
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                  color: isDark ? 'gray.400' : 'gray.500',
                  marginBottom: '0.5rem',
                })}
              >
                Or have {student.name} join manually
              </h3>
              <ol
                className={css({
                  fontSize: '0.8125rem',
                  color: isDark ? 'gray.400' : 'gray.500',
                  lineHeight: '1.6',
                  paddingLeft: '1.25rem',
                  margin: 0,
                })}
              >
                <li>
                  Have them open their device and go to <strong>Join Classroom</strong>
                </li>
                <li>They enter your classroom code to join</li>
                <li>Once they appear in your dashboard, you can observe</li>
              </ol>
            </div>
          </div>
        )}

        {isObserving && !state && !transitionState && (
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

        {/* Part transition view - shows when student is between parts */}
        {transitionState && (
          <ObserverTransitionView
            previousPartType={transitionState.previousPartType}
            nextPartType={transitionState.nextPartType}
            countdownStartTime={transitionState.countdownStartTime}
            countdownDurationMs={transitionState.countdownDurationMs}
            student={student}
          />
        )}

        {/* Main content - either problem view or full report view */}
        {state && !showFullReport && !transitionState && (
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

                {/* Vision feed or AbacusDock - positioned exactly like ActiveSession */}
                {state.phase === 'problem' && (problemHeight ?? 0) > 0 && (
                  <div
                    className={css({
                      position: 'absolute',
                      left: '100%',
                      top: 0,
                      width: '100%',
                      marginLeft: '1.5rem',
                    })}
                    style={{ height: problemHeight ?? undefined }}
                  >
                    {/* Show vision feed if available, otherwise show teacher's abacus dock */}
                    {visionFrame ? (
                      <ObserverVisionFeed frame={visionFrame} />
                    ) : (
                      <AbacusDock
                        id="teacher-observer-dock"
                        columns={abacusColumns}
                        interactive={true}
                        showNumbers={false}
                        animated={true}
                        onValueChange={handleTeacherAbacusChange}
                        style={{ height: '100%' }}
                      />
                    )}
                  </div>
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
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            })}
          >
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
