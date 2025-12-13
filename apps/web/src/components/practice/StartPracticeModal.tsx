'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPlan } from '@/db/schema/session-plans'
import { DEFAULT_PLAN_CONFIG } from '@/db/schema/session-plans'
import {
  ActiveSessionExistsClientError,
  NoSkillsEnabledClientError,
  sessionPlanKeys,
  useApproveSessionPlan,
  useGenerateSessionPlan,
  useStartSessionPlan,
} from '@/hooks/useSessionPlan'
import {
  convertSecondsPerProblemToSpt,
  estimateSessionProblemCount,
  TIME_ESTIMATION_DEFAULTS,
} from '@/lib/curriculum/time-estimation'
import { css } from '../../../styled-system/css'

interface StartPracticeModalProps {
  studentId: string
  studentName: string
  focusDescription: string
  /** Seconds per term - the primary time metric from the estimation utility */
  secondsPerTerm?: number
  /** @deprecated Use secondsPerTerm instead. This will be converted automatically. */
  avgSecondsPerProblem?: number
  existingPlan?: SessionPlan | null
  onClose: () => void
  onStarted?: () => void
  open?: boolean
}

type EnabledParts = { abacus: boolean; visualization: boolean; linear: boolean }

const PART_TYPES = [
  { type: 'abacus' as const, emoji: '🧮', label: 'Abacus' },
  { type: 'visualization' as const, emoji: '🧠', label: 'Visualize' },
  { type: 'linear' as const, emoji: '💭', label: 'Mental' },
]

