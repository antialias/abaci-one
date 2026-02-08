'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import {
  useSkillTutorialBroadcast,
  type SkillTutorialBroadcastState,
} from '@/hooks/useSkillTutorialBroadcast'
import type { SkillTutorialControlAction } from '@/lib/classroom/socket-events'
import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPlan } from '@/db/schema/session-plans'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { sessionModeKeys } from '@/hooks/useSessionMode'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { css } from '../../../styled-system/css'
import { SkillTutorialLauncher } from '../tutorial/SkillTutorialLauncher'
import { ManualSkillSelector } from './ManualSkillSelector'
import {
  StartPracticeModalProvider,
  useStartPracticeModal,
  type GameInfo,
} from './StartPracticeModalContext'
import {
  SessionConfigSummary,
  DurationSelector,
  PracticeModesSelector,
  PurposeDistributionBar,
  ProblemLengthSelector,
  GameBreakSettings,
  SessionFocusInfo,
  ErrorDisplay,
  StartButton,
} from './start-practice-modal'

interface StartPracticeModalProps {
  studentId: string
  studentName: string
  focusDescription: string
  sessionMode: SessionMode
  /** Comfort level from the session mode API (0-1) */
  comfortLevel?: number
  secondsPerTerm?: number
  /** @deprecated Use secondsPerTerm instead */
  avgSecondsPerProblem?: number
  existingPlan?: SessionPlan | null
  problemHistory?: ProblemResultWithContext[]
  onClose: () => void
  onStarted?: () => void
  open?: boolean
  /** Initial expanded state for settings panel (for Storybook) */
  initialExpanded?: boolean
  /** Override practice-approved games list (for Storybook/testing) */
  practiceApprovedGamesOverride?: GameInfo[]
}

export function StartPracticeModal({
  studentId,
  studentName,
  focusDescription,
  sessionMode,
  comfortLevel,
  secondsPerTerm,
  avgSecondsPerProblem,
  existingPlan,
  onClose,
  onStarted,
  open = true,
  initialExpanded,
  practiceApprovedGamesOverride,
}: StartPracticeModalProps) {
  return (
    <StartPracticeModalProvider
      studentId={studentId}
      studentName={studentName}
      focusDescription={focusDescription}
      sessionMode={sessionMode}
      comfortLevel={comfortLevel}
      secondsPerTerm={secondsPerTerm}
      avgSecondsPerProblem={avgSecondsPerProblem}
      existingPlan={existingPlan}
      onStarted={onStarted}
      initialExpanded={initialExpanded}
      practiceApprovedGamesOverride={practiceApprovedGamesOverride}
    >
      <StartPracticeModalContent
        studentId={studentId}
        studentName={studentName}
        focusDescription={focusDescription}
        onClose={onClose}
        open={open}
      />
    </StartPracticeModalProvider>
  )
}

interface StartPracticeModalContentProps {
  studentId: string
  studentName: string
  focusDescription: string
  onClose: () => void
  open: boolean
}

function StartPracticeModalContent({
  studentId,
  studentName,
  focusDescription,
  onClose,
  open,
}: StartPracticeModalContentProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const queryClient = useQueryClient()

  const {
    nextSkill,
    isExpanded,
    setIsExpanded,
    handleStart,
    showSkillSelector,
    setShowSkillSelector,
    canSkipTutorial,
    includeTutorial,
    setIncludeTutorial,
  } = useStartPracticeModal()

  // Tutorial state (stays in this component for WebSocket broadcast coordination)
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialBroadcastState, setTutorialBroadcastState] =
    useState<SkillTutorialBroadcastState | null>(null)
  const [pendingControlAction, setPendingControlAction] =
    useState<SkillTutorialControlAction | null>(null)

  const handleControlActionProcessed = useCallback(() => {
    setPendingControlAction(null)
  }, [])

  const handleControlReceived = useCallback((action: SkillTutorialControlAction) => {
    console.log('[StartPracticeModal] Received control action from teacher:', action)
    setPendingControlAction(action)
  }, [])

  useSkillTutorialBroadcast(
    studentId,
    studentName,
    showTutorial ? tutorialBroadcastState : null,
    handleControlReceived
  )

  // After tutorial completes, invalidate session mode (skill now enabled) and start practice
  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false)
    queryClient.invalidateQueries({
      queryKey: sessionModeKeys.forPlayer(studentId),
    })
    // Start practice - session plan will be generated with newly-enabled skill
    handleStart()
  }, [queryClient, studentId, handleStart])

  // Skip tutorial and start practice with existing skills
  const handleTutorialSkip = useCallback(() => {
    setShowTutorial(false)
    setIncludeTutorial(false)
    handleStart()
  }, [handleStart, setIncludeTutorial])

  const handleTutorialCancel = useCallback(() => {
    setShowTutorial(false)
    onClose()
  }, [onClose])

  // "Let's Go!" button handler - show tutorial first if needed, otherwise start practice
  const handleStartOrTutorial = useCallback(() => {
    if (includeTutorial && nextSkill) {
      setShowTutorial(true)
      return
    }
    handleStart()
  }, [includeTutorial, nextSkill, handleStart])

  // Render tutorial modal if tutorial is active
  if (showTutorial && nextSkill) {
    return (
      <Dialog.Root open={open} onOpenChange={(o) => !o && handleTutorialCancel()}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={css({
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              zIndex: 1000,
            })}
          />
          <Dialog.Content
            data-component="skill-tutorial-modal"
            className={css({
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 2rem)',
              maxWidth: '800px',
              maxHeight: 'calc(100vh - 2rem)',
              overflowY: 'auto',
              borderRadius: '20px',
              boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.4)',
              zIndex: 1001,
              outline: 'none',
            })}
            style={{
              background: isDark
                ? 'linear-gradient(150deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)'
                : 'linear-gradient(150deg, #ffffff 0%, #f8fafc 60%, #f0f9ff 100%)',
            }}
          >
            <SkillTutorialLauncher
              skillId={nextSkill.skillId}
              playerId={studentId}
              theme={isDark ? 'dark' : 'light'}
              onComplete={handleTutorialComplete}
              // Only allow skip if user has other skills to practice
              onSkip={canSkipTutorial ? handleTutorialSkip : undefined}
              onCancel={handleTutorialCancel}
              onBroadcastStateChange={setTutorialBroadcastState}
              controlAction={pendingControlAction}
              onControlActionProcessed={handleControlActionProcessed}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  // Config view - always shown (unified for all session modes)
  return (
    <>
      <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={css({
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              zIndex: 1000,
            })}
          />
          <Dialog.Content
            data-component="start-practice-modal"
            className={css({
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 2rem)',
              maxWidth: '360px',
              borderRadius: '20px',
              boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.4)',
              zIndex: 1001,
              outline: 'none',
              '@media (min-width: 480px)': {
                width: 'auto',
                minWidth: '360px',
              },
              '@media (max-width: 480px), (max-height: 700px)': {
                top: 0,
                left: 0,
                transform: 'none',
                width: '100%',
                maxWidth: 'none',
                height: '100%',
                borderRadius: 0,
                boxShadow: 'none',
                display: 'flex',
                flexDirection: 'column',
              },
            })}
            style={{
              background: isDark
                ? 'linear-gradient(150deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)'
                : 'linear-gradient(150deg, #ffffff 0%, #f8fafc 60%, #f0f9ff 100%)',
            }}
          >
            {/* Close button */}
            <Dialog.Close asChild>
              <button
                type="button"
                data-action="close-modal"
                className={css({
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  color: isDark ? 'gray.500' : 'gray.400',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  _hover: {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                    color: isDark ? 'gray.300' : 'gray.600',
                  },
                  '@media (max-width: 480px), (max-height: 700px)': {
                    top: '0.375rem',
                    right: '0.375rem',
                    width: '24px',
                    height: '24px',
                    fontSize: '0.75rem',
                  },
                })}
                aria-label="Close"
              >
                ✕
              </button>
            </Dialog.Close>

            <div
              data-section="modal-content"
              data-expanded={isExpanded}
              className={css({
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                flex: 1,
                overflow: 'hidden',
                '@media (max-height: 500px) and (orientation: landscape)': {
                  padding: '0.75rem 1.5rem',
                  paddingTop: '2rem',
                  justifyContent: 'flex-start',
                },
              })}
            >
              {/* Screen reader only title/description */}
              <Dialog.Title className={css({ srOnly: true })}>Start Practice Session</Dialog.Title>
              <Dialog.Description className={css({ srOnly: true })}>
                {focusDescription}
              </Dialog.Description>

              {/* Config and action wrapper */}
              <div
                data-section="config-and-action"
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  '@media (max-height: 500px) and (orientation: landscape)': {
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    gap: '0.5rem',
                  },
                })}
              >
                {/* Session focus info (replaces TutorialCTA and RemediationCTA) */}
                <SessionFocusInfo />

                {/* Session config card */}
                <div
                  data-section="session-config"
                  className={css({
                    borderRadius: '12px',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                  })}
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  }}
                >
                  {/* Summary view (collapsed) */}
                  <SessionConfigSummary />

                  {/* Expanded config panel */}
                  <div
                    data-section="config-expanded"
                    className={css({
                      overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      '@media (max-height: 500px) and (min-width: 500px)': {
                        overflow: 'auto',
                        maxHeight: '100%',
                      },
                    })}
                    style={{
                      maxHeight: isExpanded ? '620px' : '0px',
                      opacity: isExpanded ? 1 : 0,
                    }}
                  >
                    <div
                      className={css({
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.875rem',
                      })}
                    >
                      {/* Expanded header with collapse button */}
                      <div
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '-0.25rem',
                          '@media (max-width: 480px), (max-height: 700px)': {
                            marginBottom: '-0.125rem',
                          },
                        })}
                      >
                        <span
                          className={css({
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: isDark ? 'gray.400' : 'gray.500',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            '@media (max-width: 480px), (max-height: 700px)': {
                              fontSize: '0.625rem',
                            },
                          })}
                        >
                          Session Settings
                        </span>
                        <button
                          type="button"
                          data-action="collapse-settings"
                          onClick={() => setIsExpanded(false)}
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.6875rem',
                            fontWeight: '500',
                            color: isDark ? 'gray.400' : 'gray.500',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            _hover: {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.1)'
                                : 'rgba(0,0,0,0.06)',
                              color: isDark ? 'gray.300' : 'gray.600',
                            },
                            '@media (max-width: 480px), (max-height: 700px)': {
                              padding: '0.125rem 0.375rem',
                              fontSize: '0.5625rem',
                            },
                          })}
                        >
                          <span>▲</span>
                          <span>Collapse</span>
                        </button>
                      </div>

                      {/* Settings grid */}
                      <div
                        data-element="settings-grid"
                        className={css({
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.875rem',
                          '@media (max-width: 480px), (max-height: 700px)': {
                            gap: '0.375rem',
                          },
                          '@media (max-height: 500px) and (min-width: 500px)': {
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0.5rem',
                          },
                        })}
                      >
                        <DurationSelector />
                        <PracticeModesSelector />
                        <PurposeDistributionBar />
                        <ProblemLengthSelector />
                        <GameBreakSettings />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error display */}
                <ErrorDisplay />

                {/* Primary action button - always visible */}
                <StartButton onStart={handleStartOrTutorial} />

                {/* Manual skill selector link (for users who want to skip tutorial) */}
                {!canSkipTutorial && (
                  <button
                    type="button"
                    data-action="open-manual-skill-selector"
                    onClick={() => setShowSkillSelector(true)}
                    className={css({
                      padding: '0.5rem 1rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: '2px',
                      transition: 'all 0.15s ease',
                      alignSelf: 'center',
                      _hover: {
                        textDecoration: 'none',
                      },
                    })}
                    style={{ color: isDark ? '#71717a' : '#9ca3af' }}
                  >
                    Skip tutorial — choose skills manually
                  </button>
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Skill Selector Modal (for manual skill selection) */}
      <ManualSkillSelector
        open={showSkillSelector}
        onClose={() => setShowSkillSelector(false)}
        studentName={studentName}
        playerId={studentId}
        onSave={async () => {
          setShowSkillSelector(false)
          queryClient.invalidateQueries({
            queryKey: sessionModeKeys.forPlayer(studentId),
          })
        }}
      />
    </>
  )
}

export default StartPracticeModal
