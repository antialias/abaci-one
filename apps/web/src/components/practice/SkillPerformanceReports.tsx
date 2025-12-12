'use client'

import { useEffect, useState } from 'react'
import { css } from '../../../styled-system/css'

interface SkillPerformance {
  skillId: string
  masteryLevel: 'learning' | 'practicing' | 'mastered'
  attempts: number
  accuracy: number
  avgResponseTimeMs: number | null
  responseTimeCount: number
}

interface SkillPerformanceAnalysis {
  skills: SkillPerformance[]
  overallAvgResponseTimeMs: number | null
  fastSkills: SkillPerformance[]
  slowSkills: SkillPerformance[]
  lowAccuracySkills: SkillPerformance[]
  reinforcementSkills: SkillPerformance[]
}

interface SkillPerformanceReportsProps {
  playerId: string
  isDark?: boolean
}

// Format skill ID to human-readable name
function formatSkillName(skillId: string): string {
  // Examples:
  // "basic.directAddition" -> "Direct Addition"
  // "fiveComplements.4=5-1" -> "5s: 4=5-1"
  // "tenComplements.9=10-1" -> "10s: 9=10-1"

  if (skillId.startsWith('basic.')) {
    const skill = skillId.replace('basic.', '')
    if (skill === 'directAddition') return 'Direct Addition'
    if (skill === 'heavenBead') return 'Heaven Bead'
    if (skill === 'simpleCombinations') return 'Simple Combos'
    if (skill === 'directSubtraction') return 'Direct Subtraction'
    if (skill === 'heavenBeadSubtraction') return 'Heaven Bead Sub'
    if (skill === 'simpleCombinationsSub') return 'Simple Combos Sub'
    return skill
  }
  if (skillId.startsWith('fiveComplements.')) {
    return `5s: ${skillId.replace('fiveComplements.', '')}`
  }
  if (skillId.startsWith('tenComplements.')) {
    return `10s: ${skillId.replace('tenComplements.', '')}`
  }
  if (skillId.startsWith('fiveComplementsSub.')) {
    return `5s Sub: ${skillId.replace('fiveComplementsSub.', '')}`
  }
  if (skillId.startsWith('tenComplementsSub.')) {
    return `10s Sub: ${skillId.replace('tenComplementsSub.', '')}`
  }
  return skillId
}

// Format milliseconds to readable duration
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}

// Get mastery level badge style
function getMasteryBadgeStyle(level: string, isDark: boolean) {
  const baseStyle = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
  }

  switch (level) {
    case 'mastered':
      return {
        ...baseStyle,
        backgroundColor: isDark ? 'green.800' : 'green.100',
        color: isDark ? 'green.200' : 'green.800',
      }
    case 'practicing':
      return {
        ...baseStyle,
        backgroundColor: isDark ? 'yellow.800' : 'yellow.100',
        color: isDark ? 'yellow.200' : 'yellow.800',
      }
    default:
      return {
        ...baseStyle,
        backgroundColor: isDark ? 'gray.700' : 'gray.200',
        color: isDark ? 'gray.300' : 'gray.700',
      }
  }
}

