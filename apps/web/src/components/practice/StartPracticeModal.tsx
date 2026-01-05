'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import {
  useSkillTutorialBroadcast,
  type SkillTutorialBroadcastState,
} from '@/hooks/useSkillTutorialBroadcast'
import type { SkillTutorialControlAction } from '@/lib/classroom/socket-events'
import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPlan, GameBreakSettings } from '@/db/schema/session-plans'
import { DEFAULT_PLAN_CONFIG, DEFAULT_GAME_BREAK_SETTINGS } from '@/db/schema/session-plans'
import {
  ActiveSessionExistsClientError,
  NoSkillsEnabledClientError,
  sessionPlanKeys,
  useApproveSessionPlan,
  useGenerateSessionPlan,
  useStartSessionPlan,
} from '@/hooks/useSessionPlan'
import { sessionModeKeys } from '@/hooks/useSessionMode'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import {
  convertSecondsPerProblemToSpt,
  estimateSessionProblemCount,
  TIME_ESTIMATION_DEFAULTS,
} from '@/lib/curriculum/time-estimation'
import { getSkillTutorialConfig } from '@/lib/curriculum/skill-tutorial-config'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { css } from '../../../styled-system/css'
import { SkillTutorialLauncher } from '../tutorial/SkillTutorialLauncher'

interface StartPracticeModalProps {
  studentId: string
  studentName: string
  focusDescription: string
  /** Session mode - single source of truth for what type of session to run */
  sessionMode: SessionMode
  /** Seconds per term - the primary time metric from the estimation utility */
  secondsPerTerm?: number
  /** @deprecated Use secondsPerTerm instead. This will be converted automatically. */
  avgSecondsPerProblem?: number
  existingPlan?: SessionPlan | null
  /** Problem history for BKT analysis - used to identify weak skills for display */
  problemHistory?: ProblemResultWithContext[]
  onClose: () => void
  onStarted?: () => void
  open?: boolean
}

type EnabledParts = {
  abacus: boolean
  visualization: boolean
  linear: boolean
}

const PART_TYPES = [
  { type: 'abacus' as const, emoji: '🧮', label: 'Abacus' },
  { type: 'visualization' as const, emoji: '🧠', label: 'Visualize' },
  { type: 'linear' as const, emoji: '💭', label: 'Mental' },
]

