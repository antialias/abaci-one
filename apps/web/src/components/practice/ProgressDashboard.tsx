'use client'

import { useTheme } from '@/contexts/ThemeContext'
import type { MasteryLevel } from './styles/practiceTheme'
import { css } from '../../../styled-system/css'
import type { StudentWithProgress } from './StudentSelector'

/**
 * Skill mastery data for display
 */
export interface SkillProgress {
  skillId: string
  skillName: string
  masteryLevel: MasteryLevel
  attempts: number
  correct: number
  consecutiveCorrect: number
  /** Whether this skill needs reinforcement (used heavy help recently) */
  needsReinforcement?: boolean
  /** Last help level used on this skill (0-3) */
  lastHelpLevel?: number
  /** Progress toward clearing reinforcement (0-3) */
  reinforcementStreak?: number
}

/**
 * Current phase information
 */
export interface CurrentPhaseInfo {
  phaseId: string
  levelName: string
  phaseName: string
  description: string
  skillsToMaster: string[]
  masteredSkills: number
  totalSkills: number
}

/**
 * Active session state for unified display
 */
export interface ActiveSessionState {
  /** Session ID */
  id: string
  /** Current status */
  status: 'draft' | 'approved' | 'in_progress'
  /** Problems completed so far */
  completedCount: number
  /** Total problems in session */
  totalCount: number
  /** Whether skills have changed since session was created */
  hasSkillMismatch: boolean
  /** Number of skills added since session creation */
  skillsAdded: number
  /** Number of skills removed since session creation */
  skillsRemoved: number
}

interface ProgressDashboardProps {
  student: StudentWithProgress
  currentPhase: CurrentPhaseInfo
  /** Skills that need extra practice (used heavy help recently) */
  focusAreas?: SkillProgress[]
  /** Active session state (if any) */
  activeSession?: ActiveSessionState | null
  /** Callback when no active session - start new practice */
  onStartPractice: () => void
  /** Callback when active session - resume it */
  onResumePractice?: () => void
  /** Callback to start over (abandon old session, start fresh) */
  onStartOver?: () => void
  /** Loading state for start over action */
  isStartingOver?: boolean
  onViewFullProgress: () => void
  onGenerateWorksheet: () => void
  /** Callback to run placement test */
  onRunPlacementTest?: () => void
  /** Callback to record offline practice */
  onRecordOfflinePractice?: () => void
  /** Callback to clear reinforcement for a skill (teacher only) */
  onClearReinforcement?: (skillId: string) => void
  /** Callback to clear all reinforcement flags (teacher only) */
  onClearAllReinforcement?: () => void
}

/**
 * ProgressDashboard - Student's practice home screen
 *
 * Shows after a student is selected. Displays:
 * - Greeting with avatar
 * - Current curriculum position
 * - Progress visualization
 * - Action buttons (Continue, Worksheet, View Progress)
 */
