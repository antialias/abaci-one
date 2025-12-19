'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { PracticeSubNav } from '@/components/practice'
import { useTheme } from '@/contexts/ThemeContext'
import type { Player } from '@/db/schema/players'
import type { SessionPlan } from '@/db/schema/session-plans'
import { DEFAULT_PLAN_CONFIG } from '@/db/schema/session-plans'
import {
  ActiveSessionExistsClientError,
  sessionPlanKeys,
  useApproveSessionPlan,
  useGenerateSessionPlan,
  useStartSessionPlan,
} from '@/hooks/useSessionPlan'
import { css } from '../../../../../styled-system/css'

// Plan configuration constants (from DEFAULT_PLAN_CONFIG)
const PART_TIME_WEIGHTS = DEFAULT_PLAN_CONFIG.partTimeWeights
const PURPOSE_WEIGHTS = {
  focus: DEFAULT_PLAN_CONFIG.focusWeight,
  reinforce: DEFAULT_PLAN_CONFIG.reinforceWeight,
  review: DEFAULT_PLAN_CONFIG.reviewWeight,
  // Note: Challenge slots are calculated as remainder after focus/reinforce/review
  // and use CHALLENGE_RATIO_BY_PART_TYPE in the actual session planner
}

interface ConfigureClientProps {
  studentId: string
  player: Player
  /** If there's an existing draft plan, pass it here */
  existingPlan?: SessionPlan | null
  /** Current phase focus description from curriculum */
  focusDescription: string
  /** Average seconds per problem based on student's history */
  avgSecondsPerProblem: number
  /** List of mastered skill IDs that will be used in problem generation */
  masteredSkillIds: string[]
}

/**
 * Session structure part types with their display info
 */
const PART_INFO = [
  {
    type: 'abacus' as const,
    emoji: '🧮',
    label: 'Use Abacus',
    description: 'Practice with the physical abacus',
  },
  {
    type: 'visualization' as const,
    emoji: '🧠',
    label: 'Visualization',
    description: 'Mental math by picturing beads',
  },
  {
    type: 'linear' as const,
    emoji: '💭',
    label: 'Mental Math',
    description: 'Solve problems in your head',
  },
]

/**
 * Get part type colors (dark mode aware)
 */
function getPartTypeColors(
  type: 'abacus' | 'visualization' | 'linear',
  isDark: boolean
): { bg: string; border: string; text: string } {
  switch (type) {
    case 'abacus':
      return isDark
        ? { bg: 'blue.900', border: 'blue.700', text: 'blue.200' }
        : { bg: 'blue.50', border: 'blue.200', text: 'blue.700' }
    case 'visualization':
      return isDark
        ? { bg: 'purple.900', border: 'purple.700', text: 'purple.200' }
        : { bg: 'purple.50', border: 'purple.200', text: 'purple.700' }
    case 'linear':
      return isDark
        ? { bg: 'orange.900', border: 'orange.700', text: 'orange.200' }
        : { bg: 'orange.50', border: 'orange.200', text: 'orange.700' }
  }
}

/**
 * Skill category display names
 */
const SKILL_CATEGORY_NAMES: Record<string, string> = {
  basic: 'Basic',
  fiveComplements: '5-Complements',
  fiveComplementsSub: '5-Complements (Sub)',
  tenComplements: '10-Complements',
  tenComplementsSub: '10-Complements (Sub)',
  advanced: 'Advanced',
}

/**
 * Group and format skill IDs for display
 */
function groupSkillsByCategory(skillIds: string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>()

  for (const skillId of skillIds) {
    const [category, ...rest] = skillId.split('.')
    const skillName = rest.join('.')

    if (!grouped.has(category)) {
      grouped.set(category, [])
    }
    grouped.get(category)!.push(skillName)
  }

  return grouped
}

/**
 * Enabled parts configuration
 */
type EnabledParts = {
  abacus: boolean
  visualization: boolean
  linear: boolean
}

/**
 * Calculate estimated session breakdown based on duration and enabled parts
 */