export function StartPracticeModal({
  studentId,
  studentName,
  focusDescription,
  sessionMode,
  secondsPerTerm: secondsPerTermProp,
  avgSecondsPerProblem,
  existingPlan,
  problemHistory,
  onClose,
  onStarted,
  open = true,
}: StartPracticeModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Tutorial gate state
  const [showTutorial, setShowTutorial] = useState(false)

  // Tutorial broadcast state for teacher observation
  const [tutorialBroadcastState, setTutorialBroadcastState] =
    useState<SkillTutorialBroadcastState | null>(null)

  // Control action from teacher (via WebSocket)
  const [pendingControlAction, setPendingControlAction] =
    useState<SkillTutorialControlAction | null>(null)

  // Handler for when control action is processed
  const handleControlActionProcessed = useCallback(() => {
    setPendingControlAction(null)
  }, [])

  // Handler for receiving control actions from teacher
  const handleControlReceived = useCallback((action: SkillTutorialControlAction) => {
    console.log('[StartPracticeModal] Received control action from teacher:', action)
    setPendingControlAction(action)
  }, [])

  // Broadcast tutorial state to classroom observers
  useSkillTutorialBroadcast(
    studentId,
    studentName,
    showTutorial ? tutorialBroadcastState : null,
    handleControlReceived
  )

  // Derive tutorial info from sessionMode (no separate hook needed)
  const tutorialConfig = useMemo(() => {
    if (sessionMode.type !== 'progression' || !sessionMode.tutorialRequired) return null
    return getSkillTutorialConfig(sessionMode.nextSkill.skillId)
  }, [sessionMode])

  // Whether to show the tutorial gate prompt
  const showTutorialGate = !!tutorialConfig && !showTutorial

  // Whether to show the remediation CTA (weak skills need strengthening)
  const showRemediationCta = sessionMode.type === 'remediation' && sessionMode.weakSkills.length > 0

  // Get skill info for tutorial from sessionMode
  const nextSkill = sessionMode.type === 'progression' ? sessionMode.nextSkill : null

  // Derive secondsPerTerm: prefer direct prop, fall back to converting avgSecondsPerProblem, then default
  const secondsPerTerm = useMemo(() => {
    if (secondsPerTermProp !== undefined) return secondsPerTermProp
    if (avgSecondsPerProblem !== undefined)
      return convertSecondsPerProblemToSpt(avgSecondsPerProblem)
    return TIME_ESTIMATION_DEFAULTS.secondsPerTerm
  }, [secondsPerTermProp, avgSecondsPerProblem])

  const [durationMinutes, setDurationMinutes] = useState(existingPlan?.targetDurationMinutes ?? 10)
  const [isExpanded, setIsExpanded] = useState(false)
  const [enabledParts, setEnabledParts] = useState<EnabledParts>({
    abacus: true,
    visualization: true,
    linear: true,
  })
  const [abacusMaxTerms, setAbacusMaxTerms] = useState(
    DEFAULT_PLAN_CONFIG.abacusTermCount?.max ?? 5
  )
  const [gameBreakEnabled, setGameBreakEnabled] = useState(DEFAULT_GAME_BREAK_SETTINGS.enabled)
  const [gameBreakMinutes, setGameBreakMinutes] = useState(
    DEFAULT_GAME_BREAK_SETTINGS.maxDurationMinutes
  )

  const togglePart = useCallback((partType: keyof EnabledParts) => {
    setEnabledParts((prev) => {
      const enabledCount = Object.values(prev).filter(Boolean).length
      if (enabledCount === 1 && prev[partType]) return prev
      return { ...prev, [partType]: !prev[partType] }
    })
  }, [])

  // Calculate average terms per problem based on the max terms setting
  const avgTermsPerProblem = useMemo(() => {
    // Problems range from 3 terms to abacusMaxTerms, average them
    return (3 + abacusMaxTerms) / 2
  }, [abacusMaxTerms])

  // Calculate problems per mode type
  const problemsPerType = useMemo(() => {
    const enabledPartTypes = PART_TYPES.filter((p) => enabledParts[p.type]).map((p) => p.type)
    const enabledCount = enabledPartTypes.length
    if (enabledCount === 0) {
      return { abacus: 0, visualization: 0, linear: 0 }
    }

    const minutesPerPart = durationMinutes / enabledCount

    return {
      abacus: enabledParts.abacus
        ? estimateSessionProblemCount(minutesPerPart, avgTermsPerProblem, secondsPerTerm, 'abacus')
        : 0,
      visualization: enabledParts.visualization
        ? estimateSessionProblemCount(
            minutesPerPart,
            avgTermsPerProblem,
            secondsPerTerm,
            'visualization'
          )
        : 0,
      linear: enabledParts.linear
        ? estimateSessionProblemCount(minutesPerPart, avgTermsPerProblem, secondsPerTerm, 'linear')
        : 0,
    }
  }, [durationMinutes, enabledParts, avgTermsPerProblem, secondsPerTerm])

  // Total estimated problems
  const estimatedProblems = useMemo(() => {
    return problemsPerType.abacus + problemsPerType.visualization + problemsPerType.linear
  }, [problemsPerType])

  const modesSummary = useMemo(() => {
    const enabled = PART_TYPES.filter((p) => enabledParts[p.type])
    if (enabled.length === 3) return { text: 'all modes', emojis: '🧮🧠💭' }
    if (enabled.length === 0) return { text: 'none', emojis: '—' }
    return {
      text: `${enabled.length} mode${enabled.length > 1 ? 's' : ''}`,
      emojis: enabled.map((p) => p.emoji).join(''),
    }
  }, [enabledParts])

  const generatePlan = useGenerateSessionPlan()
  const approvePlan = useApproveSessionPlan()
  const startPlan = useStartSessionPlan()

  const isStarting = generatePlan.isPending || approvePlan.isPending || startPlan.isPending

  // Check for errors (excluding recoverable ActiveSessionExistsClientError)
  const displayError = (() => {
    if (generatePlan.error && !(generatePlan.error instanceof ActiveSessionExistsClientError)) {
      return generatePlan.error
    }
    if (approvePlan.error) return approvePlan.error
    if (startPlan.error) return startPlan.error
    return null
  })()

  const isNoSkillsError = displayError instanceof NoSkillsEnabledClientError

  const handleStart = useCallback(async () => {
    generatePlan.reset()
    approvePlan.reset()
    startPlan.reset()

    try {
      let plan: SessionPlan

      if (existingPlan && existingPlan.targetDurationMinutes === durationMinutes) {
        plan = existingPlan
      } else {
        try {
          plan = await generatePlan.mutateAsync({
            playerId: studentId,
            durationMinutes,
            abacusTermCount: { min: 3, max: abacusMaxTerms },
            enabledParts,
            problemGenerationMode: 'adaptive-bkt',
            sessionMode,
            gameBreakSettings: {
              enabled: gameBreakEnabled,
              maxDurationMinutes: gameBreakMinutes,
            },
          })
        } catch (err) {
          if (err instanceof ActiveSessionExistsClientError) {
            plan = err.existingPlan
            queryClient.setQueryData(sessionPlanKeys.active(studentId), plan)
          } else {
            throw err
          }
        }
      }

      await approvePlan.mutateAsync({ playerId: studentId, planId: plan.id })
      await startPlan.mutateAsync({ playerId: studentId, planId: plan.id })
      onStarted?.()
      router.push(`/practice/${studentId}`, { scroll: false })
    } catch {
      // Error will show in UI
    }
  }, [
    studentId,
    durationMinutes,
    abacusMaxTerms,
    enabledParts,
    existingPlan,
    sessionMode,
    gameBreakEnabled,
    gameBreakMinutes,
    generatePlan,
    approvePlan,
    startPlan,
    queryClient,
    router,
    onStarted,
  ])

  // Handle tutorial completion - refresh session mode query and proceed to practice
  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false)
    // Invalidate the session mode query to refresh state
    queryClient.invalidateQueries({
      queryKey: sessionModeKeys.forPlayer(studentId),
    })
    // Proceed with starting practice
    handleStart()
  }, [queryClient, studentId, handleStart])

  // Handle tutorial skip - proceed without the new skill
  const handleTutorialSkip = useCallback(() => {
    setShowTutorial(false)
    // Proceed with practice (skill remains gated)
    handleStart()
  }, [handleStart])

  // Handle tutorial cancel - close modal
  const handleTutorialCancel = useCallback(() => {
    setShowTutorial(false)
    onClose()
  }, [onClose])

  // If showing tutorial, render the tutorial launcher
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
              onSkip={handleTutorialSkip}
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

  return (
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
            // Full-screen on mobile phones (narrow widths OR short viewports)
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
              // Landscape: more compact
              '@media (max-height: 500px) and (orientation: landscape)': {
                padding: '0.75rem 1.5rem',
                paddingTop: '2rem',
                justifyContent: 'flex-start',
              },
            })}
          >
            {/* Screen reader only title/description for accessibility */}
            <Dialog.Title className={css({ srOnly: true })}>Start Practice Session</Dialog.Title>
            <Dialog.Description className={css({ srOnly: true })}>
              {focusDescription}
            </Dialog.Description>

            {/* Config and action wrapper - CTA first, settings second via order */}
            <div
              data-section="config-and-action"
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                // Landscape mode: allow flex to fill space
                '@media (max-height: 500px) and (orientation: landscape)': {
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  gap: '0.5rem',
                },
              })}
            >
              {/* Session config card - always appears after CTA via order */}
              <div
                data-section="session-config"
                className={css({
                  order: 99, // Always last
                  borderRadius: '12px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                })}
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                {/* Summary view (collapses when expanded) */}
                <div
                  data-section="config-summary"
                  className={css({
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                  })}
                  style={{
                    maxHeight: isExpanded ? '0px' : '140px',
                    opacity: isExpanded ? 0 : 1,
                  }}
                >
                  <button
                    type="button"
                    data-action="expand-config"
                    onClick={() => setIsExpanded(true)}
                    className={css({
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.75rem',
                      background: 'none',
                      border: 'none',
                      padding: '1rem',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                      _hover: {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      },
                      '@media (max-width: 480px), (max-height: 700px)': {
                        padding: '0.75rem',
                        gap: '0.5rem',
                      },
                    })}
                  >
                    {/* Duration */}
                    <div data-element="duration-summary" className={css({ textAlign: 'center' })}>
                      <div
                        data-value="duration-minutes"
                        className={css({
                          fontSize: '1.5rem',
                          fontWeight: 'bold',
                          color: isDark ? 'blue.300' : 'blue.600',
                          lineHeight: 1,
                          '@media (max-width: 480px), (max-height: 700px)': {
                            fontSize: '1.25rem',
                          },
                        })}
                      >
                        {durationMinutes}
                      </div>
                      <div
                        data-label="duration"
                        className={css({
                          fontSize: '0.6875rem',
                          color: isDark ? 'gray.500' : 'gray.500',
                          marginTop: '0.125rem',
                        })}
                      >
                        min
                      </div>
                    </div>

                    <div
                      className={css({
                        fontSize: '0.875rem',
                        color: isDark ? 'gray.600' : 'gray.300',
                      })}
                    >
                      •
                    </div>

                    {/* Problems */}
                    <div data-element="problems-summary" className={css({ textAlign: 'center' })}>
                      <div
                        data-value="problems-count"
                        className={css({
                          fontSize: '1.5rem',
                          fontWeight: 'bold',
                          color: isDark ? 'green.300' : 'green.600',
                          lineHeight: 1,
                          '@media (max-width: 480px), (max-height: 700px)': {
                            fontSize: '1.25rem',
                          },
                        })}
                      >
                        ~{estimatedProblems}
                      </div>
                      <div
                        data-label="problems"
                        className={css({
                          fontSize: '0.6875rem',
                          color: isDark ? 'gray.500' : 'gray.500',
                          marginTop: '0.125rem',
                          '@media (max-width: 480px), (max-height: 700px)': {
                            fontSize: '0.625rem',
                          },
                        })}
                      >
                        problems
                      </div>
                    </div>

                    <div
                      className={css({
                        fontSize: '0.875rem',
                        color: isDark ? 'gray.600' : 'gray.300',
                        '@media (max-width: 480px), (max-height: 700px)': {
                          fontSize: '0.75rem',
                        },
                      })}
                    >
                      •
                    </div>

                    {/* Modes with problem counts underneath */}
                    <div
                      data-element="modes-summary"
                      className={css({
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        '@media (max-width: 480px), (max-height: 700px)': {
                          gap: '0.375rem',
                        },
                      })}
                    >
                      {PART_TYPES.filter((p) => enabledParts[p.type]).map(({ type, emoji }) => (
                        <div
                          key={type}
                          data-mode={type}
                          className={css({
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0',
                          })}
                        >
                          <span
                            data-element="mode-icon"
                            className={css({
                              fontSize: '1.25rem',
                              lineHeight: 1,
                              '@media (max-width: 480px), (max-height: 700px)': {
                                fontSize: '1rem',
                              },
                            })}
                          >
                            {emoji}
                          </span>
                          <span
                            data-element="mode-count"
                            className={css({
                              fontSize: '0.6875rem',
                              fontWeight: '600',
                              lineHeight: 1,
                              marginTop: '0.125rem',
                              '@media (max-width: 480px), (max-height: 700px)': {
                                fontSize: '0.625rem',
                              },
                            })}
                            style={{ color: isDark ? '#22c55e' : '#16a34a' }}
                          >
                            {problemsPerType[type]}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Expand indicator */}
                    <div
                      data-element="expand-indicator"
                      className={css({
                        marginLeft: '0.25rem',
                        fontSize: '0.625rem',
                        color: isDark ? 'gray.500' : 'gray.400',
                        '@media (max-width: 480px), (max-height: 700px)': {
                          fontSize: '0.5rem',
                          marginLeft: '0.125rem',
                        },
                      })}
                    >
                      ▼
                    </div>
                  </button>
                </div>

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
                    maxHeight: isExpanded ? '520px' : '0px',
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
                            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
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

                    {/* Settings grid - 2 columns in landscape */}
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
                      {/* Duration options */}
                      <div data-setting="duration">
                        <div
                          data-element="duration-label"
                          className={css({
                            fontSize: '0.6875rem',
                            fontWeight: '600',
                            color: isDark ? 'gray.500' : 'gray.400',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '0.5rem',
                            '@media (max-width: 480px), (max-height: 700px)': {
                              marginBottom: '0.25rem',
                              fontSize: '0.625rem',
                            },
                          })}
                        >
                          Duration
                        </div>
                        <div
                          data-element="duration-options"
                          className={css({
                            display: 'flex',
                            gap: '0.375rem',
                            '@media (max-width: 480px), (max-height: 700px)': {
                              gap: '0.25rem',
                            },
                          })}
                        >
                          {[5, 10, 15, 20].map((min) => {
                            // Estimate problems for this duration using current settings
                            const enabledPartTypes = PART_TYPES.filter(
                              (p) => enabledParts[p.type]
                            ).map((p) => p.type)
                            const minutesPerPart =
                              enabledPartTypes.length > 0 ? min / enabledPartTypes.length : min
                            let problems = 0
                            for (const partType of enabledPartTypes) {
                              problems += estimateSessionProblemCount(
                                minutesPerPart,
                                avgTermsPerProblem,
                                secondsPerTerm,
                                partType
                              )
                            }
                            const isSelected = durationMinutes === min
                            return (
                              <button
                                key={min}
                                type="button"
                                data-option={`duration-${min}`}
                                data-selected={isSelected}
                                onClick={() => setDurationMinutes(min)}
                                className={css({
                                  flex: 1,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '0.125rem',
                                  padding: '0.5rem 0.25rem',
                                  borderRadius: '8px',
                                  border: '2px solid',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  '@media (max-width: 480px), (max-height: 700px)': {
                                    padding: '0.375rem 0.125rem',
                                    borderRadius: '6px',
                                    gap: '0',
                                  },
                                })}
                                style={{
                                  borderColor: isSelected
                                    ? isDark
                                      ? '#60a5fa'
                                      : '#3b82f6'
                                    : isDark
                                      ? 'rgba(255,255,255,0.1)'
                                      : 'rgba(0,0,0,0.08)',
                                  backgroundColor: isSelected
                                    ? isDark
                                      ? 'rgba(96, 165, 250, 0.15)'
                                      : 'rgba(59, 130, 246, 0.08)'
                                    : 'transparent',
                                }}
                              >
                                <span
                                  className={css({
                                    fontSize: '0.9375rem',
                                    fontWeight: '600',
                                    '@media (max-width: 480px), (max-height: 700px)': {
                                      fontSize: '0.8125rem',
                                    },
                                  })}
                                  style={{
                                    color: isSelected
                                      ? isDark
                                        ? '#93c5fd'
                                        : '#2563eb'
                                      : isDark
                                        ? '#e2e8f0'
                                        : '#334155',
                                  }}
                                >
                                  {min}m
                                </span>
                                <span
                                  className={css({
                                    fontSize: '0.625rem',
                                    '@media (max-width: 480px), (max-height: 700px)': {
                                      fontSize: '0.5625rem',
                                    },
                                  })}
                                  style={{
                                    color: isDark ? '#64748b' : '#94a3b8',
                                  }}
                                >
                                  ~{problems}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Modes */}
                      <div data-setting="practice-modes">
                        <div
                          data-element="modes-label"
                          className={css({
                            fontSize: '0.6875rem',
                            fontWeight: '600',
                            color: isDark ? 'gray.500' : 'gray.400',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '0.5rem',
                            '@media (max-width: 480px), (max-height: 700px)': {
                              marginBottom: '0.25rem',
                              fontSize: '0.625rem',
                            },
                          })}
                        >
                          Practice Modes
                        </div>
                        <div
                          data-element="modes-options"
                          className={css({
                            display: 'flex',
                            gap: '0.375rem',
                            '@media (max-width: 480px), (max-height: 700px)': {
                              gap: '0.25rem',
                            },
                          })}
                        >
                          {PART_TYPES.map(({ type, emoji, label }) => {
                            const isEnabled = enabledParts[type]
                            const problemCount = problemsPerType[type]
                            return (
                              <button
                                key={type}
                                type="button"
                                data-option={`mode-${type}`}
                                data-enabled={isEnabled}
                                onClick={() => togglePart(type)}
                                className={css({
                                  position: 'relative',
                                  flex: 1,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.625rem 0.25rem 0.5rem',
                                  borderRadius: '8px',
                                  border: '2px solid',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  '@media (max-width: 480px), (max-height: 700px)': {
                                    padding: '0.375rem 0.125rem 0.25rem',
                                    borderRadius: '6px',
                                    gap: '0.125rem',
                                  },
                                })}
                                style={{
                                  borderColor: isEnabled
                                    ? isDark
                                      ? '#22c55e'
                                      : '#16a34a'
                                    : isDark
                                      ? 'rgba(255,255,255,0.1)'
                                      : 'rgba(0,0,0,0.08)',
                                  backgroundColor: isEnabled
                                    ? isDark
                                      ? 'rgba(34, 197, 94, 0.15)'
                                      : 'rgba(22, 163, 74, 0.08)'
                                    : 'transparent',
                                  opacity: isEnabled ? 1 : 0.5,
                                }}
                              >
                                {/* Badge positioned at upper-right of button box */}
                                {isEnabled && (
                                  <span
                                    className={css({
                                      position: 'absolute',
                                      top: '-8px',
                                      right: '-8px',
                                      minWidth: '22px',
                                      minHeight: '22px',
                                      aspectRatio: '1 / 1',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.75rem',
                                      fontWeight: 'bold',
                                      color: 'white',
                                      backgroundColor: 'green.500',
                                      borderRadius: '50%',
                                      padding: '2px',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                      '@media (max-width: 480px), (max-height: 700px)': {
                                        top: '-6px',
                                        right: '-6px',
                                        minWidth: '18px',
                                        minHeight: '18px',
                                        fontSize: '0.625rem',
                                      },
                                    })}
                                  >
                                    {problemCount}
                                  </span>
                                )}
                                {/* Emoji */}
                                <span
                                  className={css({
                                    fontSize: '1.5rem',
                                    lineHeight: 1,
                                    '@media (max-width: 480px), (max-height: 700px)': {
                                      fontSize: '1.25rem',
                                    },
                                  })}
                                >
                                  {emoji}
                                </span>
                                <span
                                  className={css({
                                    fontSize: '0.6875rem',
                                    fontWeight: '500',
                                    '@media (max-width: 480px), (max-height: 700px)': {
                                      fontSize: '0.5625rem',
                                    },
                                  })}
                                  style={{
                                    color: isDark ? '#e2e8f0' : '#334155',
                                  }}
                                >
                                  {label}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Numbers per problem */}
                      <div data-setting="max-terms">
                        <div
                          data-element="terms-label"
                          className={css({
                            fontSize: '0.6875rem',
                            fontWeight: '600',
                            color: isDark ? 'gray.500' : 'gray.400',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '0.5rem',
                            '@media (max-width: 480px), (max-height: 700px)': {
                              marginBottom: '0.25rem',
                              fontSize: '0.625rem',
                            },
                          })}
                        >
                          Numbers per problem
                        </div>
                        <div
                          data-element="terms-options"
                          className={css({
                            display: 'flex',
                            gap: '0.25rem',
                            '@media (max-width: 480px), (max-height: 700px)': {
                              gap: '0.125rem',
                            },
                          })}
                        >
                          {[3, 4, 5, 6, 7, 8].map((terms) => {
                            const isSelected = abacusMaxTerms === terms
                            return (
                              <button
                                key={terms}
                                type="button"
                                data-option={`terms-${terms}`}
                                data-selected={isSelected}
                                onClick={() => setAbacusMaxTerms(terms)}
                                className={css({
                                  flex: 1,
                                  padding: '0.5rem 0.25rem',
                                  fontSize: '0.875rem',
                                  fontWeight: '600',
                                  borderRadius: '6px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  '@media (max-width: 480px), (max-height: 700px)': {
                                    padding: '0.3125rem 0.125rem',
                                    fontSize: '0.75rem',
                                    borderRadius: '4px',
                                  },
                                })}
                                style={{
                                  backgroundColor: isSelected
                                    ? isDark
                                      ? '#8b5cf6'
                                      : '#7c3aed'
                                    : isDark
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(0,0,0,0.04)',
                                  color: isSelected ? 'white' : isDark ? '#9ca3af' : '#6b7280',
                                }}
                              >
                                {terms}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Game Break Settings */}
                      <div data-setting="game-break">
                        <div
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0.5rem',
                            '@media (max-width: 480px), (max-height: 700px)': {
                              marginBottom: '0.25rem',
                            },
                          })}
                        >
                          <div
                            data-element="game-break-label"
                            className={css({
                              fontSize: '0.6875rem',
                              fontWeight: '600',
                              color: isDark ? 'gray.500' : 'gray.400',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              '@media (max-width: 480px), (max-height: 700px)': {
                                fontSize: '0.625rem',
                              },
                            })}
                          >
                            Game Breaks
                          </div>
                          <button
                            type="button"
                            data-action="toggle-game-break"
                            onClick={() => setGameBreakEnabled(!gameBreakEnabled)}
                            className={css({
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.6875rem',
                              fontWeight: '500',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              '@media (max-width: 480px), (max-height: 700px)': {
                                padding: '0.125rem 0.375rem',
                                fontSize: '0.5625rem',
                              },
                            })}
                            style={{
                              backgroundColor: gameBreakEnabled
                                ? isDark
                                  ? 'rgba(34, 197, 94, 0.2)'
                                  : 'rgba(34, 197, 94, 0.15)'
                                : isDark
                                  ? 'rgba(255,255,255,0.05)'
                                  : 'rgba(0,0,0,0.03)',
                              color: gameBreakEnabled
                                ? isDark
                                  ? '#86efac'
                                  : '#16a34a'
                                : isDark
                                  ? '#9ca3af'
                                  : '#6b7280',
                            }}
                          >
                            <span>{gameBreakEnabled ? '🎮' : '⏸️'}</span>
                            <span>{gameBreakEnabled ? 'On' : 'Off'}</span>
                          </button>
                        </div>
                        {gameBreakEnabled && (
                          <div
                            data-element="game-break-duration"
                            className={css({
                              display: 'flex',
                              gap: '0.25rem',
                              '@media (max-width: 480px), (max-height: 700px)': {
                                gap: '0.125rem',
                              },
                            })}
                          >
                            {[2, 3, 5, 10].map((mins) => {
                              const isSelected = gameBreakMinutes === mins
                              return (
                                <button
                                  key={mins}
                                  type="button"
                                  data-option={`game-break-${mins}`}
                                  data-selected={isSelected}
                                  onClick={() => setGameBreakMinutes(mins)}
                                  className={css({
                                    flex: 1,
                                    padding: '0.5rem 0.25rem',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    '@media (max-width: 480px), (max-height: 700px)': {
                                      padding: '0.3125rem 0.125rem',
                                      fontSize: '0.75rem',
                                      borderRadius: '4px',
                                    },
                                  })}
                                  style={{
                                    backgroundColor: isSelected
                                      ? isDark
                                        ? '#22c55e'
                                        : '#16a34a'
                                      : isDark
                                        ? 'rgba(255,255,255,0.06)'
                                        : 'rgba(0,0,0,0.04)',
                                    color: isSelected ? 'white' : isDark ? '#9ca3af' : '#6b7280',
                                  }}
                                >
                                  {mins}m
                                </button>
                              )
                            })}
                          </div>
                        )}
                        {gameBreakEnabled && (
                          <div
                            data-element="game-break-hint"
                            className={css({
                              fontSize: '0.625rem',
                              color: isDark ? 'gray.500' : 'gray.400',
                              marginTop: '0.375rem',
                              '@media (max-width: 480px), (max-height: 700px)': {
                                fontSize: '0.5625rem',
                                marginTop: '0.25rem',
                              },
                            })}
                          >
                            Arcade time between sections (or 1 game)
                          </div>
                        )}
                      </div>
                    </div>
                    {/* End settings-grid */}
                  </div>
                </div>
              </div>

              {/* Tutorial CTA - New skill unlocked with integrated start button */}
              {showTutorialGate && tutorialConfig && nextSkill && (
                <div
                  data-element="tutorial-cta"
                  className={css({
                    borderRadius: '12px',
                    overflow: 'hidden',
                  })}
                  style={{
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)'
                      : 'linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)',
                    border: `2px solid ${isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.2)'}`,
                  }}
                >
                  {/* Info section */}
                  <div
                    className={css({
                      padding: '0.875rem 1rem',
                      display: 'flex',
                      gap: '0.625rem',
                      alignItems: 'center',
                    })}
                  >
                    <span className={css({ fontSize: '1.5rem', lineHeight: 1 })}>🌟</span>
                    <div className={css({ flex: 1 })}>
                      <p
                        className={css({
                          fontSize: '0.875rem',
                          fontWeight: '600',
                        })}
                        style={{ color: isDark ? '#86efac' : '#166534' }}
                      >
                        You've unlocked: <strong>{tutorialConfig.title}</strong>
                      </p>
                      <p
                        className={css({
                          fontSize: '0.75rem',
                          marginTop: '0.125rem',
                        })}
                        style={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
                      >
                        Start with a quick tutorial
                      </p>
                    </div>
                  </div>
                  {/* Integrated start button */}
                  <button
                    type="button"
                    data-action="start-tutorial"
                    data-status={isStarting ? 'starting' : 'ready'}
                    onClick={() => setShowTutorial(true)}
                    disabled={isStarting}
                    className={css({
                      width: '100%',
                      padding: '0.875rem',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0 0 10px 10px',
                      cursor: isStarting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      _hover: {
                        filter: isStarting ? 'none' : 'brightness(1.05)',
                      },
                    })}
                    style={{
                      background: isStarting
                        ? '#9ca3af'
                        : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      boxShadow: isStarting ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.15)',
                    }}
                  >
                    {isStarting ? (
                      'Starting...'
                    ) : (
                      <>
                        <span>🎓</span>
                        <span>Begin Tutorial</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Remediation CTA - Weak skills need strengthening */}
              {showRemediationCta && !showTutorialGate && sessionMode.type === 'remediation' && (
                <div
                  data-element="remediation-cta"
                  className={css({
                    borderRadius: '12px',
                    overflow: 'hidden',
                  })}
                  style={{
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(234, 88, 12, 0.08) 100%)'
                      : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(234, 88, 12, 0.05) 100%)',
                    border: `2px solid ${isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.2)'}`,
                  }}
                >
                  {/* Info section */}
                  <div
                    className={css({
                      padding: '0.875rem 1rem',
                      display: 'flex',
                      gap: '0.625rem',
                      alignItems: 'flex-start',
                    })}
                  >
                    <span className={css({ fontSize: '1.5rem', lineHeight: 1 })}>💪</span>
                    <div className={css({ flex: 1 })}>
                      <p
                        className={css({
                          fontSize: '0.875rem',
                          fontWeight: '600',
                        })}
                        style={{ color: isDark ? '#fcd34d' : '#b45309' }}
                      >
                        Time to build strength!
                      </p>
                      <p
                        className={css({
                          fontSize: '0.75rem',
                          marginTop: '0.125rem',
                        })}
                        style={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
                      >
                        Focusing on {sessionMode.weakSkills.length} skill
                        {sessionMode.weakSkills.length > 1 ? 's' : ''} that need practice
                      </p>
                      {/* Weak skills badges */}
                      <div
                        className={css({
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.25rem',
                          marginTop: '0.5rem',
                        })}
                      >
                        {sessionMode.weakSkills.slice(0, 4).map((skill) => (
                          <span
                            key={skill.skillId}
                            data-skill={skill.skillId}
                            className={css({
                              fontSize: '0.625rem',
                              padding: '0.125rem 0.375rem',
                              borderRadius: '4px',
                            })}
                            style={{
                              backgroundColor: isDark
                                ? 'rgba(245, 158, 11, 0.2)'
                                : 'rgba(245, 158, 11, 0.15)',
                              color: isDark ? '#fcd34d' : '#92400e',
                            }}
                          >
                            {skill.displayName}{' '}
                            <span style={{ opacity: 0.7 }}>
                              ({Math.round(skill.pKnown * 100)}%)
                            </span>
                          </span>
                        ))}
                        {sessionMode.weakSkills.length > 4 && (
                          <span
                            className={css({
                              fontSize: '0.625rem',
                              padding: '0.125rem 0.375rem',
                            })}
                            style={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
                          >
                            +{sessionMode.weakSkills.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Integrated start button */}
                  <button
                    type="button"
                    data-action="start-focus-practice"
                    data-status={isStarting ? 'starting' : 'ready'}
                    onClick={handleStart}
                    disabled={isStarting}
                    className={css({
                      width: '100%',
                      padding: '0.875rem',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0 0 10px 10px',
                      cursor: isStarting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      _hover: {
                        filter: isStarting ? 'none' : 'brightness(1.05)',
                      },
                    })}
                    style={{
                      background: isStarting
                        ? '#9ca3af'
                        : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      boxShadow: isStarting ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.15)',
                    }}
                  >
                    {isStarting ? (
                      'Starting...'
                    ) : (
                      <>
                        <span>💪</span>
                        <span>Start Focus Practice</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Error display */}
              {displayError && (
                <div
                  data-element="error-display"
                  data-error-type={isNoSkillsError ? 'no-skills' : 'generic'}
                  className={css({
                    padding: '0.75rem',
                    borderRadius: '8px',
                    textAlign: 'center',
                  })}
                  style={{
                    background: isNoSkillsError
                      ? isDark
                        ? 'rgba(251, 191, 36, 0.12)'
                        : 'rgba(251, 191, 36, 0.08)'
                      : isDark
                        ? 'rgba(239, 68, 68, 0.12)'
                        : 'rgba(239, 68, 68, 0.08)',
                    border: `1px solid ${
                      isNoSkillsError
                        ? isDark
                          ? 'rgba(251, 191, 36, 0.25)'
                          : 'rgba(251, 191, 36, 0.15)'
                        : isDark
                          ? 'rgba(239, 68, 68, 0.25)'
                          : 'rgba(239, 68, 68, 0.15)'
                    }`,
                  }}
                >
                  {isNoSkillsError ? (
                    <>
                      <p
                        className={css({
                          fontSize: '0.875rem',
                          marginBottom: '0.5rem',
                        })}
                        style={{ color: isDark ? '#fcd34d' : '#b45309' }}
                      >
                        ⚠️ No skills enabled
                      </p>
                      <p
                        className={css({ fontSize: '0.75rem' })}
                        style={{ color: isDark ? '#d4d4d4' : '#525252' }}
                      >
                        Please enable at least one skill in the skill selector before starting a
                        session.
                      </p>
                    </>
                  ) : (
                    <p
                      className={css({ fontSize: '0.875rem' })}
                      style={{ color: isDark ? '#fca5a5' : '#dc2626' }}
                    >
                      {displayError.message || 'Something went wrong. Please try again.'}
                    </p>
                  )}
                </div>
              )}

              {/* Start button - only shown when no special CTA is active */}
              {!showTutorialGate && !showRemediationCta && (
                <button
                  type="button"
                  data-action="start-practice"
                  data-status={isStarting ? 'starting' : 'ready'}
                  onClick={handleStart}
                  disabled={isStarting}
                  className={css({
                    width: '100%',
                    padding: '1rem',
                    fontSize: '1.0625rem',
                    fontWeight: 'bold',
                    color: 'white',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: isStarting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    _hover: {
                      transform: isStarting ? 'none' : 'translateY(-1px)',
                    },
                    _active: {
                      transform: 'translateY(0)',
                    },
                  })}
                  style={{
                    background: isStarting
                      ? '#9ca3af'
                      : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    boxShadow: isStarting ? 'none' : '0 6px 20px rgba(34, 197, 94, 0.35)',
                  }}
                >
                  {isStarting ? (
                    'Starting...'
                  ) : (
                    <span
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                      })}
                    >
                      <span>Let's Go!</span>
                      <span>→</span>
                    </span>
                  )}
                </button>
              )}
            </div>
            {/* End config-and-action wrapper */}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default StartPracticeModal