export function ProgressDashboard({
  student,
  currentPhase,
  focusAreas = [],
  activeSession,
  onStartPractice,
  onResumePractice,
  onStartOver,
  isStartingOver = false,
  onViewFullProgress,
  onGenerateWorksheet,
  onRunPlacementTest,
  onRecordOfflinePractice,
  onClearReinforcement,
  onClearAllReinforcement,
}: ProgressDashboardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const progressPercent =
    currentPhase.totalSkills > 0
      ? Math.round((currentPhase.masteredSkills / currentPhase.totalSkills) * 100)
      : 0

  // Determine if we have an active session
  const hasActiveSession = !!activeSession

  return (
    <div
      data-component="progress-dashboard"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
        padding: '1.5rem',
        maxWidth: '600px',
        margin: '0 auto',
      })}
    >
      {/* Page header */}
      <div
        className={css({
          textAlign: 'center',
          marginBottom: '0.5rem',
        })}
      >
        <h1
          className={css({
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.800',
            marginBottom: '0.25rem',
          })}
        >
          Daily Practice
        </h1>
        <p
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.400' : 'gray.600',
          })}
        >
          Build your soroban skills one step at a time
        </p>
      </div>

      {/* Current level card */}
      <div
        data-section="current-level"
        className={css({
          width: '100%',
          padding: '1.5rem',
          borderRadius: '12px',
          backgroundColor: isDark ? 'gray.800' : 'white',
          boxShadow: 'md',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
          })}
        >
          <div>
            <h2
              className={css({
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.800',
              })}
            >
              {currentPhase.levelName}
            </h2>
            <p
              className={css({
                fontSize: '1rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {currentPhase.phaseName}
            </p>
          </div>
          <span
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: isDark ? 'blue.400' : 'blue.600',
            })}
          >
            {progressPercent}% mastered
          </span>
        </div>

        {/* Progress bar */}
        <div
          className={css({
            width: '100%',
            height: '12px',
            backgroundColor: isDark ? 'gray.700' : 'gray.200',
            borderRadius: '6px',
            overflow: 'hidden',
            marginBottom: '1rem',
          })}
        >
          <div
            className={css({
              height: '100%',
              backgroundColor: isDark ? 'green.400' : 'green.500',
              borderRadius: '6px',
              transition: 'width 0.5s ease',
            })}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          {currentPhase.description}
        </p>

        {/* Skill mismatch warning - inline in level card */}
        {hasActiveSession && activeSession.hasSkillMismatch && (
          <div
            data-element="skill-mismatch-warning"
            className={css({
              marginTop: '1rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: isDark ? 'orange.900/50' : 'orange.50',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: isDark ? 'orange.700' : 'orange.200',
            })}
          >
            <p
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'orange.300' : 'orange.700',
              })}
            >
              Skills changed since session was created
              {activeSession.skillsAdded > 0 && ` (+${activeSession.skillsAdded} new)`}
              {activeSession.skillsRemoved > 0 && ` (-${activeSession.skillsRemoved} removed)`}
            </p>
          </div>
        )}
      </div>

      {/* Primary action - only shown when there's an active session */}
      {hasActiveSession && (
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            width: '100%',
          })}
        >
          {/* Resume button with progress indicator */}
          <button
            type="button"
            data-action="resume-practice"
            onClick={onResumePractice}
            className={css({
              padding: '1rem',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: 'green.500',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              _hover: {
                backgroundColor: 'green.600',
              },
            })}
          >
            Resume Practice →
          </button>
          {/* Session progress info */}
          <p
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.500',
              textAlign: 'center',
            })}
          >
            {activeSession.completedCount} of {activeSession.totalCount} problems done
          </p>
          {/* Secondary session action */}
          <button
            type="button"
            data-action="start-over"
            onClick={onStartOver}
            disabled={isStartingOver}
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.500',
              background: 'none',
              border: 'none',
              cursor: isStartingOver ? 'wait' : 'pointer',
              opacity: isStartingOver ? 0.7 : 1,
              textDecoration: 'underline',
              marginTop: '0.25rem',
              _hover: {
                color: isDark ? 'gray.200' : 'gray.700',
              },
            })}
          >
            {isStartingOver ? 'Starting over...' : 'Start over'}
          </button>
        </div>
      )}

      {/* Secondary action buttons */}
      <div
        className={css({
          display: 'flex',
          gap: '0.75rem',
          width: '100%',
        })}
      >
        <button
          type="button"
          data-action="view-progress"
          onClick={onViewFullProgress}
          className={css({
            flex: 1,
            padding: '0.75rem',
            fontSize: '1rem',
            color: isDark ? 'gray.200' : 'gray.700',
            backgroundColor: isDark ? 'gray.700' : 'gray.100',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            _hover: {
              backgroundColor: isDark ? 'gray.600' : 'gray.200',
            },
          })}
        >
          View Progress
        </button>

        <button
          type="button"
          data-action="generate-worksheet"
          onClick={onGenerateWorksheet}
          className={css({
            flex: 1,
            padding: '0.75rem',
            fontSize: '1rem',
            color: isDark ? 'gray.200' : 'gray.700',
            backgroundColor: isDark ? 'gray.700' : 'gray.100',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            _hover: {
              backgroundColor: isDark ? 'gray.600' : 'gray.200',
            },
          })}
        >
          Worksheet
        </button>
      </div>

      {/* Focus Areas - Skills needing extra practice */}
      {focusAreas.length > 0 && (
        <div
          data-section="focus-areas"
          className={css({
            width: '100%',
            padding: '1rem',
            backgroundColor: isDark ? 'orange.900' : 'orange.50',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: isDark ? 'orange.700' : 'orange.200',
          })}
        >
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            })}
          >
            <h3
              className={css({
                fontSize: '0.875rem',
                fontWeight: 'bold',
                color: isDark ? 'orange.200' : 'orange.700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              })}
            >
              <span>🎯</span>
              Focus Areas
            </h3>
            {onClearAllReinforcement && focusAreas.length > 1 && (
              <button
                type="button"
                data-action="clear-all-reinforcement"
                onClick={onClearAllReinforcement}
                className={css({
                  fontSize: '0.75rem',
                  color: isDark ? 'gray.400' : 'gray.500',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: {
                    color: isDark ? 'gray.200' : 'gray.700',
                    textDecoration: 'underline',
                  },
                })}
              >
                Clear All
              </button>
            )}
          </div>
          <p
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'orange.300' : 'orange.600',
              marginBottom: '0.75rem',
            })}
          >
            These skills need extra practice:
          </p>
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            })}
          >
            {focusAreas.map((skill) => (
              <div
                key={skill.skillId}
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isDark ? 'orange.800' : 'orange.100',
                })}
              >
                <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
                  <span
                    className={css({
                      fontSize: '0.875rem',
                      color: isDark ? 'gray.200' : 'gray.700',
                      fontWeight: 'medium',
                    })}
                  >
                    {skill.skillName}
                  </span>
                  {skill.reinforcementStreak !== undefined && skill.reinforcementStreak > 0 && (
                    <span
                      className={css({
                        fontSize: '0.75rem',
                        color: isDark ? 'green.400' : 'green.600',
                      })}
                      title={`${skill.reinforcementStreak} correct answers toward clearing`}
                    >
                      ({skill.reinforcementStreak}/3)
                    </span>
                  )}
                </div>
                {onClearReinforcement && (
                  <button
                    type="button"
                    data-action="clear-reinforcement"
                    onClick={() => onClearReinforcement(skill.skillId)}
                    className={css({
                      fontSize: '0.75rem',
                      color: isDark ? 'gray.500' : 'gray.400',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      _hover: {
                        color: isDark ? 'gray.300' : 'gray.600',
                      },
                    })}
                    title="Mark as mastered (teacher only)"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onboarding & Assessment Tools */}
      {(onRunPlacementTest || onRecordOfflinePractice) && (
        <div
          data-section="onboarding-tools"
          className={css({
            width: '100%',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <h3
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'semibold',
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '0.75rem',
            })}
          >
            Assessment & Sync
          </h3>
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
            })}
          >
            {onRunPlacementTest && (
              <button
                type="button"
                data-action="run-placement-test"
                onClick={onRunPlacementTest}
                className={css({
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  color: isDark ? 'blue.300' : 'blue.700',
                  backgroundColor: isDark ? 'blue.900' : 'blue.50',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isDark ? 'blue.700' : 'blue.200',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  _hover: {
                    backgroundColor: isDark ? 'blue.800' : 'blue.100',
                    borderColor: isDark ? 'blue.600' : 'blue.300',
                  },
                })}
              >
                Placement Test
              </button>
            )}
            {onRecordOfflinePractice && (
              <button
                type="button"
                data-action="record-offline-practice"
                onClick={onRecordOfflinePractice}
                className={css({
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  color: isDark ? 'green.300' : 'green.700',
                  backgroundColor: isDark ? 'green.900' : 'green.50',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isDark ? 'green.700' : 'green.200',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  _hover: {
                    backgroundColor: isDark ? 'green.800' : 'green.100',
                    borderColor: isDark ? 'green.600' : 'green.300',
                  },
                })}
              >
                Record Offline Practice
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProgressDashboard
