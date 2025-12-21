'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'
import type { StudentWithProgress } from './StudentSelector'

/** BKT-based mastery classification */
export type BktClassification = 'strong' | 'developing' | 'weak' | null

/**
 * Skill mastery data for display
 */
export interface SkillProgress {
  skillId: string
  skillName: string
  /** BKT-based mastery classification */
  bktClassification: BktClassification
  attempts: number
  correct: number
  consecutiveCorrect: number
  /** Whether help was used when this skill was last practiced */
  lastHadHelp?: boolean
}

/**
 * Current phase information
 * @deprecated Use SkillHealthSummary instead - this is legacy level/phase based
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
 * BKT-based skill health summary for dashboard display
 */
export interface SkillHealthSummary {
  /** Session mode type for visual treatment */
  mode: 'remediation' | 'progression' | 'maintenance'

  /** Skill counts by BKT classification */
  counts: {
    strong: number // pKnown >= 0.8
    developing: number // 0.5 <= pKnown < 0.8
    weak: number // pKnown < 0.5
    total: number
  }

  /** Mode-specific context */
  context: {
    /** Primary message (e.g., "Focus: Addition +4") */
    headline: string
    /** Secondary detail (e.g., "2 skills need more practice") */
    detail: string
  }

  /** For remediation: weakest skill info */
  weakestSkill?: { displayName: string; pKnown: number }

  /** For progression: next skill to learn */
  nextSkill?: { displayName: string; tutorialRequired: boolean }
}

interface ProgressDashboardProps {
  student: StudentWithProgress
  /** @deprecated Use skillHealth instead */
  currentPhase?: CurrentPhaseInfo
  /** BKT-based skill health summary */
  skillHealth?: SkillHealthSummary
  /** Callback when no active session - start new practice */
  onStartPractice: () => void
}

// Helper: Compute progress percent based on mode
function computeProgressPercent(health: SkillHealthSummary): number {
  switch (health.mode) {
    case 'remediation':
      // Progress toward exiting remediation (weakest skill reaching 0.5)
      if (health.weakestSkill) {
        return Math.min(100, Math.round((health.weakestSkill.pKnown / 0.5) * 100))
      }
      return 0
    case 'progression':
      // Just starting a new skill
      return 0
    case 'maintenance':
      // Strong skills / total
      if (health.counts.total > 0) {
        return Math.round((health.counts.strong / health.counts.total) * 100)
      }
      return 100
  }
}

// Helper: Get mode-specific colors
function getModeColors(
  mode: SkillHealthSummary['mode'],
  isDark: boolean
): { accent: string; bg: string; border: string; progressBar: string } {
  switch (mode) {
    case 'remediation':
      return {
        accent: isDark ? 'orange.400' : 'orange.600',
        bg: isDark ? 'gray.800' : 'white',
        border: isDark ? 'orange.700' : 'orange.200',
        progressBar: isDark ? 'orange.400' : 'orange.500',
      }
    case 'progression':
      return {
        accent: isDark ? 'blue.400' : 'blue.600',
        bg: isDark ? 'gray.800' : 'white',
        border: isDark ? 'blue.700' : 'blue.200',
        progressBar: isDark ? 'blue.400' : 'blue.500',
      }
    case 'maintenance':
      return {
        accent: isDark ? 'green.400' : 'green.600',
        bg: isDark ? 'gray.800' : 'white',
        border: isDark ? 'green.700' : 'green.200',
        progressBar: isDark ? 'green.400' : 'green.500',
      }
  }
}

/**
 * ProgressDashboard - Student's practice home screen
 *
 * Shows after a student is selected. Displays:
 * - Greeting with avatar
 * - Current curriculum position
 * - Progress visualization
 * - Action button (Continue Practice)
 */
export function ProgressDashboard({
  student,
  currentPhase,
  skillHealth,
  onStartPractice,
}: ProgressDashboardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Compute progress percent based on mode
  const progressPercent = skillHealth
    ? computeProgressPercent(skillHealth)
    : currentPhase?.totalSkills && currentPhase.totalSkills > 0
      ? Math.round((currentPhase.masteredSkills / currentPhase.totalSkills) * 100)
      : 0

  // Mode-specific styling
  const modeColors = skillHealth
    ? getModeColors(skillHealth.mode, isDark)
    : {
        accent: isDark ? 'blue.400' : 'blue.600',
        bg: isDark ? 'gray.800' : 'white',
        border: isDark ? 'gray.700' : 'gray.200',
        progressBar: isDark ? 'green.400' : 'green.500',
      }

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

      {/* Current level card - BKT-based when skillHealth available */}
      <div
        data-section="current-level"
        data-mode={skillHealth?.mode}
        className={css({
          width: '100%',
          padding: '1.5rem',
          borderRadius: '12px',
          backgroundColor: modeColors.bg,
          boxShadow: 'md',
          border: '2px solid',
          borderColor: modeColors.border,
        })}
      >
        {skillHealth ? (
          <>
            {/* BKT-based header */}
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
                  {skillHealth.context.headline}
                </h2>
                <p
                  className={css({
                    fontSize: '1rem',
                    color: isDark ? 'gray.400' : 'gray.600',
                  })}
                >
                  {skillHealth.context.detail}
                </p>
              </div>
            </div>

            {/* Skill counts badges */}
            <div
              className={css({
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '1rem',
                flexWrap: 'wrap',
              })}
            >
              {skillHealth.counts.strong > 0 && (
                <span
                  data-skill-status="strong"
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.8125rem',
                    fontWeight: '500',
                    color: isDark ? 'green.300' : 'green.700',
                    backgroundColor: isDark ? 'green.900' : 'green.100',
                    padding: '0.25rem 0.625rem',
                    borderRadius: '9999px',
                  })}
                >
                  ✓ {skillHealth.counts.strong} Strong
                </span>
              )}
              {skillHealth.counts.developing > 0 && (
                <span
                  data-skill-status="developing"
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.8125rem',
                    fontWeight: '500',
                    color: isDark ? 'blue.300' : 'blue.700',
                    backgroundColor: isDark ? 'blue.900' : 'blue.100',
                    padding: '0.25rem 0.625rem',
                    borderRadius: '9999px',
                  })}
                >
                  📚 {skillHealth.counts.developing} Developing
                </span>
              )}
              {skillHealth.counts.weak > 0 && (
                <span
                  data-skill-status="weak"
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.8125rem',
                    fontWeight: '500',
                    color: isDark ? 'orange.300' : 'orange.700',
                    backgroundColor: isDark ? 'orange.900' : 'orange.100',
                    padding: '0.25rem 0.625rem',
                    borderRadius: '9999px',
                  })}
                >
                  ⚠ {skillHealth.counts.weak} Weak
                </span>
              )}
            </div>

            {/* Progress bar (mode-specific) */}
            <div
              className={css({
                width: '100%',
                height: '12px',
                backgroundColor: isDark ? 'gray.700' : 'gray.200',
                borderRadius: '6px',
                overflow: 'hidden',
              })}
            >
              <div
                className={css({
                  height: '100%',
                  backgroundColor: modeColors.progressBar,
                  borderRadius: '6px',
                  transition: 'width 0.5s ease',
                })}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        ) : currentPhase ? (
          <>
            {/* Legacy phase-based display (fallback) */}
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
          </>
        ) : (
          <p className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>
            No skill data available
          </p>
        )}
      </div>
    </div>
  )
}

export default ProgressDashboard
