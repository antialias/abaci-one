'use client'

import { useState, useEffect } from 'react'
import { css } from '../../../../../../../styled-system/css'
import type { SkillId, SkillDefinition } from '../../skills'

interface CustomizeMixModalProps {
  isOpen: boolean
  onClose: () => void
  currentSkill: SkillDefinition
  masteryStates: Map<SkillId, boolean>
  currentMixRatio: number // 0-1, where 0.25 = 25% review
  currentSelectedReviewSkills?: SkillId[]
  onApply: (mixRatio: number, selectedReviewSkills: SkillId[]) => void
  isDark?: boolean
}

/**
 * Customize Mix Modal
 *
 * Allows users to customize the worksheet mix:
 * - Adjust review ratio (0-100% review)
 * - Select which mastered skills to include in review
 * - Reset to defaults (75% current, all recommended review skills)
 */
export function CustomizeMixModal({
  isOpen,
  onClose,
  currentSkill,
  masteryStates,
  currentMixRatio,
  currentSelectedReviewSkills,
  onApply,
  isDark = false,
}: CustomizeMixModalProps) {
  const [mixRatio, setMixRatio] = useState(currentMixRatio)
  const [selectedReviewSkills, setSelectedReviewSkills] = useState<Set<SkillId>>(new Set())

  // Get mastered skills from recommendedReview
  const masteredReviewSkills = currentSkill.recommendedReview.filter(
    (skillId) => masteryStates.get(skillId) === true
  )

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMixRatio(currentMixRatio)

      // Get mastered review skills at the time modal opens
      const mastered = currentSkill.recommendedReview.filter(
        (skillId) => masteryStates.get(skillId) === true
      )

      if (currentSelectedReviewSkills && currentSelectedReviewSkills.length > 0) {
        // Use user's custom selection
        setSelectedReviewSkills(new Set(currentSelectedReviewSkills))
      } else {
        // Default to all mastered review skills
        setSelectedReviewSkills(new Set(mastered))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]) // Only run when modal opens, not when props change

  if (!isOpen) return null

  const handleReset = () => {
    setMixRatio(0.25) // Default 25% review
    setSelectedReviewSkills(new Set(masteredReviewSkills)) // All recommended
  }

  const handleApply = () => {
    onApply(mixRatio, Array.from(selectedReviewSkills))
    onClose()
  }

  const toggleReviewSkill = (skillId: SkillId) => {
    const newSet = new Set(selectedReviewSkills)
    if (newSet.has(skillId)) {
      newSet.delete(skillId)
    } else {
      newSet.add(skillId)
    }
    setSelectedReviewSkills(newSet)
  }

  // Calculate problem counts based on a 20-problem worksheet
  const totalProblems = 20
  const reviewCount = Math.floor(totalProblems * mixRatio)
  const currentCount = totalProblems - reviewCount

  return (
    <div
      data-component="customize-mix-modal-overlay"
      className={css({
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1rem',
      })}
      onClick={onClose}
    >
      <div
        data-component="customize-mix-modal"
        className={css({
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '12px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={css({
            padding: '1.5rem',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <div>
            <h2
              className={css({
                fontSize: '1.25rem',
                fontWeight: 600,
                color: isDark ? 'white' : 'gray.900',
                marginBottom: '0.25rem',
              })}
            >
              Customize Worksheet Mix
            </h2>
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {currentSkill.name}
            </p>
          </div>
          <button
            type="button"
            data-action="close-modal"
            onClick={onClose}
            className={css({
              padding: '0.5rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: isDark ? 'gray.400' : 'gray.600',
              cursor: 'pointer',
              fontSize: '1.5rem',
              lineHeight: '1',
              transition: 'all 0.2s',
              _hover: {
                backgroundColor: isDark ? 'gray.700' : 'gray.100',
                color: isDark ? 'gray.200' : 'gray.900',
              },
            })}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          className={css({
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
          })}
        >
          {/* Mix Ratio Section */}
          <div className={css({ marginBottom: '2rem' })}>
            <h3
              className={css({
                fontSize: '0.875rem',
                fontWeight: 600,
                color: isDark ? 'gray.200' : 'gray.700',
                marginBottom: '1rem',
              })}
            >
              Mix Ratio
            </h3>

            {/* Visual breakdown */}
            <div
              className={css({
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1rem',
              })}
            >
              <div
                className={css({
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '6px',
                  backgroundColor: 'blue.50',
                  border: '1px solid',
                  borderColor: 'blue.200',
                })}
              >
                <div
                  className={css({
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'blue.700',
                    marginBottom: '0.25rem',
                  })}
                >
                  Current Skill: {Math.round((1 - mixRatio) * 100)}%
                </div>
                <div
                  className={css({
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'blue.800',
                  })}
                >
                  {currentCount} problems
                </div>
              </div>

              <div
                className={css({
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '6px',
                  backgroundColor: 'green.50',
                  border: '1px solid',
                  borderColor: 'green.200',
                })}
              >
                <div
                  className={css({
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'green.700',
                    marginBottom: '0.25rem',
                  })}
                >
                  Review: {Math.round(mixRatio * 100)}%
                </div>
                <div
                  className={css({
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'green.800',
                  })}
                >
                  {reviewCount} problems
                </div>
              </div>
            </div>

            {/* Slider */}
            <div className={css({ marginBottom: '0.5rem' })}>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(mixRatio * 100)}
                onChange={(e) => setMixRatio(Number.parseInt(e.target.value) / 100)}
                className={css({
                  width: '100%',
                  cursor: 'pointer',
                })}
              />
            </div>

            {/* Slider labels */}
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              <span>More current skill</span>
              <span>More review</span>
            </div>
          </div>

          {/* Review Skills Section */}
          {masteredReviewSkills.length > 0 && (
            <div>
              <h3
                className={css({
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: isDark ? 'gray.200' : 'gray.700',
                  marginBottom: '0.75rem',
                })}
              >
                Review Skills ({selectedReviewSkills.size} selected)
              </h3>

              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                })}
              >
                {masteredReviewSkills.map((skillId) => {
                  // Find skill definition to get name
                  const skill = currentSkill.recommendedReview
                    .map((id) => {
                      // This is a bit inefficient, but works for now
                      // In a real app, we'd pass skills as a prop
                      return { id, name: skillId } // Placeholder
                    })
                    .find((s) => s.id === skillId)

                  const isSelected = selectedReviewSkills.has(skillId)

                  return (
                    <label
                      key={skillId}
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isSelected ? 'green.300' : isDark ? 'gray.600' : 'gray.200',
                        backgroundColor: isSelected ? 'green.50' : isDark ? 'gray.700' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        _hover: {
                          borderColor: 'green.400',
                        },
                      })}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleReviewSkill(skillId)}
                        className={css({
                          cursor: 'pointer',
                        })}
                      />
                      <span
                        className={css({
                          fontSize: '0.875rem',
                          color: isDark ? 'gray.200' : 'gray.700',
                        })}
                      >
                        {skillId}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {masteredReviewSkills.length === 0 && (
            <div
              className={css({
                padding: '1rem',
                borderRadius: '6px',
                backgroundColor: isDark ? 'gray.700' : 'gray.50',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.200',
              })}
            >
              <p
                className={css({
                  fontSize: '0.875rem',
                  color: isDark ? 'gray.400' : 'gray.600',
                  textAlign: 'center',
                })}
              >
                No mastered review skills available. Mark prerequisite skills as mastered to enable
                review mixing.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={css({
            padding: '1rem 1.5rem',
            borderTop: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '0.75rem',
          })}
        >
          <button
            type="button"
            data-action="reset-to-default"
            onClick={handleReset}
            className={css({
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: isDark ? 'gray.600' : 'gray.300',
              backgroundColor: 'transparent',
              color: isDark ? 'gray.300' : 'gray.700',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                backgroundColor: isDark ? 'gray.700' : 'gray.50',
              },
            })}
          >
            Reset to Default
          </button>

          <div className={css({ display: 'flex', gap: '0.75rem' })}>
            <button
              type="button"
              data-action="cancel"
              onClick={onClose}
              className={css({
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                backgroundColor: isDark ? 'gray.700' : 'white',
                color: isDark ? 'gray.200' : 'gray.700',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                _hover: {
                  backgroundColor: isDark ? 'gray.600' : 'gray.50',
                },
              })}
            >
              Cancel
            </button>

            <button
              type="button"
              data-action="apply"
              onClick={handleApply}
              className={css({
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'blue.500',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                _hover: {
                  backgroundColor: 'blue.600',
                },
              })}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