function calculateEstimates(
  durationMinutes: number,
  avgSecondsPerProblem: number,
  enabledParts: EnabledParts
) {
  // Filter to only enabled parts and recalculate weights
  const enabledPartTypes = (['abacus', 'visualization', 'linear'] as const).filter(
    (type) => enabledParts[type]
  )

  // If no parts enabled, return zeros
  if (enabledPartTypes.length === 0) {
    return {
      totalProblems: 0,
      parts: [
        {
          type: 'abacus' as const,
          weight: 0,
          minutes: 0,
          problems: 0,
          enabled: false,
        },
        {
          type: 'visualization' as const,
          weight: 0,
          minutes: 0,
          problems: 0,
          enabled: false,
        },
        {
          type: 'linear' as const,
          weight: 0,
          minutes: 0,
          problems: 0,
          enabled: false,
        },
      ],
      purposes: { focus: 0, reinforce: 0, review: 0, challenge: 0 },
    }
  }

  // Calculate total weight of enabled parts
  const totalEnabledWeight = enabledPartTypes.reduce(
    (sum, type) => sum + PART_TIME_WEIGHTS[type],
    0
  )

  const totalProblems = Math.max(3, Math.floor((durationMinutes * 60) / avgSecondsPerProblem))

  // Calculate problems per part based on normalized weights
  const parts = (['abacus', 'visualization', 'linear'] as const).map((type) => {
    const enabled = enabledParts[type]
    if (!enabled) {
      return { type, weight: 0, minutes: 0, problems: 0, enabled: false }
    }
    const normalizedWeight = PART_TIME_WEIGHTS[type] / totalEnabledWeight
    return {
      type,
      weight: normalizedWeight,
      minutes: Math.round(durationMinutes * normalizedWeight),
      problems: Math.max(1, Math.round(totalProblems * normalizedWeight)),
      enabled: true,
    }
  })

  // Recalculate actual total problems from enabled parts
  const actualTotalProblems = parts.reduce((sum, p) => sum + p.problems, 0)

  // Calculate purpose breakdown
  const focusCount = Math.round(actualTotalProblems * PURPOSE_WEIGHTS.focus)
  const reinforceCount = Math.round(actualTotalProblems * PURPOSE_WEIGHTS.reinforce)
  const reviewCount = Math.round(actualTotalProblems * PURPOSE_WEIGHTS.review)
  const challengeCount = Math.max(
    0,
    actualTotalProblems - focusCount - reinforceCount - reviewCount
  )

  return {
    totalProblems: actualTotalProblems,
    parts,
    purposes: {
      focus: focusCount,
      reinforce: reinforceCount,
      review: reviewCount,
      challenge: challengeCount,
    },
  }
}

/**
 * Unified session configuration and preview component
 *
 * Features:
 * - Duration selector that updates preview in real-time
 * - Live preview showing estimated problems, session structure, problem breakdown
 * - Single "Let's Go!" button that generates + approves + starts the session
 * - Handles existing draft plans gracefully
 */
