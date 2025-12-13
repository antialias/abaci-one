'use client'

import * as Accordion from '@radix-ui/react-accordion'
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { FLUENCY_CONFIG, type FluencyState } from '@/db/schema/player-skill-mastery'
import type { PlayerSkillMastery } from '@/db/schema/player-skill-mastery'
import {
  BASE_SKILL_COMPLEXITY,
  computeMasteryState,
  type MasteryState,
} from '@/utils/skillComplexity'
import { css } from '../../../styled-system/css'

/**
 * Skill categories and their human-readable names
 */
const SKILL_CATEGORIES = {
  basic: {
    name: 'Basic Skills',
    skills: {
      directAddition: 'Direct Addition (1-4)',
      heavenBead: 'Heaven Bead (5)',
      simpleCombinations: 'Simple Combinations (6-9)',
      directSubtraction: 'Direct Subtraction (1-4)',
      heavenBeadSubtraction: 'Heaven Bead Subtraction (5)',
      simpleCombinationsSub: 'Simple Combinations Subtraction (6-9)',
    },
  },
  fiveComplements: {
    name: 'Five Complements (Addition)',
    skills: {
      '4=5-1': '+4 = +5 - 1',
      '3=5-2': '+3 = +5 - 2',
      '2=5-3': '+2 = +5 - 3',
      '1=5-4': '+1 = +5 - 4',
    },
  },
  fiveComplementsSub: {
    name: 'Five Complements (Subtraction)',
    skills: {
      '-4=-5+1': '-4 = -5 + 1',
      '-3=-5+2': '-3 = -5 + 2',
      '-2=-5+3': '-2 = -5 + 3',
      '-1=-5+4': '-1 = -5 + 4',
    },
  },
  tenComplements: {
    name: 'Ten Complements (Addition)',
    skills: {
      '9=10-1': '+9 = +10 - 1',
      '8=10-2': '+8 = +10 - 2',
      '7=10-3': '+7 = +10 - 3',
      '6=10-4': '+6 = +10 - 4',
      '5=10-5': '+5 = +10 - 5',
      '4=10-6': '+4 = +10 - 6',
      '3=10-7': '+3 = +10 - 7',
      '2=10-8': '+2 = +10 - 8',
      '1=10-9': '+1 = +10 - 9',
    },
  },
  tenComplementsSub: {
    name: 'Ten Complements (Subtraction)',
    skills: {
      '-9=+1-10': '-9 = +1 - 10',
      '-8=+2-10': '-8 = +2 - 10',
      '-7=+3-10': '-7 = +3 - 10',
      '-6=+4-10': '-6 = +4 - 10',
      '-5=+5-10': '-5 = +5 - 10',
      '-4=+6-10': '-4 = +6 - 10',
      '-3=+7-10': '-3 = +7 - 10',
      '-2=+8-10': '-2 = +8 - 10',
      '-1=+9-10': '-1 = +9 - 10',
    },
  },
  advanced: {
    name: 'Advanced Multi-Column Operations',
    skills: {
      cascadingCarry: 'Cascading Carry (e.g., 999 + 1 = 1000)',
      cascadingBorrow: 'Cascading Borrow (e.g., 1000 - 1 = 999)',
    },
  },
} as const

type CategoryKey = keyof typeof SKILL_CATEGORIES

/**
 * ComplexityBadge - Shows the base complexity cost for a skill
 *
 * Base costs represent intrinsic mechanical complexity:
 * - 0★ Trivial: Basic bead movements, no mental calculation
 * - 1★ Simple: Single complement (one mental substitution)
 * - 2★ Cross-column: Operations that cross column boundaries (ten complements)
 * - 3★ Cascading: Multi-column cascading operations (advanced)
 */
