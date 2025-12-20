'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { PageWithNav } from '@/components/PageWithNav'
import { StudentFilterBar } from '@/components/practice/StudentFilterBar'
import { StudentSelector, type StudentWithProgress } from '@/components/practice'
import { useTheme } from '@/contexts/ThemeContext'
import { usePlayersWithSkillData, useUpdatePlayer } from '@/hooks/useUserPlayers'
import type { StudentWithSkillData } from '@/utils/studentGrouping'
import { filterStudents, groupStudents } from '@/utils/studentGrouping'
import { css } from '../../../styled-system/css'
import { AddStudentModal } from './AddStudentModal'

interface PracticeClientProps {
  initialPlayers: StudentWithSkillData[]
}

/**
 * Practice page client component
 *
 * Uses React Query with server-prefetched data for immediate rendering.
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

  // Add student modal state
  const [showAddModal, setShowAddModal] = useState(false)

  // Use React Query with initial data from server for instant render + live updates
  const { data: players = initialPlayers } = usePlayersWithSkillData({
    initialData: initialPlayers,
  })

  // Mutation for bulk updates
  const updatePlayer = useUpdatePlayer()

  // Count archived students
  const archivedCount = useMemo(() => players.filter((p) => p.isArchived).length, [players])

  // Filter and group students
  const filteredStudents = useMemo(
    () => filterStudents(players, searchQuery, skillFilters, showArchived),
    [players, searchQuery, skillFilters, showArchived]
  )

  const groupedStudents = useMemo(() => groupStudents(filteredStudents), [filteredStudents])

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

  // Handle bulk archive using React Query mutation
  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return

    // Send requests to archive each selected student using mutations
    const promises = Array.from(selectedIds).map((id) =>
      updatePlayer.mutateAsync({
        id,
        updates: { isArchived: true },
      })
    )

    await Promise.all(promises)

    // Clear selection and exit edit mode
    setSelectedIds(new Set())
    setEditMode(false)
  }, [selectedIds, updatePlayer])

  // Handle edit mode change
  const handleEditModeChange = useCallback((editing: boolean) => {
    setEditMode(editing)
    if (!editing) {
      setSelectedIds(new Set())
    }
  }, [])

  // Handle add student
  const handleAddStudent = useCallback(() => {
    setShowAddModal(true)
  }, [])

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false)
  }, [])

  // Count archived students that match filters but are hidden
  const hiddenArchivedCount = useMemo(() => {
    if (showArchived) return 0
    return filterStudents(players, searchQuery, skillFilters, true).filter((p) => p.isArchived)
      .length
  }, [players, searchQuery, skillFilters, showArchived])

  return (
    <PageWithNav>
      <main
        data-component="practice-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          paddingTop: '160px', // Nav height (80px) + Filter bar height (~80px)
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
          onAddStudent={handleAddStudent}
          selectedCount={selectedIds.size}
          onBulkArchive={handleBulkArchive}
        />

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
              {searchQuery || skillFilters.length > 0 ? (
                'No students match your filters'
              ) : showArchived ? (
                'No archived students'
              ) : (
                <div
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                  })}
                >
                  <span>No students yet.</span>
                  <button
                    type="button"
                    onClick={handleAddStudent}
                    data-action="add-first-student"
                    className={css({
                      padding: '12px 24px',
                      bg: isDark ? 'green.700' : 'green.500',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: 'medium',
                      cursor: 'pointer',
                      _hover: {
                        bg: isDark ? 'green.600' : 'green.600',
                      },
                    })}
                  >
                    + Add Your First Student
                  </button>
                </div>
              )}
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
                  {/* Bucket header - sticky below filter bar */}
                  <h2
                    data-element="bucket-header"
                    className={css({
                      position: 'sticky',
                      top: '160px', // Nav (80px) + Filter bar (~80px)
                      zIndex: Z_INDEX.STICKY_BUCKET_HEADER,
                      fontSize: '0.875rem',
                      fontWeight: 'semibold',
                      color: isDark ? 'gray.400' : 'gray.500',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '12px',
                      paddingTop: '8px',
                      paddingBottom: '8px',
                      borderBottom: '2px solid',
                      borderColor: isDark ? 'gray.700' : 'gray.200',
                      bg: isDark ? 'gray.900' : 'gray.50',
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
                        {/* Category header - sticky below bucket header */}
                        <h3
                          data-element="category-header"
                          className={css({
                            position: 'sticky',
                            top: '195px', // Nav (80px) + Filter bar (~80px) + Bucket header (~35px)
                            zIndex: Z_INDEX.STICKY_CATEGORY_HEADER,
                            fontSize: '0.8125rem',
                            fontWeight: 'medium',
                            color: isDark ? 'gray.500' : 'gray.400',
                            marginBottom: '8px',
                            paddingTop: '4px',
                            paddingBottom: '4px',
                            paddingLeft: '4px',
                            bg: isDark ? 'gray.900' : 'gray.50',
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
                          hideAddButton
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hidden archived students indicator - only shown when filtering */}
          {hiddenArchivedCount > 0 && !showArchived && (searchQuery || skillFilters.length > 0) && (
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              data-element="hidden-archived-indicator"
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '16px',
                marginTop: '16px',
                bg: isDark ? 'gray.800/50' : 'gray.100',
                border: '1px dashed',
                borderColor: isDark ? 'gray.700' : 'gray.300',
                borderRadius: '12px',
                fontSize: '14px',
                color: isDark ? 'gray.400' : 'gray.500',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                _hover: {
                  bg: isDark ? 'gray.800' : 'gray.200',
                  borderColor: isDark ? 'gray.600' : 'gray.400',
                  color: isDark ? 'gray.300' : 'gray.600',
                },
              })}
            >
              <span>👁‍🗨</span>
              <span>
                {hiddenArchivedCount} archived student{hiddenArchivedCount !== 1 ? 's' : ''} not
                shown
              </span>
              <span
                className={css({
                  fontSize: '12px',
                  color: isDark ? 'gray.500' : 'gray.400',
                })}
              >
                — click to show
              </span>
            </button>
          )}
        </div>
      </main>

      {/* Add Student Modal */}
      <AddStudentModal isOpen={showAddModal} onClose={handleCloseAddModal} isDark={isDark} />
    </PageWithNav>
  )
}
