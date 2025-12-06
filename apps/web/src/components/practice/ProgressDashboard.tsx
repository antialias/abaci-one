'use client'

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
}

/**
 * Mastery level badge colors
 */
function getMasteryColor(level: MasteryLevel): { bg: string; text: string } {
  switch (level) {
    case 'mastered':
      return { bg: 'green.100', text: 'green.700' }
    case 'practicing':
      return { bg: 'yellow.100', text: 'yellow.700' }
    default:
      // 'learning' and any unknown values use gray
      return { bg: 'gray.100', text: 'gray.600' }
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
  onContinuePractice,
  onViewFullProgress,
  onGenerateWorksheet,
  onChangeStudent,
  onRunPlacementTest,
  onSetSkillsManually,
  onRecordOfflinePractice,
}: ProgressDashboardProps) {
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
              color: 'gray.800',
            })}
          >
            Hi {student.name}!
          </h1>
          <button
            type="button"
            onClick={onChangeStudent}
            className={css({
              fontSize: '0.875rem',
              color: 'blue.500',
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
          backgroundColor: 'white',
          boxShadow: 'md',
          border: '1px solid',
          borderColor: 'gray.200',
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
                color: 'gray.800',
              })}
            >
              {currentPhase.levelName}
            </h2>
            <p
              className={css({
                fontSize: '1rem',
                color: 'gray.600',
              })}
            >
              {currentPhase.phaseName}
            </p>
          </div>
          <span
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: 'blue.600',
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
            backgroundColor: 'gray.200',
            borderRadius: '6px',
            overflow: 'hidden',
            marginBottom: '1rem',
          })}
        >
          <div
            className={css({
              height: '100%',
              backgroundColor: 'green.500',
              borderRadius: '6px',
              transition: 'width 0.5s ease',
            })}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p
          className={css({
            fontSize: '0.875rem',
            color: 'gray.500',
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
              color: 'gray.700',
              backgroundColor: 'gray.100',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              _hover: {
                backgroundColor: 'gray.200',
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
              color: 'gray.700',
              backgroundColor: 'gray.100',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              _hover: {
                backgroundColor: 'gray.200',
              },
            })}
          >
            Worksheet
          </button>
        </div>
      </div>

      {/* Onboarding & Assessment Tools */}
      {(onRunPlacementTest || onSetSkillsManually || onRecordOfflinePractice) && (
        <div
          data-section="onboarding-tools"
          className={css({
            width: '100%',
            padding: '1rem',
            backgroundColor: 'gray.50',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'gray.200',
          })}
        >
          <h3
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'semibold',
              color: 'gray.600',
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
                  color: 'blue.700',
                  backgroundColor: 'blue.50',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: 'blue.200',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  _hover: {
                    backgroundColor: 'blue.100',
                    borderColor: 'blue.300',
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
                  color: 'purple.700',
                  backgroundColor: 'purple.50',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: 'purple.200',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  _hover: {
                    backgroundColor: 'purple.100',
                    borderColor: 'purple.300',
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
                  color: 'green.700',
                  backgroundColor: 'green.50',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: 'green.200',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  _hover: {
                    backgroundColor: 'green.100',
                    borderColor: 'green.300',
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
              color: 'gray.700',
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
              const colors = getMasteryColor(skill.masteryLevel)
              return (
                <span
                  key={skill.skillId}
                  className={css({
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                  })}
                  style={{
                    backgroundColor: `var(--colors-${colors.bg.replace('.', '-')})`,
                    color: `var(--colors-${colors.text.replace('.', '-')})`,
                  }}
                  title={`${skill.correct}/${skill.attempts} correct, ${skill.consecutiveCorrect} in a row`}
                >
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