function ComplexityBadge({ skillId, isDark }: { skillId: string; isDark: boolean }) {
  const baseCost = BASE_SKILL_COMPLEXITY[skillId] ?? 1

  // No badge for zero-cost (trivial) skills
  if (baseCost === 0) {
    return null
  }

  const styles: Record<number, { bg: string; text: string; label: string }> = {
    1: {
      bg: isDark ? 'green.900' : 'green.100',
      text: isDark ? 'green.300' : 'green.700',
      label: '1★',
    },
    2: {
      bg: isDark ? 'orange.900' : 'orange.100',
      text: isDark ? 'orange.300' : 'orange.700',
      label: '2★',
    },
    3: {
      bg: isDark ? 'red.900' : 'red.100',
      text: isDark ? 'red.300' : 'red.700',
      label: '3★',
    },
  }

  const style = styles[baseCost] ?? styles[1]

  return (
    <span
      data-element="complexity-badge"
      data-complexity={baseCost}
      title={`Base complexity: ${baseCost}`}
      className={css({
        fontSize: '10px',
        fontWeight: 'bold',
        px: '1.5',
        py: '0.5',
        borderRadius: 'sm',
        bg: style.bg,
        color: style.text,
        whiteSpace: 'nowrap',
      })}
    >
      {style.label}
    </span>
  )
}

/**
 * ComplexityLegend - Shows explanation of complexity badges
 */
function ComplexityLegend({ isDark }: { isDark: boolean }) {
  return (
    <div
      data-element="complexity-legend"
      className={css({
        display: 'flex',
        flexWrap: 'wrap',
        gap: '3',
        fontSize: 'xs',
        color: isDark ? 'gray.400' : 'gray.600',
        p: '2',
        bg: isDark ? 'gray.750' : 'gray.50',
        borderRadius: 'md',
        mb: '3',
      })}
    >
      <span className={css({ fontWeight: 'medium' })}>Complexity:</span>
      <span className={css({ display: 'flex', alignItems: 'center', gap: '1' })}>
        <span
          className={css({
            fontSize: '10px',
            fontWeight: 'bold',
            px: '1.5',
            py: '0.5',
            borderRadius: 'sm',
            bg: isDark ? 'green.900' : 'green.100',
            color: isDark ? 'green.300' : 'green.700',
          })}
        >
          1★
        </span>
        Simple
      </span>
      <span className={css({ display: 'flex', alignItems: 'center', gap: '1' })}>
        <span
          className={css({
            fontSize: '10px',
            fontWeight: 'bold',
            px: '1.5',
            py: '0.5',
            borderRadius: 'sm',
            bg: isDark ? 'orange.900' : 'orange.100',
            color: isDark ? 'orange.300' : 'orange.700',
          })}
        >
          2★
        </span>
        Cross-column
      </span>
      <span className={css({ display: 'flex', alignItems: 'center', gap: '1' })}>
        <span
          className={css({
            fontSize: '10px',
            fontWeight: 'bold',
            px: '1.5',
            py: '0.5',
            borderRadius: 'sm',
            bg: isDark ? 'red.900' : 'red.100',
            color: isDark ? 'red.300' : 'red.700',
          })}
        >
          3★
        </span>
        Cascading
      </span>
    </div>
  )
}

/**
 * FluencyStateBadge - Shows the recency-based fluency state for a skill
 *
 * For practicing skills, shows how fluent they are:
 * - effortless: Fluent + recently practiced (within 14 days) - automatic recall
 * - fluent: Fluent + practiced 14-30 days ago - solid but warming up
 * - rusty: Fluent but >30 days since practice - needs rebuilding
 * - practicing: In rotation but not yet fluent
 */
function FluencyStateBadge({
  fluencyState,
  isDark,
  compact = false,
}: {
  fluencyState: FluencyState
  isDark: boolean
  compact?: boolean
}) {
  // Show badges for all fluency states
  const styles: Record<FluencyState, { bg: string; text: string; label: string; icon: string }> = {
    effortless: {
      bg: isDark ? 'green.900' : 'green.100',
      text: isDark ? 'green.300' : 'green.700',
      label: 'Effortless',
      icon: '✓',
    },
    fluent: {
      bg: isDark ? 'blue.900' : 'blue.100',
      text: isDark ? 'blue.300' : 'blue.700',
      label: 'Fluent',
      icon: '○',
    },
    rusty: {
      bg: isDark ? 'amber.900' : 'amber.100',
      text: isDark ? 'amber.300' : 'amber.700',
      label: 'Rusty',
      icon: '⚠',
    },
    practicing: {
      bg: isDark ? 'purple.900' : 'purple.100',
      text: isDark ? 'purple.300' : 'purple.700',
      label: 'Practicing',
      icon: '◐',
    },
  }

  const style = styles[fluencyState]
  if (!style) return null

  return (
    <span
      data-element="fluency-state-badge"
      data-state={fluencyState}
      title={
        fluencyState === 'effortless'
          ? `Fluent + recently practiced (within ${FLUENCY_CONFIG.effortlessDays} days)`
          : fluencyState === 'fluent'
            ? `Fluent, practiced ${FLUENCY_CONFIG.effortlessDays}-${FLUENCY_CONFIG.fluentDays} days ago`
            : fluencyState === 'rusty'
              ? `Fluent but not practiced for ${FLUENCY_CONFIG.fluentDays}+ days`
              : 'In practice rotation, building fluency'
      }
      className={css({
        fontSize: compact ? '9px' : '10px',
        fontWeight: 'medium',
        px: compact ? '1' : '1.5',
        py: '0.5',
        borderRadius: 'sm',
        bg: style.bg,
        color: style.text,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '1',
      })}
    >
      <span>{style.icon}</span>
      {!compact && <span>{style.label}</span>}
    </span>
  )
}

