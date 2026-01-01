'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { animated, useSpring } from '@react-spring/web'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EnrollChildModal } from '@/components/classroom'
import { FamilyCodeDisplay } from '@/components/family'
import { Z_INDEX } from '@/constants/zIndex'
import { usePageTransition } from '@/contexts/PageTransitionContext'
import { useTheme } from '@/contexts/ThemeContext'
import { usePlayerCurriculumQuery } from '@/hooks/usePlayerCurriculum'
import { useSessionMode } from '@/hooks/useSessionMode'
import { useStudentActions, type StudentActionData } from '@/hooks/useStudentActions'
import { useStudentStakeholders } from '@/hooks/useStudentStakeholders'
import { useUpdatePlayer } from '@/hooks/useUserPlayers'
import type { StudentActivity, StudentRelationship, UnifiedStudent } from '@/types/student'
import { css } from '../../../styled-system/css'
import { MiniStartPracticeBanner } from './MiniStartPracticeBanner'
import { RelationshipCard } from './RelationshipCard'
import { RelationshipSummary } from './RelationshipBadge'
import { ACTION_DEFINITIONS } from './studentActions'

// ============================================================================
// Types
// ============================================================================

/** Base student fields required for the modal */
interface BaseStudentFields {
  id: string
  name: string
  emoji: string
  color: string
  notes?: string | null
  isArchived?: boolean
}

/** Full student type with relationship and activity data */
type FullStudent = UnifiedStudent

/** Accept any object with the required base fields, plus optional unified student fields */
type StudentProp = BaseStudentFields &
  Partial<Pick<FullStudent, 'relationship' | 'activity' | 'intervention'>>

interface NotesModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Student to display - accepts simple or UnifiedStudent */
  student: StudentProp
  /** Bounding rect of the source tile for zoom animation */
  sourceBounds: DOMRect | null
  /** Called when the modal should close */
  onClose: () => void
  /** Callback when "Watch Session" is clicked - handled by parent to avoid z-index issues */
  onObserveSession?: (sessionId: string) => void
}

type TabId = 'overview' | 'notes' | 'relationships'

// ============================================================================
// Helper functions
// ============================================================================

function formatLastPracticed(date: Date | string | null | undefined): string {
  if (!date) return 'Never'
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

function calculateMasteryPercent(skills: Array<{ attempts: number; correct: number }>): number {
  if (skills.length === 0) return 0
  const totalAttempts = skills.reduce((sum, s) => sum + s.attempts, 0)
  const totalCorrect = skills.reduce((sum, s) => sum + s.correct, 0)
  if (totalAttempts === 0) return 0
  return Math.round((totalCorrect / totalAttempts) * 100)
}

/** Build StudentActionData from StudentProp */
function buildStudentActionData(student: StudentProp): StudentActionData {
  return {
    id: student.id,
    name: student.name,
    isArchived: student.isArchived,
    relationship: student.relationship
      ? {
          isMyChild: student.relationship.isMyChild,
          isEnrolled: student.relationship.isEnrolled,
          isPresent: student.relationship.isPresent,
          enrollmentStatus: student.relationship.enrollmentStatus,
        }
      : undefined,
    activity: student.activity
      ? {
          status: student.activity.status,
          sessionId: student.activity.sessionId,
        }
      : undefined,
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * NotesModal - Student quick-look modal with tabs
 *
 * Features:
 * - Overview tab: Stats, badges, intervention
 * - Notes tab: View/edit student notes
 * - Overflow menu: All student actions (uses shared useStudentActions hook)
 * - Zoom animation from source tile
 */
export function NotesModal({
  isOpen,
  student,
  sourceBounds,
  onClose,
  onObserveSession,
}: NotesModalProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { startTransition } = usePageTransition()

  // ========== Internal state (notes editing only) ==========
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editedNotes, setEditedNotes] = useState(student.notes ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isHiddenForTransition, setIsHiddenForTransition] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ========== Use shared student actions hook ==========
  const studentActionData = buildStudentActionData(student)
  const { actions, handlers, modals } = useStudentActions(studentActionData, {
    // Session observer is rendered at parent level to avoid z-index issues
    // Close this modal first so the observer modal appears on top
    onObserveSession:
      onObserveSession && student.activity?.sessionId
        ? () => {
            onClose()
            onObserveSession(student.activity!.sessionId!)
          }
        : undefined,
  })

  // ========== Additional data for Overview tab ==========
  const { data: curriculumData } = usePlayerCurriculumQuery(student.id)
  const { data: sessionMode } = useSessionMode(student.id)
  const updatePlayer = useUpdatePlayer() // For notes only

  // ========== Stakeholder data for Relationships tab ==========
  const { data: stakeholdersData } = useStudentStakeholders(student.id)
  const viewerRelationship = stakeholdersData?.viewerRelationship ?? null
  const stakeholders = stakeholdersData?.stakeholders ?? null

  // Count other stakeholders for the summary line
  const otherStakeholders = useMemo(() => {
    if (!stakeholders) return undefined
    const otherParents = stakeholders.parents.filter((p) => !p.isMe).length
    const teacherCount = stakeholders.enrolledClassrooms.length
    if (otherParents === 0 && teacherCount === 0) return undefined
    return { parents: otherParents, teachers: teacherCount }
  }, [stakeholders])

  // ========== Derived data ==========
  const relationship: StudentRelationship | null = student.relationship ?? null
  const activity: StudentActivity | null = student.activity ?? null
  const intervention = student.intervention ?? null

  const currentLevel = curriculumData?.curriculum?.currentLevel ?? null
  const masteryPercent = curriculumData?.skills
    ? calculateMasteryPercent(curriculumData.skills)
    : null
  const lastPracticedAt = curriculumData?.recentSessions?.[0]?.startedAt ?? null

  // Determine if Overview tab has content
  const hasOverviewContent = !!(
    currentLevel ||
    masteryPercent !== null ||
    intervention ||
    activity?.status === 'practicing' ||
    relationship?.isPresent
  )

  // Default tab based on content
  const defaultTab: TabId = hasOverviewContent ? 'overview' : 'notes'

  // ========== Mini Banner Handlers ==========

  const handleBannerStartPractice = useCallback(() => {
    // Navigate to dashboard with startPractice param to open the modal there
    // This ensures all required data (avgSecondsPerProblem, problemHistory, etc.) is available
    onClose()
    router.push(`/practice/${student.id}/dashboard?startPractice=true`)
  }, [onClose, router, student.id])

  const handleBannerResumePractice = useCallback(() => {
    // Navigate to the active practice session
    onClose()
    router.push(`/practice/${student.id}`)
  }, [onClose, router, student.id])

  // ========== Effects ==========

  // Reset state when modal opens/closes or student changes
  useEffect(() => {
    if (isOpen) {
      setEditedNotes(student.notes ?? '')
      setIsEditing(false)
      setActiveTab(defaultTab)
      setIsHiddenForTransition(false)
    }
  }, [isOpen, student.id, student.notes, defaultTab])

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false)
          setEditedNotes(student.notes ?? '')
        } else {
          onClose()
        }
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isEditing, student.notes, onClose])

  // ========== Animation ==========
  const wasOpenRef = useRef(false)
  const isOpening = !wasOpenRef.current && isOpen

  useEffect(() => {
    wasOpenRef.current = isOpen
  }, [isOpen])

  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 800
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 600

  // Responsive modal dimensions
  const modalWidth = Math.min(420, windowWidth - 32)
  const modalHeight = Math.min(400, windowHeight - 100) // Leave room for virtual keyboard on mobile
  const targetX = (windowWidth - modalWidth) / 2
  const targetY = (windowHeight - modalHeight) / 2

  const sourceX = sourceBounds?.left ?? targetX
  const sourceY = sourceBounds?.top ?? targetY
  const sourceWidth = sourceBounds?.width ?? modalWidth
  const sourceHeight = sourceBounds?.height ?? modalHeight

  const springProps = useSpring({
    from: {
      x: sourceX,
      y: sourceY,
      width: sourceWidth,
      height: sourceHeight,
      opacity: 0,
      scale: 0.95,
    },
    to: {
      x: isOpen ? targetX : sourceX,
      y: isOpen ? targetY : sourceY,
      width: isOpen ? modalWidth : sourceWidth,
      height: isOpen ? modalHeight : sourceHeight,
      opacity: isOpen ? 1 : 0,
      scale: isOpen ? 1 : 0.95,
    },
    reset: isOpening,
    config: { tension: 300, friction: 30 },
  })

  const backdropSpring = useSpring({
    opacity: isOpen ? 1 : 0,
    config: { tension: 300, friction: 30 },
  })

  // ========== Handlers (notes only - actions use hook) ==========
  const handleSaveNotes = useCallback(async () => {
    setIsSaving(true)
    try {
      await updatePlayer.mutateAsync({
        id: student.id,
        updates: { notes: editedNotes || null },
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save notes:', error)
    } finally {
      setIsSaving(false)
    }
  }, [student.id, editedNotes, updatePlayer])

  // Wrap startPractice to also close modal
  const handleStartPractice = useCallback(() => {
    handlers.startPractice()
    onClose()
  }, [handlers, onClose])

  // Handle fullscreen transition to dashboard
  const handleFullscreen = useCallback(() => {
    if (!modalRef.current) return

    const bounds = modalRef.current.getBoundingClientRect()

    // Hide the modal instantly (no close animation) - overlay will take over
    setIsHiddenForTransition(true)

    startTransition({
      studentId: student.id,
      studentName: student.name,
      studentEmoji: student.emoji,
      studentColor: student.color,
      originBounds: {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
    })
    // Note: Don't call onClose() - it triggers the shrink animation
    // The modal will be unmounted when we navigate away
  }, [student, startTransition])

  // ========== Render ==========
  return (
    <>
      {/* Backdrop - fades out when doing fullscreen transition */}
      <animated.div
        data-component="notes-modal-backdrop"
        onClick={onClose}
        style={{
          opacity: isHiddenForTransition ? 0 : backdropSpring.opacity,
          pointerEvents: isOpen && !isHiddenForTransition ? 'auto' : 'none',
          transition: isHiddenForTransition ? 'opacity 150ms ease-out' : undefined,
        }}
        className={css({
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: Z_INDEX.MODAL_BACKDROP,
        })}
      />

      {/* Modal - fades out when doing fullscreen transition (cross-fade with overlay) */}
      <animated.div
        ref={modalRef}
        data-component="notes-modal"
        style={{
          position: 'fixed',
          left: springProps.x,
          top: springProps.y,
          width: springProps.width,
          height: springProps.height,
          opacity: isHiddenForTransition ? 0 : springProps.opacity,
          transform: springProps.scale.to((s) => `scale(${s})`),
          transformOrigin: 'center center',
          zIndex: Z_INDEX.MODAL,
          pointerEvents: isOpen && !isHiddenForTransition ? 'auto' : 'none',
          transition: isHiddenForTransition ? 'opacity 150ms ease-out' : undefined,
        }}
        className={css({
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          backgroundColor: isDark ? 'gray.800' : 'white',
        })}
      >
        {/* Header */}
        <div
          data-section="header"
          className={css({
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
          style={{ backgroundColor: student.color }}
        >
          {/* Avatar */}
          <div
            className={css({
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              flexShrink: 0,
            })}
          >
            {student.emoji}
          </div>

          {/* Name and relationship summary */}
          <div className={css({ flex: 1, minWidth: 0 })}>
            <h2
              className={css({
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: 'white',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              })}
            >
              {student.name}
            </h2>
            {/* Relationship summary line */}
            {viewerRelationship && viewerRelationship.type !== 'none' && (
              <div
                className={css({
                  marginTop: '2px',
                  opacity: 0.9,
                })}
              >
                <RelationshipSummary
                  type={viewerRelationship.type}
                  classroomName={viewerRelationship.classroomName}
                  otherStakeholders={otherStakeholders}
                  className={css({ color: 'rgba(255, 255, 255, 0.9)' })}
                />
              </div>
            )}
          </div>

          {/* Fullscreen button - expands to dashboard */}
          <button
            type="button"
            data-action="fullscreen"
            onClick={handleFullscreen}
            title="Open full dashboard"
            className={css({
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              _hover: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
            })}
          >
            ⛶
          </button>

          {/* Overflow menu - uses shared actions hook */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                data-action="overflow-menu"
                className={css({
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  _hover: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
                })}
              >
                ⋮
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={css({
                  minWidth: '180px',
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 10px 38px -10px rgba(0,0,0,0.35)',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  zIndex: Z_INDEX.TOOLTIP,
                })}
                sideOffset={5}
              >
                {/* Primary actions */}
                {actions.startPractice && (
                  <DropdownMenu.Item
                    className={menuItemStyle(isDark)}
                    onSelect={handleStartPractice}
                  >
                    <span>{ACTION_DEFINITIONS.startPractice.icon}</span>
                    <span>{ACTION_DEFINITIONS.startPractice.label}</span>
                  </DropdownMenu.Item>
                )}

                {actions.watchSession && (
                  <DropdownMenu.Item
                    className={menuItemStyle(isDark)}
                    onSelect={handlers.watchSession}
                  >
                    <span>{ACTION_DEFINITIONS.watchSession.icon}</span>
                    <span>{ACTION_DEFINITIONS.watchSession.label}</span>
                  </DropdownMenu.Item>
                )}

                {actions.enterClassroom && (
                  <DropdownMenu.Item
                    className={menuItemStyle(isDark)}
                    onSelect={handlers.enterClassroom}
                  >
                    <span>{ACTION_DEFINITIONS.enterClassroom.icon}</span>
                    <span>{ACTION_DEFINITIONS.enterClassroom.label}</span>
                  </DropdownMenu.Item>
                )}

                {actions.leaveClassroom && (
                  <DropdownMenu.Item
                    className={menuItemStyle(isDark)}
                    onSelect={handlers.leaveClassroom}
                  >
                    <span>{ACTION_DEFINITIONS.leaveClassroom.icon}</span>
                    <span>{ACTION_DEFINITIONS.leaveClassroom.label}</span>
                  </DropdownMenu.Item>
                )}

                {actions.promptToEnter && (
                  <DropdownMenu.Item
                    className={menuItemStyle(isDark)}
                    onSelect={handlers.promptToEnter}
                  >
                    <span>{ACTION_DEFINITIONS.promptToEnter.icon}</span>
                    <span>{ACTION_DEFINITIONS.promptToEnter.label}</span>
                  </DropdownMenu.Item>
                )}

                <DropdownMenu.Separator className={separatorStyle(isDark)} />

                {/* Management actions */}
                {actions.archive && (
                  <DropdownMenu.Item
                    className={menuItemStyle(isDark)}
                    onSelect={handlers.toggleArchive}
                  >
                    <span>{ACTION_DEFINITIONS.archive.icon}</span>
                    <span>{ACTION_DEFINITIONS.archive.label}</span>
                  </DropdownMenu.Item>
                )}

                {actions.unarchive && (
                  <DropdownMenu.Item
                    className={menuItemStyle(isDark)}
                    onSelect={handlers.toggleArchive}
                  >
                    <span>{ACTION_DEFINITIONS.unarchive.icon}</span>
                    <span>{ACTION_DEFINITIONS.unarchive.label}</span>
                  </DropdownMenu.Item>
                )}

                {actions.shareAccess && (
                  <DropdownMenu.Item
                    className={menuItemStyle(isDark)}
                    onSelect={handlers.openShareAccess}
                  >
                    <span>{ACTION_DEFINITIONS.shareAccess.icon}</span>
                    <span>{ACTION_DEFINITIONS.shareAccess.label}</span>
                  </DropdownMenu.Item>
                )}

                {actions.enrollInClassroom && (
                  <DropdownMenu.Item
                    className={menuItemStyle(isDark)}
                    onSelect={handlers.openEnrollModal}
                  >
                    <span>{ACTION_DEFINITIONS.enrollInClassroom.icon}</span>
                    <span>{ACTION_DEFINITIONS.enrollInClassroom.label}</span>
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Close button */}
          <button
            type="button"
            data-action="close"
            onClick={onClose}
            className={css({
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              fontSize: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              _hover: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
            })}
          >
            ×
          </button>
        </div>

        {/* Mini Start Practice Banner - shows session mode or active session */}
        <MiniStartPracticeBanner
          sessionMode={sessionMode ?? null}
          activity={activity}
          onStartPractice={handleBannerStartPractice}
          onResumePractice={handleBannerResumePractice}
        />

        {/* Tab bar - show if Overview has content or if we have stakeholder data */}
        {(hasOverviewContent || stakeholdersData) && (
          <div
            data-section="tabs"
            className={css({
              display: 'flex',
              borderBottom: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              backgroundColor: isDark ? 'gray.800' : 'gray.50',
            })}
          >
            {hasOverviewContent && (
              <TabButton
                label="Overview"
                isActive={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
                isDark={isDark}
              />
            )}
            <TabButton
              label="Notes"
              isActive={activeTab === 'notes'}
              onClick={() => setActiveTab('notes')}
              isDark={isDark}
            />
            <TabButton
              label="Relationships"
              isActive={activeTab === 'relationships'}
              onClick={() => setActiveTab('relationships')}
              isDark={isDark}
            />
          </div>
        )}

        {/* Tab content */}
        <div
          data-section="content"
          className={css({
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          })}
        >
          {activeTab === 'overview' && hasOverviewContent ? (
            <OverviewTab
              currentLevel={currentLevel}
              masteryPercent={masteryPercent}
              lastPracticedAt={lastPracticedAt}
              intervention={intervention}
              relationship={relationship}
              activity={activity}
              isDark={isDark}
            />
          ) : activeTab === 'relationships' ? (
            <RelationshipsTab playerId={student.id} />
          ) : (
            <NotesTab
              notes={student.notes ?? null}
              isEditing={isEditing}
              editedNotes={editedNotes}
              isSaving={isSaving}
              textareaRef={textareaRef}
              onEditedNotesChange={setEditedNotes}
              onStartEditing={() => setIsEditing(true)}
              onCancel={() => {
                setIsEditing(false)
                setEditedNotes(student.notes ?? '')
              }}
              onSave={handleSaveNotes}
              isDark={isDark}
            />
          )}
        </div>
      </animated.div>

      {/* Sub-modals - managed by shared hook */}
      <FamilyCodeDisplay
        playerId={student.id}
        playerName={student.name}
        isOpen={modals.shareAccess.isOpen}
        onClose={modals.shareAccess.close}
      />

      <EnrollChildModal
        isOpen={modals.enroll.isOpen}
        onClose={modals.enroll.close}
        playerId={student.id}
        playerName={student.name}
      />
    </>
  )
}

// ============================================================================
// Tab Button Component
// ============================================================================

interface TabButtonProps {
  label: string
  isActive: boolean
  onClick: () => void
  isDark: boolean
}

function TabButton({ label, isActive, onClick, isDark }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={css({
        flex: 1,
        padding: '12px 16px',
        border: 'none',
        backgroundColor: 'transparent',
        color: isActive ? (isDark ? 'blue.400' : 'blue.600') : isDark ? 'gray.400' : 'gray.600',
        fontSize: '0.875rem',
        fontWeight: isActive ? 'semibold' : 'normal',
        cursor: 'pointer',
        borderBottom: '2px solid',
        borderColor: isActive ? (isDark ? 'blue.400' : 'blue.600') : 'transparent',
        marginBottom: '-1px',
        transition: 'all 0.15s ease',
        _hover: {
          color: isDark ? 'blue.300' : 'blue.500',
        },
      })}
    >
      {label}
    </button>
  )
}

// ============================================================================
// Overview Tab Component
// ============================================================================

interface OverviewTabProps {
  currentLevel: number | null
  masteryPercent: number | null
  lastPracticedAt: Date | string | null
  intervention: UnifiedStudent['intervention'] | null
  relationship: StudentRelationship | null
  activity: StudentActivity | null
  isDark: boolean
}

function OverviewTab({
  currentLevel,
  masteryPercent,
  lastPracticedAt,
  intervention,
  relationship,
  activity,
  isDark,
}: OverviewTabProps) {
  const hasStats = currentLevel !== null || masteryPercent !== null

  return (
    <div
      className={css({
        flex: 1,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflow: 'auto',
      })}
    >
      {/* Status badges */}
      {(activity?.status === 'practicing' || relationship?.isPresent) && (
        <div
          data-element="status-badges"
          className={css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          })}
        >
          {activity?.status === 'practicing' && (
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 'medium',
                bg: isDark ? 'blue.900' : 'blue.100',
                color: isDark ? 'blue.300' : 'blue.700',
              })}
            >
              📝 Practicing
            </span>
          )}
          {relationship?.isPresent && activity?.status !== 'practicing' && (
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 'medium',
                bg: isDark ? 'green.900' : 'green.100',
                color: isDark ? 'green.300' : 'green.700',
              })}
            >
              🟢 In Classroom
            </span>
          )}
        </div>
      )}

      {/* Stats grid */}
      {hasStats && (
        <div
          data-element="stats-grid"
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
          })}
        >
          <StatBox label="Level" value={currentLevel?.toString() ?? '—'} isDark={isDark} />
          <StatBox
            label="Mastery"
            value={masteryPercent !== null ? `${masteryPercent}%` : '—'}
            isDark={isDark}
          />
          <StatBox
            label="Last Practice"
            value={formatLastPracticed(lastPracticedAt)}
            isDark={isDark}
          />
        </div>
      )}

      {/* Intervention alert */}
      {intervention && (
        <div
          data-element="intervention"
          className={css({
            padding: '12px',
            borderRadius: '8px',
            backgroundColor:
              intervention.severity === 'high'
                ? isDark
                  ? 'red.900/40'
                  : 'red.50'
                : intervention.severity === 'medium'
                  ? isDark
                    ? 'orange.900/40'
                    : 'orange.50'
                  : isDark
                    ? 'blue.900/40'
                    : 'blue.50',
            border: '1px solid',
            borderColor:
              intervention.severity === 'high'
                ? isDark
                  ? 'red.800'
                  : 'red.200'
                : intervention.severity === 'medium'
                  ? isDark
                    ? 'orange.800'
                    : 'orange.200'
                  : isDark
                    ? 'blue.800'
                    : 'blue.200',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          })}
        >
          <span className={css({ fontSize: '1.25rem' })}>{intervention.icon}</span>
          <div>
            <div
              className={css({
                fontSize: '0.8125rem',
                fontWeight: 'semibold',
                color:
                  intervention.severity === 'high'
                    ? isDark
                      ? 'red.300'
                      : 'red.700'
                    : intervention.severity === 'medium'
                      ? isDark
                        ? 'orange.300'
                        : 'orange.700'
                      : isDark
                        ? 'blue.300'
                        : 'blue.700',
              })}
            >
              {intervention.severity === 'high'
                ? 'Needs Attention'
                : intervention.severity === 'medium'
                  ? 'Suggestion'
                  : 'Note'}
            </div>
            <div
              className={css({
                fontSize: '0.8125rem',
                color: isDark ? 'gray.300' : 'gray.600',
                marginTop: '2px',
              })}
            >
              {intervention.message}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Stats Box Component
// ============================================================================

interface StatBoxProps {
  label: string
  value: string
  isDark: boolean
}

function StatBox({ label, value, isDark }: StatBoxProps) {
  return (
    <div
      className={css({
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: isDark ? 'gray.700' : 'gray.100',
        textAlign: 'center',
      })}
    >
      <div
        className={css({
          fontSize: '1.25rem',
          fontWeight: 'bold',
          color: isDark ? 'gray.100' : 'gray.800',
        })}
      >
        {value}
      </div>
      <div
        className={css({
          fontSize: '0.6875rem',
          color: isDark ? 'gray.400' : 'gray.500',
          marginTop: '2px',
        })}
      >
        {label}
      </div>
    </div>
  )
}

// ============================================================================
// Notes Tab Component
// ============================================================================

interface NotesTabProps {
  notes: string | null
  isEditing: boolean
  editedNotes: string
  isSaving: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement>
  onEditedNotesChange: (notes: string) => void
  onStartEditing: () => void
  onCancel: () => void
  onSave: () => void
  isDark: boolean
}

function NotesTab({
  notes,
  isEditing,
  editedNotes,
  isSaving,
  textareaRef,
  onEditedNotesChange,
  onStartEditing,
  onCancel,
  onSave,
  isDark,
}: NotesTabProps) {
  return (
    <div
      className={css({
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        gap: '12px',
        overflow: 'hidden',
        minHeight: 0,
      })}
    >
      {isEditing ? (
        <>
          <textarea
            ref={textareaRef}
            value={editedNotes}
            onChange={(e) => onEditedNotesChange(e.target.value)}
            placeholder="Add notes about this student..."
            className={css({
              flex: 1,
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: isDark ? 'gray.600' : 'gray.300',
              backgroundColor: isDark ? 'gray.700' : 'white',
              color: isDark ? 'gray.100' : 'gray.900',
              fontSize: '0.875rem',
              lineHeight: '1.5',
              resize: 'none',
              fontFamily: 'inherit',
              _focus: {
                outline: 'none',
                borderColor: isDark ? 'blue.500' : 'blue.400',
              },
              _placeholder: {
                color: isDark ? 'gray.500' : 'gray.400',
              },
            })}
          />
          <div
            className={css({
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end',
            })}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className={css({
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                backgroundColor: 'transparent',
                color: isDark ? 'gray.300' : 'gray.600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                _hover: { backgroundColor: isDark ? 'gray.700' : 'gray.100' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className={css({
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isDark ? 'green.600' : 'green.500',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 'medium',
                cursor: 'pointer',
                _hover: { backgroundColor: isDark ? 'green.500' : 'green.600' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div
            className={css({
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: isDark ? 'gray.700' : 'gray.100',
              overflow: 'auto',
              minHeight: 0,
            })}
          >
            {notes ? (
              <p
                className={css({
                  fontSize: '0.875rem',
                  lineHeight: '1.6',
                  color: isDark ? 'gray.200' : 'gray.700',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                })}
              >
                {notes}
              </p>
            ) : (
              <p
                className={css({
                  fontSize: '0.875rem',
                  color: isDark ? 'gray.500' : 'gray.400',
                  fontStyle: 'italic',
                  margin: 0,
                })}
              >
                No notes yet
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onStartEditing}
            className={css({
              alignSelf: 'flex-end',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isDark ? 'blue.600' : 'blue.500',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 'medium',
              cursor: 'pointer',
              _hover: { backgroundColor: isDark ? 'blue.500' : 'blue.600' },
            })}
          >
            {notes ? 'Edit Notes' : 'Add Notes'}
          </button>
        </>
      )}
    </div>
  )
}

// ============================================================================
// Relationships Tab Component
// ============================================================================

interface RelationshipsTabProps {
  playerId: string
}

function RelationshipsTab({ playerId }: RelationshipsTabProps) {
  return (
    <div
      className={css({
        flex: 1,
        padding: '16px',
        overflow: 'auto',
      })}
    >
      <RelationshipCard playerId={playerId} compact />
    </div>
  )
}

// ============================================================================
// Style Helper Functions
// ============================================================================

function menuItemStyle(isDark: boolean) {
  return css({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    outline: 'none',
    color: isDark ? 'gray.200' : 'gray.700',
    _hover: { backgroundColor: isDark ? 'gray.700' : 'gray.100' },
    _focus: { backgroundColor: isDark ? 'gray.700' : 'gray.100' },
  })
}

function separatorStyle(isDark: boolean) {
  return css({
    height: '1px',
    backgroundColor: isDark ? 'gray.700' : 'gray.200',
    margin: '4px 0',
  })
}
