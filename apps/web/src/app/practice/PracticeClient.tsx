'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { StudentFilterBar } from '@/components/practice/StudentFilterBar'
import { StudentSelector, type StudentWithProgress } from '@/components/practice'
import { useTheme } from '@/contexts/ThemeContext'
import type { StudentWithSkillData } from '@/utils/studentGrouping'
import { filterStudents, groupStudents } from '@/utils/studentGrouping'
import { css } from '../../../styled-system/css'

interface PracticeClientProps {
  initialPlayers: StudentWithSkillData[]
}

/**
 * Practice page client component
 *
 * Receives prefetched player data with skill information from the server component.
 * Manages filter state (search, skills, archived, edit mode) and passes
 * grouped/filtered students to StudentSelector.
 */
export function PracticeClient({ initialPlayers }: PracticeClientProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [skillFilters, setSkillFilters] = useState<string[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Use initial data from server (local state for optimistic updates)
  const [players, setPlayers] = useState(initialPlayers)

  // Count archived students
  const archivedCount = useMemo(() => players.filter((p) => p.isArchived).length, [players])

  // Filter and group students
  const filteredStudents = useMemo(
    () => filterStudents(players, searchQuery, skillFilters, showArchived),
    [players, searchQuery, skillFilters, showArchived]
  )

  const groupedStudents = useMemo(() => groupStudents(filteredStudents), [filteredStudents])

  // Convert to StudentWithProgress format for StudentSelector
  // (maintaining backwards compatibility)
  const students: StudentWithProgress[] = useMemo(
    () =>
      filteredStudents.map((player) => ({
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        color: player.color,
        createdAt: player.createdAt,
        notes: player.notes,
        isArchived: player.isArchived,
        // Pass through skill data for grouping display
        practicingSkills: player.practicingSkills,
        lastPracticedAt: player.lastPracticedAt,
        skillCategory: player.skillCategory,
      })),
    [filteredStudents]
  )

  // Handle student selection - navigate to student's resume page
  const handleSelectStudent = useCallback(
    (student: StudentWithProgress) => {
      if (editMode) {
        // In edit mode, toggle selection instead of navigating
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(student.id)) {
            next.delete(student.id)
          } else {
            next.add(student.id)
          }
          return next
        })
      } else {
        router.push(`/practice/${student.id}/resume`, { scroll: false })
      }
    },
    [router, editMode]
  )

  // Handle bulk archive
  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return

    // Optimistically update local state
    setPlayers((prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, isArchived: true } : p)))

    // Send requests to archive each selected student
    const promises = Array.from(selectedIds).map((id) =>
      fetch(`/api/players/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      })
    )

    await Promise.all(promises)

    // Clear selection and exit edit mode
    setSelectedIds(new Set())
    setEditMode(false)
  }, [selectedIds])

  // Handle edit mode change
  const handleEditModeChange = useCallback((editing: boolean) => {
    setEditMode(editing)
    if (!editing) {
      setSelectedIds(new Set())
    }
  }, [])

  return (
    <PageWithNav>
      <main
        data-component="practice-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          paddingTop: '80px', // Nav height
        })}
      >
        {/* Filter Bar */}
        <StudentFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          skillFilters={skillFilters}
          onSkillFiltersChange={setSkillFilters}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          editMode={editMode}
          onEditModeChange={handleEditModeChange}
          archivedCount={archivedCount}
        />

        {/* Edit mode bulk actions */}
        {editMode && selectedIds.size > 0 && (
          <div
            data-element="bulk-actions"
            className={css({
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              padding: '12px 16px',
              bg: isDark ? 'amber.900/50' : 'amber.50',
              borderBottom: '1px solid',
              borderColor: isDark ? 'amber.800' : 'amber.200',
            })}
          >
            <span
              className={css({
                fontSize: '14px',
                color: isDark ? 'amber.200' : 'amber.700',
              })}
            >
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={handleBulkArchive}
              data-action="bulk-archive"
              className={css({
                padding: '6px 12px',
                bg: isDark ? 'red.900' : 'red.100',
                color: isDark ? 'red.200' : 'red.700',
                border: '1px solid',
                borderColor: isDark ? 'red.700' : 'red.300',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                _hover: {
                  bg: isDark ? 'red.800' : 'red.200',
                },
              })}
            >
              Archive Selected
            </button>
          </div>
        )}

        <div
          className={css({
            maxWidth: '1000px',
            margin: '0 auto',
            padding: '2rem',
          })}
        >
          {/* Header */}
          <header
            className={css({
              textAlign: 'center',
              marginBottom: '2rem',
            })}
          >
            <h1
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '0.5rem',
              })}
            >
              Daily Practice
            </h1>
            <p
              className={css({
                fontSize: '1rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Build your soroban skills one step at a time
            </p>
          </header>

          {/* Grouped Student List */}
          {groupedStudents.length === 0 ? (
            <div
              className={css({
                textAlign: 'center',
                padding: '3rem',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              {searchQuery || skillFilters.length > 0
                ? 'No students match your filters'
                : showArchived
                  ? 'No archived students'
                  : 'No students yet. Add students from the Manage Students page.'}
            </div>
          ) : (
            <div
              data-component="grouped-students"
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              })}
            >
              {groupedStudents.map((bucket) => (
                <div key={bucket.bucket} data-bucket={bucket.bucket}>
                  {/* Bucket header */}
                  <h2
                    className={css({
                      fontSize: '0.875rem',
                      fontWeight: 'semibold',
                      color: isDark ? 'gray.400' : 'gray.500',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '12px',
                      paddingBottom: '8px',
                      borderBottom: '2px solid',
                      borderColor: isDark ? 'gray.700' : 'gray.200',
                    })}
                  >
                    {bucket.bucketName}
                  </h2>

                  {/* Categories within bucket */}
                  <div
                    className={css({
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                    })}
                  >
                    {bucket.categories.map((category) => (
                      <div
                        key={category.category ?? 'null'}
                        data-category={category.category ?? 'new'}
                      >
                        {/* Category header */}
                        <h3
                          className={css({
                            fontSize: '0.8125rem',
                            fontWeight: 'medium',
                            color: isDark ? 'gray.500' : 'gray.400',
                            marginBottom: '8px',
                            paddingLeft: '4px',
                          })}
                        >
                          {category.categoryName}
                        </h3>

                        {/* Student cards */}
                        <StudentSelector
                          students={category.students as StudentWithProgress[]}
                          onSelectStudent={handleSelectStudent}
                          title=""
                          editMode={editMode}
                          selectedIds={selectedIds}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </PageWithNav>
  )
}
