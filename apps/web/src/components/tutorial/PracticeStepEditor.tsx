'use client'

import { useState, useCallback, useEffect } from 'react'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'
import { PracticeStep, createBasicSkillSet } from '../../types/tutorial'
import { SkillSelector, SkillConfiguration } from './SkillSelector'
import { validatePracticeStepConfiguration, generateSingleProblem } from '../../utils/problemGenerator'
import { createBasicAllowedConfiguration, skillConfigurationToSkillSets } from '../../utils/skillConfiguration'
import type { GeneratedProblem } from '../../utils/problemGenerator'

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
  const [sampleProblems, setSampleProblems] = useState<GeneratedProblem[]>([])
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validatePracticeStepConfiguration> | null>(null)
  const [skillConfig, setSkillConfig] = useState<SkillConfiguration>(() => {
    // Initialize with a basic configuration for new steps or convert from existing
    return createBasicAllowedConfiguration()
  })

  const updateStep = useCallback((updates: Partial<PracticeStep>) => {
    onChange({ ...step, ...updates })
  }, [step, onChange])

  const updateSkillConfiguration = useCallback((config: SkillConfiguration) => {
    setSkillConfig(config)
    const { required, target, forbidden } = skillConfigurationToSkillSets(config)
    updateStep({
      requiredSkills: required,
      targetSkills: target,
      forbiddenSkills: forbidden
    })
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

  // Validate configuration when step changes
  useEffect(() => {
    const result = validatePracticeStepConfiguration(step)
    setValidationResult(result)
  }, [step])

  // Generate sample problems
  const generateSampleProblems = useCallback(() => {
    const samples: GeneratedProblem[] = []
    const maxSamples = Math.min(3, step.problemCount) // Show up to 3 samples
    const { required, target, forbidden } = skillConfigurationToSkillSets(skillConfig)

    for (let i = 0; i < maxSamples; i++) {
      const problem = generateSingleProblem(
        {
          numberRange: step.numberRange || { min: 1, max: 9 },
          maxSum: step.sumConstraints?.maxSum,
          minSum: step.sumConstraints?.minSum,
          maxTerms: step.maxTerms,
          problemCount: step.problemCount
        },
        required,
        target,
        forbidden,
        50 // More attempts for samples
      )

      if (problem) {
        samples.push(problem)
      }
    }

    setSampleProblems(samples)
  }, [step, skillConfig])

  const presetConfigurations = [
    {
      name: 'Basic Addition Only',
      config: {
        ...createBasicAllowedConfiguration(),
        basic: { directAddition: 'allowed', heavenBead: 'off', simpleCombinations: 'off' }
      } as SkillConfiguration
    },
    {
      name: 'Practice Heaven Bead',
      config: {
        ...createBasicAllowedConfiguration(),
        basic: { directAddition: 'allowed', heavenBead: 'target', simpleCombinations: 'allowed' }
      } as SkillConfiguration
    },
    {
      name: 'Learn Five Complements',
      config: {
        ...createBasicAllowedConfiguration(),
        basic: { directAddition: 'allowed', heavenBead: 'allowed', simpleCombinations: 'allowed' },
        fiveComplements: { "4=5-1": 'target', "3=5-2": 'target', "2=5-3": 'off', "1=5-4": 'off' }
      } as SkillConfiguration
    },
    {
      name: 'All Basic Skills',
      config: {
        ...createBasicAllowedConfiguration(),
        basic: { directAddition: 'allowed', heavenBead: 'allowed', simpleCombinations: 'allowed' },
        fiveComplements: { "4=5-1": 'allowed', "3=5-2": 'allowed', "2=5-3": 'allowed', "1=5-4": 'allowed' }
      } as SkillConfiguration
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
                onClick={() => updateSkillConfiguration(preset.config)}
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

        {/* Unified Skill Configuration */}
        <SkillSelector
          skills={skillConfig}
          onChange={updateSkillConfiguration}
          title="Skill Configuration"
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
          {showAdvanced ? '▼' : '▶'} Advanced Constraints
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className={vstack({ gap: 3, alignItems: 'stretch' })}>
            <h5 className={css({
              fontSize: 'md',
              fontWeight: 'medium',
              color: 'gray.700'
            })}>
              Number & Sum Constraints
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
        )}

        {/* Validation Results */}
        {validationResult && (
          <div className={css({
            p: 3,
            bg: validationResult.isValid ? 'green.50' : 'yellow.50',
            border: '1px solid',
            borderColor: validationResult.isValid ? 'green.200' : 'yellow.200',
            rounded: 'md'
          })}>
            <h5 className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: validationResult.isValid ? 'green.800' : 'yellow.800',
              mb: 2
            })}>
              {validationResult.isValid ? '✅ Configuration Valid' : '⚠️ Configuration Warnings'}
            </h5>

            {validationResult.warnings.length > 0 && (
              <div className={css({ mb: 2 })}>
                <strong className={css({ fontSize: 'xs', color: 'yellow.800' })}>Warnings:</strong>
                <ul className={css({ fontSize: 'xs', color: 'yellow.700', pl: 4, mt: 1 })}>
                  {validationResult.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.suggestions.length > 0 && (
              <div>
                <strong className={css({ fontSize: 'xs', color: 'blue.800' })}>Suggestions:</strong>
                <ul className={css({ fontSize: 'xs', color: 'blue.700', pl: 4, mt: 1 })}>
                  {validationResult.suggestions.map((suggestion, index) => (
                    <li key={index}>• {suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Sample Problems Preview */}
        <div className={css({
          p: 3,
          bg: 'blue.50',
          border: '1px solid',
          borderColor: 'blue.200',
          rounded: 'md'
        })}>
          <div className={hstack({ justifyContent: 'space-between', alignItems: 'center', mb: 2 })}>
            <h5 className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'blue.800'
            })}>
              Sample Problems Preview
            </h5>
            <button
              onClick={generateSampleProblems}
              className={css({
                px: 2,
                py: 1,
                fontSize: 'xs',
                bg: 'blue.500',
                color: 'white',
                border: 'none',
                rounded: 'sm',
                cursor: 'pointer',
                _hover: { bg: 'blue.600' }
              })}
            >
              Generate
            </button>
          </div>

          {sampleProblems.length > 0 ? (
            <div className={hstack({ gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' })}>
              {sampleProblems.map((problem, index) => (
                <div key={problem.id} className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1
                })}>
                  {/* Compact vertical problem display */}
                  <div className={css({
                    textAlign: 'right',
                    fontFamily: 'mono',
                    fontSize: 'sm',
                    fontWeight: 'bold',
                    bg: 'gray.50',
                    px: 2,
                    py: 1,
                    rounded: 'sm',
                    border: '1px solid',
                    borderColor: 'gray.200',
                    minW: '40px'
                  })}>
                    {problem.terms.map((term, termIndex) => (
                      <div key={termIndex} className={css({ lineHeight: 'tight' })}>
                        {term}
                      </div>
                    ))}
                    <div className={css({
                      borderTop: '1px solid',
                      borderColor: 'gray.400',
                      mt: 0.5,
                      pt: 0.5
                    })}>
                      {problem.answer}
                    </div>
                  </div>

                  {/* Difficulty badge below */}
                  <span className={css({
                    px: 1,
                    py: 0.5,
                    rounded: 'xs',
                    fontSize: 'xs',
                    bg: problem.difficulty === 'easy' ? 'green.100' :
                        problem.difficulty === 'medium' ? 'yellow.100' : 'red.100',
                    color: problem.difficulty === 'easy' ? 'green.800' :
                           problem.difficulty === 'medium' ? 'yellow.800' : 'red.800'
                  })}>
                    {problem.difficulty}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className={css({
              fontSize: 'xs',
              color: 'blue.700',
              textAlign: 'center',
              py: 2
            })}>
              Click "Generate" to see sample problems
            </div>
          )}

          {/* Skills summary below problems */}
          {sampleProblems.length > 0 && (
            <div className={css({
              mt: 2,
              pt: 2,
              borderTop: '1px solid',
              borderColor: 'blue.200',
              fontSize: 'xs',
              color: 'blue.600'
            })}>
              <strong>Skills used:</strong> {[...new Set(sampleProblems.flatMap(p => p.requiredSkills))].join(', ')}
            </div>
          )}

          {/* Configuration Summary */}
          <div className={css({
            mt: 3,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'blue.200',
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