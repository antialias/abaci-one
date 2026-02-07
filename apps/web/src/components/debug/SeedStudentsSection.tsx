'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useBackgroundTask } from '@/hooks/useBackgroundTask'
import type { ProfileInfo } from '@/lib/seed/types'
import { css } from '../../../styled-system/css'

interface ProfileGroup {
  id: string
  label: string
  description: string
  match: (p: ProfileInfo) => boolean
}

const PROFILE_GROUPS: ProfileGroup[] = [
  {
    id: 'mastery',
    label: 'Skill Mastery Levels',
    description: 'Students at different stages — from struggling to ready to advance',
    match: (p) => p.category === 'bkt',
  },
  {
    id: 'session-mode',
    label: 'Session Mode Triggers',
    description: 'Each triggers a specific session mode: remediation, progression, or maintenance',
    match: (p) => p.category === 'session',
  },
  {
    id: 'chart',
    label: 'Progress Chart',
    description: 'Different history sizes to test the skill progress chart rendering',
    match: (p) => p.tags.includes('chart-test'),
  },
  {
    id: 'data-edge',
    label: 'Data Robustness',
    description: 'Empty states, extreme data, stale skills, NaN handling',
    match: (p) => p.category === 'edge' && !p.tags.includes('chart-test'),
  },
]

interface StudentStatus {
  name: string
  status: 'pending' | 'seeding' | 'completed' | 'failed'
  playerId?: string
  classifications?: { weak: number; developing: number; strong: number }
  error?: string
}

