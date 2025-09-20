'use client'

import { useState, useCallback } from 'react'
import { css } from '../../styled-system/css'
import { vstack, hstack } from '../../styled-system/patterns'
import { PracticeStep, SkillSet, createBasicSkillSet, createEmptySkillSet } from '../../types/tutorial'
import { SkillSelector } from './SkillSelector'

interface PracticeStepEditorProps {
  step: PracticeStep
  onChange: (step: PracticeStep) => void
  onDelete?: () => void
  className?: string
}

export function PracticeStepEditor({
  step,
  onChange,
  onDelete,
  className
}: PracticeStepEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateStep = useCallback((updates: Partial<PracticeStep>) => {
    onChange({ ...step, ...updates })
  }, [step, onChange])

  const updateRequiredSkills = useCallback((skills: SkillSet) => {
    updateStep({ requiredSkills: skills })
  }, [updateStep])

  const updateTargetSkills = useCallback((skills: Partial<SkillSet>) => {
    updateStep({ targetSkills: skills })
  }, [updateStep])

  const updateForbiddenSkills = useCallback((skills: Partial<SkillSet>) => {
    updateStep({ forbiddenSkills: skills })
  }, [updateStep])

  // Convert partial skill sets to full skill sets for the selector
  const targetSkillsForSelector: SkillSet = {
    basic: {
      directAddition: step.targetSkills?.basic?.directAddition || false,
      heavenBead: step.targetSkills?.basic?.heavenBead || false,
      simpleCombinations: step.targetSkills?.basic?.simpleCombinations || false
    },
    fiveComplements: {
      "4=5-1": step.targetSkills?.fiveComplements?.["4=5-1"] || false,
      "3=5-2": step.targetSkills?.fiveComplements?.["3=5-2"] || false,
      "2=5-3": step.targetSkills?.fiveComplements?.["2=5-3"] || false,
      "1=5-4": step.targetSkills?.fiveComplements?.["1=5-4"] || false
    },
    tenComplements: {
      "9=10-1": step.targetSkills?.tenComplements?.["9=10-1"] || false,
      "8=10-2": step.targetSkills?.tenComplements?.["8=10-2"] || false,
      "7=10-3": step.targetSkills?.tenComplements?.["7=10-3"] || false,
      "6=10-4": step.targetSkills?.tenComplements?.["6=10-4"] || false,
      "5=10-5": step.targetSkills?.tenComplements?.["5=10-5"] || false,
      "4=10-6": step.targetSkills?.tenComplements?.["4=10-6"] || false,
      "3=10-7": step.targetSkills?.tenComplements?.["3=10-7"] || false,
      "2=10-8": step.targetSkills?.tenComplements?.["2=10-8"] || false,
      "1=10-9": step.targetSkills?.tenComplements?.["1=10-9"] || false
    }
  }

  const presetConfigurations = [
    {
      name: 'Basic Addition (1-4)',
      skills: createBasicSkillSet()
    },
    {
      name: 'With Heaven Bead',
      skills: {
        ...createBasicSkillSet(),
        basic: { ...createBasicSkillSet().basic, heavenBead: true, simpleCombinations: true }
      }
    },
    {
      name: 'First Five Complement (4=5-1)',
      skills: {
        ...createBasicSkillSet(),
        basic: { directAddition: true, heavenBead: true, simpleCombinations: true },
        fiveComplements: { ...createEmptySkillSet().fiveComplements, "4=5-1": true }
      }
    },
    {
      name: 'All Five Complements',
      skills: {
        ...createBasicSkillSet(),
        basic: { directAddition: true, heavenBead: true, simpleCombinations: true },
        fiveComplements: { "4=5-1": true, "3=5-2": true, "2=5-3": true, "1=5-4": true }
      }
    }
  ]

  return (
    <div className={css({
      p: 4,
      bg: 'purple.50',
      border: '1px solid',
      borderColor: 'purple.200',
      rounded: 'lg'
    }, className)}>
      <div className={vstack({ gap: 4, alignItems: 'stretch' })}>
        {/* Header */}
        <div className={hstack({ justifyContent: 'space-between', alignItems: 'center' })}>
          <h3 className={css({
            fontSize: 'lg',
            fontWeight: 'semibold',
            color: 'purple.800'
          })}>
            Practice Step Editor
          </h3>
          {onDelete && (
            <button
              onClick={onDelete}
              className={css({
                px: 3,
                py: 1,
                bg: 'red.500',
                color: 'white',
                rounded: 'md',
                fontSize: 'sm',
                cursor: 'pointer',
                _hover: { bg: 'red.600' }
              })}
            >
              Delete
            </button>
          )}
        </div>

        {/* Basic Information */}
        <div className={vstack({ gap: 3, alignItems: 'stretch' })}>
          <div>
            <label className={css({
              display: 'block',
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.700',
              mb: 1
            })}>
              Title
            </label>
            <input
              type="text"
              value={step.title}
              onChange={(e) => updateStep({ title: e.target.value })}
              className={css({
                w: 'full',
                px: 3,
                py: 2,
                border: '1px solid',
                borderColor: 'gray.300',
                rounded: 'md',
                fontSize: 'sm'
              })}
              placeholder="e.g., Practice: Basic Addition"
            />
          </div>

          <div>
            <label className={css({
              display: 'block',
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.700',
              mb: 1
            })}>
              Description
            </label>
            <textarea
              value={step.description}
              onChange={(e) => updateStep({ description: e.target.value })}
              rows={2}
              className={css({
                w: 'full',
                px: 3,
                py: 2,
                border: '1px solid',
                borderColor: 'gray.300',
                rounded: 'md',
                fontSize: 'sm'
              })}
              placeholder="Explain what this practice session covers"
            />
          </div>

          <div className={hstack({ gap: 4 })}>
            <div className={css({ flex: 1 })}>
              <label className={css({
                display: 'block',
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'gray.700',
                mb: 1
              })}>
                Problem Count
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={step.problemCount}
                onChange={(e) => updateStep({ problemCount: parseInt(e.target.value) || 1 })}
                className={css({
                  w: 'full',
                  px: 3,
                  py: 2,
                  border: '1px solid',
                  borderColor: 'gray.300',
                  rounded: 'md',
                  fontSize: 'sm'
                })}
              />
            </div>

            <div className={css({ flex: 1 })}>
              <label className={css({
                display: 'block',
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'gray.700',
                mb: 1
              })}>
                Max Terms per Problem
              </label>
              <input
                type="number"
                min={2}
                max={10}
                value={step.maxTerms}
                onChange={(e) => updateStep({ maxTerms: parseInt(e.target.value) || 2 })}
                className={css({
                  w: 'full',
                  px: 3,
                  py: 2,
                  border: '1px solid',
                  borderColor: 'gray.300',
                  rounded: 'md',
                  fontSize: 'sm'
                })}
              />
            </div>
          </div>
        </div>

        {/* Quick Preset Configurations */}
        <div>
          <label className={css({
            display: 'block',
            fontSize: 'sm',
            fontWeight: 'medium',
            color: 'gray.700',
            mb: 2
          })}>
            Quick Presets
          </label>
          <div className={hstack({ gap: 2, flexWrap: 'wrap' })}>
            {presetConfigurations.map((preset) => (
              <button
                key={preset.name}
                onClick={() => updateRequiredSkills(preset.skills)}
                className={css({
                  px: 3,
                  py: 2,
                  bg: 'blue.100',
                  color: 'blue.800',
                  border: '1px solid',
                  borderColor: 'blue.300',
                  rounded: 'md',
                  fontSize: 'sm',
                  cursor: 'pointer',
                  _hover: { bg: 'blue.200' }
                })}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Required Skills */}
        <SkillSelector
          skills={step.requiredSkills}
          onChange={updateRequiredSkills}
          mode="required"
          title="Required Skills (User Must Know)"
        />

        {/* Advanced Options Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={css({
            px: 3,
            py: 2,
            bg: 'gray.100',
            color: 'gray.700',
            border: '1px solid',
            borderColor: 'gray.300',
            rounded: 'md',
            fontSize: 'sm',
            cursor: 'pointer',
            _hover: { bg: 'gray.200' }
          })}
        >
          {showAdvanced ? '▼' : '▶'} Advanced Options
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className={vstack({ gap: 4, alignItems: 'stretch' })}>
            {/* Target Skills */}
            <SkillSelector
              skills={targetSkillsForSelector}
              onChange={(skills) => updateTargetSkills(skills)}
              mode="target"
              title="Target Skills (Specific Practice Focus)"
            />

            {/* Constraints */}
            <div className={vstack({ gap: 3, alignItems: 'stretch' })}>
              <h5 className={css({
                fontSize: 'md',
                fontWeight: 'medium',
                color: 'gray.700'
              })}>
                Problem Constraints
              </h5>

              <div className={hstack({ gap: 4 })}>
                <div className={css({ flex: 1 })}>
                  <label className={css({
                    display: 'block',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: 'gray.700',
                    mb: 1
                  })}>
                    Number Range Min
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={step.numberRange?.min || 1}
                    onChange={(e) => updateStep({
                      numberRange: {
                        ...step.numberRange,
                        min: parseInt(e.target.value) || 1,
                        max: step.numberRange?.max || 9
                      }
                    })}
                    className={css({
                      w: 'full',
                      px: 3,
                      py: 2,
                      border: '1px solid',
                      borderColor: 'gray.300',
                      rounded: 'md',
                      fontSize: 'sm'
                    })}
                  />
                </div>

                <div className={css({ flex: 1 })}>
                  <label className={css({
                    display: 'block',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: 'gray.700',
                    mb: 1
                  })}>
                    Number Range Max
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={step.numberRange?.max || 9}
                    onChange={(e) => updateStep({
                      numberRange: {
                        min: step.numberRange?.min || 1,
                        max: parseInt(e.target.value) || 9
                      }
                    })}
                    className={css({
                      w: 'full',
                      px: 3,
                      py: 2,
                      border: '1px solid',
                      borderColor: 'gray.300',
                      rounded: 'md',
                      fontSize: 'sm'
                    })}
                  />
                </div>
              </div>

              <div className={hstack({ gap: 4 })}>
                <div className={css({ flex: 1 })}>
                  <label className={css({
                    display: 'block',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: 'gray.700',
                    mb: 1
                  })}>
                    Maximum Sum
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={step.sumConstraints?.maxSum || 9}
                    onChange={(e) => updateStep({
                      sumConstraints: {
                        ...step.sumConstraints,
                        maxSum: parseInt(e.target.value) || 9
                      }
                    })}
                    className={css({
                      w: 'full',
                      px: 3,
                      py: 2,
                      border: '1px solid',
                      borderColor: 'gray.300',
                      rounded: 'md',
                      fontSize: 'sm'
                    })}
                  />
                </div>

                <div className={css({ flex: 1 })}>
                  <label className={css({
                    display: 'block',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: 'gray.700',
                    mb: 1
                  })}>
                    Minimum Sum (Optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={step.sumConstraints?.minSum || ''}
                    onChange={(e) => updateStep({
                      sumConstraints: {
                        ...step.sumConstraints,
                        minSum: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                    className={css({
                      w: 'full',
                      px: 3,
                      py: 2,
                      border: '1px solid',
                      borderColor: 'gray.300',
                      rounded: 'md',
                      fontSize: 'sm'
                    })}
                    placeholder="Leave empty for no minimum"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Problem Preview */}
        <div className={css({
          p: 3,
          bg: 'blue.50',
          border: '1px solid',
          borderColor: 'blue.200',
          rounded: 'md'
        })}>
          <h5 className={css({
            fontSize: 'sm',
            fontWeight: 'medium',
            color: 'blue.800',
            mb: 2
          })}>
            Configuration Summary
          </h5>
          <div className={css({
            fontSize: 'xs',
            color: 'blue.700',
            lineHeight: 'relaxed'
          })}>
            <p><strong>Problems:</strong> {step.problemCount} problems, {step.maxTerms} terms max</p>
            <p><strong>Numbers:</strong> {step.numberRange?.min || 1} to {step.numberRange?.max || 9}</p>
            <p><strong>Sum limit:</strong> {step.sumConstraints?.maxSum || 9}</p>
            <p><strong>Skills required:</strong> {
              Object.entries(step.requiredSkills.basic).filter(([, enabled]) => enabled).length +
              Object.entries(step.requiredSkills.fiveComplements).filter(([, enabled]) => enabled).length +
              Object.entries(step.requiredSkills.tenComplements).filter(([, enabled]) => enabled).length
            } skills enabled</p>
          </div>
        </div>
      </div>
    </div>
  )
}