/**
 * Calculate days since a date
 */
function daysSince(date: Date | null | undefined): number | undefined {
  if (!date) return undefined
  const now = new Date()
  return Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Book preset mappings (SAI Abacus Mind Math levels)
 */
const BOOK_PRESETS = {
  'sai-level-1': {
    name: 'Abacus Mind Math - Level 1',
    description: 'Basic operations, no regrouping',
    skills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'basic.directSubtraction',
      'basic.heavenBeadSubtraction',
      'basic.simpleCombinationsSub',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplements.1=5-4',
      'fiveComplementsSub.-4=-5+1',
      'fiveComplementsSub.-3=-5+2',
      'fiveComplementsSub.-2=-5+3',
      'fiveComplementsSub.-1=-5+4',
    ],
  },
  'sai-level-2': {
    name: 'Abacus Mind Math - Level 2',
    description: 'Five complements mastered, practicing speed',
    skills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'basic.directSubtraction',
      'basic.heavenBeadSubtraction',
      'basic.simpleCombinationsSub',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplements.1=5-4',
      'fiveComplementsSub.-4=-5+1',
      'fiveComplementsSub.-3=-5+2',
      'fiveComplementsSub.-2=-5+3',
      'fiveComplementsSub.-1=-5+4',
    ],
  },
  'sai-level-3': {
    name: 'Abacus Mind Math - Level 3',
    description: 'Ten complements (carrying/borrowing)',
    skills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'basic.directSubtraction',
      'basic.heavenBeadSubtraction',
      'basic.simpleCombinationsSub',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplements.1=5-4',
      'fiveComplementsSub.-4=-5+1',
      'fiveComplementsSub.-3=-5+2',
      'fiveComplementsSub.-2=-5+3',
      'fiveComplementsSub.-1=-5+4',
      'tenComplements.9=10-1',
      'tenComplements.8=10-2',
      'tenComplements.7=10-3',
      'tenComplements.6=10-4',
      'tenComplements.5=10-5',
      'tenComplements.4=10-6',
      'tenComplements.3=10-7',
      'tenComplements.2=10-8',
      'tenComplements.1=10-9',
      'tenComplementsSub.-9=+1-10',
      'tenComplementsSub.-8=+2-10',
      'tenComplementsSub.-7=+3-10',
      'tenComplementsSub.-6=+4-10',
      'tenComplementsSub.-5=+5-10',
      'tenComplementsSub.-4=+6-10',
      'tenComplementsSub.-3=+7-10',
      'tenComplementsSub.-2=+8-10',
      'tenComplementsSub.-1=+9-10',
    ],
  },
} as const

export interface ManualSkillSelectorProps {
  /** Whether modal is open */
  open: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Student name (for display) */
  studentName: string
  /** Student ID for saving */
  playerId: string
  /** Currently mastered skill IDs (deprecated, use skillMasteryData instead) */
  currentMasteredSkills?: string[]
  /** Full skill mastery data including lastPracticedAt for recency display */
  skillMasteryData?: PlayerSkillMastery[]
  /** Callback when save is clicked */
  onSave: (masteredSkillIds: string[]) => Promise<void>
  /** Callback to refresh a skill's lastPracticedAt (marks as recently practiced) */
  onRefreshSkill?: (skillId: string) => Promise<void>
}

