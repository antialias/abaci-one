'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Search, Share2 } from 'lucide-react'
import { FamilyCodeDisplay } from '@/components/family/FamilyCodeDisplay'
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
  seededAt?: Date
}

function ProfileCard({
  profile,
  isDark,
  isSeeding,
  isSelected,
  isExpanded,
  studentStatus,
  similarity,
  onToggleSelect,
  onToggleExpand,
  onShareAccess,
}: {
  profile: ProfileInfo
  isDark: boolean
  isSeeding: boolean
  isSelected: boolean
  isExpanded: boolean
  studentStatus?: StudentStatus
  similarity?: number
  onToggleSelect: (name: string) => void
  onToggleExpand: (name: string) => void
  onShareAccess?: (playerId: string, name: string) => void
}) {
  return (
    <div
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
      {/* Top row: checkbox, name, similarity badge, status */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        })}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(profile.name)}
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

        {/* Similarity score when searching */}
        {similarity !== undefined && (
          <span
            className={css({
              fontSize: '0.7rem',
              fontWeight: '500',
              padding: '2px 6px',
              borderRadius: '4px',
              flexShrink: 0,
              fontFamily: 'monospace',
              backgroundColor: isDark ? 'blue.900/50' : 'blue.50',
              color: isDark ? 'blue.300' : 'blue.600',
            })}
          >
            {Math.round(similarity * 100)}%
          </span>
        )}

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
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          })}
        >
          <div>
            🔴 {studentStatus.classifications.weak} weak, 📚{' '}
            {studentStatus.classifications.developing} dev, ✅{' '}
            {studentStatus.classifications.strong} strong
          </div>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '10px' })}>
            {studentStatus.playerId && (
              <>
                <a
                  href={`/practice/${studentStatus.playerId}/dashboard`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-action="view-dashboard"
                  className={css({
                    color: isDark ? 'blue.400' : 'blue.600',
                    textDecoration: 'underline',
                    _hover: { color: isDark ? 'blue.300' : 'blue.500' },
                  })}
                >
                  View dashboard
                </a>
                <button
                  data-action="share-access"
                  onClick={() => onShareAccess?.(studentStatus.playerId!, profile.name)}
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: isDark ? 'blue.400' : 'blue.600',
                    textDecoration: 'underline',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: 'inherit',
                    _hover: { color: isDark ? 'blue.300' : 'blue.500' },
                  })}
                >
                  <Share2 size={11} />
                  Share
                </button>
              </>
            )}
            {studentStatus.seededAt && (
              <span className={css({ color: isDark ? 'gray.600' : 'gray.400' })}>
                Seeded {studentStatus.seededAt.toLocaleString()}
              </span>
            )}
          </div>
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
        onClick={() => onToggleExpand(profile.name)}
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Map<string, number> | null>(null)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sharePlayer, setSharePlayer] = useState<{ playerId: string; name: string } | null>(null)

  interface TaskOutput {
    seededCount: number
    failedCount: number
    classroomCode: string
    students: Array<{
      name: string
      status: 'completed' | 'failed'
      playerId?: string
      classifications?: { weak: number; developing: number; strong: number }
      error?: string
    }>
  }

  const { state: taskState } = useBackgroundTask<TaskOutput>(taskId)

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
            seededAt: new Date(),
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

  // Populate from task output when events weren't received (fast-completing tasks)
  useEffect(() => {
    if (!taskState?.output) return
    if (studentStatuses.size > 0) return // events already populated statuses

    const output = taskState.output
    setClassroomCode(output.classroomCode)

    const newStatuses = new Map<string, StudentStatus>()
    for (const student of output.students) {
      newStatuses.set(student.name, {
        name: student.name,
        status: student.status === 'completed' ? 'completed' : 'failed',
        playerId: student.playerId,
        classifications: student.classifications,
        error: student.error,
        seededAt: new Date(),
      })
    }
    setStudentStatuses(newStatuses)
  }, [taskState?.output, studentStatuses.size])

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

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)

      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (query.trim().length < 3) {
        setSearchResults(null)
        setSearching(false)
        return
      }

      setSearching(true)
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/debug/seed-students/search?q=${encodeURIComponent(query.trim())}`
          )
          const data = await res.json()
          const map = new Map<string, number>()
          for (const r of data.results ?? []) {
            map.set(r.name, r.similarity)
          }
          setSearchResults(map)
        } catch {
          setSearchResults(null)
        } finally {
          setSearching(false)
        }
      }, 400)
    },
    []
  )

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

      {/* Search input */}
      <div
        data-element="search-bar"
        className={css({
          position: 'relative',
          marginBottom: '1rem',
        })}
      >
        <Search
          size={16}
          className={css({
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: isDark ? 'gray.500' : 'gray.400',
            pointerEvents: 'none',
          })}
        />
        <input
          type="text"
          placeholder="Search profiles... e.g. &quot;struggling student&quot; or &quot;chart with many sessions&quot;"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          disabled={isSeeding}
          data-action="search-profiles"
          className={css({
            width: '100%',
            padding: '8px 12px 8px 36px',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.300',
            backgroundColor: isDark ? 'gray.800' : 'white',
            color: isDark ? 'white' : 'gray.800',
            fontSize: '0.85rem',
            outline: 'none',
            _focus: {
              borderColor: isDark ? 'blue.500' : 'blue.400',
            },
            _placeholder: {
              color: isDark ? 'gray.600' : 'gray.400',
            },
          })}
        />
        {searching && (
          <Loader2
            size={14}
            className={css({
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              animation: 'spin 1s linear infinite',
              color: isDark ? 'gray.500' : 'gray.400',
            })}
          />
        )}
      </div>

      {/* Action bar — sticky above list */}
      {(selected.size > 0 || isComplete || isFailed) && (
        <div
          data-element="seed-actions"
          className={css({
            position: 'sticky',
            top: '73px',
            zIndex: 10,
            backgroundColor: isDark ? 'gray.900' : 'gray.50',
            padding: '8px 0',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          })}
        >
          {isComplete ? (
            <button
              data-action="seed-more"
              onClick={() => {
                setTaskId(null)
                setClassroomCode(null)
              }}
              className={css({
                padding: '10px 20px',
                backgroundColor: isDark ? 'green.700' : 'green.600',
                color: 'white',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer',
                _hover: { backgroundColor: isDark ? 'green.600' : 'green.500' },
              })}
            >
              Seed More
            </button>
          ) : (
            <button
              data-action="seed-selected"
              onClick={() => handleSeed(Array.from(selected))}
              disabled={isSeeding || selected.size === 0}
              className={css({
                padding: '10px 20px',
                backgroundColor:
                  isSeeding || selected.size === 0
                    ? isDark
                      ? 'gray.700'
                      : 'gray.300'
                    : isDark
                      ? 'blue.600'
                      : 'blue.500',
                color: 'white',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.875rem',
                border: 'none',
                cursor: isSeeding || selected.size === 0 ? 'not-allowed' : 'pointer',
                _hover:
                  isSeeding || selected.size === 0
                    ? {}
                    : { backgroundColor: isDark ? 'blue.500' : 'blue.600' },
              })}
            >
              {isSeeding ? 'Seeding...' : `Seed Selected (${selected.size})`}
            </button>
          )}
          {/* Inline progress */}
          {isSeeding && taskState?.progressMessage && (
            <span
              className={css({
                fontSize: '0.8rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {taskState.progressMessage}
            </span>
          )}
          {isComplete && classroomCode && (
            <span
              className={css({
                fontSize: '0.8rem',
                color: isDark ? 'green.400' : 'green.600',
              })}
            >
              Done — classroom code: {classroomCode}
            </span>
          )}
        </div>
      )}

      {/* Profile list — grouped view or search results */}
      <div data-element="profile-list" className={css({ marginBottom: '1rem' })}>
        {searchResults ? (
          /* Search results: flat list ranked by similarity */
          <div
            data-element="search-results"
            className={css({ display: 'flex', flexDirection: 'column', gap: '6px' })}
          >
            {searchResults.size === 0 && !searching && (
              <div
                className={css({
                  padding: '1rem',
                  textAlign: 'center',
                  fontSize: '0.85rem',
                  color: isDark ? 'gray.500' : 'gray.400',
                })}
              >
                No matching profiles found
              </div>
            )}
            {profiles
              .filter((p) => searchResults.has(p.name))
              .sort(
                (a, b) => (searchResults.get(b.name) ?? 0) - (searchResults.get(a.name) ?? 0)
              )
              .map((profile) => (
                <ProfileCard
                  key={profile.name}
                  profile={profile}
                  isDark={isDark}
                  isSeeding={isSeeding}
                  isSelected={selected.has(profile.name)}
                  isExpanded={expandedProfiles.has(profile.name)}
                  studentStatus={studentStatuses.get(profile.name)}
                  similarity={searchResults.get(profile.name)}
                  onToggleSelect={toggleSelect}
                  onToggleExpand={toggleExpand}
                  onShareAccess={(playerId, name) => setSharePlayer({ playerId, name })}
                />
              ))}
          </div>
        ) : (
          /* Grouped view */
          groupedProfiles.map((group) => {
            const groupNames = group.profiles.map((p) => p.name)
            const allGroupSelected =
              groupNames.length > 0 && groupNames.every((n) => selected.has(n))
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
                  {group.profiles.map((profile) => (
                    <ProfileCard
                      key={profile.name}
                      profile={profile}
                      isDark={isDark}
                      isSeeding={isSeeding}
                      isSelected={selected.has(profile.name)}
                      isExpanded={expandedProfiles.has(profile.name)}
                      studentStatus={studentStatuses.get(profile.name)}
                      onToggleSelect={toggleSelect}
                      onToggleExpand={toggleExpand}
                      onShareAccess={(playerId, name) => setSharePlayer({ playerId, name })}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Failed banner */}
      {isFailed && (
        <div
          data-element="seed-failed"
          className={css({
            padding: '12px 16px',
            backgroundColor: isDark ? 'red.900/20' : 'red.50',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'red.800' : 'red.200',
            fontSize: '0.85rem',
            color: isDark ? 'red.300' : 'red.700',
          })}
        >
          Seeding failed: {taskState?.error}
        </div>
      )}

      {/* Family share modal */}
      <FamilyCodeDisplay
        playerId={sharePlayer?.playerId ?? ''}
        playerName={sharePlayer?.name ?? ''}
        isOpen={sharePlayer !== null}
        onClose={() => setSharePlayer(null)}
      />
    </section>
  )
}
