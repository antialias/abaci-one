'use client'

import * as Accordion from '@radix-ui/react-accordion'
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
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
  /** Currently mastered skill IDs */
  currentMasteredSkills?: string[]
  /** Callback when save is clicked */
  onSave: (masteredSkillIds: string[]) => Promise<void>
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
  onSave,
}: ManualSkillSelectorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set(currentMasteredSkills))
  const [isSaving, setIsSaving] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])

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
                              })}
                            >
                              {skillName}
                            </span>
                            {isSelected && (
                              <span
                                className={css({
                                  fontSize: 'xs',
                                  color: isDark ? 'green.300' : 'green.600',
                                  bg: isDark ? 'green.900' : 'green.50',
                                  px: '2',
                                  py: '0.5',
                                  borderRadius: 'full',
                                })}
                              >
                                Mastered
                              </span>
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