function SkillCard({
  skill,
  isDark,
  overallAvgMs,
}: {
  skill: SkillPerformance
  isDark: boolean
  overallAvgMs: number | null
}) {
  const speedIndicator = (() => {
    if (!skill.avgResponseTimeMs || !overallAvgMs) return null
    const ratio = skill.avgResponseTimeMs / overallAvgMs
    if (ratio < 0.7) return { emoji: '🚀', label: 'Fast', color: 'green' }
    if (ratio > 1.3) return { emoji: '🐢', label: 'Slow', color: 'orange' }
    return { emoji: '➡️', label: 'Average', color: 'gray' }
  })()

  return (
    <div
      data-element="skill-card"
      className={css({
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: isDark ? 'gray.800' : 'white',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        })}
      >
        <span className={css({ fontWeight: 'bold', color: isDark ? 'gray.100' : 'gray.900' })}>
          {formatSkillName(skill.skillId)}
        </span>
        <span className={css(getMasteryBadgeStyle(skill.masteryLevel, isDark))}>
          {skill.masteryLevel}
        </span>
      </div>

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          fontSize: '0.875rem',
        })}
      >
        <div>
          <span className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>Accuracy: </span>
          <span
            className={css({
              color:
                skill.accuracy >= 0.7
                  ? isDark
                    ? 'green.400'
                    : 'green.600'
                  : isDark
                    ? 'orange.400'
                    : 'orange.600',
              fontWeight: 'medium',
            })}
          >
            {Math.round(skill.accuracy * 100)}%
          </span>
        </div>
        <div>
          <span className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>Attempts: </span>
          <span className={css({ color: isDark ? 'gray.200' : 'gray.700' })}>{skill.attempts}</span>
        </div>
        {skill.avgResponseTimeMs && (
          <div className={css({ gridColumn: 'span 2' })}>
            <span className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>Avg Time: </span>
            <span className={css({ color: isDark ? 'gray.200' : 'gray.700' })}>
              {formatTime(skill.avgResponseTimeMs)}
            </span>
            {speedIndicator && (
              <span className={css({ marginLeft: '8px' })} title={speedIndicator.label}>
                {speedIndicator.emoji}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function SkillPerformanceReports({
  playerId,
  isDark = false,
}: SkillPerformanceReportsProps) {
  const [analysis, setAnalysis] = useState<SkillPerformanceAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPerformance() {
      try {
        const response = await fetch(`/api/curriculum/${playerId}/skills/performance`)
        if (!response.ok) throw new Error('Failed to fetch')
        const data = await response.json()
        setAnalysis(data.analysis)
      } catch (err) {
        setError('Failed to load performance data')
        console.error('Error fetching skill performance:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPerformance()
  }, [playerId])

  if (loading) {
    return (
      <div
        data-component="skill-performance-reports"
        className={css({
          padding: '24px',
          borderRadius: '12px',
          backgroundColor: isDark ? 'gray.800' : 'white',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <div className={css({ color: isDark ? 'gray.400' : 'gray.500', textAlign: 'center' })}>
          Loading performance data...
        </div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div
        data-component="skill-performance-reports"
        className={css({
          padding: '24px',
          borderRadius: '12px',
          backgroundColor: isDark ? 'gray.800' : 'white',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <div className={css({ color: isDark ? 'red.400' : 'red.600', textAlign: 'center' })}>
          {error || 'No performance data available'}
        </div>
      </div>
    )
  }

  const hasTimingData = analysis.skills.some((s) => s.responseTimeCount > 0)
  const hasSlowSkills = analysis.slowSkills.length > 0
  const hasLowAccuracySkills = analysis.lowAccuracySkills.length > 0
  const hasReinforcementSkills = analysis.reinforcementSkills.length > 0

  // No data yet
  if (analysis.skills.length === 0) {
    return (
      <div
        data-component="skill-performance-reports"
        className={css({
          padding: '24px',
          borderRadius: '12px',
          backgroundColor: isDark ? 'gray.800' : 'white',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <h3
          className={css({
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.900',
            marginBottom: '12px',
          })}
        >
          📊 Skill Performance
        </h3>
        <p className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>
          No practice data yet. Complete some practice sessions to see performance insights.
        </p>
      </div>
    )
  }

  return (
    <div
      data-component="skill-performance-reports"
      className={css({
        padding: '24px',
        borderRadius: '12px',
        backgroundColor: isDark ? 'gray.800' : 'white',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
      })}
    >
      <h3
        className={css({
          fontSize: '1.125rem',
          fontWeight: 'bold',
          color: isDark ? 'gray.100' : 'gray.900',
          marginBottom: '16px',
        })}
      >
        📊 Skill Performance Reports
      </h3>

      {/* Overall Stats */}
      {hasTimingData && analysis.overallAvgResponseTimeMs && (
        <div
          className={css({
            marginBottom: '20px',
            padding: '12px',
            backgroundColor: isDark ? 'gray.700' : 'gray.100',
            borderRadius: '8px',
          })}
        >
          <div className={css({ fontSize: '0.875rem', color: isDark ? 'gray.400' : 'gray.500' })}>
            Average Response Time
          </div>
          <div
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
            })}
          >
            {formatTime(analysis.overallAvgResponseTimeMs)}
          </div>
        </div>
      )}

      {/* Areas Needing Work */}
      {(hasSlowSkills || hasLowAccuracySkills || hasReinforcementSkills) && (
        <div className={css({ marginBottom: '20px' })}>
          <h4
            className={css({
              fontSize: '1rem',
              fontWeight: 'semibold',
              color: isDark ? 'orange.400' : 'orange.600',
              marginBottom: '12px',
            })}
          >
            ⚠️ Areas Needing Work
          </h4>
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
            {analysis.slowSkills.map((skill) => (
              <SkillCard
                key={skill.skillId}
                skill={skill}
                isDark={isDark}
                overallAvgMs={analysis.overallAvgResponseTimeMs}
              />
            ))}
            {analysis.lowAccuracySkills
              .filter((s) => !analysis.slowSkills.some((slow) => slow.skillId === s.skillId))
              .map((skill) => (
                <SkillCard
                  key={skill.skillId}
                  skill={skill}
                  isDark={isDark}
                  overallAvgMs={analysis.overallAvgResponseTimeMs}
                />
              ))}
            {analysis.reinforcementSkills
              .filter(
                (s) =>
                  !analysis.slowSkills.some((slow) => slow.skillId === s.skillId) &&
                  !analysis.lowAccuracySkills.some((low) => low.skillId === s.skillId)
              )
              .map((skill) => (
                <SkillCard
                  key={skill.skillId}
                  skill={skill}
                  isDark={isDark}
                  overallAvgMs={analysis.overallAvgResponseTimeMs}
                />
              ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {analysis.fastSkills.length > 0 && (
        <div className={css({ marginBottom: '20px' })}>
          <h4
            className={css({
              fontSize: '1rem',
              fontWeight: 'semibold',
              color: isDark ? 'green.400' : 'green.600',
              marginBottom: '12px',
            })}
          >
            🌟 Strengths
          </h4>
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
            {analysis.fastSkills.map((skill) => (
              <SkillCard
                key={skill.skillId}
                skill={skill}
                isDark={isDark}
                overallAvgMs={analysis.overallAvgResponseTimeMs}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Skills Summary */}
      <div>
        <h4
          className={css({
            fontSize: '1rem',
            fontWeight: 'semibold',
            color: isDark ? 'gray.300' : 'gray.700',
            marginBottom: '12px',
          })}
        >
          All Skills ({analysis.skills.length})
        </h4>
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '400px',
            overflowY: 'auto',
          })}
        >
          {analysis.skills.map((skill) => (
            <SkillCard
              key={skill.skillId}
              skill={skill}
              isDark={isDark}
              overallAvgMs={analysis.overallAvgResponseTimeMs}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
