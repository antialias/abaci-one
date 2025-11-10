'use client'

import { useState, useEffect } from 'react'
import { css } from '../../../../../../../styled-system/css'
import type { WorksheetFormState } from '../../types'
import {
  SINGLE_CARRY_PATH,
  getStepFromSliderValue,
  getSliderValueFromStep,
  findNearestStep,
  getStepById,
} from '../../progressionPath'

interface ProgressionModePanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  isDark?: boolean
}

interface MasteryState {
  stepId: string
  isMastered: boolean
  attempts: number
  correctCount: number
}

/**
 * Progression Mode Panel
 *
 * Slider-based UI that follows a curated learning path through 3D space:
 * - Digit count (1-5 digits)
 * - Regrouping difficulty (0-100%)
 * - Scaffolding level (full → minimal)
 *
 * Key feature: Scaffolding cycles as complexity increases (ten-frames return!)
 */
export function ProgressionModePanel({
  formState,
  onChange,
  isDark = false,
}: ProgressionModePanelProps) {
  // Get current step from formState or default to first step
  const currentStepId = formState.currentStepId ?? SINGLE_CARRY_PATH[0].id
  const currentStep = getStepById(currentStepId, SINGLE_CARRY_PATH) ?? SINGLE_CARRY_PATH[0]

  // Derive slider value from current step
  const sliderValue = getSliderValueFromStep(currentStep.stepNumber, SINGLE_CARRY_PATH.length)

  // Track whether advanced controls are expanded
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Track mastery states for all steps
  const [masteryStates, setMasteryStates] = useState<Map<string, MasteryState>>(new Map())
  const [isLoadingMastery, setIsLoadingMastery] = useState(true)

  // Load mastery data from API
  useEffect(() => {
    async function loadMasteryStates() {
      try {
        setIsLoadingMastery(true)
        const response = await fetch('/api/worksheets/mastery?operator=addition')
        if (!response.ok) {
          throw new Error('Failed to load mastery states')
        }
        const data = await response.json()

        // Convert to Map<stepId, MasteryState>
        // The API returns data with skill IDs, we'll use them as step IDs for now
        const statesMap = new Map<string, MasteryState>()
        for (const record of data.masteryStates) {
          statesMap.set(record.skillId, {
            stepId: record.skillId,
            isMastered: record.isMastered,
            attempts: record.attempts ?? 0,
            correctCount: record.correctCount ?? 0,
          })
        }
        setMasteryStates(statesMap)
      } catch (error) {
        console.error('Failed to load mastery states:', error)
      } finally {
        setIsLoadingMastery(false)
      }
    }

    loadMasteryStates()
  }, [])

  // Apply current step's configuration to form state when step changes
  useEffect(() => {
    console.log('[ProgressionModePanel] Applying step config:', {
      stepId: currentStep.id,
      stepName: currentStep.name,
      stepNumber: currentStep.stepNumber,
      config: currentStep.config,
    })

    onChange({
      currentStepId: currentStep.id,
      ...currentStep.config,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep.id]) // Only run when step ID changes

  // Handler: Slider value changes
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(event.target.value)
    const newStep = getStepFromSliderValue(newValue, SINGLE_CARRY_PATH)

    console.log('[ProgressionModePanel] Slider changed:', {
      sliderValue: newValue,
      newStepNumber: newStep.stepNumber,
      newStepId: newStep.id,
    })

    // Apply new step's config
    onChange({
      currentStepId: newStep.id,
      ...newStep.config,
    })
  }

  // Handler: Manual digit count change
  const handleDigitChange = (digits: number) => {
    const updatedConfig = {
      ...formState,
      digitRange: { min: digits, max: digits },
    }

    // Find nearest step matching new config
    const nearestStep = findNearestStep(updatedConfig, SINGLE_CARRY_PATH)

    console.log('[ProgressionModePanel] Manual digit change:', {
      digits,
      nearestStepId: nearestStep.id,
      nearestStepNumber: nearestStep.stepNumber,
    })

    // Apply nearest step's full config (not just digit range)
    onChange({
      currentStepId: nearestStep.id,
      ...nearestStep.config,
    })
  }

  // Handler: Manual scaffolding change
  const handleScaffoldingChange = (tenFrames: 'whenRegrouping' | 'never') => {
    // Build complete displayRules with the new tenFrames value
    const displayRules = currentStep.config.displayRules
      ? { ...currentStep.config.displayRules, tenFrames }
      : undefined

    const updatedConfig = {
      ...formState,
      displayRules,
    }

    // Find nearest step matching new config
    const nearestStep = findNearestStep(updatedConfig, SINGLE_CARRY_PATH)

    console.log('[ProgressionModePanel] Manual scaffolding change:', {
      tenFrames,
      nearestStepId: nearestStep.id,
      nearestStepNumber: nearestStep.stepNumber,
    })

    // Apply nearest step's full config
    onChange({
      currentStepId: nearestStep.id,
      ...nearestStep.config,
    })
  }

  // Determine scaffolding level description
  const hasFullScaffolding = currentStep.config.displayRules?.tenFrames === 'whenRegrouping'
  const scaffoldingDesc = hasFullScaffolding
    ? 'Full scaffolding (ten-frames shown)'
    : 'Independent practice (no ten-frames)'

  // Get next step info
  const nextStep = currentStep.nextStepId
    ? getStepById(currentStep.nextStepId, SINGLE_CARRY_PATH)
    : null

  return (
    <div
      data-component="progression-mode-panel"
      className={css({
        padding: '1.5rem',
        backgroundColor: isDark ? 'gray.700' : 'gray.50',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: isDark ? 'gray.600' : 'gray.200',
      })}
    >
      {/* Header */}
      <div className={css({ marginBottom: '1.5rem' })}>
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
          Difficulty Progression
        </h3>
      </div>

      {/* Slider */}
      <div
        data-element="slider-container"
        className={css({
          marginBottom: '1.5rem',
        })}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.5rem',
          })}
        >
          <span
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            Easier
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={sliderValue}
            onChange={handleSliderChange}
            data-element="difficulty-slider"
            className={css({
              flex: 1,
              cursor: 'pointer',
            })}
          />
          <span
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            Harder
          </span>
        </div>
      </div>

      {/* Current Status */}
      <div
        data-element="current-status"
        className={css({
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '6px',
          border: '1px solid',
          borderColor: isDark ? 'gray.600' : 'gray.200',
        })}
      >
        <h4
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: isDark ? 'gray.300' : 'gray.700',
            marginBottom: '0.75rem',
          })}
        >
          Currently practicing:
        </h4>
        <ul
          className={css({
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          })}
        >
          <li
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.200' : 'gray.800',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            <span className={css({ color: isDark ? 'blue.400' : 'blue.600' })}>•</span>
            {currentStep.config.digitRange?.min}-digit problems
          </li>
          <li
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.200' : 'gray.800',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            <span className={css({ color: isDark ? 'blue.400' : 'blue.600' })}>•</span>
            {currentStep.name}
          </li>
          <li
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.200' : 'gray.800',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            <span className={css({ color: isDark ? 'blue.400' : 'blue.600' })}>•</span>
            {scaffoldingDesc}
          </li>
        </ul>
      </div>

      {/* Progress Dots */}
      <div
        data-element="progress-dots"
        className={css({
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        })}
      >
        <span
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.400' : 'gray.600',
          })}
        >
          Progress:
        </span>
        <div
          className={css({
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
          })}
        >
          {SINGLE_CARRY_PATH.map((step) => {
            const isMastered = masteryStates.get(step.id)?.isMastered ?? false
            const isCurrent = step.id === currentStep.id

            return (
              <span
                key={step.id}
                data-step={step.stepNumber}
                data-current={isCurrent}
                data-mastered={isMastered}
                className={css({
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%',
                  backgroundColor: isMastered
                    ? isDark
                      ? 'green.400'
                      : 'green.600' // Mastered = green
                    : step.stepNumber <= currentStep.stepNumber
                      ? isDark
                        ? 'blue.400'
                        : 'blue.600' // Current/past = blue
                      : isDark
                        ? 'gray.600'
                        : 'gray.300', // Future = gray
                  border: isCurrent ? '2px solid' : 'none',
                  borderColor: isCurrent ? (isDark ? 'yellow.400' : 'yellow.600') : undefined,
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                })}
                title={`${step.name}${isMastered ? ' ✓ Mastered' : ''}`}
              />
            )
          })}
        </div>
        <span
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.400' : 'gray.600',
          })}
        >
          Step {currentStep.stepNumber + 1} of {SINGLE_CARRY_PATH.length}
        </span>
      </div>

      {/* Next Milestone */}
      {nextStep && (
        <div
          data-element="next-milestone"
          className={css({
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'blue.50',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'blue.200',
          })}
        >
          <h4
            className={css({
              fontSize: '0.875rem',
              fontWeight: '600',
              color: isDark ? 'blue.300' : 'blue.700',
              marginBottom: '0.5rem',
            })}
          >
            Next milestone:
          </h4>
          <p
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.300' : 'gray.700',
              margin: 0,
            })}
          >
            → {nextStep.description}
          </p>
        </div>
      )}

      {/* Advanced Controls Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        data-action="toggle-advanced-controls"
        className={css({
          width: '100%',
          padding: '0.75rem',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: isDark ? 'blue.400' : 'blue.600',
          backgroundColor: isDark ? 'gray.800' : 'white',
          border: '1px solid',
          borderColor: isDark ? 'gray.600' : 'gray.300',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'all 0.2s',
          _hover: {
            backgroundColor: isDark ? 'gray.700' : 'gray.50',
          },
        })}
      >
        {showAdvanced ? 'Hide' : 'Show'} Advanced Controls
        <span className={css({ fontSize: '0.75rem' })}>{showAdvanced ? '▲' : '▼'}</span>
      </button>

      {/* Advanced Controls (Collapsible) */}
      {showAdvanced && (
        <div
          data-element="advanced-controls"
          className={css({
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.200',
          })}
        >
          {/* Digit Count */}
          <div className={css({ marginBottom: '1.5rem' })}>
            <label
              className={css({
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: isDark ? 'gray.300' : 'gray.700',
                marginBottom: '0.75rem',
              })}
            >
              Digit Count:
            </label>
            <div
              className={css({
                display: 'flex',
                gap: '0.5rem',
              })}
            >
              {[1, 2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigitChange(d)}
                  data-setting="digit-count"
                  data-value={d}
                  data-selected={formState.digitRange?.min === d}
                  className={css({
                    flex: 1,
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color:
                      formState.digitRange?.min === d ? 'white' : isDark ? 'gray.300' : 'gray.700',
                    backgroundColor:
                      formState.digitRange?.min === d
                        ? isDark
                          ? 'blue.600'
                          : 'blue.500'
                        : isDark
                          ? 'gray.700'
                          : 'gray.100',
                    border: '1px solid',
                    borderColor:
                      formState.digitRange?.min === d
                        ? isDark
                          ? 'blue.500'
                          : 'blue.400'
                        : isDark
                          ? 'gray.600'
                          : 'gray.300',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    _hover: {
                      backgroundColor:
                        formState.digitRange?.min === d
                          ? isDark
                            ? 'blue.500'
                            : 'blue.400'
                          : isDark
                            ? 'gray.600'
                            : 'gray.200',
                    },
                  })}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Scaffolding Level */}
          <div className={css({ marginBottom: '1rem' })}>
            <label
              className={css({
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: isDark ? 'gray.300' : 'gray.700',
                marginBottom: '0.75rem',
              })}
            >
              Scaffolding Level:
            </label>
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.5rem' })}>
              <label
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                })}
              >
                <input
                  type="radio"
                  name="scaffolding"
                  checked={formState.displayRules?.tenFrames === 'whenRegrouping'}
                  onChange={() => handleScaffoldingChange('whenRegrouping')}
                  data-setting="scaffolding"
                  data-value="full"
                  className={css({ cursor: 'pointer' })}
                />
                <span
                  className={css({
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.200' : 'gray.800',
                  })}
                >
                  Full (ten-frames, carry boxes, colors)
                </span>
              </label>
              <label
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                })}
              >
                <input
                  type="radio"
                  name="scaffolding"
                  checked={formState.displayRules?.tenFrames === 'never'}
                  onChange={() => handleScaffoldingChange('never')}
                  data-setting="scaffolding"
                  data-value="minimal"
                  className={css({ cursor: 'pointer' })}
                />
                <span
                  className={css({
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.200' : 'gray.800',
                  })}
                >
                  Minimal (no ten-frames)
                </span>
              </label>
            </div>
          </div>

          {/* Warning */}
          <div
            className={css({
              padding: '0.75rem',
              backgroundColor: isDark ? 'yellow.900' : 'yellow.50',
              border: '1px solid',
              borderColor: isDark ? 'yellow.700' : 'yellow.300',
              borderRadius: '4px',
            })}
          >
            <p
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'yellow.200' : 'yellow.800',
                margin: 0,
              })}
            >
              ⚠ Manual changes will move you to the nearest step on the progression path
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