export function SeedStudentsSection({ isDark }: { isDark: boolean }) {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set())
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [studentStatuses, setStudentStatuses] = useState<Map<string, StudentStatus>>(new Map())
  const [classroomCode, setClassroomCode] = useState<string | null>(null)

  const { state: taskState } = useBackgroundTask(taskId)

  // Fetch profile list
  useEffect(() => {
    fetch('/api/debug/seed-students')
      .then((r) => r.json())
      .then((data) => {
        setProfiles(data.profiles)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Process task events for per-student status
  useEffect(() => {
    if (!taskState?.events) return

    const newStatuses = new Map<string, StudentStatus>()

    for (const event of taskState.events) {
      const payload = event.payload as Record<string, unknown>

      switch (event.eventType) {
        case 'seed_started': {
          const names = payload.profileNames as string[]
          for (const name of names) {
            newStatuses.set(name, { name, status: 'pending' })
          }
          break
        }
        case 'student_started': {
          const name = payload.name as string
          newStatuses.set(name, { name, status: 'seeding' })
          break
        }
        case 'student_completed': {
          const name = payload.name as string
          newStatuses.set(name, {
            name,
            status: 'completed',
            playerId: payload.playerId as string,
            classifications: payload.classifications as {
              weak: number
              developing: number
              strong: number
            },
          })
          break
        }
        case 'student_failed': {
          const name = payload.name as string
          newStatuses.set(name, {
            name,
            status: 'failed',
            error: payload.error as string,
          })
          break
        }
        case 'seed_complete': {
          setClassroomCode(payload.classroomCode as string)
          break
        }
      }
    }

    if (newStatuses.size > 0) {
      setStudentStatuses(newStatuses)
    }
  }, [taskState?.events])

  const groupedProfiles = PROFILE_GROUPS.map((group) => ({
    ...group,
    profiles: profiles.filter(group.match),
  }))

  const toggleSelect = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const toggleExpand = useCallback((name: string) => {
    setExpandedProfiles((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const toggleGroup = useCallback((groupProfiles: ProfileInfo[]) => {
    setSelected((prev) => {
      const names = groupProfiles.map((p) => p.name)
      const allSelected = names.every((n) => prev.has(n))
      const next = new Set(prev)
      for (const name of names) {
        if (allSelected) next.delete(name)
        else next.add(name)
      }
      return next
    })
  }, [])

  const handleSeed = useCallback(async (profileNames: string[]) => {
    setError(null)
    setStudentStatuses(new Map())
    setClassroomCode(null)

    try {
      const res = await fetch('/api/debug/seed-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles: profileNames }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setTaskId(data.taskId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start seeding')
    }
  }, [])

  const isSeeding = taskState?.status === 'running' || taskState?.status === 'pending'
  const isComplete = taskState?.status === 'completed'
  const isFailed = taskState?.status === 'failed'

  if (loading) {
    return (
      <div
        data-component="seed-students-loading"
        className={css({
          padding: '2rem',
          textAlign: 'center',
          color: isDark ? 'gray.500' : 'gray.400',
        })}
      >
        <Loader2
          size={24}
          className={css({ animation: 'spin 1s linear infinite', display: 'inline-block' })}
        />
      </div>
    )
  }

  return (
    <section data-component="seed-students-section" className={css({ marginTop: '2rem' })}>
      {/* Header */}
      <h2
        className={css({
          fontSize: '1.25rem',
          fontWeight: '600',
          color: isDark ? 'white' : 'gray.800',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        Seed Test Students
      </h2>

      {/* Error banner */}
      {error && (
        <div
          data-element="seed-error"
          className={css({
            padding: '12px 16px',
            backgroundColor: isDark ? 'red.900/30' : 'red.50',
            color: isDark ? 'red.300' : 'red.700',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            border: '1px solid',
            borderColor: isDark ? 'red.800' : 'red.200',
          })}
        >
          {error}
        </div>
      )}

      {/* Grouped profile list */}
      <div data-element="profile-groups" className={css({ marginBottom: '1rem' })}>
        {groupedProfiles.map((group) => {
          const groupNames = group.profiles.map((p) => p.name)
          const allGroupSelected = groupNames.length > 0 && groupNames.every((n) => selected.has(n))
          const someGroupSelected =
            !allGroupSelected && groupNames.some((n) => selected.has(n))

          return (
            <div
              key={group.id}
              data-element={`group-${group.id}`}
              className={css({ marginBottom: '1.25rem' })}
            >
              {/* Group header */}
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '10px',
                  marginBottom: '8px',
                })}
              >
                <label
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: isSeeding ? 'not-allowed' : 'pointer',
                  })}
                >
                  <input
                    type="checkbox"
                    checked={allGroupSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someGroupSelected
                    }}
                    onChange={() => toggleGroup(group.profiles)}
                    disabled={isSeeding}
                    data-action={`toggle-group-${group.id}`}
                    className={css({
                      width: '14px',
                      height: '14px',
                      cursor: isSeeding ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    })}
                  />
                  <span
                    className={css({
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      color: isDark ? 'white' : 'gray.800',
                    })}
                  >
                    {group.label}
                  </span>
                </label>
                <span
                  className={css({
                    fontSize: '0.8rem',
                    color: isDark ? 'gray.500' : 'gray.500',
                  })}
                >
                  {group.description}
                </span>
              </div>

              {/* Group profiles */}
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  paddingLeft: '22px',
                })}
              >
                {group.profiles.map((profile) => {
                  const studentStatus = studentStatuses.get(profile.name)
                  const isExpanded = expandedProfiles.has(profile.name)

                  return (
                    <div
                      key={profile.name}
                      data-element="profile-card"
                      className={css({
                        backgroundColor: isDark ? 'gray.800' : 'white',
                        border: '1px solid',
                        borderColor:
                          studentStatus?.status === 'completed'
                            ? isDark
                              ? 'green.700'
                              : 'green.300'
                            : studentStatus?.status === 'failed'
                              ? isDark
                                ? 'red.700'
                                : 'red.300'
                              : isDark
                                ? 'gray.700'
                                : 'gray.200',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        transition: 'border-color 0.2s',
                      })}
                    >
                      {/* Top row: checkbox, name, status */}
                      <div
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        })}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(profile.name)}
                          onChange={() => toggleSelect(profile.name)}
                          disabled={isSeeding}
                          data-action="toggle-profile"
                          className={css({
                            width: '16px',
                            height: '16px',
                            cursor: isSeeding ? 'not-allowed' : 'pointer',
                            flexShrink: 0,
                          })}
                        />

                        <div className={css({ flex: 1, minWidth: 0 })}>
                          <div
                            className={css({
                              fontWeight: '600',
                              fontSize: '0.9rem',
                              color: isDark ? 'white' : 'gray.800',
                            })}
                          >
                            {profile.name}
                          </div>
                          <div
                            className={css({
                              fontSize: '0.8rem',
                              color: isDark ? 'gray.400' : 'gray.600',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            })}
                          >
                            {profile.description}
                          </div>
                        </div>

                        {/* Status indicator when seeding */}
                        {studentStatus && (
                          <span className={css({ flexShrink: 0, fontSize: '1rem' })}>
                            {studentStatus.status === 'completed'
                              ? '✅'
                              : studentStatus.status === 'failed'
                                ? '❌'
                                : studentStatus.status === 'seeding'
                                  ? '⏳'
                                  : '○'}
                          </span>
                        )}
                      </div>

                      {/* Completed details */}
                      {studentStatus?.status === 'completed' && studentStatus.classifications && (
                        <div
                          className={css({
                            marginTop: '6px',
                            marginLeft: '26px',
                            fontSize: '0.75rem',
                            color: isDark ? 'gray.400' : 'gray.500',
                          })}
                        >
                          🔴 {studentStatus.classifications.weak} weak, 📚{' '}
                          {studentStatus.classifications.developing} dev, ✅{' '}
                          {studentStatus.classifications.strong} strong
                        </div>
                      )}

                      {/* Failed details */}
                      {studentStatus?.status === 'failed' && (
                        <div
                          className={css({
                            marginTop: '6px',
                            marginLeft: '26px',
                            fontSize: '0.75rem',
                            color: isDark ? 'red.400' : 'red.600',
                          })}
                        >
                          {studentStatus.error}
                        </div>
                      )}

                      {/* Expandable details */}
                      <button
                        data-action="toggle-details"
                        onClick={() => toggleExpand(profile.name)}
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '6px',
                          marginLeft: '26px',
                          fontSize: '0.75rem',
                          color: isDark ? 'gray.500' : 'gray.400',
                          cursor: 'pointer',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          _hover: { color: isDark ? 'gray.300' : 'gray.600' },
                        })}
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {isExpanded ? 'Hide details' : 'Show details'}
                      </button>

                      {isExpanded && (
                        <pre
                          className={css({
                            marginTop: '8px',
                            marginLeft: '26px',
                            padding: '10px',
                            backgroundColor: isDark ? 'gray.900' : 'gray.50',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            lineHeight: '1.4',
                            color: isDark ? 'gray.300' : 'gray.700',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: '200px',
                            overflowY: 'auto',
                          })}
                        >
                          {profile.intentionNotes}
                        </pre>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      {!isSeeding && !isComplete && selected.size > 0 && (
        <div data-element="seed-actions">
          <button
            data-action="seed-selected"
            onClick={() => handleSeed(Array.from(selected))}
            className={css({
              padding: '10px 20px',
              backgroundColor: isDark ? 'blue.600' : 'blue.500',
              color: 'white',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
              _hover: { backgroundColor: isDark ? 'blue.500' : 'blue.600' },
            })}
          >
            Seed Selected ({selected.size})
          </button>
        </div>
      )}

      {/* Progress section */}
      {isSeeding && (
        <div
          data-element="seed-progress"
          className={css({
            padding: '12px 16px',
            backgroundColor: isDark ? 'blue.900/20' : 'blue.50',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'blue.800' : 'blue.200',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '6px',
            })}
          >
            <Loader2 size={16} className={css({ animation: 'spin 1s linear infinite' })} />
            <span
              className={css({
                fontWeight: '600',
                fontSize: '0.875rem',
                color: isDark ? 'blue.300' : 'blue.700',
              })}
            >
              Seeding... {taskState?.progress ?? 0}%
            </span>
          </div>
          {taskState?.progressMessage && (
            <div
              className={css({
                fontSize: '0.8rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {taskState.progressMessage}
            </div>
          )}
        </div>
      )}

      {/* Complete summary */}
      {isComplete && (
        <div
          data-element="seed-complete"
          className={css({
            padding: '12px 16px',
            backgroundColor: isDark ? 'green.900/20' : 'green.50',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'green.800' : 'green.200',
          })}
        >
          <div
            className={css({
              fontWeight: '600',
              fontSize: '0.875rem',
              color: isDark ? 'green.300' : 'green.700',
              marginBottom: '4px',
            })}
          >
            Seeding complete!
          </div>
          <div
            className={css({
              fontSize: '0.8rem',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            {classroomCode && `Classroom code: ${classroomCode}`}
          </div>
          <button
            data-action="seed-more"
            onClick={() => {
              setTaskId(null)
              setStudentStatuses(new Map())
              setClassroomCode(null)
              setSelected(new Set())
            }}
            className={css({
              marginTop: '8px',
              padding: '6px 14px',
              backgroundColor: isDark ? 'gray.700' : 'gray.200',
              color: isDark ? 'white' : 'gray.800',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
              _hover: { backgroundColor: isDark ? 'gray.600' : 'gray.300' },
            })}
          >
            Seed More
          </button>
        </div>
      )}

      {/* Failed summary */}
      {isFailed && (
        <div
          data-element="seed-failed"
          className={css({
            padding: '12px 16px',
            backgroundColor: isDark ? 'red.900/20' : 'red.50',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'red.800' : 'red.200',
          })}
        >
          <div
            className={css({
              fontWeight: '600',
              fontSize: '0.875rem',
              color: isDark ? 'red.300' : 'red.700',
            })}
          >
            Seeding failed: {taskState?.error}
          </div>
          <button
            data-action="retry"
            onClick={() => {
              setTaskId(null)
              setStudentStatuses(new Map())
            }}
            className={css({
              marginTop: '8px',
              padding: '6px 14px',
              backgroundColor: isDark ? 'gray.700' : 'gray.200',
              color: isDark ? 'white' : 'gray.800',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
              _hover: { backgroundColor: isDark ? 'gray.600' : 'gray.300' },
            })}
          >
            Try Again
          </button>
        </div>
      )}
    </section>
  )
}
