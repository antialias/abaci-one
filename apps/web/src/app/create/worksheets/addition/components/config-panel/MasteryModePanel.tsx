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

  // Get current operator (default to addition, filter out 'mixed')
  const rawOperator = formState.operator ?? 'addition'
  const operator: 'addition' | 'subtraction' = rawOperator === 'mixed' ? 'addition' : rawOperator

  // Get skills for current operator
  const availableSkills = getSkillsByOperator(operator)

  // Get current skill ID from form state, or use first available skill
  const currentSkillId = formState.currentSkillId ?? availableSkills[0]?.id

  // Get current skill definition
  const currentSkill = currentSkillId ? getSkillById(currentSkillId as SkillId) : availableSkills[0]

  // Load mastery states from API
  useEffect(() => {
    async function loadMasteryStates() {
      try {
        setIsLoadingMastery(true)
        const response = await fetch(`/api/worksheets/mastery?operator=${operator}`)
        if (!response.ok) {
          throw new Error('Failed to load mastery states')
        }
        const data = await response.json()

        // Convert to Map<SkillId, boolean>
        const statesMap = new Map<SkillId, boolean>()
        for (const record of data.masteryStates) {
          statesMap.set(record.skillId as SkillId, record.isMastered)
        }
        setMasteryStates(statesMap)
      } catch (error) {
        console.error('Failed to load mastery states:', error)
      } finally {
        setIsLoadingMastery(false)
      }
    }

    loadMasteryStates()
  }, [operator])

  // Apply current skill configuration to form state
  useEffect(() => {
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
    // This updates the preview to show problems appropriate for this skill
    onChange({
      // Keep mode as 'mastery' - displayRules will still apply conditional scaffolding
      digitRange: currentSkill.digitRange,
      pAnyStart: currentSkill.regroupingConfig.pAnyStart,
      pAllStart: currentSkill.regroupingConfig.pAllStart,
      displayRules: currentSkill.recommendedScaffolding,
      operator: currentSkill.operator,
      interpolate: false, // CRITICAL: Disable progressive difficulty in mastery mode
    } as Partial<WorksheetFormState>)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSkill?.id]) // Only run when skill ID changes, not when onChange changes

  // Handler: Navigate to previous skill
  const handlePreviousSkill = () => {
    if (!currentSkill) return
    const currentIndex = availableSkills.findIndex((s) => s.id === currentSkill.id)
    if (currentIndex > 0) {
      const prevSkill = availableSkills[currentIndex - 1]
      onChange({ currentSkillId: prevSkill.id } as Partial<WorksheetFormState>)
    }
  }

  // Handler: Navigate to next skill
  const handleNextSkill = () => {
    if (!currentSkill) return
    const currentIndex = availableSkills.findIndex((s) => s.id === currentSkill.id)
    if (currentIndex < availableSkills.length - 1) {
      const nextSkill = availableSkills[currentIndex + 1]
      onChange({ currentSkillId: nextSkill.id } as Partial<WorksheetFormState>)
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
      {/* Header */}
      <div className={css({ marginBottom: '1rem' })}>
        <h3
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
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
          <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
            <h4
              className={css({
                fontSize: '1.125rem',
                fontWeight: '600',
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
            fontWeight: '500',
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
            fontWeight: '500',
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
            fontWeight: '500',
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
        <div className={css({ marginTop: '1rem', display: 'flex', gap: '0.75rem' })}>
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
              fontWeight: '500',
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
                  fontWeight: '500',
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
