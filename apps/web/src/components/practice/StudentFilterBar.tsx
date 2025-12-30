'use client'

import * as Popover from '@radix-ui/react-popover'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ShareCodePanel } from '@/components/common'
import { Z_INDEX } from '@/constants/zIndex'
import { useTheme } from '@/contexts/ThemeContext'
import { useUpdateClassroom } from '@/hooks/useClassroom'
import { useShareCode } from '@/hooks/useShareCode'
import type { Classroom } from '@/db/schema'
import {
  formatSkillChipName,
  getSkillDisplayName,
  searchSkills,
  type SkillSearchResult,
} from '@/utils/skillSearch'
import { css } from '../../../styled-system/css'
import { ViewSelector, TeacherCompoundChip, type StudentView } from './ViewSelector'

interface StudentFilterBarProps {
  /** Currently selected view */
  currentView?: StudentView
  /** Callback when view changes */
  onViewChange?: (view: StudentView) => void
  /** Views to show (filtered by user type) */
  availableViews?: StudentView[]
  /** Counts per view */
  viewCounts?: Partial<Record<StudentView, number>>
  /** Classroom data for teachers (includes code and settings) */
  classroom?: Classroom | null
  /** Current search query */
  searchQuery: string
  /** Callback when search query changes */
  onSearchChange: (query: string) => void
  /** Currently selected skill filter IDs */
  skillFilters: string[]
  /** Callback when skill filters change */
  onSkillFiltersChange: (skillIds: string[]) => void
  /** Whether to show archived students */
  showArchived: boolean
  /** Callback when archive toggle changes */
  onShowArchivedChange: (show: boolean) => void
  /** Number of archived students (for badge) */
  archivedCount: number
  /** Callback when add student button is clicked (parent mode - no auto-enroll) */
  onAddStudent?: () => void
  /** Callback when add student button is clicked from classroom controls (auto-enrolls) */
  onAddStudentToClassroom?: () => void
  /** Number of selected students (for bulk actions bar) */
  selectedCount?: number
  /** Callback when bulk archive is clicked */
  onBulkArchive?: () => void
  /** Callback when bulk prompt to enter is clicked */
  onBulkPromptToEnter?: () => void
  /** Number of students eligible for entry prompt (enrolled but not present) */
  promptEligibleCount?: number
  /** Callback to clear selection */
  onClearSelection?: () => void
}

/**
 * Filter bar for the student list.
 *
 * Features:
 * - Search input with debounce
 * - Skill autocomplete dropdown
 * - Skill filter pills with remove button
 * - Archive toggle button
 * - Bulk action bar (appears when students are selected)
 */
export function StudentFilterBar({
  currentView,
  onViewChange,
  availableViews,
  viewCounts,
  classroom,
  searchQuery,
  onSearchChange,
  skillFilters,
  onSkillFiltersChange,
  showArchived,
  onShowArchivedChange,
  archivedCount,
  onAddStudent,
  onAddStudentToClassroom,
  selectedCount = 0,
  onBulkArchive,
  onBulkPromptToEnter,
  promptEligibleCount = 0,
  onClearSelection,
}: StudentFilterBarProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [showDropdown, setShowDropdown] = useState(false)
  const [skillResults, setSkillResults] = useState<SkillSearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [localQuery, onSearchChange])

  // Search for skills as user types
  useEffect(() => {
    if (localQuery.trim()) {
      const results = searchSkills(localQuery)
      // Filter out already selected skills
      const filtered = results.filter((r) => !skillFilters.includes(r.skillId))
      setSkillResults(filtered)
      setShowDropdown(filtered.length > 0)
    } else {
      setSkillResults([])
      setShowDropdown(false)
    }
  }, [localQuery, skillFilters])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAddSkillFilter = useCallback(
    (skillId: string) => {
      onSkillFiltersChange([...skillFilters, skillId])
      setLocalQuery('')
      setShowDropdown(false)
    },
    [skillFilters, onSkillFiltersChange]
  )

  const handleRemoveSkillFilter = useCallback(
    (skillId: string) => {
      onSkillFiltersChange(skillFilters.filter((id) => id !== skillId))
    },
    [skillFilters, onSkillFiltersChange]
  )

  const handleClearAll = useCallback(() => {
    onSkillFiltersChange([])
    setLocalQuery('')
  }, [onSkillFiltersChange])

  return (
    <div
      data-component="student-filter-bar"
      className={css({
        position: 'fixed',
        top: '80px', // Below nav
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        bg: isDark ? 'gray.800' : 'white',
        borderBottom: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
        zIndex: Z_INDEX.FILTER_BAR,
      })}
    >
      {/* View selector row - only show if views are available */}
      {currentView && onViewChange && availableViews && availableViews.length > 0 && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          })}
        >
          {/* View selector with optional classroom card inline */}
          <ViewSelector
            currentView={currentView}
            onViewChange={onViewChange}
            availableViews={availableViews}
            viewCounts={viewCounts}
            hideTeacherCompound={!!classroom}
            classroomCard={
              classroom ? (
                <TeacherClassroomCard
                  classroom={classroom}
                  currentView={currentView}
                  onViewChange={onViewChange}
                  availableViews={availableViews}
                  viewCounts={viewCounts}
                  onAddStudentToClassroom={onAddStudentToClassroom}
                />
              ) : undefined
            }
          />
        </div>
      )}

      {/* Search row OR bulk action bar (mutually exclusive) */}
      <div
        className={css({
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
        })}
      >
        {selectedCount > 0 ? (
          /* Bulk action bar - replaces search when students are selected */
          <div
            data-element="bulk-actions"
            className={css({
              flex: '1',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              bg: isDark ? 'blue.900/50' : 'blue.50',
              border: '1px solid',
              borderColor: isDark ? 'blue.700' : 'blue.200',
              borderRadius: '8px',
            })}
          >
            <span
              className={css({
                fontSize: '14px',
                fontWeight: 'medium',
                color: isDark ? 'blue.200' : 'blue.700',
              })}
            >
              {selectedCount} selected
            </span>
            {onBulkArchive && (
              <button
                type="button"
                onClick={onBulkArchive}
                data-action="bulk-archive"
                className={css({
                  padding: '6px 12px',
                  bg: isDark ? 'red.700' : 'red.500',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  _hover: {
                    bg: isDark ? 'red.600' : 'red.600',
                  },
                })}
              >
                Archive
              </button>
            )}
            {onBulkPromptToEnter && promptEligibleCount > 0 && (
              <button
                type="button"
                onClick={onBulkPromptToEnter}
                data-action="bulk-prompt-to-enter"
                className={css({
                  padding: '6px 12px',
                  bg: isDark ? 'orange.700' : 'orange.500',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  _hover: {
                    bg: isDark ? 'orange.600' : 'orange.600',
                  },
                })}
              >
                Prompt to Enter ({promptEligibleCount})
              </button>
            )}
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                data-action="clear-selection"
                className={css({
                  padding: '6px 12px',
                  bg: 'transparent',
                  color: isDark ? 'gray.300' : 'gray.600',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  _hover: {
                    bg: isDark ? 'gray.700' : 'gray.100',
                  },
                })}
              >
                Clear
              </button>
            )}
          </div>
        ) : (
          /* Search input with dropdown */
          <>
            <div
              className={css({
                position: 'relative',
                flex: '1',
                minWidth: '200px',
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  bg: isDark ? 'gray.700' : 'gray.50',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  borderRadius: '8px',
                  _focusWithin: {
                    borderColor: 'blue.500',
                    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
                  },
                })}
              >
                <span className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>🔍</span>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search students or skills..."
                  value={localQuery}
                  onChange={(e) => setLocalQuery(e.target.value)}
                  onFocus={() => {
                    if (skillResults.length > 0) {
                      setShowDropdown(true)
                    }
                  }}
                  data-element="search-input"
                  className={css({
                    flex: 1,
                    bg: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: isDark ? 'gray.100' : 'gray.900',
                    fontSize: '14px',
                    _placeholder: {
                      color: isDark ? 'gray.500' : 'gray.400',
                    },
                  })}
                />
                {localQuery && (
                  <button
                    type="button"
                    onClick={() => setLocalQuery('')}
                    data-action="clear-search"
                    className={css({
                      color: isDark ? 'gray.400' : 'gray.500',
                      cursor: 'pointer',
                      padding: '2px',
                      _hover: { color: isDark ? 'gray.300' : 'gray.700' },
                    })}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Skill autocomplete dropdown */}
              {showDropdown && (
                <div
                  ref={dropdownRef}
                  data-element="skill-dropdown"
                  className={css({
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    bg: isDark ? 'gray.800' : 'white',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.200',
                    borderRadius: '8px',
                    boxShadow: 'lg',
                    zIndex: Z_INDEX.DROPDOWN,
                    maxHeight: '300px',
                    overflowY: 'auto',
                  })}
                >
                  <div
                    className={css({
                      padding: '8px 12px',
                      fontSize: '11px',
                      fontWeight: 'medium',
                      color: isDark ? 'gray.400' : 'gray.500',
                      borderBottom: '1px solid',
                      borderColor: isDark ? 'gray.700' : 'gray.100',
                    })}
                  >
                    Add skill filter (AND logic)
                  </div>
                  {skillResults.slice(0, 10).map((skill) => (
                    <button
                      key={skill.skillId}
                      type="button"
                      onClick={() => handleAddSkillFilter(skill.skillId)}
                      data-action="add-skill-filter"
                      data-skill-id={skill.skillId}
                      className={css({
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '2px',
                        padding: '10px 12px',
                        bg: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        _hover: { bg: isDark ? 'gray.700' : 'gray.50' },
                      })}
                    >
                      <span
                        className={css({
                          fontSize: '14px',
                          color: isDark ? 'gray.100' : 'gray.900',
                        })}
                      >
                        {skill.displayName}
                      </span>
                      <span
                        className={css({
                          fontSize: '12px',
                          color: isDark ? 'gray.500' : 'gray.500',
                        })}
                      >
                        {skill.categoryName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Archive toggle button */}
            <button
              type="button"
              onClick={() => onShowArchivedChange(!showArchived)}
              data-action="toggle-archived"
              data-status={showArchived ? 'showing' : 'hiding'}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                bg: showArchived
                  ? isDark
                    ? 'blue.900'
                    : 'blue.100'
                  : isDark
                    ? 'gray.700'
                    : 'gray.100',
                border: '1px solid',
                borderColor: showArchived
                  ? isDark
                    ? 'blue.700'
                    : 'blue.300'
                  : isDark
                    ? 'gray.600'
                    : 'gray.300',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                color: showArchived
                  ? isDark
                    ? 'blue.300'
                    : 'blue.700'
                  : isDark
                    ? 'gray.300'
                    : 'gray.700',
                transition: 'all 0.15s ease',
                _hover: {
                  borderColor: showArchived
                    ? isDark
                      ? 'blue.600'
                      : 'blue.400'
                    : isDark
                      ? 'gray.500'
                      : 'gray.400',
                },
              })}
            >
              <span>{showArchived ? '👁' : '👁‍🗨'}</span>
              <span>Archived</span>
              {archivedCount > 0 && (
                <span
                  className={css({
                    fontSize: '12px',
                    fontWeight: 'medium',
                    padding: '2px 6px',
                    bg: showArchived
                      ? isDark
                        ? 'blue.800'
                        : 'blue.200'
                      : isDark
                        ? 'gray.600'
                        : 'gray.200',
                    borderRadius: '10px',
                  })}
                >
                  {archivedCount}
                </span>
              )}
            </button>
          </>
        )}

        {/* Add Student FAB - always available for creating students */}
        {onAddStudent && (
          <button
            type="button"
            onClick={onAddStudent}
            data-action="add-student-fab"
            title="Add Student"
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              bg: isDark ? 'green.600' : 'green.500',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '24px',
              color: 'white',
              boxShadow:
                '0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
              _hover: {
                bg: isDark ? 'green.500' : 'green.600',
                boxShadow:
                  '0 5px 5px -3px rgba(0,0,0,0.2), 0 8px 10px 1px rgba(0,0,0,0.14), 0 3px 14px 2px rgba(0,0,0,0.12)',
                transform: 'scale(1.05)',
              },
              _active: {
                transform: 'scale(0.95)',
              },
            })}
          >
            +
          </button>
        )}
      </div>

      {/* Skill filter pills */}
      {skillFilters.length > 0 && (
        <div
          data-element="skill-filter-pills"
          className={css({
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
          })}
        >
          <span
            className={css({
              fontSize: '12px',
              fontWeight: 'medium',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Skill filters:
          </span>
          {skillFilters.map((skillId) => (
            <div
              key={skillId}
              data-element="skill-pill"
              data-skill-id={skillId}
              title={getSkillDisplayName(skillId)}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                bg: isDark ? 'blue.900' : 'blue.100',
                border: '1px solid',
                borderColor: isDark ? 'blue.700' : 'blue.300',
                borderRadius: '16px',
                fontSize: '12px',
                color: isDark ? 'blue.300' : 'blue.700',
              })}
            >
              <span>{formatSkillChipName(skillId)}</span>
              <button
                type="button"
                onClick={() => handleRemoveSkillFilter(skillId)}
                data-action="remove-skill-filter"
                className={css({
                  cursor: 'pointer',
                  padding: '0 2px',
                  color: isDark ? 'blue.400' : 'blue.600',
                  _hover: { color: isDark ? 'blue.200' : 'blue.800' },
                })}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleClearAll}
            data-action="clear-all-filters"
            className={css({
              fontSize: '12px',
              color: isDark ? 'gray.400' : 'gray.500',
              cursor: 'pointer',
              padding: '4px 8px',
              _hover: { color: isDark ? 'gray.200' : 'gray.700' },
            })}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Preset options for entry prompt expiry
 */
const EXPIRY_OPTIONS = [
  { value: null, label: 'Default (30 min)' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
] as const

export interface TeacherClassroomCardProps {
  classroom: Classroom
  currentView: StudentView
  onViewChange: (view: StudentView) => void
  availableViews: StudentView[]
  viewCounts?: Partial<Record<StudentView, number>>
  /** Callback for adding student (auto-enrolls in classroom) */
  onAddStudentToClassroom?: () => void
}

/**
 * Unified classroom control card for teachers
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ 📚 Mrs. Smith's Class          [ABC-123] [+Student] [⚙️]        │
 * ├──────────────────────────────────────────────────────────────────┤
 * │ [📋 Enrolled (10)]  [🏫 Present (5)]  [🎯 Active (2)]           │
 * └──────────────────────────────────────────────────────────────────┘
 */
export function TeacherClassroomCard({
  classroom,
  currentView,
  onViewChange,
  availableViews,
  viewCounts = {},
  onAddStudentToClassroom,
}: TeacherClassroomCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const updateClassroom = useUpdateClassroom()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [nameValue, setNameValue] = useState(classroom.name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Reset name value when classroom changes or settings popover opens
  useEffect(() => {
    setNameValue(classroom.name)
  }, [classroom.name, isSettingsOpen])

  const handleNameSave = useCallback(() => {
    const trimmedName = nameValue.trim()
    if (trimmedName && trimmedName !== classroom.name) {
      updateClassroom.mutate({
        classroomId: classroom.id,
        name: trimmedName,
      })
    }
  }, [classroom.id, classroom.name, nameValue, updateClassroom])

  const handleExpiryChange = useCallback(
    (value: number | null) => {
      updateClassroom.mutate({
        classroomId: classroom.id,
        entryPromptExpiryMinutes: value,
      })
    },
    [classroom.id, updateClassroom]
  )

  const currentExpiry = classroom.entryPromptExpiryMinutes

  return (
    <div
      data-component="teacher-classroom-card"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: isDark ? 'gray.600' : 'gray.300',
        bg: isDark ? 'gray.750' : 'gray.50',
        overflow: 'hidden',
        flexShrink: 0,
      })}
    >
      {/* Header row: Action buttons only - classroom name is now in first segment */}
      <div
        data-element="classroom-card-header"
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
          padding: '4px 8px',
          borderBottom: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        {/* Action buttons - minimal icons */}
        <div
          data-element="classroom-actions"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            flexShrink: 0,
          })}
        >
          {/* Add student button - opens unified modal with share code, create, family code */}
          {onAddStudentToClassroom && (
            <button
              type="button"
              onClick={onAddStudentToClassroom}
              data-action="add-student-to-classroom"
              title="Add Student to Classroom"
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '22px',
                height: '22px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                color: isDark ? 'green.400' : 'green.600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                _hover: {
                  backgroundColor: isDark ? 'green.900' : 'green.100',
                },
              })}
            >
              +
            </button>
          )}

          {/* Settings button with popover - icon only */}
          <Popover.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                data-action="open-classroom-settings"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '22px',
                  height: '22px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: isDark ? 'gray.400' : 'gray.500',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  _hover: {
                    backgroundColor: isDark ? 'gray.700' : 'gray.200',
                  },
                })}
                aria-label="Classroom settings"
              >
                ⚙️
              </button>
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Content
                data-component="classroom-settings-popover"
                side="bottom"
                align="end"
                sideOffset={8}
                className={css({
                  width: '240px',
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  boxShadow: 'lg',
                  padding: '12px',
                  zIndex: Z_INDEX.POPOVER,
                  animation: 'fadeIn 0.15s ease',
                })}
              >
                <h3
                  className={css({
                    fontSize: '13px',
                    fontWeight: '600',
                    color: isDark ? 'gray.200' : 'gray.700',
                    marginBottom: '12px',
                  })}
                >
                  Classroom Settings
                </h3>

                {/* Classroom name setting */}
                <div data-setting="classroom-name" className={css({ marginBottom: '12px' })}>
                  <label
                    className={css({
                      display: 'block',
                      fontSize: '12px',
                      color: isDark ? 'gray.400' : 'gray.500',
                      marginBottom: '4px',
                    })}
                  >
                    Classroom name
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleNameSave()
                      } else if (e.key === 'Escape') {
                        setNameValue(classroom.name)
                      }
                    }}
                    onBlur={handleNameSave}
                    disabled={updateClassroom.isPending}
                    className={css({
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isDark ? 'gray.600' : 'gray.300',
                      backgroundColor: isDark ? 'gray.700' : 'white',
                      color: isDark ? 'gray.100' : 'gray.800',
                      cursor: updateClassroom.isPending ? 'wait' : 'text',
                      opacity: updateClassroom.isPending ? 0.7 : 1,
                      _focus: {
                        outline: '2px solid',
                        outlineColor: 'blue.500',
                        outlineOffset: '1px',
                      },
                    })}
                  />
                </div>

                {/* Entry prompt expiry setting */}
                <div data-setting="entry-prompt-expiry">
                  <label
                    className={css({
                      display: 'block',
                      fontSize: '12px',
                      color: isDark ? 'gray.400' : 'gray.500',
                      marginBottom: '4px',
                    })}
                  >
                    Entry prompt expires after
                  </label>
                  <select
                    value={currentExpiry ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      handleExpiryChange(val === '' ? null : Number(val))
                    }}
                    disabled={updateClassroom.isPending}
                    className={css({
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isDark ? 'gray.600' : 'gray.300',
                      backgroundColor: isDark ? 'gray.700' : 'white',
                      color: isDark ? 'gray.100' : 'gray.800',
                      cursor: updateClassroom.isPending ? 'wait' : 'pointer',
                      opacity: updateClassroom.isPending ? 0.7 : 1,
                      _focus: {
                        outline: '2px solid',
                        outlineColor: 'blue.500',
                        outlineOffset: '1px',
                      },
                    })}
                  >
                    {EXPIRY_OPTIONS.map((opt) => (
                      <option key={opt.value ?? 'default'} value={opt.value ?? ''}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p
                    className={css({
                      fontSize: '11px',
                      color: isDark ? 'gray.500' : 'gray.400',
                      marginTop: '4px',
                      lineHeight: '1.4',
                    })}
                  >
                    How long parents have to respond before the entry prompt expires
                  </p>
                </div>

                <Popover.Arrow
                  className={css({
                    fill: isDark ? 'gray.800' : 'white',
                  })}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>

      {/* Filter row: Embedded compound chip - flush with card edges */}
      <TeacherCompoundChip
        currentView={currentView}
        onViewChange={onViewChange}
        viewCounts={viewCounts}
        availableViews={availableViews}
        embedded
        classroomName={classroom.name}
      />
    </div>
  )
}

/**
 * Classroom share chip with settings popover (legacy, keeping for reference)
 * @deprecated Use TeacherClassroomCard instead
 */
function ClassroomChipWithSettings({ classroom }: { classroom: Classroom }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const shareCode = useShareCode({ type: 'classroom', code: classroom.code })
  const updateClassroom = useUpdateClassroom()
  const [isOpen, setIsOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(classroom.name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Reset name value when classroom changes or popover opens
  useEffect(() => {
    setNameValue(classroom.name)
    setEditingName(false)
  }, [classroom.name, isOpen])

  // Focus input when editing starts
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editingName])

  const handleNameSave = useCallback(() => {
    const trimmedName = nameValue.trim()
    if (trimmedName && trimmedName !== classroom.name) {
      updateClassroom.mutate({
        classroomId: classroom.id,
        name: trimmedName,
      })
    }
    setEditingName(false)
  }, [classroom.id, classroom.name, nameValue, updateClassroom])

  const handleExpiryChange = useCallback(
    (value: number | null) => {
      updateClassroom.mutate({
        classroomId: classroom.id,
        entryPromptExpiryMinutes: value,
      })
    },
    [classroom.id, updateClassroom]
  )

  const currentExpiry = classroom.entryPromptExpiryMinutes

  return (
    <div
      data-element="classroom-share-and-settings"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      })}
    >
      <ShareCodePanel shareCode={shareCode} compact showRegenerate={false} />

      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            data-action="open-classroom-settings"
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.300',
              backgroundColor: isDark ? 'gray.800' : 'white',
              color: isDark ? 'gray.400' : 'gray.500',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              _hover: {
                backgroundColor: isDark ? 'gray.700' : 'gray.100',
                borderColor: isDark ? 'gray.600' : 'gray.400',
              },
            })}
            aria-label="Classroom settings"
          >
            ⚙️
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            data-component="classroom-settings-popover"
            side="bottom"
            align="end"
            sideOffset={8}
            className={css({
              width: '240px',
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              boxShadow: 'lg',
              padding: '12px',
              zIndex: Z_INDEX.POPOVER,
              animation: 'fadeIn 0.15s ease',
            })}
          >
            <h3
              className={css({
                fontSize: '13px',
                fontWeight: '600',
                color: isDark ? 'gray.200' : 'gray.700',
                marginBottom: '12px',
              })}
            >
              Classroom Settings
            </h3>

            {/* Classroom name */}
            <div data-setting="classroom-name" className={css({ marginBottom: '12px' })}>
              <label
                className={css({
                  display: 'block',
                  fontSize: '12px',
                  color: isDark ? 'gray.400' : 'gray.500',
                  marginBottom: '4px',
                })}
              >
                Classroom Name
              </label>
              {editingName ? (
                <div className={css({ display: 'flex', gap: '4px' })}>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleNameSave()
                      } else if (e.key === 'Escape') {
                        setNameValue(classroom.name)
                        setEditingName(false)
                      }
                    }}
                    onBlur={handleNameSave}
                    disabled={updateClassroom.isPending}
                    className={css({
                      flex: 1,
                      padding: '6px 8px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: 'blue.500',
                      backgroundColor: isDark ? 'gray.700' : 'white',
                      color: isDark ? 'gray.100' : 'gray.800',
                      outline: '2px solid',
                      outlineColor: 'blue.500',
                      outlineOffset: '1px',
                    })}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.300',
                    backgroundColor: isDark ? 'gray.700' : 'white',
                    color: isDark ? 'gray.100' : 'gray.800',
                    cursor: 'pointer',
                    textAlign: 'left',
                    _hover: {
                      borderColor: isDark ? 'gray.500' : 'gray.400',
                      backgroundColor: isDark ? 'gray.600' : 'gray.50',
                    },
                  })}
                >
                  <span
                    className={css({
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    })}
                  >
                    {classroom.name}
                  </span>
                  <span
                    className={css({
                      fontSize: '11px',
                      color: isDark ? 'gray.400' : 'gray.400',
                      flexShrink: 0,
                      marginLeft: '8px',
                    })}
                  >
                    ✏️
                  </span>
                </button>
              )}
            </div>

            {/* Entry prompt expiry setting */}
            <div data-setting="entry-prompt-expiry">
              <label
                className={css({
                  display: 'block',
                  fontSize: '12px',
                  color: isDark ? 'gray.400' : 'gray.500',
                  marginBottom: '4px',
                })}
              >
                Entry prompt expires after
              </label>
              <select
                value={currentExpiry ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  handleExpiryChange(val === '' ? null : Number(val))
                }}
                disabled={updateClassroom.isPending}
                className={css({
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  backgroundColor: isDark ? 'gray.700' : 'white',
                  color: isDark ? 'gray.100' : 'gray.800',
                  cursor: updateClassroom.isPending ? 'wait' : 'pointer',
                  opacity: updateClassroom.isPending ? 0.7 : 1,
                  _focus: {
                    outline: '2px solid',
                    outlineColor: 'blue.500',
                    outlineOffset: '1px',
                  },
                })}
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.value ?? 'default'} value={opt.value ?? ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p
                className={css({
                  fontSize: '11px',
                  color: isDark ? 'gray.500' : 'gray.400',
                  marginTop: '4px',
                  lineHeight: '1.4',
                })}
              >
                How long parents have to respond before the entry prompt expires
              </p>
            </div>

            <Popover.Arrow
              className={css({
                fill: isDark ? 'gray.800' : 'white',
              })}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