export function StartPracticeModal({
  studentId,
  studentName,
  focusDescription,
  secondsPerTerm: secondsPerTermProp,
  avgSecondsPerProblem,
  existingPlan,
  onClose,
  onStarted,
  open = true,
}: StartPracticeModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

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
  const [abacusMaxTerms, setAbacusMaxTerms] = useState(DEFAULT_PLAN_CONFIG.abacusTermCount.max)

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
    generatePlan,
    approvePlan,
    startPlan,
    queryClient,
    router,
    onStarted,
  ])

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
            maxHeight: 'calc(100vh - 2rem)',
            overflowY: 'auto',
            borderRadius: '20px',
            boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.4)',
            zIndex: 1001,
            outline: 'none',
            '@media (min-width: 480px)': {
              width: 'auto',
              minWidth: '360px',
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
              })}
              aria-label="Close"
            >
              ✕
            </button>
          </Dialog.Close>

          <div className={css({ padding: '1.5rem' })}>
            {/* Header */}
            <div className={css({ textAlign: 'center', marginBottom: '1.25rem' })}>
              <div className={css({ fontSize: '2rem', marginBottom: '0.375rem' })}>🎯</div>
              <Dialog.Title
                className={css({
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  marginBottom: '0.25rem',
                })}
                style={{
                  background: isDark
                    ? 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)'
                    : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Ready to practice?
              </Dialog.Title>
              <Dialog.Description
                className={css({
                  fontSize: '0.875rem',
                  color: isDark ? 'gray.400' : 'gray.500',
                })}
              >
                {focusDescription}
              </Dialog.Description>
            </div>

            {/* Session config card */}
            <div
              className={css({
                borderRadius: '12px',
                marginBottom: '1rem',
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
                className={css({
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                })}
                style={{
                  maxHeight: isExpanded ? '0px' : '80px',
                  opacity: isExpanded ? 0 : 1,
                }}
              >
                <button
                  type="button"
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
                  })}
                >
                  {/* Duration */}
                  <div className={css({ textAlign: 'center' })}>
                    <div
                      className={css({
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: isDark ? 'blue.300' : 'blue.600',
                        lineHeight: 1,
                      })}
                    >
                      {durationMinutes}
                    </div>
                    <div
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
                  <div className={css({ textAlign: 'center' })}>
                    <div
                      className={css({
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: isDark ? 'green.300' : 'green.600',
                        lineHeight: 1,
                      })}
                    >
                      ~{estimatedProblems}
                    </div>
                    <div
                      className={css({
                        fontSize: '0.6875rem',
                        color: isDark ? 'gray.500' : 'gray.500',
                        marginTop: '0.125rem',
                      })}
                    >
                      problems
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

                  {/* Modes with problem counts underneath */}
                  <div
                    className={css({
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    })}
                  >
                    {PART_TYPES.filter((p) => enabledParts[p.type]).map(({ type, emoji }) => (
                      <div
                        key={type}
                        className={css({
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0',
                        })}
                      >
                        <span className={css({ fontSize: '1.25rem', lineHeight: 1 })}>{emoji}</span>
                        <span
                          className={css({
                            fontSize: '0.6875rem',
                            fontWeight: '600',
                            lineHeight: 1,
                            marginTop: '0.125rem',
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
                    className={css({
                      marginLeft: '0.25rem',
                      fontSize: '0.625rem',
                      color: isDark ? 'gray.500' : 'gray.400',
                    })}
                  >
                    ▼
                  </div>
                </button>
              </div>

              {/* Expanded config panel */}
              <div
                className={css({
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                })}
                style={{
                  maxHeight: isExpanded ? '400px' : '0px',
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
                  {/* Duration options */}
                  <div>
                    <div
                      className={css({
                        fontSize: '0.6875rem',
                        fontWeight: '600',
                        color: isDark ? 'gray.500' : 'gray.400',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '0.5rem',
                      })}
                    >
                      Duration
                    </div>
                    <div className={css({ display: 'flex', gap: '0.375rem' })}>
                      {[5, 10, 15, 20].map((min) => {
                        // Estimate problems for this duration using current settings
                        const enabledPartTypes = PART_TYPES.filter((p) => enabledParts[p.type]).map(
                          (p) => p.type
                        )
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
                              className={css({ fontSize: '0.9375rem', fontWeight: '600' })}
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
                              className={css({ fontSize: '0.625rem' })}
                              style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                            >
                              ~{problems}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Modes */}
                  <div>
                    <div
                      className={css({
                        fontSize: '0.6875rem',
                        fontWeight: '600',
                        color: isDark ? 'gray.500' : 'gray.400',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '0.5rem',
                      })}
                    >
                      Practice Modes
                    </div>
                    <div className={css({ display: 'flex', gap: '0.375rem' })}>
                      {PART_TYPES.map(({ type, emoji, label }) => {
                        const isEnabled = enabledParts[type]
                        const problemCount = problemsPerType[type]
                        return (
                          <button
                            key={type}
                            type="button"
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
                                })}
                              >
                                {problemCount}
                              </span>
                            )}
                            {/* Emoji */}
                            <span className={css({ fontSize: '1.5rem', lineHeight: 1 })}>
                              {emoji}
                            </span>
                            <span
                              className={css({ fontSize: '0.6875rem', fontWeight: '500' })}
                              style={{ color: isDark ? '#e2e8f0' : '#334155' }}
                            >
                              {label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Numbers per problem */}
                  <div>
                    <div
                      className={css({
                        fontSize: '0.6875rem',
                        fontWeight: '600',
                        color: isDark ? 'gray.500' : 'gray.400',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '0.5rem',
                      })}
                    >
                      Numbers per problem
                    </div>
                    <div className={css({ display: 'flex', gap: '0.25rem' })}>
                      {[3, 4, 5, 6, 7, 8].map((terms) => {
                        const isSelected = abacusMaxTerms === terms
                        return (
                          <button
                            key={terms}
                            type="button"
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

                  {/* Collapse button */}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className={css({
                      width: '100%',
                      padding: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      color: isDark ? 'gray.500' : 'gray.400',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'color 0.15s ease',
                      _hover: { color: isDark ? 'gray.300' : 'gray.600' },
                    })}
                  >
                    ▲ Done
                  </button>
                </div>
              </div>
            </div>

            {/* Error display */}
            {displayError && (
              <div
                className={css({
                  marginBottom: '1rem',
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
                      className={css({ fontSize: '0.875rem', marginBottom: '0.5rem' })}
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

            {/* Start button */}
            <button
              type="button"
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
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default StartPracticeModal
