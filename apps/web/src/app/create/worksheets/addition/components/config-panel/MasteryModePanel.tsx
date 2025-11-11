'use client'

import { useState, useEffect } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { css } from '../../../../../../../styled-system/css'
import type { WorksheetFormState } from '../../types'
import type { SkillId } from '../../skills'
import { getSkillById, getSkillsByOperator } from '../../skills'
import { AllSkillsModal } from './AllSkillsModal'
import { CustomizeMixModal } from './CustomizeMixModal'

interface MasteryModePanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  isDark?: boolean
}

/**
 * Mastery Mode Panel
 *
 * Allows users to select a skill to practice, navigate between skills,
 * and mark skills as mastered. Displays the current skill with automatic
 * configuration based on the skill's pedagogical requirements.
 */
export function MasteryModePanel({ formState, onChange, isDark = false }: MasteryModePanelProps) {
  const [masteryStates, setMasteryStates] = useState<Map<SkillId, boolean>>(new Map())
  const [isLoadingMastery, setIsLoadingMastery] = useState(true)
  const [isAllSkillsModalOpen, setIsAllSkillsModalOpen] = useState(false)
  const [isCustomizeMixModalOpen, setIsCustomizeMixModalOpen] = useState(false)

  // Get current operator (default to addition)
  const operator = formState.operator ?? 'addition'

  // For mixed mode, we need to track skills for BOTH operators
  const isMixedMode = operator === 'mixed'

  // Get skills for current operator(s)
  const additionSkills = getSkillsByOperator('addition')
  const subtractionSkills = getSkillsByOperator('subtraction')

  // Get current skill IDs for each operator
  const currentAdditionSkillId =
    formState.currentAdditionSkillId ?? additionSkills[0]?.id ?? 'sd-no-regroup'
  const currentSubtractionSkillId =
    formState.currentSubtractionSkillId ?? subtractionSkills[0]?.id ?? 'sd-sub-no-borrow'

  // Get current skill definitions
  const currentAdditionSkill = getSkillById(currentAdditionSkillId as SkillId)
  const currentSubtractionSkill = getSkillById(currentSubtractionSkillId as SkillId)

  // For single-operator modes, use the appropriate skill
  const currentSkill = isMixedMode
    ? currentAdditionSkill // Just use one for single-mode UI components
    : operator === 'subtraction'
      ? currentSubtractionSkill
      : currentAdditionSkill

  const availableSkills = isMixedMode
    ? [...additionSkills, ...subtractionSkills] // Combined for modal
    : operator === 'subtraction'
      ? subtractionSkills
      : additionSkills

  // Load mastery states from API
  useEffect(() => {
    async function loadMasteryStates() {
      try {
        setIsLoadingMastery(true)

        // For mixed mode, load both addition and subtraction mastery states
        const operatorsToLoad = isMixedMode ? ['addition', 'subtraction'] : [operator]

        const allStates = new Map<SkillId, boolean>()

        for (const op of operatorsToLoad) {
          const response = await fetch(`/api/worksheets/mastery?operator=${op}`)
          if (!response.ok) {
            throw new Error(`Failed to load mastery states for ${op}`)
          }
          const data = await response.json()

          // Merge into combined map
          for (const record of data.masteryStates) {
            allStates.set(record.skillId as SkillId, record.isMastered)
          }
        }

        setMasteryStates(allStates)
      } catch (error) {
        console.error('Failed to load mastery states:', error)
      } finally {
        setIsLoadingMastery(false)
      }
    }

    loadMasteryStates()
  }, [operator, isMixedMode])

  // Apply current skill configuration to form state
  useEffect(() => {
    if (isMixedMode) {
      // Mixed mode: Use current addition and subtraction skills
      if (!currentAdditionSkill || !currentSubtractionSkill) return

      console.log('[MasteryModePanel] Applying mixed mode config:', {
        additionSkill: currentAdditionSkill.id,
        subtractionSkill: currentSubtractionSkill.id,
      })

      // Store both skill IDs - worksheet generation will query these
      onChange({
        currentAdditionSkillId: currentAdditionSkill.id,
        currentSubtractionSkillId: currentSubtractionSkill.id,
        operator: 'mixed',
        // Do NOT force interpolate - let user control it via the toggle
      } as Partial<WorksheetFormState>)
    } else {
      // Single operator mode: Use the current skill
      if (!currentSkill) return

      console.log('[MasteryModePanel] Applying skill config:', {
        skillId: currentSkill.id,
        skillName: currentSkill.name,
        digitRange: currentSkill.digitRange,
        pAnyStart: currentSkill.regroupingConfig.pAnyStart,
        pAllStart: currentSkill.regroupingConfig.pAllStart,
        displayRules: currentSkill.recommendedScaffolding,
        operator: currentSkill.operator,
      })

      // Apply skill's configuration to form state
      onChange({
        digitRange: currentSkill.digitRange,
        pAnyStart: currentSkill.regroupingConfig.pAnyStart,
        pAllStart: currentSkill.regroupingConfig.pAllStart,
        displayRules: currentSkill.recommendedScaffolding,
        operator: currentSkill.operator,
        // Do NOT force interpolate - let user control it via the toggle
      } as Partial<WorksheetFormState>)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMixedMode, currentAdditionSkill?.id, currentSubtractionSkill?.id, currentSkill?.id])

  // Handler: Navigate to previous skill
  const handlePreviousSkill = () => {
    if (!currentSkill) return
    const currentIndex = availableSkills.findIndex((s) => s.id === currentSkill.id)
    if (currentIndex > 0) {
      const prevSkill = availableSkills[currentIndex - 1]

      // Update the appropriate skill ID based on operator
      if (operator === 'addition') {
        onChange({
          currentAdditionSkillId: prevSkill.id,
        } as Partial<WorksheetFormState>)
      } else if (operator === 'subtraction') {
        onChange({
          currentSubtractionSkillId: prevSkill.id,
        } as Partial<WorksheetFormState>)
      }
    }
  }

  // Handler: Navigate to next skill
  const handleNextSkill = () => {
    if (!currentSkill) return
    const currentIndex = availableSkills.findIndex((s) => s.id === currentSkill.id)
    if (currentIndex < availableSkills.length - 1) {
      const nextSkill = availableSkills[currentIndex + 1]

      // Update the appropriate skill ID based on operator
      if (operator === 'addition') {
        onChange({
          currentAdditionSkillId: nextSkill.id,
        } as Partial<WorksheetFormState>)
      } else if (operator === 'subtraction') {
        onChange({
          currentSubtractionSkillId: nextSkill.id,
        } as Partial<WorksheetFormState>)
      }
    }
  }

  // Handler: Toggle mastery state
  const handleToggleMastery = async () => {
    if (!currentSkill) return

    const currentMastery = masteryStates.get(currentSkill.id) ?? false
    const newMastery = !currentMastery

    try {
      // Optimistically update UI
      const newStates = new Map(masteryStates)
      newStates.set(currentSkill.id, newMastery)
      setMasteryStates(newStates)

      // Update server
      const response = await fetch('/api/worksheets/mastery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: currentSkill.id,
          isMastered: newMastery,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update mastery state')
      }
    } catch (error) {
      console.error('Failed to update mastery state:', error)
      // Revert optimistic update
      const revertedStates = new Map(masteryStates)
      revertedStates.set(currentSkill.id, currentMastery)
      setMasteryStates(revertedStates)
    }
  }

  // Mixed mode: Show both skills
  if (isMixedMode) {
    if (!currentAdditionSkill || !currentSubtractionSkill) {
      return (
        <div
          data-component="mastery-mode-panel"
          className={css({
            padding: '1.5rem',
            backgroundColor: isDark ? 'gray.700' : 'gray.50',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.200',
          })}
        >
          <p className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>Loading skills...</p>
        </div>
      )
    }

    const additionMastered = masteryStates.get(currentAdditionSkill.id) ?? false
    const subtractionMastered = masteryStates.get(currentSubtractionSkill.id) ?? false

    return (
      <div
        data-component="mastery-mode-panel"
        data-mode="mixed"
        className={css({
          padding: '1.5rem',
          backgroundColor: isDark ? 'gray.700' : 'gray.50',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: isDark ? 'gray.600' : 'gray.200',
        })}
      >
        {/* Header */}
        <div className={css({ marginBottom: '1rem' })}>
          <h3
            className={css({
              fontSize: '0.875rem',
              fontWeight: 600,
              color: isDark ? 'gray.200' : 'gray.700',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            })}
          >
            Mixed Operations Mode
          </h3>
          <p
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.600',
              fontStyle: 'italic',
            })}
          >
            Practicing operator recognition with problems from both current addition and subtraction
            skill levels
          </p>
        </div>

        {/* Current Skills Display - Mini Compact Cards */}
        <div
          className={css({
            display: 'flex',
            gap: '0.75rem',
            marginTop: '1rem',
          })}
        >
          {/* Addition Skill - Mini */}
          <div
            data-skill-card="addition-mini"
            className={css({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            })}
          >
            <div
              className={css({
                flex: 1,
                padding: '0.625rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                backgroundColor: isDark ? 'gray.600' : 'white',
                height: '5.5rem',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              })}
            >
              <div
                className={css({
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: isDark ? 'gray.400' : 'gray.500',
                  marginBottom: '0.25rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.025em',
                  flexShrink: 0,
                })}
              >
                Addition
              </div>
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  flexShrink: 0,
                })}
              >
                <h4
                  className={css({
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: isDark ? 'white' : 'gray.900',
                    lineHeight: '1.2',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  })}
                >
                  {currentAdditionSkill.name}
                </h4>
                {additionMastered && (
                  <span
                    className={css({
                      fontSize: '0.8125rem',
                      lineHeight: '1',
                    })}
                    title="Mastered"
                  >
                    ✓
                  </span>
                )}
              </div>
              <p
                className={css({
                  fontSize: '0.6875rem',
                  color: isDark ? 'gray.400' : 'gray.600',
                  marginTop: '0.25rem',
                  lineHeight: '1.3',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                })}
              >
                {currentAdditionSkill.description}
              </p>
            </div>

            {/* Addition Nav Buttons */}
            <div
              className={css({
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.5rem',
              })}
            >
              <button
                type="button"
                onClick={() => {
                  const currentIndex = additionSkills.findIndex(
                    (s) => s.id === currentAdditionSkill.id
                  )
                  if (currentIndex > 0) {
                    onChange({
                      currentAdditionSkillId: additionSkills[currentIndex - 1].id,
                    } as Partial<WorksheetFormState>)
                  }
                }}
                disabled={additionSkills.findIndex((s) => s.id === currentAdditionSkill.id) === 0}
                className={css({
                  flex: 1,
                  padding: '0.375rem',
                  fontSize: '0.75rem',
                  borderRadius: '3px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.500' : 'gray.300',
                  backgroundColor: isDark ? 'gray.600' : 'white',
                  color: isDark ? 'gray.200' : 'gray.700',
                  cursor: 'pointer',
                  _disabled: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                  },
                  _hover: {
                    backgroundColor: isDark ? 'gray.500' : 'gray.50',
                  },
                })}
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentIndex = additionSkills.findIndex(
                    (s) => s.id === currentAdditionSkill.id
                  )
                  if (currentIndex < additionSkills.length - 1) {
                    onChange({
                      currentAdditionSkillId: additionSkills[currentIndex + 1].id,
                    } as Partial<WorksheetFormState>)
                  }
                }}
                disabled={
                  additionSkills.findIndex((s) => s.id === currentAdditionSkill.id) ===
                  additionSkills.length - 1
                }
                className={css({
                  flex: 1,
                  padding: '0.375rem',
                  fontSize: '0.75rem',
                  borderRadius: '3px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.500' : 'gray.300',
                  backgroundColor: isDark ? 'gray.600' : 'white',
                  color: isDark ? 'gray.200' : 'gray.700',
                  cursor: 'pointer',
                  _disabled: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                  },
                  _hover: {
                    backgroundColor: isDark ? 'gray.500' : 'gray.50',
                  },
                })}
              >
                Next →
              </button>
            </div>
          </div>

          {/* Subtraction Skill - Mini */}
          <div
            data-skill-card="subtraction-mini"
            className={css({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            })}
          >
            <div
              className={css({
                flex: 1,
                padding: '0.625rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                backgroundColor: isDark ? 'gray.600' : 'white',
                height: '5.5rem',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              })}
            >
              <div
                className={css({
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: isDark ? 'gray.400' : 'gray.500',
                  marginBottom: '0.25rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.025em',
                  flexShrink: 0,
                })}
              >
                Subtraction
              </div>
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  flexShrink: 0,
                })}
              >
                <h4
                  className={css({
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: isDark ? 'white' : 'gray.900',
                    lineHeight: '1.2',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  })}
                >
                  {currentSubtractionSkill.name}
                </h4>
                {subtractionMastered && (
                  <span
                    className={css({
                      fontSize: '0.8125rem',
                      lineHeight: '1',
                    })}
                    title="Mastered"
                  >
                    ✓
                  </span>
                )}
              </div>
              <p
                className={css({
                  fontSize: '0.6875rem',
                  color: isDark ? 'gray.400' : 'gray.600',
                  marginTop: '0.25rem',
                  lineHeight: '1.3',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                })}
              >
                {currentSubtractionSkill.description}
              </p>
            </div>

            {/* Subtraction Nav Buttons */}
            <div
              className={css({
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.5rem',
              })}
            >
              <button
                type="button"
                onClick={() => {
                  const currentIndex = subtractionSkills.findIndex(
                    (s) => s.id === currentSubtractionSkill.id
                  )
                  if (currentIndex > 0) {
                    onChange({
                      currentSubtractionSkillId: subtractionSkills[currentIndex - 1].id,
                    } as Partial<WorksheetFormState>)
                  }
                }}
                disabled={
                  subtractionSkills.findIndex((s) => s.id === currentSubtractionSkill.id) === 0
                }
                className={css({
                  flex: 1,
                  padding: '0.375rem',
                  fontSize: '0.75rem',
                  borderRadius: '3px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.500' : 'gray.300',
                  backgroundColor: isDark ? 'gray.600' : 'white',
                  color: isDark ? 'gray.200' : 'gray.700',
                  cursor: 'pointer',
                  _disabled: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                  },
                  _hover: {
                    backgroundColor: isDark ? 'gray.500' : 'gray.50',
                  },
                })}
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentIndex = subtractionSkills.findIndex(
                    (s) => s.id === currentSubtractionSkill.id
                  )
                  if (currentIndex < subtractionSkills.length - 1) {
                    onChange({
                      currentSubtractionSkillId: subtractionSkills[currentIndex + 1].id,
                    } as Partial<WorksheetFormState>)
                  }
                }}
                disabled={
                  subtractionSkills.findIndex((s) => s.id === currentSubtractionSkill.id) ===
                  subtractionSkills.length - 1
                }
                className={css({
                  flex: 1,
                  padding: '0.375rem',
                  fontSize: '0.75rem',
                  borderRadius: '3px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.500' : 'gray.300',
                  backgroundColor: isDark ? 'gray.600' : 'white',
                  color: isDark ? 'gray.200' : 'gray.700',
                  cursor: 'pointer',
                  _disabled: {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                  },
                  _hover: {
                    backgroundColor: isDark ? 'gray.500' : 'gray.50',
                  },
                })}
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* View All Skills Button */}
        <div className={css({ marginTop: '1.5rem' })}>
          <button
            type="button"
            data-action="view-all-skills"
            onClick={() => setIsAllSkillsModalOpen(true)}
            className={css({
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: isDark ? 'gray.500' : 'gray.300',
              backgroundColor: isDark ? 'gray.600' : 'white',
              color: isDark ? 'gray.200' : 'gray.700',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'blue.400',
                backgroundColor: isDark ? 'gray.500' : 'gray.50',
              },
            })}
          >
            View All Skills
          </button>
        </div>

        {/* All Skills Modal */}
        <AllSkillsModal
          isOpen={isAllSkillsModalOpen}
          onClose={() => setIsAllSkillsModalOpen(false)}
          skills={availableSkills}
          currentSkillId={currentAdditionSkill.id}
          masteryStates={masteryStates}
          onSelectSkill={(skillId) => {
            // Determine which operator this skill belongs to
            const skill = getSkillById(skillId)
            if (!skill) return

            if (skill.operator === 'addition') {
              onChange({
                currentAdditionSkillId: skillId,
              } as Partial<WorksheetFormState>)
            } else {
              onChange({
                currentSubtractionSkillId: skillId,
              } as Partial<WorksheetFormState>)
            }
          }}
          onToggleMastery={async (skillId, isMastered) => {
            const newStates = new Map(masteryStates)
            newStates.set(skillId, isMastered)
            setMasteryStates(newStates)

            try {
              const response = await fetch('/api/worksheets/mastery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skillId, isMastered }),
              })

              if (!response.ok) throw new Error('Failed to update mastery state')
            } catch (error) {
              console.error('Failed to update mastery state:', error)
              const revertedStates = new Map(masteryStates)
              revertedStates.set(skillId, !isMastered)
              setMasteryStates(revertedStates)
            }
          }}
          isDark={isDark}
        />
      </div>
    )
  }

  // Single operator mode
  if (!currentSkill) {
    return (
      <div
        data-component="mastery-mode-panel"
        className={css({
          padding: '1.5rem',
          backgroundColor: isDark ? 'gray.700' : 'gray.50',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: isDark ? 'gray.600' : 'gray.200',
        })}
      >
        <p className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
          No skills available for {operator}
        </p>
      </div>
    )
  }

  const isMastered = masteryStates.get(currentSkill.id) ?? false

  // Check if there are previous/next skills
  const currentIndex = availableSkills.findIndex((s) => s.id === currentSkill.id)
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < availableSkills.length - 1

  // Calculate mastery progress
  const masteredCount = availableSkills.filter((s) => masteryStates.get(s.id) === true).length
  const totalCount = availableSkills.length

  // Check if there are any mastered review skills available
  const hasMasteredReviewSkills = currentSkill.recommendedReview.some(
    (skillId) => masteryStates.get(skillId) === true
  )

  return (
    <div data-component="mastery-mode-panel">
      {/* Header */}
      <div className={css({ marginBottom: '1rem' })}>
        <h3
          className={css({
            fontSize: '0.875rem',
            fontWeight: 600,
            color: isDark ? 'gray.200' : 'gray.700',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          })}
        >
          Current Skill
        </h3>
      </div>

      {/* Skill Name and Status */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        })}
      >
        <div className={css({ flex: 1 })}>
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            <h4
              className={css({
                fontSize: '1.125rem',
                fontWeight: 600,
                color: isDark ? 'white' : 'gray.900',
              })}
            >
              {currentSkill.name}
            </h4>
            {isMastered && (
              <span
                className={css({
                  fontSize: '1.25rem',
                  lineHeight: '1',
                })}
                title="Mastered"
              >
                ✓
              </span>
            )}
          </div>
          <p
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.600',
              marginTop: '0.25rem',
            })}
          >
            {currentSkill.description}
          </p>
        </div>
      </div>

      {/* Navigation and Mastery Controls */}
      <div
        className={css({
          display: 'flex',
          gap: '0.75rem',
          marginTop: '1.5rem',
        })}
      >
        {/* Previous Button */}
        <button
          type="button"
          data-action="previous-skill"
          onClick={handlePreviousSkill}
          disabled={!hasPrevious}
          className={css({
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: isDark ? 'gray.500' : 'gray.300',
            backgroundColor: isDark ? 'gray.600' : 'white',
            color: isDark ? 'gray.200' : 'gray.700',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            opacity: hasPrevious ? 1 : 0.5,
            _hover: hasPrevious
              ? {
                  borderColor: 'blue.400',
                  backgroundColor: isDark ? 'gray.500' : 'gray.50',
                }
              : {},
            _disabled: {
              cursor: 'not-allowed',
            },
          })}
        >
          ← Previous
        </button>

        {/* Mark as Mastered Toggle */}
        <button
          type="button"
          data-action="toggle-mastery"
          onClick={handleToggleMastery}
          disabled={isLoadingMastery}
          className={css({
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: isMastered ? 'green.500' : isDark ? 'gray.500' : 'gray.300',
            backgroundColor: isMastered ? 'green.50' : isDark ? 'gray.600' : 'white',
            color: isMastered ? 'green.700' : isDark ? 'gray.200' : 'gray.700',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            _hover: {
              borderColor: isMastered ? 'green.600' : 'blue.400',
              backgroundColor: isMastered ? 'green.100' : isDark ? 'gray.500' : 'gray.50',
            },
            _disabled: {
              opacity: 0.5,
              cursor: 'not-allowed',
            },
          })}
        >
          {isLoadingMastery
            ? 'Loading...'
            : isMastered
              ? 'Mark as Not Mastered'
              : 'Mark as Mastered'}
        </button>

        {/* Next Button */}
        <button
          type="button"
          data-action="next-skill"
          onClick={handleNextSkill}
          disabled={!hasNext}
          className={css({
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: isDark ? 'gray.500' : 'gray.300',
            backgroundColor: isDark ? 'gray.600' : 'white',
            color: isDark ? 'gray.200' : 'gray.700',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            opacity: hasNext ? 1 : 0.5,
            _hover: hasNext
              ? {
                  borderColor: 'blue.400',
                  backgroundColor: isDark ? 'gray.500' : 'gray.50',
                }
              : {},
            _disabled: {
              cursor: 'not-allowed',
            },
          })}
        >
          Next →
        </button>
      </div>

      {/* Action Buttons */}
      <Tooltip.Provider delayDuration={300}>
        <div
          className={css({
            marginTop: '1rem',
            display: 'flex',
            gap: '0.75rem',
          })}
        >
          <button
            type="button"
            data-action="view-all-skills"
            onClick={() => setIsAllSkillsModalOpen(true)}
            className={css({
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: isDark ? 'gray.500' : 'gray.300',
              backgroundColor: isDark ? 'gray.600' : 'white',
              color: isDark ? 'gray.200' : 'gray.700',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                borderColor: 'blue.400',
                backgroundColor: isDark ? 'gray.500' : 'gray.50',
              },
            })}
          >
            View All Skills ({masteredCount}/{totalCount})
          </button>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                data-action="customize-mix"
                onClick={() => setIsCustomizeMixModalOpen(true)}
                disabled={!hasMasteredReviewSkills}
                className={css({
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.500' : 'gray.300',
                  backgroundColor: isDark ? 'gray.600' : 'white',
                  color: isDark ? 'gray.200' : 'gray.700',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: hasMasteredReviewSkills ? 'pointer' : 'not-allowed',
                  opacity: hasMasteredReviewSkills ? 1 : 0.5,
                  transition: 'all 0.2s',
                  _hover: hasMasteredReviewSkills
                    ? {
                        borderColor: 'blue.400',
                        backgroundColor: isDark ? 'gray.500' : 'gray.50',
                      }
                    : {},
                })}
              >
                Customize Mix
              </button>
            </Tooltip.Trigger>
            {!hasMasteredReviewSkills && (
              <Tooltip.Portal>
                <Tooltip.Content
                  side="top"
                  className={css({
                    backgroundColor: isDark ? 'gray.800' : 'gray.900',
                    color: 'white',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    maxWidth: '250px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    zIndex: 10001,
                  })}
                >
                  Mark prerequisite skills as mastered to enable review mixing
                  <Tooltip.Arrow className={css({ fill: isDark ? 'gray.800' : 'gray.900' })} />
                </Tooltip.Content>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </div>
      </Tooltip.Provider>

      {/* All Skills Modal */}
      <AllSkillsModal
        isOpen={isAllSkillsModalOpen}
        onClose={() => setIsAllSkillsModalOpen(false)}
        skills={availableSkills}
        currentSkillId={currentSkill.id}
        masteryStates={masteryStates}
        onSelectSkill={(skillId) => {
          onChange({ currentSkillId: skillId } as Partial<WorksheetFormState>)
        }}
        onToggleMastery={async (skillId, isMastered) => {
          // Optimistically update UI
          const newStates = new Map(masteryStates)
          newStates.set(skillId, isMastered)
          setMasteryStates(newStates)

          try {
            // Update server
            const response = await fetch('/api/worksheets/mastery', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                skillId,
                isMastered,
              }),
            })

            if (!response.ok) {
              throw new Error('Failed to update mastery state')
            }
          } catch (error) {
            console.error('Failed to update mastery state:', error)
            // Revert optimistic update
            const revertedStates = new Map(masteryStates)
            revertedStates.set(skillId, !isMastered)
            setMasteryStates(revertedStates)
          }
        }}
        isDark={isDark}
      />

      {/* Customize Mix Modal */}
      <CustomizeMixModal
        isOpen={isCustomizeMixModalOpen}
        onClose={() => setIsCustomizeMixModalOpen(false)}
        currentSkill={currentSkill}
        masteryStates={masteryStates}
        currentMixRatio={formState.reviewMixRatio ?? 0.25}
        currentSelectedReviewSkills={formState.selectedReviewSkills as SkillId[] | undefined}
        onApply={(mixRatio, selectedReviewSkills) => {
          onChange({
            reviewMixRatio: mixRatio,
            selectedReviewSkills,
          } as Partial<WorksheetFormState>)
        }}
        isDark={isDark}
      />
    </div>
  )
}
