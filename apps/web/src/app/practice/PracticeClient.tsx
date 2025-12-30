'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useToast } from '@/components/common/ToastContext'
import {
  AddStudentByFamilyCodeModal,
  AddStudentToClassroomContent,
  AddStudentToClassroomModal,
  CreateClassroomForm,
  PendingApprovalsSection,
  SessionObserverModal,
  TeacherEnrollmentSection,
} from '@/components/classroom'
import { useClassroomSocket } from '@/hooks/useClassroomSocket'
import { api } from '@/lib/queryClient'
import { PageWithNav } from '@/components/PageWithNav'
import {
  EntryPromptBanner,
  getAvailableViews,
  getDefaultView,
  StudentFilterBar,
  StudentSelector,
  type StudentView,
  type StudentWithProgress,
} from '@/components/practice'
import { Z_INDEX } from '@/constants/zIndex'
import { useTheme } from '@/contexts/ThemeContext'
import { useMyClassroom } from '@/hooks/useClassroom'
import { useParentSocket } from '@/hooks/useParentSocket'
import {
  computeViewCounts,
  filterStudentsByView,
  useUnifiedStudents,
} from '@/hooks/useUnifiedStudents'
import { useUpdatePlayer } from '@/hooks/useUserPlayers'
import type { UnifiedStudent } from '@/types/student'
import type { StudentWithSkillData } from '@/utils/studentGrouping'
import { filterStudents, getStudentsNeedingAttention, groupStudents } from '@/utils/studentGrouping'
import { css } from '../../../styled-system/css'
import { AddStudentModal } from './AddStudentModal'

interface PracticeClientProps {
  initialPlayers: StudentWithSkillData[]
  /** Viewer ID for session observation */
  viewerId: string
  /** Database user ID for parent socket notifications */
  userId: string
}

/**
 * Practice page client component
 *
 * Uses React Query with server-prefetched data for immediate rendering.
 * Manages filter state (search, skills, archived, edit mode) and passes
 * grouped/filtered students to StudentSelector.
 */
export function PracticeClient({ initialPlayers, viewerId, userId }: PracticeClientProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { showSuccess, showError } = useToast()

  // Classroom state - check if user is a teacher
  const { data: classroom, isLoading: isLoadingClassroom } = useMyClassroom()

  // Parent socket for real-time enrollment notifications
  // Only connect when user is NOT a teacher (classroom is null and not loading)
  const isParent = !isLoadingClassroom && !classroom
  useParentSocket(isParent ? userId : undefined)
  const [showCreateClassroom, setShowCreateClassroom] = useState(false)

  // Unified student data - merges children, enrolled, present, and active sessions
  const {
    students: unifiedStudents,
    isTeacher,
    classroomCode,
    classroomId,
  } = useUnifiedStudents(initialPlayers, userId)

  // Real-time WebSocket updates for classroom events
  // This invalidates React Query caches when students enter/leave, sessions start/end, etc.
  useClassroomSocket(classroomId)

  // Use unified students (already fetched above) as the main data source
  // Cast to maintain compatibility with existing grouping functions
  const players = unifiedStudents as StudentWithSkillData[]

  // Mutation for bulk updates
  const updatePlayer = useUpdatePlayer()

  // Count archived students
  const archivedCount = useMemo(() => players.filter((p) => p.isArchived).length, [players])

  // Compute view counts from unified students (must be before availableViews)
  const viewCounts = useMemo(
    () => computeViewCounts(unifiedStudents, isTeacher),
    [unifiedStudents, isTeacher]
  )

  // View and filter state - pass viewCounts so active sub-views appear conditionally
  const availableViews = useMemo(
    () => getAvailableViews(isTeacher, viewCounts),
    [isTeacher, viewCounts]
  )
  const defaultView = useMemo(() => getDefaultView(isTeacher), [isTeacher])
  const [currentView, setCurrentView] = useState<StudentView>(defaultView)
  const [searchQuery, setSearchQuery] = useState('')
  const [skillFilters, setSkillFilters] = useState<string[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Add student modal state (parent mode - create new child)
  const [showAddModal, setShowAddModal] = useState(false)
  // Track if we're adding to classroom (auto-enroll mode)
  const [addToClassroomMode, setAddToClassroomMode] = useState(false)

  // Unified add student to classroom modal (teacher mode - combines create, share, family code)
  const [showUnifiedAddModal, setShowUnifiedAddModal] = useState(false)

  // Add student modal state (teacher mode - add by family code) - legacy, kept for direct access
  const [showAddByFamilyCode, setShowAddByFamilyCode] = useState(false)

  // Session observation state
  const [observingStudent, setObservingStudent] = useState<UnifiedStudent | null>(null)

  // Filter students by view first, then apply search/skill filters
  const viewFilteredStudents = useMemo(
    () => filterStudentsByView(unifiedStudents, currentView),
    [unifiedStudents, currentView]
  )

  // Apply search and skill filters on top of view filter
  const filteredStudents = useMemo(
    () =>
      filterStudents(
        viewFilteredStudents as StudentWithSkillData[],
        searchQuery,
        skillFilters,
        showArchived
      ),
    [viewFilteredStudents, searchQuery, skillFilters, showArchived]
  )

  const groupedStudents = useMemo(() => groupStudents(filteredStudents), [filteredStudents])

  // Students needing intervention (only from non-archived, filtered set)
  const studentsNeedingAttention = useMemo(
    () => getStudentsNeedingAttention(filteredStudents),
    [filteredStudents]
  )

  // Set of student IDs shown in attention section (for filtering)
  const attentionStudentIds = useMemo(
    () => new Set(studentsNeedingAttention.map((s) => s.id)),
    [studentsNeedingAttention]
  )

  // Track attention counts per bucket/category for placeholder display
  const attentionCountsByBucket = useMemo(() => {
    const counts = new Map<string, Map<string | null, number>>()
    for (const student of studentsNeedingAttention) {
      // Find which bucket/category this student would be in
      for (const bucket of groupedStudents) {
        for (const category of bucket.categories) {
          if (category.students.some((s) => s.id === student.id)) {
            const bucketKey = bucket.bucket
            if (!counts.has(bucketKey)) {
              counts.set(bucketKey, new Map())
            }
            const categoryKey = category.category
            const categoryMap = counts.get(bucketKey)!
            categoryMap.set(categoryKey, (categoryMap.get(categoryKey) ?? 0) + 1)
          }
        }
      }
    }
    return counts
  }, [studentsNeedingAttention, groupedStudents])

  // Filter grouped students to exclude those in attention section
  const filteredGroupedStudents = useMemo(() => {
    return groupedStudents
      .map((bucket) => ({
        ...bucket,
        categories: bucket.categories
          .map((category) => ({
            ...category,
            students: category.students.filter((s) => !attentionStudentIds.has(s.id)),
          }))
          // Only show categories that have visible students (not moved to attention)
          .filter((category) => category.students.length > 0),
      }))
      .filter((bucket) => bucket.categories.length > 0)
  }, [groupedStudents, attentionStudentIds])

  // Handle student selection - navigate to student's dashboard page
  const handleSelectStudent = useCallback(
    (student: StudentWithProgress) => {
      router.push(`/practice/${student.id}/dashboard`, { scroll: false })
    },
    [router]
  )

  // Handle checkbox toggle for multi-select
  const handleToggleSelection = useCallback((student: StudentWithProgress) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(student.id)) {
        next.delete(student.id)
      } else {
        next.add(student.id)
      }
      return next
    })
  }, [])

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

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

    // Clear selection after archiving
    setSelectedIds(new Set())
  }, [selectedIds, updatePlayer])

  // Mutation for bulk entry prompts
  const bulkEntryPrompt = useMutation({
    mutationFn: async (playerIds: string[]) => {
      if (!classroomId) throw new Error('No classroom ID')
      const response = await api(`classrooms/${classroomId}/entry-prompts`, {
        method: 'POST',
        body: JSON.stringify({ playerIds }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send prompts')
      }
      return response.json()
    },
  })

  // Compute which selected students are eligible for entry prompts
  // (enrolled in teacher's classroom but not currently present)
  const promptEligibleIds = useMemo(() => {
    if (!isTeacher || !classroomId) return new Set<string>()
    return new Set(
      Array.from(selectedIds).filter((id) => {
        const student = unifiedStudents.find((s) => s.id === id)
        if (!student) return false
        // Must be enrolled but not present
        return student.relationship.isEnrolled && !student.relationship.isPresent
      })
    )
  }, [selectedIds, unifiedStudents, isTeacher, classroomId])

  // Handle bulk prompt to enter
  const handleBulkPromptToEnter = useCallback(async () => {
    if (promptEligibleIds.size === 0) return

    try {
      const result = await bulkEntryPrompt.mutateAsync(Array.from(promptEligibleIds))

      // Show success message
      const created = result.created ?? promptEligibleIds.size
      const skipped = result.skippedCount ?? 0
      if (created > 0) {
        showSuccess(
          'Entry prompts sent',
          `Sent to ${created} student${created !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`
        )
      } else if (skipped > 0) {
        showError(
          'No prompts sent',
          `All ${skipped} students were skipped (already prompted or present)`
        )
      }

      // Clear selection after prompting
      setSelectedIds(new Set())
    } catch (error) {
      showError(
        'Failed to send prompts',
        error instanceof Error ? error.message : 'An unexpected error occurred'
      )
    }
  }, [promptEligibleIds, bulkEntryPrompt, showSuccess, showError])

  // Handle add student - show create modal (parent mode, no auto-enroll)
  const handleAddStudent = useCallback(() => {
    setAddToClassroomMode(false)
    setShowAddModal(true)
  }, [])

  // Handle add student to classroom - show unified modal with all options
  const handleAddStudentToClassroom = useCallback(() => {
    setShowUnifiedAddModal(true)
  }, [])

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false)
    setAddToClassroomMode(false)
  }, [])

  // Handle session observation - find the student and open observer modal
  const handleObserveSession = useCallback(
    (sessionId: string) => {
      // Find the student with this session
      const student = unifiedStudents.find((s) => s.activity?.sessionId === sessionId)
      if (student) {
        setObservingStudent(student)
      }
    },
    [unifiedStudents]
  )

  // Count archived students that match filters but are hidden
  const hiddenArchivedCount = useMemo(() => {
    if (showArchived) return 0
    return filterStudents(players, searchQuery, skillFilters, true).filter((p) => p.isArchived)
      .length
  }, [players, searchQuery, skillFilters, showArchived])

  // Handle classroom creation
  const handleBecomeTeacher = useCallback(() => {
    setShowCreateClassroom(true)
  }, [])

  const handleCloseCreateClassroom = useCallback(() => {
    setShowCreateClassroom(false)
  }, [])

  // Show create classroom modal if requested
  if (showCreateClassroom) {
    return (
      <PageWithNav>
        <main
          data-component="practice-page"
          className={css({
            minHeight: '100vh',
            backgroundColor: isDark ? 'gray.900' : 'gray.50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          })}
        >
          <div
            className={css({
              maxWidth: '500px',
              width: '100%',
            })}
          >
            <CreateClassroomForm onCancel={handleCloseCreateClassroom} />
          </div>
        </main>
      </PageWithNav>
    )
  }

  // Parent view - show student list with filter bar
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
          currentView={currentView}
          onViewChange={setCurrentView}
          availableViews={availableViews}
          viewCounts={viewCounts}
          classroom={classroom}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          skillFilters={skillFilters}
          onSkillFiltersChange={setSkillFilters}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          archivedCount={archivedCount}
          onAddStudent={handleAddStudent}
          onAddStudentToClassroom={isTeacher ? handleAddStudentToClassroom : undefined}
          selectedCount={selectedIds.size}
          onBulkArchive={handleBulkArchive}
          onBulkPromptToEnter={isTeacher ? handleBulkPromptToEnter : undefined}
          promptEligibleCount={promptEligibleIds.size}
          onClearSelection={handleClearSelection}
        />

        <div
          className={css({
            maxWidth: '1000px',
            margin: '0 auto',
            padding: '2rem',
          })}
        >
          {/* Teacher option */}
          {!isLoadingClassroom && !classroom && (
            <div
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '12px',
                marginBottom: '1rem',
              })}
            >
              {/* Become a Teacher option */}
              <button
                type="button"
                onClick={handleBecomeTeacher}
                data-action="become-teacher"
                className={css({
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: isDark ? 'blue.400' : 'blue.600',
                  border: '1px solid',
                  borderColor: isDark ? 'blue.700' : 'blue.300',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  _hover: {
                    backgroundColor: isDark ? 'blue.900/30' : 'blue.50',
                    borderColor: isDark ? 'blue.500' : 'blue.400',
                  },
                })}
              >
                🏫 Are you a teacher? Create a classroom
              </button>
            </div>
          )}

          {/* Teacher Enrollment Requests - for teachers to approve parent-initiated requests */}
          {isTeacher && classroomId && <TeacherEnrollmentSection classroomId={classroomId} />}

          {/* Pending Enrollment Approvals - for parents to approve teacher-initiated requests */}
          <PendingApprovalsSection />

          {/* Entry Prompt Banner - for parents to respond to teacher classroom entry requests */}
          {/* Shows for anyone with children, even if they're also a teacher */}
          <EntryPromptBanner />

          {/* All Students - unified layout with compact sections flowing together */}
          {filteredGroupedStudents.length === 0 && studentsNeedingAttention.length === 0 ? (
            <ViewEmptyState
              currentView={currentView}
              classroomId={classroomId}
              classroomCode={classroomCode}
              searchQuery={searchQuery}
              skillFilters={skillFilters}
              showArchived={showArchived}
              onAddStudent={handleAddStudent}
              isDark={isDark}
            />
          ) : (
            <div
              data-component="grouped-students"
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              })}
            >
              {(() => {
                // Unified section type for both "Needs Attention" and regular buckets
                type Section =
                  | {
                      type: 'attention'
                      students: typeof studentsNeedingAttention
                    }
                  | {
                      type: 'bucket'
                      bucket: (typeof filteredGroupedStudents)[0]
                    }

                // Build list of all sections (attention first, then buckets)
                const allSections: Section[] = []
                if (studentsNeedingAttention.length > 0) {
                  allSections.push({ type: 'attention', students: studentsNeedingAttention })
                }
                for (const bucket of filteredGroupedStudents) {
                  allSections.push({ type: 'bucket', bucket })
                }

                // Helper to check if a category is compact (1 student, no attention placeholder)
                const isCategoryCompact = (
                  bucket: (typeof filteredGroupedStudents)[0],
                  cat: (typeof bucket.categories)[0]
                ) => {
                  const attentionCount =
                    attentionCountsByBucket.get(bucket.bucket)?.get(cat.category) ?? 0
                  return cat.students.length === 1 && attentionCount === 0
                }

                // Helper to check if entire bucket is compact
                const isBucketCompact = (bucket: (typeof filteredGroupedStudents)[0]) =>
                  bucket.categories.every((cat) => isCategoryCompact(bucket, cat))

                // Helper to check if a section is compact
                const isSectionCompact = (section: Section) => {
                  if (section.type === 'attention') {
                    return section.students.length === 1
                  }
                  return isBucketCompact(section.bucket)
                }

                // Group consecutive compact sections
                type RenderItem =
                  | { type: 'compact-sections'; sections: Section[] }
                  | { type: 'full-section'; section: Section }

                const renderItems: RenderItem[] = []
                let compactBuffer: Section[] = []

                for (const section of allSections) {
                  if (isSectionCompact(section)) {
                    compactBuffer.push(section)
                  } else {
                    if (compactBuffer.length > 0) {
                      renderItems.push({ type: 'compact-sections', sections: compactBuffer })
                      compactBuffer = []
                    }
                    renderItems.push({ type: 'full-section', section })
                  }
                }
                if (compactBuffer.length > 0) {
                  renderItems.push({ type: 'compact-sections', sections: compactBuffer })
                }

                return renderItems.map((item, itemIdx) => {
                  if (item.type === 'compact-sections') {
                    // Render compact sections flowing together
                    return (
                      <div
                        key={`compact-sections-${itemIdx}`}
                        data-element="compact-sections-row"
                        className={css({
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '12px',
                          alignItems: 'flex-start',
                        })}
                      >
                        {item.sections.flatMap((section) => {
                          if (section.type === 'attention') {
                            // Compact attention section (1 student)
                            return (
                              <div
                                key="attention"
                                data-bucket="attention"
                                data-compact="true"
                                className={css({
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                })}
                              >
                                <span
                                  data-element="compact-label"
                                  className={css({
                                    fontSize: '0.6875rem',
                                    fontWeight: 'medium',
                                    color: isDark ? 'orange.400' : 'orange.500',
                                    paddingLeft: '4px',
                                    display: 'flex',
                                    gap: '4px',
                                    alignItems: 'center',
                                  })}
                                >
                                  <span>⚠️</span>
                                  <span
                                    className={css({
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.03em',
                                    })}
                                  >
                                    Needs Attention
                                  </span>
                                </span>
                                <StudentSelector
                                  students={section.students as StudentWithProgress[]}
                                  onSelectStudent={handleSelectStudent}
                                  onToggleSelection={handleToggleSelection}
                                  onObserveSession={handleObserveSession}
                                  title=""
                                  selectedIds={selectedIds}
                                  hideAddButton
                                  compact
                                />
                              </div>
                            )
                          }
                          // Compact bucket (all single-student categories)
                          return section.bucket.categories.map((cat) => (
                            <div
                              key={`${section.bucket.bucket}-${cat.category ?? 'null'}`}
                              data-bucket={section.bucket.bucket}
                              data-category={cat.category ?? 'new'}
                              data-compact="true"
                              className={css({
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                              })}
                            >
                              <span
                                data-element="compact-label"
                                className={css({
                                  fontSize: '0.6875rem',
                                  fontWeight: 'medium',
                                  color: isDark ? 'gray.500' : 'gray.400',
                                  paddingLeft: '4px',
                                  display: 'flex',
                                  gap: '4px',
                                  alignItems: 'center',
                                })}
                              >
                                <span
                                  className={css({
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em',
                                    color: isDark ? 'gray.600' : 'gray.350',
                                  })}
                                >
                                  {section.bucket.bucketName}
                                </span>
                                <span className={css({ color: isDark ? 'gray.600' : 'gray.300' })}>
                                  ·
                                </span>
                                <span>{cat.categoryName}</span>
                              </span>
                              <StudentSelector
                                students={cat.students as StudentWithProgress[]}
                                onSelectStudent={handleSelectStudent}
                                onToggleSelection={handleToggleSelection}
                                onObserveSession={handleObserveSession}
                                title=""
                                selectedIds={selectedIds}
                                hideAddButton
                                compact
                              />
                            </div>
                          ))
                        })}
                      </div>
                    )
                  }

                  // Full section
                  const section = item.section

                  if (section.type === 'attention') {
                    // Full attention section (multiple students)
                    return (
                      <div
                        key="attention"
                        data-bucket="attention"
                        data-component="needs-attention-bucket"
                      >
                        <h2
                          data-element="bucket-header"
                          className={css({
                            position: 'sticky',
                            top: '160px',
                            zIndex: Z_INDEX.STICKY_BUCKET_HEADER,
                            fontSize: '0.875rem',
                            fontWeight: 'semibold',
                            color: isDark ? 'orange.400' : 'orange.600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '12px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                            borderBottom: '2px solid',
                            borderColor: isDark ? 'orange.700' : 'orange.300',
                            bg: isDark ? 'gray.900' : 'gray.50',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          })}
                        >
                          <span>⚠️</span>
                          <span>Needs Attention</span>
                          <span
                            className={css({
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '20px',
                              height: '20px',
                              padding: '0 6px',
                              borderRadius: '10px',
                              backgroundColor: isDark ? 'orange.700' : 'orange.500',
                              color: 'white',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                            })}
                          >
                            {section.students.length}
                          </span>
                        </h2>
                        <StudentSelector
                          students={section.students as StudentWithProgress[]}
                          onSelectStudent={handleSelectStudent}
                          onToggleSelection={handleToggleSelection}
                          onObserveSession={handleObserveSession}
                          title=""
                          selectedIds={selectedIds}
                          hideAddButton
                        />
                      </div>
                    )
                  }

                  // Full bucket
                  const bucket = section.bucket

                  return (
                    <div key={bucket.bucket} data-bucket={bucket.bucket}>
                      <h2
                        data-element="bucket-header"
                        className={css({
                          position: 'sticky',
                          top: '160px',
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

                      {/* Categories within bucket - grouped for compact display */}
                      <div
                        className={css({
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px',
                        })}
                      >
                        {(() => {
                          // Group consecutive compact categories
                          type CategoryRenderItem =
                            | { type: 'compact-row'; categories: typeof bucket.categories }
                            | { type: 'full'; category: (typeof bucket.categories)[0] }

                          const items: CategoryRenderItem[] = []
                          let compactBuffer: typeof bucket.categories = []

                          for (const cat of bucket.categories) {
                            if (isCategoryCompact(bucket, cat)) {
                              compactBuffer.push(cat)
                            } else {
                              if (compactBuffer.length > 0) {
                                items.push({ type: 'compact-row', categories: compactBuffer })
                                compactBuffer = []
                              }
                              items.push({ type: 'full', category: cat })
                            }
                          }
                          if (compactBuffer.length > 0) {
                            items.push({ type: 'compact-row', categories: compactBuffer })
                          }

                          return items.map((item, idx) => {
                            if (item.type === 'compact-row') {
                              // Render compact categories flowing together
                              return (
                                <div
                                  key={`compact-${idx}`}
                                  data-element="compact-category-row"
                                  className={css({
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '12px',
                                    alignItems: 'flex-start',
                                  })}
                                >
                                  {item.categories.map((cat) => (
                                    <div
                                      key={cat.category ?? 'null'}
                                      data-category={cat.category ?? 'new'}
                                      data-compact="true"
                                      className={css({
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                      })}
                                    >
                                      {/* Small inline category label */}
                                      <span
                                        data-element="compact-category-label"
                                        className={css({
                                          fontSize: '0.75rem',
                                          fontWeight: 'medium',
                                          color: isDark ? 'gray.500' : 'gray.400',
                                          paddingLeft: '4px',
                                        })}
                                      >
                                        {cat.categoryName}
                                      </span>
                                      {/* Single student tile */}
                                      <StudentSelector
                                        students={cat.students as StudentWithProgress[]}
                                        onSelectStudent={handleSelectStudent}
                                        onToggleSelection={handleToggleSelection}
                                        onObserveSession={handleObserveSession}
                                        title=""
                                        selectedIds={selectedIds}
                                        hideAddButton
                                        compact
                                      />
                                    </div>
                                  ))}
                                </div>
                              )
                            }

                            // Render full category (2+ students or has attention placeholder)
                            const category = item.category
                            const attentionCount =
                              attentionCountsByBucket.get(bucket.bucket)?.get(category.category) ??
                              0

                            return (
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

                                {/* Student cards wrapper */}
                                <div
                                  className={css({
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                    alignItems: 'stretch',
                                  })}
                                >
                                  {/* Student cards */}
                                  {category.students.length > 0 && (
                                    <StudentSelector
                                      students={category.students as StudentWithProgress[]}
                                      onSelectStudent={handleSelectStudent}
                                      onToggleSelection={handleToggleSelection}
                                      onObserveSession={handleObserveSession}
                                      title=""
                                      selectedIds={selectedIds}
                                      hideAddButton
                                    />
                                  )}

                                  {/* Attention placeholder */}
                                  {attentionCount > 0 && (
                                    <div
                                      data-element="attention-placeholder"
                                      data-attention-count={attentionCount}
                                      className={css({
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        border: '2px dashed',
                                        borderColor: isDark ? 'orange.700' : 'orange.300',
                                        color: isDark ? 'orange.400' : 'orange.600',
                                        fontSize: '0.8125rem',
                                        textAlign: 'center',
                                        minHeight: '60px',
                                        flexShrink: 0,
                                      })}
                                    >
                                      +{attentionCount} in Needs Attention
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  )
                })
              })()}
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

      {/* Add Student Modal (Parent - create new child, or Teacher - create & enroll) */}
      <AddStudentModal
        isOpen={showAddModal}
        onClose={handleCloseAddModal}
        isDark={isDark}
        classroomId={addToClassroomMode ? classroomId : undefined}
        classroomName={addToClassroomMode ? classroom?.name : undefined}
      />

      {/* Unified Add Student to Classroom Modal (Teacher mode - combines all options) */}
      {classroomId && classroomCode && classroom && (
        <AddStudentToClassroomModal
          isOpen={showUnifiedAddModal}
          onClose={() => setShowUnifiedAddModal(false)}
          classroomId={classroomId}
          classroomName={classroom.name}
          classroomCode={classroomCode}
        />
      )}

      {/* Add Student Modal (Teacher - add by family code) - legacy, kept for direct access */}
      {classroomId && (
        <AddStudentByFamilyCodeModal
          isOpen={showAddByFamilyCode}
          onClose={() => setShowAddByFamilyCode(false)}
          classroomId={classroomId}
        />
      )}

      {/* Session Observer Modal */}
      {observingStudent && observingStudent.activity?.sessionId && (
        <SessionObserverModal
          isOpen={!!observingStudent}
          onClose={() => setObservingStudent(null)}
          session={{
            sessionId: observingStudent.activity.sessionId,
            playerId: observingStudent.id,
            completedProblems: observingStudent.activity.sessionProgress?.current ?? 0,
            totalProblems: observingStudent.activity.sessionProgress?.total ?? 0,
            // These fields are required by the type but not used by the modal
            startedAt: new Date().toISOString(),
            currentPartIndex: 0,
            currentSlotIndex: 0,
            totalParts: 1,
          }}
          student={{
            name: observingStudent.name,
            emoji: observingStudent.emoji,
            color: observingStudent.color,
          }}
          observerId={userId}
          canShare={observingStudent.relationship.isMyChild}
          classroomId={classroomId}
        />
      )}
    </PageWithNav>
  )
}

/**
 * ViewEmptyState - View-specific empty states
 */
interface ViewEmptyStateProps {
  currentView: StudentView
  classroomId?: string
  classroomCode?: string
  searchQuery: string
  skillFilters: string[]
  showArchived: boolean
  onAddStudent: () => void
  isDark: boolean
}

function ViewEmptyState({
  currentView,
  classroomId,
  classroomCode,
  searchQuery,
  skillFilters,
  showArchived,
  onAddStudent,
  isDark,
}: ViewEmptyStateProps) {
  // Filter-based empty state takes priority
  if (searchQuery || skillFilters.length > 0) {
    return (
      <div
        data-element="empty-state"
        data-reason="filters"
        className={css({
          textAlign: 'center',
          padding: '3rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        No students match your filters
      </div>
    )
  }

  if (showArchived) {
    return (
      <div
        data-element="empty-state"
        data-reason="no-archived"
        className={css({
          textAlign: 'center',
          padding: '3rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        No archived students
      </div>
    )
  }

  // View-specific empty states
  switch (currentView) {
    case 'in-classroom':
      return (
        <div
          data-element="empty-state"
          data-reason="no-students-in-classroom"
          className={css({
            textAlign: 'center',
            padding: '3rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          })}
        >
          <div
            className={css({
              fontSize: '3rem',
            })}
          >
            🏫
          </div>
          <div>
            <h3
              className={css({
                fontSize: '1.25rem',
                fontWeight: 'semibold',
                color: isDark ? 'gray.200' : 'gray.700',
                marginBottom: '8px',
              })}
            >
              No students in classroom
            </h3>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              Enrolled students can enter via their practice page, or you can prompt them to join.
            </p>
          </div>

          {/* Instructions for bulk prompt */}
          <div
            className={css({
              backgroundColor: isDark ? 'gray.800' : 'gray.50',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              borderRadius: '12px',
              padding: '16px 20px',
              maxWidth: '400px',
              textAlign: 'left',
            })}
          >
            <p
              className={css({
                fontSize: '0.875rem',
                fontWeight: 'medium',
                color: isDark ? 'gray.300' : 'gray.600',
                marginBottom: '8px',
              })}
            >
              To prompt students to enter:
            </p>
            <ol
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.500',
                paddingLeft: '20px',
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              })}
            >
              <li>Switch to the "Enrolled" view above</li>
              <li>Select students using the checkboxes</li>
              <li>Click "Prompt to Enter" in the selection bar</li>
            </ol>
          </div>
        </div>
      )

    case 'enrolled':
      return (
        <div
          data-element="empty-state"
          data-reason="no-enrolled-students"
          className={css({
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            maxWidth: '700px',
            margin: '0 auto',
          })}
        >
          <div className={css({ textAlign: 'center' })}>
            <div
              className={css({
                fontSize: '2.5rem',
                marginBottom: '8px',
              })}
            >
              📋
            </div>
            <h3
              className={css({
                fontSize: '1.25rem',
                fontWeight: 'semibold',
                color: isDark ? 'gray.200' : 'gray.700',
                marginBottom: '4px',
              })}
            >
              No enrolled students yet
            </h3>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.500',
                fontSize: '0.9375rem',
              })}
            >
              Add your first student to get started
            </p>
          </div>
          {classroomId && classroomCode && (
            <AddStudentToClassroomContent classroomId={classroomId} classroomCode={classroomCode} />
          )}
        </div>
      )

    case 'my-children':
      return (
        <div
          data-element="empty-state"
          data-reason="no-children"
          className={css({
            textAlign: 'center',
            padding: '3rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          })}
        >
          <div
            className={css({
              fontSize: '3rem',
            })}
          >
            👶
          </div>
          <div>
            <h3
              className={css({
                fontSize: '1.25rem',
                fontWeight: 'semibold',
                color: isDark ? 'gray.200' : 'gray.700',
                marginBottom: '8px',
              })}
            >
              No children added yet
            </h3>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.500',
                marginBottom: '16px',
              })}
            >
              Add a student to get started with daily practice
            </p>
          </div>
          <button
            type="button"
            onClick={onAddStudent}
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
      )

    case 'all':
    default:
      return (
        <div
          data-element="empty-state"
          data-reason="no-students"
          className={css({
            textAlign: 'center',
            padding: '3rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          })}
        >
          <span className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>No students yet.</span>
          <button
            type="button"
            onClick={onAddStudent}
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
      )
  }
}
