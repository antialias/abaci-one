'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageWithNav } from '@/components/PageWithNav'
import { BktProvider, useBktConfig, useSkillsByClassification } from '@/contexts/BktContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useBktSettings, useUpdateBktSettings } from '@/hooks/useBktSettings'
import { api } from '@/lib/queryClient'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { css } from '../../../../styled-system/css'

interface Student {
  id: string
  name: string
}

interface BktSettingsClientProps {
  students: Student[]
}

/**
 * Fetch problem history for a specific student
 */
async function fetchStudentProblemHistory(studentId: string): Promise<ProblemResultWithContext[]> {
  const res = await api(`curriculum/${studentId}/problem-history`)
  if (!res.ok) return []
  const data = await res.json()
  return data.history ?? []
}

/**
 * Fetch aggregate BKT stats across all students
 */
async function fetchAggregateBktStats(threshold: number): Promise<{
  totalStudents: number
  totalSkills: number
  struggling: number
  learning: number
  mastered: number
}> {
  const res = await api(`settings/bkt/aggregate?threshold=${threshold}`)
  if (!res.ok) {
    return {
      totalStudents: 0,
      totalSkills: 0,
      struggling: 0,
      learning: 0,
      mastered: 0,
    }
  }
  return res.json()
}

export function BktSettingsClient({ students }: BktSettingsClientProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Fetch saved threshold
  const { data: settings, isLoading: isLoadingSettings } = useBktSettings()
  const savedThreshold = settings?.bktConfidenceThreshold ?? 0.3

  // Update mutation
  const updateMutation = useUpdateBktSettings()

  // Local preview threshold
  const [previewThreshold, setPreviewThreshold] = useState<number | null>(null)
  const effectiveThreshold = previewThreshold ?? savedThreshold

  // View mode: aggregate or single student
  const [viewMode, setViewMode] = useState<'aggregate' | 'student'>('aggregate')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)

  // Fetch student problem history when a student is selected
  const { data: studentHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['student-problem-history', selectedStudentId],
    queryFn: () => fetchStudentProblemHistory(selectedStudentId!),
    enabled: viewMode === 'student' && !!selectedStudentId,
    staleTime: 60000,
  })

  // Fetch aggregate stats
  const { data: aggregateStats, isLoading: isLoadingAggregate } = useQuery({
    queryKey: ['aggregate-bkt-stats', effectiveThreshold],
    queryFn: () => fetchAggregateBktStats(effectiveThreshold),
    enabled: viewMode === 'aggregate',
    staleTime: 30000,
  })

  const hasChanges = previewThreshold !== null && previewThreshold !== savedThreshold

  const handleSave = useCallback(() => {
    if (previewThreshold !== null) {
      updateMutation.mutate(previewThreshold, {
        onSuccess: () => {
          setPreviewThreshold(null)
        },
      })
    }
  }, [previewThreshold, updateMutation])

  const handleReset = useCallback(() => {
    setPreviewThreshold(null)
  }, [])

  const handleSliderChange = useCallback((value: number) => {
    setPreviewThreshold(value)
  }, [])

  return (
    <PageWithNav>
      <main
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '2rem',
        })}
      >
        <div className={css({ maxWidth: '800px', margin: '0 auto' })}>
          {/* Header */}
          <header className={css({ marginBottom: '2rem' })}>
            <Link
              href="/practice"
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'blue.400' : 'blue.600',
                textDecoration: 'none',
                _hover: { textDecoration: 'underline' },
                marginBottom: '0.5rem',
                display: 'inline-block',
              })}
            >
              ← Back to Practice
            </Link>
            <h1
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
              })}
            >
              BKT Confidence Threshold
            </h1>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
                marginTop: '0.5rem',
              })}
            >
              Configure how much evidence is required before trusting skill classifications.
            </p>
          </header>

          {/* Settings Card */}
          <div
            className={css({
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              padding: '1.5rem',
              marginBottom: '1.5rem',
            })}
          >
            {/* Slider */}
            <div className={css({ marginBottom: '1.5rem' })}>
              <label className={css({ display: 'block', marginBottom: '0.75rem' })}>
                <span
                  className={css({
                    fontWeight: '600',
                    color: isDark ? 'white' : 'gray.800',
                    display: 'block',
                    marginBottom: '0.25rem',
                  })}
                >
                  Confidence Threshold
                </span>
                <span
                  className={css({
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.400' : 'gray.600',
                  })}
                >
                  Higher values require more practice data before classifying skills.
                </span>
              </label>
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                })}
              >
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={effectiveThreshold}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  disabled={isLoadingSettings}
                  className={css({
                    flex: 1,
                    accentColor: isDark ? 'blue.400' : 'blue.600',
                  })}
                />
                <span
                  className={css({
                    fontWeight: 'bold',
                    fontSize: '1.25rem',
                    color: isDark ? 'white' : 'gray.800',
                    minWidth: '4rem',
                    textAlign: 'right',
                  })}
                >
                  {isLoadingSettings ? '...' : `${(effectiveThreshold * 100).toFixed(0)}%`}
                </span>
              </div>
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: isDark ? 'gray.500' : 'gray.500',
                  marginTop: '0.25rem',
                })}
              >
                <span>Aggressive (10%)</span>
                <span>Conservative (90%)</span>
              </div>
            </div>

            {/* Save/Reset buttons */}
            <div
              className={css({
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
              })}
            >
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges || updateMutation.isPending}
                className={css({
                  padding: '0.5rem 1rem',
                  backgroundColor: hasChanges ? 'blue.500' : isDark ? 'gray.700' : 'gray.300',
                  color: hasChanges ? 'white' : isDark ? 'gray.500' : 'gray.500',
                  borderRadius: '6px',
                  border: 'none',
                  fontWeight: '600',
                  cursor: hasChanges ? 'pointer' : 'not-allowed',
                  _hover: hasChanges ? { backgroundColor: 'blue.600' } : {},
                })}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              {hasChanges && (
                <button
                  type="button"
                  onClick={handleReset}
                  className={css({
                    padding: '0.5rem 1rem',
                    backgroundColor: 'transparent',
                    color: isDark ? 'gray.400' : 'gray.600',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.300',
                    cursor: 'pointer',
                    _hover: { borderColor: isDark ? 'gray.500' : 'gray.400' },
                  })}
                >
                  Reset to {(savedThreshold * 100).toFixed(0)}%
                </button>
              )}
              {hasChanges && (
                <span className={css({ fontSize: '0.875rem', color: 'orange.500' })}>
                  Unsaved changes
                </span>
              )}
            </div>
          </div>

          {/* Preview Section */}
          <div
            className={css({
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              padding: '1.5rem',
            })}
          >
            <h2
              className={css({
                fontWeight: '600',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '1rem',
              })}
            >
              Preview
            </h2>

            {/* View mode toggle */}
            <div
              className={css({
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1rem',
              })}
            >
              <button
                type="button"
                onClick={() => setViewMode('aggregate')}
                className={css({
                  padding: '0.5rem 1rem',
                  backgroundColor:
                    viewMode === 'aggregate' ? 'blue.500' : isDark ? 'gray.700' : 'gray.200',
                  color: viewMode === 'aggregate' ? 'white' : isDark ? 'gray.300' : 'gray.700',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'aggregate' ? '600' : 'normal',
                })}
              >
                All Students
              </button>
              <button
                type="button"
                onClick={() => setViewMode('student')}
                className={css({
                  padding: '0.5rem 1rem',
                  backgroundColor:
                    viewMode === 'student' ? 'blue.500' : isDark ? 'gray.700' : 'gray.200',
                  color: viewMode === 'student' ? 'white' : isDark ? 'gray.300' : 'gray.700',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'student' ? '600' : 'normal',
                })}
              >
                Single Student
              </button>
            </div>

            {/* Student selector (when in student mode) */}
            {viewMode === 'student' && (
              <div className={css({ marginBottom: '1rem' })}>
                <select
                  value={selectedStudentId ?? ''}
                  onChange={(e) => setSelectedStudentId(e.target.value || null)}
                  className={css({
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.300',
                    backgroundColor: isDark ? 'gray.700' : 'white',
                    color: isDark ? 'white' : 'gray.800',
                  })}
                >
                  <option value="">Select a student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Preview content */}
            {viewMode === 'aggregate' ? (
              <AggregatePreview
                stats={aggregateStats}
                isLoading={isLoadingAggregate}
                isDark={isDark}
              />
            ) : selectedStudentId ? (
              <BktProvider problemHistory={studentHistory ?? []}>
                <StudentPreview
                  studentName={students.find((s) => s.id === selectedStudentId)?.name ?? 'Student'}
                  isLoading={isLoadingHistory}
                  isDark={isDark}
                  previewThreshold={effectiveThreshold}
                />
              </BktProvider>
            ) : (
              <p
                className={css({
                  color: isDark ? 'gray.500' : 'gray.500',
                  fontStyle: 'italic',
                })}
              >
                Select a student to preview their skill classifications.
              </p>
            )}
          </div>

          {/* Explanation */}
          <div
            className={css({
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: isDark ? 'gray.800/50' : 'blue.50',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'blue.100',
            })}
          >
            <h3
              className={css({
                fontWeight: '600',
                color: isDark ? 'blue.300' : 'blue.800',
                marginBottom: '0.5rem',
              })}
            >
              How it works
            </h3>
            <ul
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.300' : 'gray.700',
                listStyleType: 'disc',
                paddingLeft: '1.25rem',
                '& li': { marginBottom: '0.25rem' },
              })}
            >
              <li>
                <strong>Confidence</strong> measures how much practice data we have for a skill
              </li>
              <li>
                Skills below the threshold are classified as <strong>"Developing"</strong> (not
                enough data)
              </li>
              <li>
                Skills above the threshold are classified by their P(known) estimate:
                <ul
                  className={css({
                    listStyleType: 'circle',
                    paddingLeft: '1rem',
                    marginTop: '0.25rem',
                  })}
                >
                  <li>Weak: P(known) &lt; 50%</li>
                  <li>Developing: 50% ≤ P(known) &lt; 80%</li>
                  <li>Strong: P(known) ≥ 80%</li>
                </ul>
              </li>
              <li>Lower threshold = more aggressive (classifies skills with less data)</li>
              <li>Higher threshold = more conservative (needs more practice before classifying)</li>
            </ul>
          </div>
        </div>
      </main>
    </PageWithNav>
  )
}

/**
 * Aggregate stats preview
 */
function AggregatePreview({
  stats,
  isLoading,
  isDark,
}: {
  stats?: {
    totalStudents: number
    totalSkills: number
    struggling: number
    learning: number
    mastered: number
  }
  isLoading: boolean
  isDark: boolean
}) {
  if (isLoading) {
    return <p className={css({ color: isDark ? 'gray.500' : 'gray.500' })}>Loading...</p>
  }

  if (!stats || stats.totalStudents === 0) {
    return (
      <p
        className={css({
          color: isDark ? 'gray.500' : 'gray.500',
          fontStyle: 'italic',
        })}
      >
        No students with practice data found.
      </p>
    )
  }

  return (
    <div
      className={css({
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
      })}
    >
      <StatCard label="Total Skills" value={stats.totalSkills} color="blue" isDark={isDark} />
      <StatCard label="Weak" value={stats.struggling} color="red" isDark={isDark} />
      <StatCard label="Developing" value={stats.learning} color="yellow" isDark={isDark} />
      <StatCard label="Strong" value={stats.mastered} color="green" isDark={isDark} />
    </div>
  )
}

/**
 * Single student preview using BKT context
 */
function StudentPreview({
  studentName,
  isLoading,
  isDark,
  previewThreshold,
}: {
  studentName: string
  isLoading: boolean
  isDark: boolean
  previewThreshold: number
}) {
  const { setPreviewThreshold } = useBktConfig()
  const { struggling, learning, mastered, hasData } = useSkillsByClassification()

  // Set preview threshold in context
  useMemo(() => {
    setPreviewThreshold(previewThreshold)
  }, [previewThreshold, setPreviewThreshold])

  if (isLoading) {
    return (
      <p className={css({ color: isDark ? 'gray.500' : 'gray.500' })}>
        Loading {studentName}'s data...
      </p>
    )
  }

  if (!hasData) {
    return (
      <p
        className={css({
          color: isDark ? 'gray.500' : 'gray.500',
          fontStyle: 'italic',
        })}
      >
        {studentName} has no practice data yet.
      </p>
    )
  }

  return (
    <div>
      <p
        className={css({
          marginBottom: '1rem',
          color: isDark ? 'gray.300' : 'gray.700',
        })}
      >
        {studentName}'s skills at {(previewThreshold * 100).toFixed(0)}% confidence:
      </p>
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
        })}
      >
        <StatCard label="Weak" value={struggling.length} color="red" isDark={isDark} />
        <StatCard label="Developing" value={learning.length} color="yellow" isDark={isDark} />
        <StatCard label="Strong" value={mastered.length} color="green" isDark={isDark} />
      </div>

      {/* List struggling skills */}
      {struggling.length > 0 && (
        <div className={css({ marginTop: '1rem' })}>
          <h4
            className={css({
              fontSize: '0.875rem',
              fontWeight: '600',
              color: isDark ? 'red.300' : 'red.700',
              marginBottom: '0.5rem',
            })}
          >
            Weak Skills:
          </h4>
          <ul
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.300' : 'gray.700',
              listStyleType: 'disc',
              paddingLeft: '1.25rem',
            })}
          >
            {struggling.map((skill) => (
              <li key={skill.skillId}>
                {skill.displayName} ({(skill.pKnown * 100).toFixed(0)}% known)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Stat card component
 */
function StatCard({
  label,
  value,
  color,
  isDark,
}: {
  label: string
  value: number
  color: 'blue' | 'red' | 'yellow' | 'green'
  isDark: boolean
}) {
  const colorMap = {
    blue: {
      bg: isDark ? 'blue.900/50' : 'blue.50',
      text: isDark ? 'blue.300' : 'blue.700',
    },
    red: {
      bg: isDark ? 'red.900/50' : 'red.50',
      text: isDark ? 'red.300' : 'red.700',
    },
    yellow: {
      bg: isDark ? 'yellow.900/50' : 'yellow.50',
      text: isDark ? 'yellow.300' : 'yellow.700',
    },
    green: {
      bg: isDark ? 'green.900/50' : 'green.50',
      text: isDark ? 'green.300' : 'green.700',
    },
  }

  return (
    <div
      className={css({
        backgroundColor: colorMap[color].bg,
        borderRadius: '8px',
        padding: '1rem',
        textAlign: 'center',
      })}
    >
      <div
        className={css({
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: colorMap[color].text,
        })}
      >
        {value}
      </div>
      <div
        className={css({
          fontSize: '0.75rem',
          color: isDark ? 'gray.400' : 'gray.600',
        })}
      >
        {label}
      </div>
    </div>
  )
}