export function ConfigureClient({
  studentId,
  player,
  existingPlan,
  focusDescription,
  avgSecondsPerProblem,
  masteredSkillIds,
}: ConfigureClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Duration state - use existing plan's duration if available
  const [durationMinutes, setDurationMinutes] = useState(existingPlan?.targetDurationMinutes ?? 10)

  // Term count state - max terms per problem for abacus part
  const [abacusMaxTerms, setAbacusMaxTerms] = useState(DEFAULT_PLAN_CONFIG.abacusTermCount.max)

  // Enabled parts state - which session parts to include
  const [enabledParts, setEnabledParts] = useState<EnabledParts>({
    abacus: true,
    visualization: true,
    linear: true,
  })

  // Toggle a part on/off
  const togglePart = useCallback((partType: keyof EnabledParts) => {
    setEnabledParts((prev) => {
      // Don't allow disabling the last enabled part
      const enabledCount = Object.values(prev).filter(Boolean).length
      if (enabledCount === 1 && prev[partType]) {
        return prev
      }
      return { ...prev, [partType]: !prev[partType] }
    })
  }, [])

  // Calculate visualization max terms (75% of abacus)
  const visualizationMaxTerms = Math.max(2, Math.round(abacusMaxTerms * 0.75))

  // Calculate live estimates based on current duration and enabled parts
  const estimates = useMemo(
    () => calculateEstimates(durationMinutes, avgSecondsPerProblem, enabledParts),
    [durationMinutes, avgSecondsPerProblem, enabledParts]
  )

  const generatePlan = useGenerateSessionPlan()
  const approvePlan = useApproveSessionPlan()
  const startPlan = useStartSessionPlan()

  // Combined loading state
  const isStarting = generatePlan.isPending || approvePlan.isPending || startPlan.isPending

  // Error state
  const error =
    (generatePlan.error && !(generatePlan.error instanceof ActiveSessionExistsClientError)) ||
    approvePlan.error ||
    startPlan.error
      ? {
          message: 'Unable to start session',
          suggestion: 'This may be a temporary issue. Try again or refresh the page.',
        }
      : null

  /**
   * Handle "Let's Go!" click - generates, approves, and starts the session in one flow
   */
  const handleStart = useCallback(async () => {
    generatePlan.reset()
    approvePlan.reset()
    startPlan.reset()

    try {
      let plan: SessionPlan

      // If we have an existing draft plan with the same duration, use it
      if (existingPlan && existingPlan.targetDurationMinutes === durationMinutes) {
        plan = existingPlan
      } else {
        // Generate a new plan
        try {
          plan = await generatePlan.mutateAsync({
            playerId: studentId,
            durationMinutes,
            abacusTermCount: { min: 3, max: abacusMaxTerms },
            enabledParts,
          })
        } catch (err) {
          if (err instanceof ActiveSessionExistsClientError) {
            // Use the existing plan
            plan = err.existingPlan
            queryClient.setQueryData(sessionPlanKeys.active(studentId), plan)
          } else {
            throw err
          }
        }
      }

      // Approve the plan
      await approvePlan.mutateAsync({
        playerId: studentId,
        planId: plan.id,
      })

      // Start the plan
      await startPlan.mutateAsync({
        playerId: studentId,
        planId: plan.id,
      })

      // Redirect to practice page (shows first problem)
      router.push(`/practice/${studentId}`, { scroll: false })
    } catch {
      // Errors will show in the error state
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
  ])

  return (
    <PageWithNav>
      {/* Practice Sub-Navigation */}
      <PracticeSubNav student={player} pageContext="configure" />

      <main
        data-component="configure-practice-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          paddingTop: '2rem',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingBottom: '2rem',
        })}
      >
        <div
          className={css({
            maxWidth: '500px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          })}
        >
          {/* Header */}
          <header className={css({ textAlign: 'center' })}>
            <h1
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '0.25rem',
              })}
            >
              Configure Session
            </h1>
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Focus: <strong>{focusDescription}</strong>
            </p>
          </header>

          {/* Main Card - Duration + Preview */}
          <div
            data-section="session-config"
            className={css({
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '16px',
              boxShadow: 'lg',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              overflow: 'hidden',
            })}
          >
            {/* Duration Selector */}
            <div
              className={css({
                padding: '1.25rem',
                borderBottom: '1px solid',
                borderColor: isDark ? 'gray.700' : 'gray.200',
              })}
            >
              <label
                className={css({
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isDark ? 'gray.400' : 'gray.500',
                  marginBottom: '0.75rem',
                })}
              >
                How long today?
              </label>
              <div
                className={css({
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                })}
              >
                {[5, 10, 15, 20, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    data-setting={`duration-${mins}`}
                    onClick={() => setDurationMinutes(mins)}
                    disabled={isStarting}
                    className={css({
                      flex: 1,
                      padding: '0.75rem 0.5rem',
                      fontSize: '1.125rem',
                      fontWeight: 'bold',
                      color: durationMinutes === mins ? 'white' : isDark ? 'gray.300' : 'gray.700',
                      backgroundColor:
                        durationMinutes === mins ? 'blue.500' : isDark ? 'gray.700' : 'gray.100',
                      borderRadius: '10px',
                      border: '2px solid',
                      borderColor: durationMinutes === mins ? 'blue.500' : 'transparent',
                      cursor: isStarting ? 'not-allowed' : 'pointer',
                      opacity: isStarting ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                      _hover: {
                        backgroundColor:
                          durationMinutes === mins ? 'blue.600' : isDark ? 'gray.600' : 'gray.200',
                      },
                    })}
                  >
                    {mins}
                    <span
                      className={css({
                        fontSize: '0.75rem',
                        fontWeight: 'normal',
                      })}
                    >
                      {' '}
                      min
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Terms per Problem Selector */}
            <div
              className={css({
                padding: '1.25rem',
                borderBottom: '1px solid',
                borderColor: isDark ? 'gray.700' : 'gray.200',
              })}
            >
              <label
                className={css({
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isDark ? 'gray.400' : 'gray.500',
                  marginBottom: '0.75rem',
                })}
              >
                Numbers per problem (max)
              </label>
              <div
                className={css({
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                })}
              >
                {[3, 4, 5, 6, 7, 8].map((terms) => (
                  <button
                    key={terms}
                    type="button"
                    data-setting={`terms-${terms}`}
                    onClick={() => setAbacusMaxTerms(terms)}
                    disabled={isStarting}
                    className={css({
                      flex: 1,
                      padding: '0.75rem 0.5rem',
                      fontSize: '1.125rem',
                      fontWeight: 'bold',
                      color: abacusMaxTerms === terms ? 'white' : isDark ? 'gray.300' : 'gray.700',
                      backgroundColor:
                        abacusMaxTerms === terms ? 'blue.500' : isDark ? 'gray.700' : 'gray.100',
                      borderRadius: '10px',
                      border: '2px solid',
                      borderColor: abacusMaxTerms === terms ? 'blue.500' : 'transparent',
                      cursor: isStarting ? 'not-allowed' : 'pointer',
                      opacity: isStarting ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                      _hover: {
                        backgroundColor:
                          abacusMaxTerms === terms ? 'blue.600' : isDark ? 'gray.600' : 'gray.200',
                      },
                    })}
                  >
                    {terms}
                  </button>
                ))}
              </div>
              <div
                className={css({
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: isDark ? 'gray.500' : 'gray.500',
                })}
              >
                🧮 Abacus: up to {abacusMaxTerms} numbers &nbsp;•&nbsp; 🧠 Visualize: up to{' '}
                {visualizationMaxTerms} numbers (75%)
              </div>
            </div>

            {/* Live Preview - Summary */}
            <div
              data-section="session-preview"
              className={css({
                padding: '1.25rem',
              })}
            >
              {/* Problem Count - centered prominently */}
              <div
                className={css({
                  textAlign: 'center',
                  marginBottom: '1.25rem',
                })}
              >
                <div
                  className={css({
                    fontSize: '2.5rem',
                    fontWeight: 'bold',
                    color: isDark ? 'gray.100' : 'gray.800',
                    lineHeight: 1,
                  })}
                >
                  {estimates.totalProblems}
                  <span
                    className={css({
                      fontSize: '1rem',
                      fontWeight: 'normal',
                      color: isDark ? 'gray.400' : 'gray.500',
                      marginLeft: '0.5rem',
                    })}
                  >
                    problems
                  </span>
                </div>
              </div>

              {/* Three-Part Structure */}
              <div className={css({ marginBottom: '1.25rem' })}>
                <h3
                  className={css({
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: isDark ? 'gray.400' : 'gray.500',
                    marginBottom: '0.5rem',
                  })}
                >
                  Session Structure{' '}
                  <span
                    className={css({
                      fontWeight: 'normal',
                      textTransform: 'none',
                    })}
                  >
                    (tap to toggle)
                  </span>
                </h3>
                <div
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  })}
                >
                  {PART_INFO.map((partInfo, index) => {
                    const partEstimate = estimates.parts[index]
                    const isEnabled = enabledParts[partInfo.type]
                    const colors = getPartTypeColors(partInfo.type, isDark)
                    return (
                      <button
                        type="button"
                        key={partInfo.type}
                        data-element="part-preview"
                        data-part={index + 1}
                        data-enabled={isEnabled}
                        onClick={() => togglePart(partInfo.type)}
                        disabled={isStarting}
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.625rem 0.75rem',
                          borderRadius: '10px',
                          backgroundColor: isEnabled ? colors.bg : isDark ? 'gray.800' : 'gray.100',
                          border: '2px solid',
                          borderColor: isEnabled ? colors.border : isDark ? 'gray.700' : 'gray.300',
                          opacity: isEnabled ? 1 : 0.5,
                          cursor: isStarting ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'left',
                          width: '100%',
                          _hover: {
                            borderColor: isEnabled ? colors.text : isDark ? 'gray.500' : 'gray.400',
                          },
                        })}
                      >
                        <span className={css({ fontSize: '1.25rem' })}>{partInfo.emoji}</span>
                        <div className={css({ flex: 1 })}>
                          <div
                            className={css({
                              fontWeight: 'bold',
                              fontSize: '0.875rem',
                              color: isEnabled ? colors.text : isDark ? 'gray.500' : 'gray.400',
                            })}
                          >
                            {partInfo.label}
                          </div>
                          <div
                            className={css({
                              fontSize: '0.6875rem',
                              color: isEnabled
                                ? isDark
                                  ? 'gray.400'
                                  : 'gray.500'
                                : isDark
                                  ? 'gray.600'
                                  : 'gray.400',
                            })}
                          >
                            {partInfo.description}
                          </div>
                        </div>
                        <div
                          className={css({
                            textAlign: 'right',
                            fontSize: '0.75rem',
                            color: isEnabled ? colors.text : isDark ? 'gray.600' : 'gray.400',
                          })}
                        >
                          {isEnabled ? (
                            <>
                              <div className={css({ fontWeight: 'bold' })}>
                                {partEstimate.problems} problems
                              </div>
                              <div>~{partEstimate.minutes} min</div>
                            </>
                          ) : (
                            <div className={css({ fontStyle: 'italic' })}>skipped</div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Problem Type Breakdown */}
              <div>
                <h3
                  className={css({
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: isDark ? 'gray.400' : 'gray.500',
                    marginBottom: '0.5rem',
                  })}
                >
                  Problem Mix
                </h3>
                <div
                  className={css({
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.375rem',
                  })}
                >
                  {/* Focus */}
                  <div
                    data-element="purpose-count"
                    data-purpose="focus"
                    className={css({
                      padding: '0.5rem 0.25rem',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'blue.900' : 'blue.50',
                      textAlign: 'center',
                    })}
                  >
                    <div
                      className={css({
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: isDark ? 'blue.200' : 'blue.700',
                      })}
                    >
                      {estimates.purposes.focus}
                    </div>
                    <div
                      className={css({
                        fontSize: '0.625rem',
                        color: isDark ? 'blue.300' : 'blue.600',
                      })}
                    >
                      Focus
                    </div>
                  </div>

                  {/* Reinforce */}
                  <div
                    data-element="purpose-count"
                    data-purpose="reinforce"
                    className={css({
                      padding: '0.5rem 0.25rem',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'orange.900' : 'orange.50',
                      textAlign: 'center',
                    })}
                  >
                    <div
                      className={css({
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: isDark ? 'orange.200' : 'orange.700',
                      })}
                    >
                      {estimates.purposes.reinforce}
                    </div>
                    <div
                      className={css({
                        fontSize: '0.625rem',
                        color: isDark ? 'orange.300' : 'orange.600',
                      })}
                    >
                      Reinforce
                    </div>
                  </div>

                  {/* Review */}
                  <div
                    data-element="purpose-count"
                    data-purpose="review"
                    className={css({
                      padding: '0.5rem 0.25rem',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'green.900' : 'green.50',
                      textAlign: 'center',
                    })}
                  >
                    <div
                      className={css({
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: isDark ? 'green.200' : 'green.700',
                      })}
                    >
                      {estimates.purposes.review}
                    </div>
                    <div
                      className={css({
                        fontSize: '0.625rem',
                        color: isDark ? 'green.300' : 'green.600',
                      })}
                    >
                      Review
                    </div>
                  </div>

                  {/* Challenge */}
                  <div
                    data-element="purpose-count"
                    data-purpose="challenge"
                    className={css({
                      padding: '0.5rem 0.25rem',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'purple.900' : 'purple.50',
                      textAlign: 'center',
                    })}
                  >
                    <div
                      className={css({
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: isDark ? 'purple.200' : 'purple.700',
                      })}
                    >
                      {estimates.purposes.challenge}
                    </div>
                    <div
                      className={css({
                        fontSize: '0.625rem',
                        color: isDark ? 'purple.300' : 'purple.600',
                      })}
                    >
                      Challenge
                    </div>
                  </div>
                </div>
              </div>

              {/* Mastered Skills Summary (collapsible) */}
              <details
                data-section="skills-summary"
                className={css({
                  marginTop: '1rem',
                  borderTop: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  paddingTop: '1rem',
                })}
              >
                <summary
                  className={css({
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: isDark ? 'gray.400' : 'gray.500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    _hover: { color: isDark ? 'gray.300' : 'gray.600' },
                  })}
                >
                  Mastered Skills ({masteredSkillIds.length})
                </summary>

                <div className={css({ marginTop: '0.75rem' })}>
                  {masteredSkillIds.length === 0 ? (
                    <p
                      className={css({
                        fontSize: '0.875rem',
                        color: isDark ? 'gray.500' : 'gray.400',
                        fontStyle: 'italic',
                      })}
                    >
                      No skills marked as mastered yet. Go to Dashboard to set skills.
                    </p>
                  ) : (
                    <div
                      className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      })}
                    >
                      {Array.from(groupSkillsByCategory(masteredSkillIds)).map(
                        ([category, skills]) => (
                          <div key={category}>
                            <div
                              className={css({
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                color: isDark ? 'gray.300' : 'gray.600',
                                marginBottom: '0.25rem',
                              })}
                            >
                              {SKILL_CATEGORY_NAMES[category] || category}
                            </div>
                            <div
                              className={css({
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.25rem',
                              })}
                            >
                              {skills.map((skill) => (
                                <span
                                  key={skill}
                                  className={css({
                                    fontSize: '0.6875rem',
                                    padding: '0.125rem 0.375rem',
                                    borderRadius: '4px',
                                    backgroundColor: isDark ? 'green.900' : 'green.100',
                                    color: isDark ? 'green.300' : 'green.700',
                                  })}
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div
              data-element="error-banner"
              className={css({
                padding: '1rem',
                backgroundColor: isDark ? 'red.900' : 'red.50',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isDark ? 'red.700' : 'red.200',
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                })}
              >
                <span className={css({ fontSize: '1.25rem' })}>⚠️</span>
                <div>
                  <div
                    className={css({
                      fontWeight: 'bold',
                      color: isDark ? 'red.300' : 'red.700',
                      marginBottom: '0.25rem',
                    })}
                  >
                    {error.message}
                  </div>
                  <div
                    className={css({
                      fontSize: '0.875rem',
                      color: isDark ? 'red.400' : 'red.600',
                    })}
                  >
                    {error.suggestion}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            })}
          >
            <button
              type="button"
              data-action="start-session"
              onClick={handleStart}
              disabled={isStarting}
              className={css({
                padding: '1rem',
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: 'white',
                backgroundColor: isStarting ? 'gray.400' : 'green.500',
                borderRadius: '12px',
                border: 'none',
                cursor: isStarting ? 'not-allowed' : 'pointer',
                boxShadow: isStarting ? 'none' : '0 4px 14px rgba(34, 197, 94, 0.4)',
                transition: 'all 0.2s ease',
                _hover: {
                  backgroundColor: isStarting ? 'gray.400' : 'green.600',
                },
              })}
            >
              {isStarting ? 'Starting...' : "Let's Go!"}
            </button>
          </div>
        </div>
      </main>
    </PageWithNav>
  )
}
