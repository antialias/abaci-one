'use client'

import { useTheme } from '@/contexts/ThemeContext'
import type { MasteryLevel } from '@/db/schema/player-skill-mastery'
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

interface ProgressDashboardProps {
  student: StudentWithProgress
  currentPhase: CurrentPhaseInfo
  recentSkills?: SkillProgress[]
  /** Skills that need extra practice (used heavy help recently) */
  focusAreas?: SkillProgress[]
  onContinuePractice: () => void
  onViewFullProgress: () => void
  onGenerateWorksheet: () => void
  onChangeStudent: () => void
  /** Callback to run placement test */
  onRunPlacementTest?: () => void
  /** Callback to manually set skills */
  onSetSkillsManually?: () => void
  /** Callback to record offline practice */
  onRecordOfflinePractice?: () => void
  /** Callback to clear reinforcement for a skill (teacher only) */
  onClearReinforcement?: (skillId: string) => void
  /** Callback to clear all reinforcement flags (teacher only) */
  onClearAllReinforcement?: () => void
}

/**
 * Mastery level badge colors (dark mode aware)
 */
function getMasteryColor(level: MasteryLevel, isDark: boolean): { bg: string; text: string } {
  switch (level) {
    case 'mastered':
      return isDark
        ? { bg: 'green.900', text: 'green.200' }
        : { bg: 'green.100', text: 'green.700' }
    case 'practicing':
      return isDark
        ? { bg: 'yellow.900', text: 'yellow.200' }
        : { bg: 'yellow.100', text: 'yellow.700' }
    default:
      // 'learning' and any unknown values use gray
      return isDark ? { bg: 'gray.700', text: 'gray.300' } : { bg: 'gray.100', text: 'gray.600' }
  }
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
  recentSkills = [],
  focusAreas = [],
  onContinuePractice,
  onViewFullProgress,
  onGenerateWorksheet,
  onChangeStudent,
  onRunPlacementTest,
  onSetSkillsManually,
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

  return (
    <div
      data-component="progress-dashboard"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
        padding: '2rem',
        maxWidth: '600px',
        margin: '0 auto',
      })}
    >
      {/* Header with greeting */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        })}
      >
        <div
          className={css({
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem',
          })}
          style={{ backgroundColor: student.color }}
        >
          {student.emoji}
        </div>
        <div>
          <h1
            className={css({
              fontSize: '1.75rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
            })}
          >
            Hi {student.name}!
          </h1>
          <button
            type="button"
            onClick={onChangeStudent}
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'blue.400' : 'blue.500',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              _hover: {
                textDecoration: 'underline',
              },
            })}
          >
            Not {student.name}? Switch student
          </button>
        </div>
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
      </div>

      {/* Action buttons */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          width: '100%',
        })}
      >
        <button
          type="button"
          data-action="continue-practice"
          onClick={onContinuePractice}
          className={css({
            padding: '1rem',
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: 'blue.500',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            _hover: {
              backgroundColor: 'blue.600',
            },
          })}
        >
          Continue Practice →
        </button>

        <div
          className={css({
            display: 'flex',
            gap: '0.75rem',
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
      {(onRunPlacementTest || onSetSkillsManually || onRecordOfflinePractice) && (
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
            {onSetSkillsManually && (
              <button
                type="button"
                data-action="set-skills-manually"
                onClick={onSetSkillsManually}
                className={css({
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  color: isDark ? 'purple.300' : 'purple.700',
                  backgroundColor: isDark ? 'purple.900' : 'purple.50',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isDark ? 'purple.700' : 'purple.200',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  _hover: {
                    backgroundColor: isDark ? 'purple.800' : 'purple.100',
                    borderColor: isDark ? 'purple.600' : 'purple.300',
                  },
                })}
              >
                Set Skills Manually
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

      {/* Recent skills (if available) */}
      {recentSkills.length > 0 && (
        <div
          data-section="recent-skills"
          className={css({
            width: '100%',
          })}
        >
          <h3
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.300' : 'gray.700',
              marginBottom: '0.75rem',
            })}
          >
            Recent Skills
          </h3>
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
            })}
          >
            {recentSkills.map((skill) => {
              const colors = getMasteryColor(skill.masteryLevel, isDark)
              return (
                <span
                  key={skill.skillId}
                  className={css({
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  })}
                  style={{
                    backgroundColor: `var(--colors-${colors.bg.replace('.', '-')})`,
                    color: `var(--colors-${colors.text.replace('.', '-')})`,
                  }}
                  title={`${skill.correct}/${skill.attempts} correct, ${skill.consecutiveCorrect} in a row${skill.needsReinforcement ? ' (needs practice)' : ''}`}
                >
                  {skill.needsReinforcement && <span title="Needs practice">⚠️</span>}
                  {skill.skillName}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProgressDashboard
