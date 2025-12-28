'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ShareCodePanel } from '@/components/common'
import { Z_INDEX } from '@/constants/zIndex'
import { useTheme } from '@/contexts/ThemeContext'
import { useShareCode } from '@/hooks/useShareCode'
import {
  formatSkillChipName,
  getSkillDisplayName,
  searchSkills,
  type SkillSearchResult,
} from '@/utils/skillSearch'
import { css } from '../../../styled-system/css'
import { ViewSelector, type StudentView } from './ViewSelector'

interface StudentFilterBarProps {
  /** Currently selected view */
  currentView?: StudentView
  /** Callback when view changes */
  onViewChange?: (view: StudentView) => void
  /** Views to show (filtered by user type) */
  availableViews?: StudentView[]
  /** Counts per view */
  viewCounts?: Partial<Record<StudentView, number>>
  /** Classroom code for teachers to share */
  classroomCode?: string
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
  /** Callback when add student button is clicked */
  onAddStudent?: () => void
  /** Number of selected students (for bulk actions bar) */
  selectedCount?: number
  /** Callback when bulk archive is clicked */
  onBulkArchive?: () => void
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
  classroomCode,
  searchQuery,
  onSearchChange,
  skillFilters,
  onSkillFiltersChange,
  showArchived,
  onShowArchivedChange,
  archivedCount,
  onAddStudent,
  selectedCount = 0,
  onBulkArchive,
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
          <ViewSelector
            currentView={currentView}
            onViewChange={onViewChange}
            availableViews={availableViews}
            viewCounts={viewCounts}
          />

          {/* Classroom code - teachers only */}
          {classroomCode && <ClassroomShareChip code={classroomCode} />}
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

        {/* Add Student FAB */}
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
 * Compact share chip for classroom code with QR popover
 */
function ClassroomShareChip({ code }: { code: string }) {
  const shareCode = useShareCode({ type: 'classroom', code })
  return <ShareCodePanel shareCode={shareCode} compact showRegenerate={false} />
}