/**
 * ManualSkillSelector - Modal for manually setting student skill mastery
 *
 * Allows teachers to:
 * - Select which skills a student has mastered
 * - Use book level presets to auto-populate
 * - Adjust individual skills before saving
 */
export function ManualSkillSelector({
  open,
  onClose,
  studentName,
  playerId,
  currentMasteredSkills = [],
  skillMasteryData = [],
  onSave,
  onRefreshSkill,
}: ManualSkillSelectorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set(currentMasteredSkills))
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])

  // Build a map from skill ID to mastery data for quick lookup
  const skillMasteryMap = new Map(skillMasteryData.map((s) => [s.skillId, s]))

  /**
   * Get the fluency state for a skill (effortless/fluent/rusty/practicing)
   * Returns undefined if the skill is not in the practice rotation
   */
  const getFluencyStateForSkill = (skillId: string): FluencyState | undefined => {
    const mastery = skillMasteryMap.get(skillId)
    if (!mastery || !mastery.isPracticing) return undefined
    const days = daysSince(mastery.lastPracticedAt)
    const state = computeMasteryState(
      mastery.isPracticing,
      mastery.attempts,
      mastery.correct,
      mastery.consecutiveCorrect,
      days
    )
    // computeMasteryState returns MasteryState which includes 'not_practicing'
    // But we already checked isPracticing, so we know it's a FluencyState
    return state as FluencyState
  }

  /**
   * Handle refreshing a skill (sets lastPracticedAt to today)
   */
  const handleRefreshSkill = async (skillId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Don't toggle the checkbox
    if (!onRefreshSkill || isRefreshing) return

    setIsRefreshing(skillId)
    try {
      await onRefreshSkill(skillId)
    } catch (error) {
      console.error('Failed to refresh skill:', error)
    } finally {
      setIsRefreshing(null)
    }
  }

  // Sync selected skills when modal opens with new data
  useEffect(() => {
    if (open) {
      setSelectedSkills(new Set(currentMasteredSkills))
    }
  }, [open, currentMasteredSkills])

  const handlePresetChange = (presetKey: string) => {
    if (presetKey === '') {
      // Clear all
      setSelectedSkills(new Set())
      return
    }

    const preset = BOOK_PRESETS[presetKey as keyof typeof BOOK_PRESETS]
    if (preset) {
      setSelectedSkills(new Set(preset.skills))
      // Expand all categories to show changes
      setExpandedCategories(Object.keys(SKILL_CATEGORIES))
    }
  }

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev)
      if (next.has(skillId)) {
        next.delete(skillId)
      } else {
        next.add(skillId)
      }
      return next
    })
  }

  const toggleCategory = (category: CategoryKey) => {
    const categorySkills = Object.keys(SKILL_CATEGORIES[category].skills).map(
      (skill) => `${category}.${skill}`
    )
    const allSelected = categorySkills.every((id) => selectedSkills.has(id))

    setSelectedSkills((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        // Deselect all in category
        for (const id of categorySkills) {
          next.delete(id)
        }
      } else {
        // Select all in category
        for (const id of categorySkills) {
          next.add(id)
        }
      }
      return next
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(Array.from(selectedSkills))
      onClose()
    } catch (error) {
      console.error('Failed to save skills:', error)
      alert('Failed to save skills. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const selectedCount = selectedSkills.size
  const totalSkills = Object.values(SKILL_CATEGORIES).reduce(
    (sum, cat) => sum + Object.keys(cat.skills).length,
    0
  )

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: 'fixed',
            inset: 0,
            bg: 'rgba(0, 0, 0, 0.5)',
            zIndex: 50,
          })}
        />
        <Dialog.Content
          data-component="manual-skill-selector"
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bg: isDark ? 'gray.800' : 'white',
            borderRadius: 'xl',
            boxShadow: 'xl',
            p: '6',
            maxWidth: '550px',
            width: '90vw',
            maxHeight: '85vh',
            overflowY: 'auto',
            zIndex: 51,
          })}
        >
          {/* Header */}
          <div className={css({ mb: '5' })}>
            <Dialog.Title
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.900',
              })}
            >
              Set Skills for {studentName}
            </Dialog.Title>
            <Dialog.Description
              className={css({
                fontSize: 'sm',
                color: isDark ? 'gray.400' : 'gray.600',
                mt: '1',
              })}
            >
              Select the skills this student has already mastered. You can use a book level preset
              or select individual skills.
            </Dialog.Description>
          </div>

          {/* Book Preset Selector */}
          <div className={css({ mb: '4' })}>
            <label
              htmlFor="preset-select"
              className={css({
                display: 'block',
                fontSize: 'sm',
                fontWeight: 'semibold',
                color: isDark ? 'gray.300' : 'gray.700',
                mb: '2',
              })}
            >
              Import from Book Level
            </label>
            <select
              id="preset-select"
              data-element="book-preset-select"
              onChange={(e) => handlePresetChange(e.target.value)}
              className={css({
                width: '100%',
                px: '3',
                py: '2',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                borderRadius: 'md',
                bg: isDark ? 'gray.700' : 'white',
                color: isDark ? 'gray.100' : 'gray.900',
                fontSize: 'sm',
                cursor: 'pointer',
                _focus: {
                  outline: 'none',
                  borderColor: 'blue.500',
                  ring: '2px',
                  ringColor: 'blue.500/20',
                },
              })}
            >
              <option value="">-- Select a preset --</option>
              {Object.entries(BOOK_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.name} - {preset.description}
                </option>
              ))}
            </select>
          </div>

          {/* Selected count */}
          <div
            className={css({
              fontSize: 'sm',
              color: isDark ? 'gray.400' : 'gray.600',
              mb: '3',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            })}
          >
            <span>
              {selectedCount} of {totalSkills} skills marked as mastered
            </span>
            <button
              type="button"
              onClick={() => setSelectedSkills(new Set())}
              className={css({
                fontSize: 'xs',
                color: isDark ? 'red.400' : 'red.600',
                bg: 'transparent',
                border: 'none',
                cursor: 'pointer',
                _hover: { textDecoration: 'underline' },
              })}
            >
              Clear All
            </button>
          </div>

          {/* Complexity Legend */}
          <ComplexityLegend isDark={isDark} />

          {/* Skills Accordion */}
          <Accordion.Root
            type="multiple"
            value={expandedCategories}
            onValueChange={setExpandedCategories}
            className={css({
              border: '1px solid',
              borderColor: isDark ? 'gray.600' : 'gray.200',
              borderRadius: 'lg',
              overflow: 'hidden',
            })}
          >
            {(
              Object.entries(SKILL_CATEGORIES) as [
                CategoryKey,
                (typeof SKILL_CATEGORIES)[CategoryKey],
              ][]
            ).map(([categoryKey, category]) => {
              const categorySkillIds = Object.keys(category.skills).map(
                (skill) => `${categoryKey}.${skill}`
              )
              const selectedInCategory = categorySkillIds.filter((id) =>
                selectedSkills.has(id)
              ).length
              const allSelected = selectedInCategory === categorySkillIds.length
              const someSelected = selectedInCategory > 0 && !allSelected

              return (
                <Accordion.Item
                  key={categoryKey}
                  value={categoryKey}
                  className={css({
                    borderBottom: '1px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.200',
                    _last: { borderBottom: 'none' },
                  })}
                >
                  <Accordion.Header>
                    <Accordion.Trigger
                      className={css({
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        bg: isDark ? 'gray.700' : 'gray.50',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        _hover: { bg: isDark ? 'gray.600' : 'gray.100' },
                      })}
                    >
                      <div
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3',
                        })}
                      >
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected
                          }}
                          onChange={(e) => {
                            e.stopPropagation()
                            toggleCategory(categoryKey)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={css({
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer',
                          })}
                        />
                        <span
                          className={css({
                            fontWeight: 'semibold',
                            color: isDark ? 'gray.100' : 'gray.800',
                          })}
                        >
                          {category.name}
                        </span>
                      </div>
                      <div
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2',
                        })}
                      >
                        <span
                          className={css({
                            fontSize: 'xs',
                            color: isDark ? 'gray.400' : 'gray.500',
                          })}
                        >
                          {selectedInCategory}/{categorySkillIds.length}
                        </span>
                        <span
                          className={css({
                            transition: 'transform 0.2s',
                          })}
                        >
                          {expandedCategories.includes(categoryKey) ? '▲' : '▼'}
                        </span>
                      </div>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content
                    className={css({
                      overflow: 'hidden',
                      bg: isDark ? 'gray.800' : 'white',
                    })}
                  >
                    <div className={css({ p: '3' })}>
                      {Object.entries(category.skills).map(([skillKey, skillName]) => {
                        const skillId = `${categoryKey}.${skillKey}`
                        const isSelected = selectedSkills.has(skillId)
                        const fluencyState = getFluencyStateForSkill(skillId)
                        const isRustyOrOlder =
                          fluencyState === 'rusty' || (isSelected && !skillMasteryMap.has(skillId))
                        const showRefreshButton = isSelected && onRefreshSkill && isRustyOrOlder

                        return (
                          <label
                            key={skillId}
                            className={css({
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3',
                              padding: '8px 12px',
                              borderRadius: 'md',
                              cursor: 'pointer',
                              _hover: { bg: isDark ? 'gray.700' : 'gray.50' },
                            })}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSkill(skillId)}
                              className={css({
                                width: '16px',
                                height: '16px',
                                cursor: 'pointer',
                              })}
                            />
                            <ComplexityBadge skillId={skillId} isDark={isDark} />
                            <span
                              className={css({
                                fontSize: 'sm',
                                color: isSelected
                                  ? isDark
                                    ? 'green.400'
                                    : 'green.700'
                                  : isDark
                                    ? 'gray.300'
                                    : 'gray.700',
                                fontWeight: isSelected ? 'medium' : 'normal',
                                flex: 1,
                              })}
                            >
                              {skillName}
                            </span>
                            {/* Show fluency state badge for practicing skills */}
                            {isSelected && fluencyState && (
                              <FluencyStateBadge fluencyState={fluencyState} isDark={isDark} />
                            )}
                            {/* Show "Mastered" if selected but no mastery data (newly added) */}
                            {isSelected && !skillMasteryMap.has(skillId) && (
                              <span
                                className={css({
                                  fontSize: 'xs',
                                  color: isDark ? 'gray.400' : 'gray.500',
                                  bg: isDark ? 'gray.700' : 'gray.100',
                                  px: '2',
                                  py: '0.5',
                                  borderRadius: 'full',
                                })}
                              >
                                New
                              </span>
                            )}
                            {/* Refresh button for rusty skills */}
                            {showRefreshButton && (
                              <button
                                type="button"
                                onClick={(e) => handleRefreshSkill(skillId, e)}
                                disabled={isRefreshing === skillId}
                                title="Mark as recently practiced (sets to Fluent)"
                                data-action="refresh-skill"
                                className={css({
                                  fontSize: '10px',
                                  fontWeight: 'medium',
                                  px: '2',
                                  py: '1',
                                  border: '1px solid',
                                  borderColor: isDark ? 'blue.700' : 'blue.300',
                                  borderRadius: 'md',
                                  bg: isDark ? 'blue.900' : 'blue.50',
                                  color: isDark ? 'blue.300' : 'blue.700',
                                  cursor: 'pointer',
                                  _hover: { bg: isDark ? 'blue.800' : 'blue.100' },
                                  _disabled: { opacity: 0.5, cursor: 'wait' },
                                })}
                              >
                                {isRefreshing === skillId ? '...' : '↻ Refresh'}
                              </button>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              )
            })}
          </Accordion.Root>

          {/* Actions */}
          <div
            className={css({
              display: 'flex',
              gap: '3',
              justifyContent: 'flex-end',
              mt: '6',
            })}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              data-action="cancel"
              className={css({
                px: '4',
                py: '2',
                fontSize: 'sm',
                fontWeight: 'medium',
                color: isDark ? 'gray.300' : 'gray.700',
                bg: 'transparent',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                borderRadius: 'md',
                cursor: 'pointer',
                _hover: { bg: isDark ? 'gray.700' : 'gray.50' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              data-action="save-skills"
              className={css({
                px: '4',
                py: '2',
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'white',
                bg: 'blue.600',
                border: 'none',
                borderRadius: 'md',
                cursor: 'pointer',
                _hover: { bg: 'blue.700' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isSaving ? 'Saving...' : 'Save Skills'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default ManualSkillSelector
