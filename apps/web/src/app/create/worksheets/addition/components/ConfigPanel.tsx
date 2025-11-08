'use client'

import { useState } from 'react'
import type React from 'react'
import * as Checkbox from '@radix-ui/react-checkbox'
import * as Slider from '@radix-ui/react-slider'
import * as Switch from '@radix-ui/react-switch'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useTranslations } from 'next-intl'
import { css } from '../../../../../../styled-system/css'
import { stack } from '../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../types'
import { DisplayOptionsPreview } from './DisplayOptionsPreview'
import { ModeSelector } from './ModeSelector'
import {
  DIFFICULTY_PROFILES,
  DIFFICULTY_PROGRESSION,
  makeHarder,
  makeEasier,
  calculateOverallDifficulty,
  calculateRegroupingIntensity,
  calculateScaffoldingLevel,
  findNearestPreset,
  REGROUPING_PROGRESSION,
  SCAFFOLDING_PROGRESSION,
  findNearestValidState,
  getProfileFromConfig,
  type DifficultyLevel,
  type DifficultyMode,
} from '../difficultyProfiles'
import { defaultAdditionConfig } from '../../config-schemas'
import type { DisplayRules } from '../displayRules'

interface ConfigPanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
}

/**
 * Generate a human-readable summary of enabled scaffolding aids
 * Returns JSX with each frequency group on its own line
 */
function getScaffoldingSummary(displayRules: any): React.ReactNode {
  console.log('[getScaffoldingSummary] displayRules:', displayRules)

  const alwaysItems: string[] = []
  const conditionalItems: string[] = []

  if (displayRules.carryBoxes === 'always') {
    alwaysItems.push('carry boxes')
  } else if (displayRules.carryBoxes !== 'never') {
    conditionalItems.push('carry boxes')
  }

  if (displayRules.answerBoxes === 'always') {
    alwaysItems.push('answer boxes')
  } else if (displayRules.answerBoxes !== 'never') {
    conditionalItems.push('answer boxes')
  }

  if (displayRules.placeValueColors === 'always') {
    alwaysItems.push('place value colors')
  } else if (displayRules.placeValueColors !== 'never') {
    conditionalItems.push('place value colors')
  }

  if (displayRules.tenFrames === 'always') {
    alwaysItems.push('ten-frames')
  } else if (displayRules.tenFrames !== 'never') {
    conditionalItems.push('ten-frames')
  }

  if (alwaysItems.length === 0 && conditionalItems.length === 0) {
    console.log('[getScaffoldingSummary] Final summary: no scaffolding')
    return <span className={css({ color: 'gray.500', fontStyle: 'italic' })}>no scaffolding</span>
  }

  console.log('[getScaffoldingSummary] Final summary:', { alwaysItems, conditionalItems })

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.5' })}>
      {alwaysItems.length > 0 && <div>Always: {alwaysItems.join(', ')}</div>}
      {conditionalItems.length > 0 && <div>When needed: {conditionalItems.join(', ')}</div>}
    </div>
  )
}

interface ToggleOptionProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description: string
  children?: React.ReactNode
}

function ToggleOption({ checked, onChange, label, description, children }: ToggleOptionProps) {
  return (
    <div
      data-element="toggle-option-container"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        h: children ? 'auto' : '20',
        bg: checked ? 'brand.50' : 'white',
        border: '2px solid',
        borderColor: checked ? 'brand.500' : 'gray.200',
        rounded: 'lg',
        transition: 'all 0.15s',
        _hover: {
          borderColor: checked ? 'brand.600' : 'gray.300',
          bg: checked ? 'brand.100' : 'gray.50',
        },
      })}
    >
      <Checkbox.Root
        checked={checked}
        onCheckedChange={onChange}
        data-element="toggle-option"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: '1.5',
          p: '2.5',
          bg: 'transparent',
          border: 'none',
          rounded: 'lg',
          cursor: 'pointer',
          textAlign: 'left',
          w: 'full',
          _focus: {
            outline: 'none',
            ring: '2px',
            ringColor: 'brand.300',
          },
        })}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2',
          })}
        >
          <div
            className={css({
              fontSize: 'xs',
              fontWeight: 'semibold',
              color: checked ? 'brand.700' : 'gray.700',
            })}
          >
            {label}
          </div>
          <div
            className={css({
              w: '9',
              h: '5',
              bg: checked ? 'brand.500' : 'gray.300',
              rounded: 'full',
              position: 'relative',
              transition: 'background-color 0.15s',
              flexShrink: 0,
            })}
          >
            <div
              style={{
                position: 'absolute',
                top: '0.125rem',
                left: checked ? '1.125rem' : '0.125rem',
                width: '1rem',
                height: '1rem',
                background: 'white',
                borderRadius: '9999px',
                transition: 'left 0.15s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            />
          </div>
        </div>
        <div
          className={css({
            fontSize: '2xs',
            color: checked ? 'brand.600' : 'gray.500',
            lineHeight: '1.3',
          })}
        >
          {description}
        </div>
      </Checkbox.Root>
      {children}
    </div>
  )
}

export function ConfigPanel({ formState, onChange }: ConfigPanelProps) {
  const t = useTranslations('create.worksheets.addition')
  const [showDebugPlot, setShowDebugPlot] = useState(false)
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)
  const [hoverPreview, setHoverPreview] = useState<{
    pAnyStart: number
    pAllStart: number
    displayRules: DisplayRules
    matchedProfile: string | 'custom'
  } | null>(null)

  // Helper to get default column count for a given problemsPerPage (user can override)
  const getDefaultColsForProblemsPerPage = (
    problemsPerPage: number,
    orientation: 'portrait' | 'landscape'
  ): number => {
    if (orientation === 'portrait') {
      // Portrait: prefer 2-3 columns
      if (problemsPerPage === 6) return 2
      if (problemsPerPage === 8) return 2
      if (problemsPerPage === 10) return 2
      if (problemsPerPage === 12) return 3
      if (problemsPerPage === 15) return 3
      return 2 // default
    } else {
      // Landscape: prefer 4-5 columns
      if (problemsPerPage === 8) return 4
      if (problemsPerPage === 10) return 5
      if (problemsPerPage === 12) return 4
      if (problemsPerPage === 15) return 5
      if (problemsPerPage === 16) return 4
      if (problemsPerPage === 20) return 5
      return 4 // default
    }
  }

  // Helper to calculate derived state (rows, total) from primary state (problemsPerPage, cols, pages)
  const calculateDerivedState = (problemsPerPage: number, cols: number, pages: number) => {
    const rowsPerPage = problemsPerPage / cols
    const rows = rowsPerPage * pages
    const total = problemsPerPage * pages
    return { rows, total }
  }

  // Get current primary state with defaults
  const currentOrientation = formState.orientation || 'portrait'
  const currentProblemsPerPage =
    formState.problemsPerPage || (currentOrientation === 'portrait' ? 15 : 20)
  const currentCols =
    formState.cols || getDefaultColsForProblemsPerPage(currentProblemsPerPage, currentOrientation)
  const currentPages = formState.pages || 1

  console.log('=== ConfigPanel Render ===')
  console.log('Primary state:', {
    problemsPerPage: currentProblemsPerPage,
    cols: currentCols,
    pages: currentPages,
    orientation: currentOrientation,
  })
  console.log(
    'Derived state:',
    calculateDerivedState(currentProblemsPerPage, currentCols, currentPages)
  )

  // Helper function to handle difficulty adjustments
  const handleDifficultyChange = (mode: DifficultyMode, direction: 'harder' | 'easier') => {
    // Defensive: Ensure all required fields are defined before calling makeHarder/makeEasier
    // This prevents "Cannot read properties of undefined" errors in production

    // Log warning if any fields are missing (helps debug production issues)
    if (!formState.displayRules || !formState.pAnyStart || !formState.pAllStart) {
      console.error('[ConfigPanel] Missing required fields for difficulty adjustment!', {
        hasDisplayRules: !!formState.displayRules,
        hasPAnyStart: formState.pAnyStart !== undefined,
        hasPAllStart: formState.pAllStart !== undefined,
        formState,
      })
    }

    const currentState = {
      pAnyStart: formState.pAnyStart ?? defaultAdditionConfig.pAnyStart,
      pAllStart: formState.pAllStart ?? defaultAdditionConfig.pAllStart,
      displayRules: formState.displayRules ?? defaultAdditionConfig.displayRules,
    }

    const result =
      direction === 'harder' ? makeHarder(currentState, mode) : makeEasier(currentState, mode)

    const beforeReg = calculateRegroupingIntensity(currentState.pAnyStart, currentState.pAllStart)
    const beforeScaf = calculateScaffoldingLevel(currentState.displayRules, beforeReg)
    const afterReg = calculateRegroupingIntensity(result.pAnyStart, result.pAllStart)
    const afterScaf = calculateScaffoldingLevel(result.displayRules, afterReg)

    console.log(`=== MAKE ${direction.toUpperCase()} (${mode}) ===`)
    console.log(
      `BEFORE: (${beforeReg.toFixed(2)}, ${beforeScaf.toFixed(2)}) | pAny=${(currentState.pAnyStart * 100).toFixed(0)}% pAll=${(currentState.pAllStart * 100).toFixed(0)}% | rules=${JSON.stringify(currentState.displayRules)}`
    )
    console.log(
      `AFTER:  (${afterReg.toFixed(2)}, ${afterScaf.toFixed(2)}) | pAny=${(result.pAnyStart * 100).toFixed(0)}% pAll=${(result.pAllStart * 100).toFixed(0)}% | rules=${JSON.stringify(result.displayRules)}`
    )
    console.log(
      `DELTA:  (${(afterReg - beforeReg).toFixed(2)}, ${(afterScaf - beforeScaf).toFixed(2)})`
    )
    console.log(`DESC:   ${result.changeDescription}`)
    console.log('==================')

    onChange({
      difficultyProfile: result.difficultyProfile,
      displayRules: result.displayRules,
      pAllStart: result.pAllStart,
      pAnyStart: result.pAnyStart,
    })
  }

  // Handler for mode switching
  const handleModeChange = (newMode: 'smart' | 'manual') => {
    if (formState.mode === newMode) {
      return // No change needed
    }

    if (newMode === 'smart') {
      // Switching to Smart mode
      // Use current displayRules if available, otherwise default to earlyLearner
      const displayRules = formState.displayRules ?? defaultAdditionConfig.displayRules
      onChange({
        mode: 'smart',
        displayRules,
        difficultyProfile: 'earlyLearner',
      } as unknown as Partial<WorksheetFormState>)
    } else {
      // Switching to Manual mode
      // Convert current displayRules to boolean flags if available
      let booleanFlags = {
        showCarryBoxes: true,
        showAnswerBoxes: true,
        showPlaceValueColors: true,
        showTenFrames: false,
        showProblemNumbers: true,
        showCellBorder: true,
        showTenFramesForAll: false,
      }

      if (formState.displayRules) {
        // Convert 'always' to true, everything else to false
        booleanFlags = {
          showCarryBoxes: formState.displayRules.carryBoxes === 'always',
          showAnswerBoxes: formState.displayRules.answerBoxes === 'always',
          showPlaceValueColors: formState.displayRules.placeValueColors === 'always',
          showTenFrames: formState.displayRules.tenFrames === 'always',
          showProblemNumbers: formState.displayRules.problemNumbers === 'always',
          showCellBorder: formState.displayRules.cellBorders === 'always',
          showTenFramesForAll: false,
        }
      }

      onChange({
        mode: 'manual',
        ...booleanFlags,
      } as unknown as Partial<WorksheetFormState>)
    }
  }

  return (
    <div data-component="config-panel" className={stack({ gap: '3' })}>
      {/* Student Name */}
      <input
        type="text"
        value={formState.name || ''}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Student Name"
        className={css({
          w: 'full',
          px: '3',
          py: '2',
          border: '1px solid',
          borderColor: 'gray.300',
          rounded: 'lg',
          fontSize: 'sm',
          _focus: {
            outline: 'none',
            borderColor: 'brand.500',
            ring: '2px',
            ringColor: 'brand.200',
          },
          _placeholder: { color: 'gray.400' },
        })}
      />

      {/* Digit Range Selector */}
      <div
        data-section="digit-range"
        className={css({
          bg: 'gray.50',
          border: '1px solid',
          borderColor: 'gray.200',
          rounded: 'xl',
          p: '4',
        })}
      >
        <div className={css({ mb: '3' })}>
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            })}
          >
            <label className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'gray.700' })}>
              Problem Size (Digits per Number)
            </label>
            <span className={css({ fontSize: 'sm', fontWeight: 'bold', color: 'brand.600' })}>
              {(() => {
                const min = formState.digitRange?.min ?? 2
                const max = formState.digitRange?.max ?? 2
                return min === max ? `${min}` : `${min}-${max}`
              })()}
            </span>
          </div>
          <p className={css({ fontSize: 'xs', color: 'gray.500', mt: '1' })}>
            {(() => {
              const min = formState.digitRange?.min ?? 2
              const max = formState.digitRange?.max ?? 2
              return min === max
                ? `All problems: exactly ${min} digit${min > 1 ? 's' : ''}`
                : `Mixed problem sizes from ${min} to ${max} digits`
            })()}
          </p>
        </div>

        {/* Range Slider with Tick Marks */}
        <div className={css({ position: 'relative', px: '3', py: '4' })}>
          {/* Tick marks */}
          <div
            className={css({
              position: 'absolute',
              width: 'full',
              top: '0',
              left: '0',
              px: '3',
              display: 'flex',
              justifyContent: 'space-between',
            })}
          >
            {[1, 2, 3, 4, 5].map((digit) => (
              <div
                key={`tick-${digit}`}
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '0',
                })}
              >
                <div
                  className={css({
                    fontSize: '2xs',
                    fontWeight: 'medium',
                    color: 'gray.600',
                    mb: '1',
                  })}
                >
                  {digit}
                </div>
                <div
                  className={css({
                    width: '1px',
                    height: '2',
                    bg: 'gray.300',
                  })}
                />
              </div>
            ))}
          </div>

          {/* Double-thumbed range slider */}
          <Slider.Root
            className={css({
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              userSelect: 'none',
              touchAction: 'none',
              width: 'full',
              height: '6',
              mt: '8',
            })}
            value={[formState.digitRange?.min ?? 2, formState.digitRange?.max ?? 2]}
            onValueChange={(values) => {
              onChange({
                digitRange: {
                  min: values[0],
                  max: values[1],
                },
              })
            }}
            min={1}
            max={5}
            step={1}
            minStepsBetweenThumbs={0}
          >
            <Slider.Track
              className={css({
                position: 'relative',
                flexGrow: 1,
                bg: 'gray.200',
                rounded: 'full',
                height: '2',
              })}
            >
              <Slider.Range
                className={css({
                  position: 'absolute',
                  bg: 'brand.500',
                  rounded: 'full',
                  height: 'full',
                })}
              />
            </Slider.Track>
            <Slider.Thumb
              className={css({
                display: 'block',
                width: '4',
                height: '4',
                bg: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                rounded: 'full',
                border: '2px solid',
                borderColor: 'brand.500',
                cursor: 'grab',
                transition: 'transform 0.15s',
                _hover: { transform: 'scale(1.15)' },
                _focus: { outline: 'none', boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)' },
                _active: { cursor: 'grabbing' },
              })}
            />
            <Slider.Thumb
              className={css({
                display: 'block',
                width: '4',
                height: '4',
                bg: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                rounded: 'full',
                border: '2px solid',
                borderColor: 'brand.600',
                cursor: 'grab',
                transition: 'transform 0.15s',
                _hover: { transform: 'scale(1.15)' },
                _focus: { outline: 'none', boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)' },
                _active: { cursor: 'grabbing' },
              })}
            />
          </Slider.Root>
        </div>
      </div>

      {/* Operator Selector */}
      <div
        data-section="operator-selection"
        className={css({
          bg: 'gray.50',
          border: '1px solid',
          borderColor: 'gray.200',
          rounded: 'xl',
          p: '4',
        })}
      >
        <label
          className={css({
            fontSize: 'sm',
            fontWeight: 'semibold',
            color: 'gray.700',
            mb: '2',
            display: 'block',
          })}
        >
          Operation Type
        </label>

        <div className={css({ display: 'flex', gap: '2', mb: '2' })}>
          <button
            type="button"
            onClick={() => onChange({ operator: 'addition' })}
            className={css({
              flex: 1,
              px: '4',
              py: '2',
              rounded: 'lg',
              fontSize: 'sm',
              fontWeight: 'medium',
              border: '2px solid',
              transition: 'all 0.2s',
              ...(formState.operator === 'addition' || !formState.operator
                ? {
                    bg: 'brand.600',
                    borderColor: 'brand.600',
                    color: 'white',
                  }
                : {
                    bg: 'white',
                    borderColor: 'gray.300',
                    color: 'gray.700',
                    _hover: { borderColor: 'gray.400' },
                  }),
            })}
          >
            Addition Only (+)
          </button>

          <button
            type="button"
            onClick={() => onChange({ operator: 'subtraction' })}
            className={css({
              flex: 1,
              px: '4',
              py: '2',
              rounded: 'lg',
              fontSize: 'sm',
              fontWeight: 'medium',
              border: '2px solid',
              transition: 'all 0.2s',
              ...(formState.operator === 'subtraction'
                ? {
                    bg: 'brand.600',
                    borderColor: 'brand.600',
                    color: 'white',
                  }
                : {
                    bg: 'white',
                    borderColor: 'gray.300',
                    color: 'gray.700',
                    _hover: { borderColor: 'gray.400' },
                  }),
            })}
          >
            Subtraction Only (−)
          </button>

          <button
            type="button"
            onClick={() => onChange({ operator: 'mixed' })}
            className={css({
              flex: 1,
              px: '4',
              py: '2',
              rounded: 'lg',
              fontSize: 'sm',
              fontWeight: 'medium',
              border: '2px solid',
              transition: 'all 0.2s',
              ...(formState.operator === 'mixed'
                ? {
                    bg: 'brand.600',
                    borderColor: 'brand.600',
                    color: 'white',
                  }
                : {
                    bg: 'white',
                    borderColor: 'gray.300',
                    color: 'gray.700',
                    _hover: { borderColor: 'gray.400' },
                  }),
            })}
          >
            Mixed (+/−)
          </button>
        </div>

        <p className={css({ fontSize: 'xs', color: 'gray.600' })}>
          {formState.operator === 'mixed'
            ? 'Problems will randomly use addition or subtraction'
            : formState.operator === 'subtraction'
              ? 'All problems will be subtraction'
              : 'All problems will be addition'}
        </p>
      </div>

      {/* Mode Selector */}
      <ModeSelector currentMode={formState.mode ?? 'smart'} onChange={handleModeChange} />

      {/* Progressive Difficulty Toggle - Available for both modes */}
      <div
        data-section="progressive-difficulty"
        className={css({
          bg: 'gray.50',
          border: '1px solid',
          borderColor: 'gray.200',
          rounded: 'xl',
          p: '3',
        })}
      >
        <div
          className={css({
            display: 'flex',
            gap: '3',
            alignItems: 'center',
            justifyContent: 'space-between',
          })}
        >
          <label
            htmlFor="progressive-toggle"
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'gray.700',
              cursor: 'pointer',
            })}
          >
            Progressive difficulty
          </label>
          <Switch.Root
            id="progressive-toggle"
            checked={formState.interpolate ?? true}
            onCheckedChange={(checked) => onChange({ interpolate: checked })}
            className={css({
              width: '11',
              height: '6',
              bg: 'gray.300',
              rounded: 'full',
              position: 'relative',
              cursor: 'pointer',
              '&[data-state="checked"]': {
                bg: 'brand.500',
              },
            })}
          >
            <Switch.Thumb
              className={css({
                display: 'block',
                width: '5',
                height: '5',
                bg: 'white',
                rounded: 'full',
                transition: 'transform 0.1s',
                transform: 'translateX(1px)',
                willChange: 'transform',
                '&[data-state="checked"]': {
                  transform: 'translateX(23px)',
                },
              })}
            />
          </Switch.Root>
        </div>
        <div
          className={css({
            fontSize: 'xs',
            color: 'gray.500',
            mt: '1',
          })}
        >
          Start easier and gradually build up throughout the worksheet
        </div>
      </div>

      {/* Difficulty Level Card - Smart Mode Only */}
      {(!formState.mode || formState.mode === 'smart') && (
        <div
          data-section="difficulty"
          className={css({
            bg: 'gray.50',
            border: '1px solid',
            borderColor: 'gray.200',
            rounded: 'xl',
            p: '3',
          })}
        >
          <div className={stack({ gap: '2.5' })}>
            <div
              className={css({
                fontSize: 'xs',
                fontWeight: 'semibold',
                color: 'gray.500',
                textTransform: 'uppercase',
                letterSpacing: 'wider',
              })}
            >
              Difficulty Level
            </div>

            {/* Get current profile and state */}
            {(() => {
              const currentProfile = formState.difficultyProfile as DifficultyLevel | undefined
              const profile = currentProfile
                ? DIFFICULTY_PROFILES[currentProfile]
                : DIFFICULTY_PROFILES.earlyLearner

              // Use defaults from profile if form state values are undefined
              const pAnyStart = formState.pAnyStart ?? profile.regrouping.pAnyStart
              const pAllStart = formState.pAllStart ?? profile.regrouping.pAllStart
              const displayRules = formState.displayRules ?? profile.displayRules

              // Check if current state matches the selected profile
              const matchesProfile =
                pAnyStart === profile.regrouping.pAnyStart &&
                pAllStart === profile.regrouping.pAllStart &&
                JSON.stringify(displayRules) === JSON.stringify(profile.displayRules)
              const isCustom = !matchesProfile

              // Find nearest presets for custom configurations
              let nearestEasier: DifficultyLevel | null = null
              let nearestHarder: DifficultyLevel | null = null
              let customDescription: React.ReactNode = ''

              if (isCustom) {
                const currentRegrouping = calculateRegroupingIntensity(pAnyStart, pAllStart)
                const currentScaffolding = calculateScaffoldingLevel(
                  displayRules,
                  currentRegrouping
                )

                // Calculate distances to all presets
                const distances = DIFFICULTY_PROGRESSION.map((presetName) => {
                  const preset = DIFFICULTY_PROFILES[presetName]
                  const presetRegrouping = calculateRegroupingIntensity(
                    preset.regrouping.pAnyStart,
                    preset.regrouping.pAllStart
                  )
                  const presetScaffolding = calculateScaffoldingLevel(
                    preset.displayRules,
                    presetRegrouping
                  )
                  const distance = Math.sqrt(
                    (currentRegrouping - presetRegrouping) ** 2 +
                      (currentScaffolding - presetScaffolding) ** 2
                  )
                  return {
                    presetName,
                    distance,
                    difficulty: calculateOverallDifficulty(
                      preset.regrouping.pAnyStart,
                      preset.regrouping.pAllStart,
                      preset.displayRules
                    ),
                  }
                }).sort((a, b) => a.distance - b.distance)

                const currentDifficultyValue = calculateOverallDifficulty(
                  pAnyStart,
                  pAllStart,
                  displayRules
                )

                // Find closest easier and harder presets
                const easierPresets = distances.filter((d) => d.difficulty < currentDifficultyValue)
                const harderPresets = distances.filter((d) => d.difficulty > currentDifficultyValue)

                nearestEasier =
                  easierPresets.length > 0 ? easierPresets[0].presetName : distances[0].presetName
                nearestHarder =
                  harderPresets.length > 0
                    ? harderPresets[0].presetName
                    : distances[distances.length - 1].presetName

                // Generate custom description
                const regroupingPercent = Math.round(pAnyStart * 100)
                const scaffoldingSummary = getScaffoldingSummary(displayRules)
                customDescription = (
                  <>
                    <div>{regroupingPercent}% regrouping</div>
                    {scaffoldingSummary}
                  </>
                )
              }

              // Calculate current difficulty position
              const currentDifficulty = calculateOverallDifficulty(
                pAnyStart,
                pAllStart,
                displayRules
              )

              // Calculate make easier/harder results for preview (all modes)
              const easierResultBoth = makeEasier(
                {
                  pAnyStart,
                  pAllStart,
                  displayRules,
                },
                'both'
              )

              const easierResultChallenge = makeEasier(
                {
                  pAnyStart,
                  pAllStart,
                  displayRules,
                },
                'challenge'
              )

              const easierResultSupport = makeEasier(
                {
                  pAnyStart,
                  pAllStart,
                  displayRules,
                },
                'support'
              )

              const harderResultBoth = makeHarder(
                {
                  pAnyStart,
                  pAllStart,
                  displayRules,
                },
                'both'
              )

              const harderResultChallenge = makeHarder(
                {
                  pAnyStart,
                  pAllStart,
                  displayRules,
                },
                'challenge'
              )

              const harderResultSupport = makeHarder(
                {
                  pAnyStart,
                  pAllStart,
                  displayRules,
                },
                'support'
              )

              const canMakeEasierBoth =
                easierResultBoth.changeDescription !== 'Already at minimum difficulty'
              const canMakeEasierChallenge =
                easierResultChallenge.changeDescription !== 'Already at minimum difficulty'
              const canMakeEasierSupport =
                easierResultSupport.changeDescription !== 'Already at minimum difficulty'
              const canMakeHarderBoth =
                harderResultBoth.changeDescription !== 'Already at maximum difficulty'
              const canMakeHarderChallenge =
                harderResultChallenge.changeDescription !== 'Already at maximum difficulty'
              const canMakeHarderSupport =
                harderResultSupport.changeDescription !== 'Already at maximum difficulty'

              // Keep legacy names for compatibility
              const canMakeEasier = canMakeEasierBoth
              const canMakeHarder = canMakeHarderBoth

              return (
                <>
                  {/* Preset Selector Dropdown */}
                  <div className={css({ mb: '3' })}>
                    <div
                      className={css({
                        fontSize: 'xs',
                        fontWeight: 'medium',
                        color: 'gray.700',
                        mb: '2',
                      })}
                    >
                      Difficulty Preset
                    </div>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          type="button"
                          data-action="open-preset-dropdown"
                          className={css({
                            w: 'full',
                            h: '24',
                            px: '3',
                            py: '2.5',
                            border: '2px solid',
                            borderColor: isCustom ? 'orange.400' : 'gray.300',
                            bg: isCustom ? 'orange.50' : 'white',
                            rounded: 'lg',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            gap: '2',
                            _hover: {
                              borderColor: isCustom ? 'orange.500' : 'brand.400',
                            },
                          })}
                        >
                          <div
                            className={css({
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '1',
                            })}
                          >
                            <div
                              className={css({
                                fontSize: 'sm',
                                fontWeight: 'semibold',
                                color: hoverPreview ? 'orange.700' : 'gray.700',
                              })}
                            >
                              {hoverPreview ? (
                                <>
                                  {hoverPreview.matchedProfile !== 'custom' ? (
                                    <>
                                      {DIFFICULTY_PROFILES[hoverPreview.matchedProfile].label}{' '}
                                      <span
                                        className={css({ fontSize: 'xs', color: 'orange.500' })}
                                      >
                                        (hover preview)
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      ✨ Custom{' '}
                                      <span
                                        className={css({ fontSize: 'xs', color: 'orange.500' })}
                                      >
                                        (hover preview)
                                      </span>
                                    </>
                                  )}
                                </>
                              ) : isCustom ? (
                                nearestEasier && nearestHarder ? (
                                  <>
                                    {DIFFICULTY_PROFILES[nearestEasier].label}
                                    {' ↔ '}
                                    {DIFFICULTY_PROFILES[nearestHarder].label}
                                  </>
                                ) : (
                                  '✨ Custom'
                                )
                              ) : currentProfile ? (
                                DIFFICULTY_PROFILES[currentProfile].label
                              ) : (
                                'Early Learner'
                              )}
                            </div>
                            <div
                              className={css({
                                fontSize: 'xs',
                                color: hoverPreview
                                  ? 'orange.600'
                                  : isCustom
                                    ? 'orange.600'
                                    : 'gray.500',
                                lineHeight: '1.3',
                                h: '14',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5',
                                overflow: 'hidden',
                              })}
                            >
                              {hoverPreview ? (
                                (() => {
                                  const regroupingPercent = Math.round(hoverPreview.pAnyStart * 100)
                                  const scaffoldingSummary = getScaffoldingSummary(
                                    hoverPreview.displayRules
                                  )
                                  return (
                                    <>
                                      <div>{regroupingPercent}% regrouping</div>
                                      {scaffoldingSummary}
                                    </>
                                  )
                                })()
                              ) : isCustom ? (
                                customDescription
                              ) : currentProfile ? (
                                (() => {
                                  const preset = DIFFICULTY_PROFILES[currentProfile]
                                  const regroupingPercent = Math.round(
                                    preset.regrouping.pAnyStart * 100
                                  )
                                  const scaffoldingSummary = getScaffoldingSummary(
                                    preset.displayRules
                                  )
                                  return (
                                    <>
                                      <div>{regroupingPercent}% regrouping</div>
                                      {scaffoldingSummary}
                                    </>
                                  )
                                })()
                              ) : (
                                <>
                                  <div>25% regrouping</div>
                                  <div>
                                    Always: carry boxes, answer boxes, place value colors,
                                    ten-frames
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <span
                            className={css({ fontSize: 'xs', color: 'gray.400', flexShrink: 0 })}
                          >
                            ▼
                          </span>
                        </button>
                      </DropdownMenu.Trigger>

                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className={css({
                            bg: 'white',
                            rounded: 'lg',
                            shadow: 'modal',
                            border: '1px solid',
                            borderColor: 'gray.200',
                            p: '2',
                            minW: '64',
                            maxH: '96',
                            overflowY: 'auto',
                            zIndex: 50,
                          })}
                          sideOffset={5}
                        >
                          {DIFFICULTY_PROGRESSION.map((presetName) => {
                            const preset = DIFFICULTY_PROFILES[presetName]
                            const isSelected = currentProfile === presetName && !isCustom

                            // Generate preset description
                            const regroupingPercent = Math.round(
                              calculateRegroupingIntensity(
                                preset.regrouping.pAnyStart,
                                preset.regrouping.pAllStart
                              ) * 10
                            )
                            const scaffoldingSummary = getScaffoldingSummary(preset.displayRules)
                            const presetDescription = (
                              <>
                                <div>{regroupingPercent}% regrouping</div>
                                {scaffoldingSummary}
                              </>
                            )

                            return (
                              <DropdownMenu.Item
                                key={presetName}
                                data-action={`select-preset-${presetName}`}
                                onSelect={() => {
                                  // Apply preset configuration
                                  onChange({
                                    difficultyProfile: presetName,
                                    pAnyStart: preset.regrouping.pAnyStart,
                                    pAllStart: preset.regrouping.pAllStart,
                                    displayRules: preset.displayRules,
                                  })
                                }}
                                className={css({
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '1',
                                  px: '3',
                                  py: '2.5',
                                  rounded: 'md',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  bg: isSelected ? 'brand.50' : 'transparent',
                                  _hover: {
                                    bg: 'brand.50',
                                  },
                                  _focus: {
                                    bg: 'brand.100',
                                  },
                                })}
                              >
                                <div
                                  className={css({
                                    fontSize: 'sm',
                                    fontWeight: 'semibold',
                                    color: isSelected ? 'brand.700' : 'gray.700',
                                  })}
                                >
                                  {preset.label}
                                </div>
                                <div
                                  className={css({
                                    fontSize: 'xs',
                                    color: isSelected ? 'brand.600' : 'gray.500',
                                    lineHeight: '1.3',
                                  })}
                                >
                                  {presetDescription}
                                </div>
                              </DropdownMenu.Item>
                            )
                          })}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>

                  {/* Make Easier/Harder buttons with preview */}
                  <div
                    className={css({
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2',
                      pt: '1',
                      borderTop: '1px solid',
                      borderColor: 'gray.200',
                    })}
                  >
                    {/* Four-Button Layout: [Alt-35%][Rec-65%][Rec-65%][Alt-35%] */}
                    <Tooltip.Provider delayDuration={300}>
                      <div className={css({ display: 'flex', gap: '2' })}>
                        {/* Determine which mode is alternative for easier */}
                        {(() => {
                          const easierAlternativeMode =
                            easierResultBoth.changeDescription ===
                            easierResultChallenge.changeDescription
                              ? 'support'
                              : 'challenge'
                          const easierAlternativeResult =
                            easierAlternativeMode === 'support'
                              ? easierResultSupport
                              : easierResultChallenge
                          const easierAlternativeLabel =
                            easierAlternativeMode === 'support'
                              ? '↑ More support'
                              : '← Less challenge'
                          const canEasierAlternative =
                            easierAlternativeMode === 'support'
                              ? canMakeEasierSupport
                              : canMakeEasierChallenge

                          return (
                            <div className={css({ display: 'flex', flex: '1' })}>
                              {/* Alternative Easier Button - Hidden if disabled and main is enabled */}
                              {canEasierAlternative && (
                                <Tooltip.Root>
                                  <Tooltip.Trigger asChild>
                                    <button
                                      onClick={() =>
                                        handleDifficultyChange(easierAlternativeMode, 'easier')
                                      }
                                      disabled={!canEasierAlternative}
                                      data-action={`easier-${easierAlternativeMode}`}
                                      className={css({
                                        flexShrink: 0,
                                        width: '10',
                                        h: '16',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '2xs',
                                        fontWeight: 'medium',
                                        color: 'gray.700',
                                        bg: 'gray.100',
                                        border: '1.5px solid',
                                        borderColor: 'gray.300',
                                        borderRight: 'none',
                                        borderTopLeftRadius: 'lg',
                                        borderBottomLeftRadius: 'lg',
                                        cursor: 'pointer',
                                        _hover: {
                                          bg: 'gray.200',
                                        },
                                      })}
                                    >
                                      {easierAlternativeLabel}
                                    </button>
                                  </Tooltip.Trigger>
                                  <Tooltip.Portal>
                                    <Tooltip.Content
                                      side="top"
                                      className={css({
                                        bg: 'gray.800',
                                        color: 'white',
                                        px: '3',
                                        py: '2',
                                        rounded: 'md',
                                        fontSize: 'xs',
                                        maxW: '250px',
                                        shadow: 'lg',
                                        zIndex: 1000,
                                      })}
                                    >
                                      {easierAlternativeResult.changeDescription}
                                      <Tooltip.Arrow className={css({ fill: 'gray.800' })} />
                                    </Tooltip.Content>
                                  </Tooltip.Portal>
                                </Tooltip.Root>
                              )}

                              {/* Recommended Easier Button - Expands to full width if alternative is hidden */}
                              <button
                                onClick={() => handleDifficultyChange('both', 'easier')}
                                disabled={!canMakeEasier}
                                data-action="easier-both"
                                className={css({
                                  flex: '1',
                                  h: '16',
                                  px: '3',
                                  py: '2',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                  gap: '0.5',
                                  color: canMakeEasier ? 'brand.700' : 'gray.400',
                                  bg: 'white',
                                  border: '1.5px solid',
                                  borderColor: canMakeEasier ? 'brand.500' : 'gray.300',
                                  borderTopLeftRadius: canEasierAlternative ? 'none' : 'lg',
                                  borderBottomLeftRadius: canEasierAlternative ? 'none' : 'lg',
                                  borderTopRightRadius: 'lg',
                                  borderBottomRightRadius: 'lg',
                                  cursor: canMakeEasier ? 'pointer' : 'not-allowed',
                                  opacity: canMakeEasier ? 1 : 0.5,
                                  _hover: canMakeEasier
                                    ? {
                                        bg: 'brand.50',
                                      }
                                    : {},
                                })}
                              >
                                <div
                                  className={css({
                                    fontSize: 'xs',
                                    fontWeight: 'semibold',
                                    flexShrink: 0,
                                  })}
                                >
                                  ← Make Easier
                                </div>
                                {canMakeEasier && (
                                  <div
                                    className={css({
                                      fontSize: '2xs',
                                      fontWeight: 'normal',
                                      lineHeight: '1.3',
                                      textAlign: 'left',
                                      overflow: 'hidden',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                    })}
                                    style={{ WebkitBoxOrient: 'vertical' } as React.CSSProperties}
                                  >
                                    {easierResultBoth.changeDescription}
                                  </div>
                                )}
                              </button>
                            </div>
                          )
                        })()}

                        {/* Determine which mode is alternative for harder */}
                        {(() => {
                          const harderAlternativeMode =
                            harderResultBoth.changeDescription ===
                            harderResultChallenge.changeDescription
                              ? 'support'
                              : 'challenge'
                          const harderAlternativeResult =
                            harderAlternativeMode === 'support'
                              ? harderResultSupport
                              : harderResultChallenge
                          const harderAlternativeLabel =
                            harderAlternativeMode === 'support'
                              ? '↓ Less support'
                              : '→ More challenge'
                          const canHarderAlternative =
                            harderAlternativeMode === 'support'
                              ? canMakeHarderSupport
                              : canMakeHarderChallenge

                          return (
                            <div className={css({ display: 'flex', flex: '1' })}>
                              {/* Recommended Harder Button - Expands to full width if alternative is hidden */}
                              <button
                                onClick={() => handleDifficultyChange('both', 'harder')}
                                disabled={!canMakeHarder}
                                data-action="harder-both"
                                className={css({
                                  flex: '1',
                                  h: '16',
                                  px: '3',
                                  py: '2',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                  gap: '0.5',
                                  color: canMakeHarder ? 'brand.700' : 'gray.400',
                                  bg: 'white',
                                  border: '1.5px solid',
                                  borderColor: canMakeHarder ? 'brand.500' : 'gray.300',
                                  borderTopLeftRadius: 'lg',
                                  borderBottomLeftRadius: 'lg',
                                  borderTopRightRadius: canHarderAlternative ? 'none' : 'lg',
                                  borderBottomRightRadius: canHarderAlternative ? 'none' : 'lg',
                                  cursor: canMakeHarder ? 'pointer' : 'not-allowed',
                                  opacity: canMakeHarder ? 1 : 0.5,
                                  _hover: canMakeHarder
                                    ? {
                                        bg: 'brand.50',
                                      }
                                    : {},
                                })}
                              >
                                <div
                                  className={css({
                                    fontSize: 'xs',
                                    fontWeight: 'semibold',
                                    flexShrink: 0,
                                  })}
                                >
                                  Make Harder →
                                </div>
                                {canMakeHarder && (
                                  <div
                                    className={css({
                                      fontSize: '2xs',
                                      fontWeight: 'normal',
                                      lineHeight: '1.3',
                                      textAlign: 'left',
                                      overflow: 'hidden',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                    })}
                                    style={{ WebkitBoxOrient: 'vertical' } as React.CSSProperties}
                                  >
                                    {harderResultBoth.changeDescription}
                                  </div>
                                )}
                              </button>

                              {/* Alternative Harder Button - Hidden if disabled and main is enabled */}
                              {canHarderAlternative && (
                                <Tooltip.Root>
                                  <Tooltip.Trigger asChild>
                                    <button
                                      onClick={() =>
                                        handleDifficultyChange(harderAlternativeMode, 'harder')
                                      }
                                      disabled={!canHarderAlternative}
                                      data-action={`harder-${harderAlternativeMode}`}
                                      className={css({
                                        flexShrink: 0,
                                        width: '10',
                                        h: '16',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '2xs',
                                        fontWeight: 'medium',
                                        color: 'gray.700',
                                        bg: 'gray.100',
                                        border: '1.5px solid',
                                        borderColor: 'gray.300',
                                        borderLeft: 'none',
                                        borderTopRightRadius: 'lg',
                                        borderBottomRightRadius: 'lg',
                                        cursor: 'pointer',
                                        _hover: {
                                          bg: 'gray.200',
                                        },
                                      })}
                                    >
                                      {harderAlternativeLabel}
                                    </button>
                                  </Tooltip.Trigger>
                                  {canHarderAlternative && (
                                    <Tooltip.Portal>
                                      <Tooltip.Content
                                        side="top"
                                        className={css({
                                          bg: 'gray.800',
                                          color: 'white',
                                          px: '3',
                                          py: '2',
                                          rounded: 'md',
                                          fontSize: 'xs',
                                          maxW: '250px',
                                          shadow: 'lg',
                                          zIndex: 1000,
                                        })}
                                      >
                                        {harderAlternativeResult.changeDescription}
                                        <Tooltip.Arrow className={css({ fill: 'gray.800' })} />
                                      </Tooltip.Content>
                                    </Tooltip.Portal>
                                  )}
                                </Tooltip.Root>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </Tooltip.Provider>
                  </div>

                  {/* Overall Difficulty Slider */}
                  <div className={css({ mb: '2' })}>
                    <div
                      className={css({
                        fontSize: 'xs',
                        fontWeight: 'medium',
                        color: 'gray.700',
                        mb: '1.5',
                      })}
                    >
                      Overall Difficulty: {currentDifficulty.toFixed(1)} / 10
                    </div>

                    {/* Difficulty Slider */}
                    <div className={css({ position: 'relative', px: '2' })}>
                      <Slider.Root
                        value={[currentDifficulty * 10]}
                        max={100}
                        step={1}
                        onValueChange={(value) => {
                          const targetDifficulty = value[0] / 10

                          // Calculate preset positions in 2D space
                          const presetPoints = DIFFICULTY_PROGRESSION.map((presetName) => {
                            const preset = DIFFICULTY_PROFILES[presetName]
                            const regrouping = calculateRegroupingIntensity(
                              preset.regrouping.pAnyStart,
                              preset.regrouping.pAllStart
                            )
                            const scaffolding = calculateScaffoldingLevel(
                              preset.displayRules,
                              regrouping
                            )
                            const difficulty = calculateOverallDifficulty(
                              preset.regrouping.pAnyStart,
                              preset.regrouping.pAllStart,
                              preset.displayRules
                            )
                            return { regrouping, scaffolding, difficulty, name: presetName }
                          })

                          // Find which path segment we're on and interpolate
                          let idealRegrouping = 0
                          let idealScaffolding = 10

                          for (let i = 0; i < presetPoints.length - 1; i++) {
                            const start = presetPoints[i]
                            const end = presetPoints[i + 1]

                            if (
                              targetDifficulty >= start.difficulty &&
                              targetDifficulty <= end.difficulty
                            ) {
                              // Interpolate between start and end
                              const t =
                                (targetDifficulty - start.difficulty) /
                                (end.difficulty - start.difficulty)
                              idealRegrouping =
                                start.regrouping + t * (end.regrouping - start.regrouping)
                              idealScaffolding =
                                start.scaffolding + t * (end.scaffolding - start.scaffolding)
                              console.log(
                                '[Slider] Interpolating between',
                                start.name,
                                'and',
                                end.name,
                                {
                                  t,
                                  idealRegrouping,
                                  idealScaffolding,
                                }
                              )
                              break
                            }
                          }

                          // Handle edge cases (before first or after last preset)
                          if (targetDifficulty < presetPoints[0].difficulty) {
                            idealRegrouping = presetPoints[0].regrouping
                            idealScaffolding = presetPoints[0].scaffolding
                          } else if (
                            targetDifficulty > presetPoints[presetPoints.length - 1].difficulty
                          ) {
                            idealRegrouping = presetPoints[presetPoints.length - 1].regrouping
                            idealScaffolding = presetPoints[presetPoints.length - 1].scaffolding
                          }

                          // Find valid configuration closest to ideal point on path
                          let closestConfig: {
                            pAnyStart: number
                            pAllStart: number
                            displayRules: any
                            distance: number
                          } | null = null

                          for (let regIdx = 0; regIdx < REGROUPING_PROGRESSION.length; regIdx++) {
                            for (
                              let scaffIdx = 0;
                              scaffIdx < SCAFFOLDING_PROGRESSION.length;
                              scaffIdx++
                            ) {
                              const validState = findNearestValidState(regIdx, scaffIdx)
                              if (
                                validState.regroupingIdx !== regIdx ||
                                validState.scaffoldingIdx !== scaffIdx
                              ) {
                                continue
                              }

                              const regrouping = REGROUPING_PROGRESSION[regIdx]
                              const displayRules = SCAFFOLDING_PROGRESSION[scaffIdx]

                              const actualRegrouping = calculateRegroupingIntensity(
                                regrouping.pAnyStart,
                                regrouping.pAllStart
                              )
                              const actualScaffolding = calculateScaffoldingLevel(
                                displayRules,
                                actualRegrouping
                              )

                              // Euclidean distance to ideal point on pedagogical path
                              const distance = Math.sqrt(
                                (actualRegrouping - idealRegrouping) ** 2 +
                                  (actualScaffolding - idealScaffolding) ** 2
                              )

                              if (closestConfig === null || distance < closestConfig.distance) {
                                closestConfig = {
                                  pAnyStart: regrouping.pAnyStart,
                                  pAllStart: regrouping.pAllStart,
                                  displayRules,
                                  distance,
                                }
                              }
                            }
                          }

                          if (closestConfig) {
                            console.log('[Slider] Closest config:', {
                              ...closestConfig,
                              regrouping: calculateRegroupingIntensity(
                                closestConfig.pAnyStart,
                                closestConfig.pAllStart
                              ),
                              scaffolding: calculateScaffoldingLevel(
                                closestConfig.displayRules,
                                calculateRegroupingIntensity(
                                  closestConfig.pAnyStart,
                                  closestConfig.pAllStart
                                )
                              ),
                            })
                            const matchedProfile = getProfileFromConfig(
                              closestConfig.pAllStart,
                              closestConfig.pAnyStart,
                              closestConfig.displayRules
                            )
                            onChange({
                              pAnyStart: closestConfig.pAnyStart,
                              pAllStart: closestConfig.pAllStart,
                              displayRules: closestConfig.displayRules,
                              difficultyProfile:
                                matchedProfile !== 'custom' ? matchedProfile : undefined,
                            })
                          }
                        }}
                        className={css({
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          userSelect: 'none',
                          touchAction: 'none',
                          h: '8',
                        })}
                      >
                        <Slider.Track
                          className={css({
                            bg: 'gray.100',
                            position: 'relative',
                            flexGrow: 1,
                            h: '2',
                            rounded: 'full',
                          })}
                        >
                          <Slider.Range
                            className={css({
                              position: 'absolute',
                              bg: 'brand.500',
                              h: 'full',
                              rounded: 'full',
                            })}
                          />

                          {/* Preset markers on track */}
                          {DIFFICULTY_PROGRESSION.map((profileName) => {
                            const p = DIFFICULTY_PROFILES[profileName]
                            const presetDifficulty = calculateOverallDifficulty(
                              p.regrouping.pAnyStart,
                              p.regrouping.pAllStart,
                              p.displayRules
                            )
                            const position = (presetDifficulty / 10) * 100

                            return (
                              <div
                                key={profileName}
                                className={css({
                                  position: 'absolute',
                                  top: '50%',
                                  left: `${position}%`,
                                  transform: 'translate(-50%, -50%)',
                                  w: '1.5',
                                  h: '1.5',
                                  bg: 'gray.400',
                                  rounded: 'full',
                                  pointerEvents: 'none',
                                  zIndex: 1,
                                })}
                                title={p.label}
                              />
                            )
                          })}
                        </Slider.Track>

                        <Slider.Thumb
                          className={css({
                            display: 'block',
                            w: '5',
                            h: '5',
                            bg: 'white',
                            border: '2px solid',
                            borderColor: 'brand.500',
                            rounded: 'full',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            _hover: {
                              bg: 'brand.50',
                            },
                            _focus: {
                              outline: 'none',
                              boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.1)',
                            },
                          })}
                        />
                      </Slider.Root>
                    </div>
                  </div>

                  {/* 2D Difficulty Space Visualizer */}
                  <div
                    className={css({
                      bg: 'blue.50',
                      border: '1px solid',
                      borderColor: 'blue.200',
                      rounded: 'xl',
                      overflow: 'hidden',
                      boxShadow: 'sm',
                    })}
                  >
                    <button
                      type="button"
                      onClick={() => setShowDebugPlot(!showDebugPlot)}
                      className={css({
                        w: 'full',
                        p: '4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        bg: 'transparent',
                        border: 'none',
                        _hover: {
                          bg: 'blue.100',
                        },
                        transition: 'background 0.2s',
                      })}
                    >
                      <div
                        className={css({
                          fontWeight: 'semibold',
                          color: 'blue.900',
                          fontSize: 'sm',
                        })}
                      >
                        Difficulty Space Map
                      </div>
                      <div
                        className={css({
                          fontSize: 'sm',
                          color: 'blue.700',
                          transform: showDebugPlot ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        })}
                      >
                        ▼
                      </div>
                    </button>

                    {showDebugPlot && (
                      <div className={css({ px: '4', pb: '4', pt: '2' })}>
                        {/* Responsive SVG container */}
                        <div
                          className={css({
                            w: 'full',
                            display: 'flex',
                            justifyContent: 'center',
                            bg: 'white',
                            rounded: 'lg',
                            p: '4',
                            border: '1px solid',
                            borderColor: 'gray.200',
                          })}
                        >
                          {(() => {
                            // Make responsive - use container width with max size
                            const maxSize = 500
                            const width = maxSize
                            const height = maxSize
                            const padding = 40
                            const graphWidth = width - padding * 2
                            const graphHeight = height - padding * 2

                            const currentReg = calculateRegroupingIntensity(pAnyStart, pAllStart)
                            const currentScaf = calculateScaffoldingLevel(displayRules, currentReg)

                            // Convert 0-10 scale to SVG coordinates
                            const toX = (val: number) => padding + (val / 10) * graphWidth
                            const toY = (val: number) => height - padding - (val / 10) * graphHeight

                            // Convert SVG coordinates to 0-10 scale
                            const fromX = (x: number) =>
                              Math.max(0, Math.min(10, ((x - padding) / graphWidth) * 10))
                            const fromY = (y: number) =>
                              Math.max(0, Math.min(10, ((height - padding - y) / graphHeight) * 10))

                            // Helper to calculate valid target from mouse position
                            const calculateValidTarget = (
                              clientX: number,
                              clientY: number,
                              svg: SVGSVGElement
                            ) => {
                              const rect = svg.getBoundingClientRect()
                              const x = clientX - rect.left
                              const y = clientY - rect.top

                              // Convert to difficulty space (0-10)
                              const regroupingIntensity = fromX(x)
                              const scaffoldingLevel = fromY(y)

                              // Check if we're near a preset (within snap threshold)
                              const snapThreshold = 1.0 // 1.0 units in 0-10 scale
                              let nearestPreset: {
                                distance: number
                                profile: (typeof DIFFICULTY_PROFILES)[keyof typeof DIFFICULTY_PROFILES]
                              } | null = null

                              for (const profileName of DIFFICULTY_PROGRESSION) {
                                const p = DIFFICULTY_PROFILES[profileName]
                                const presetReg = calculateRegroupingIntensity(
                                  p.regrouping.pAnyStart,
                                  p.regrouping.pAllStart
                                )
                                const presetScaf = calculateScaffoldingLevel(
                                  p.displayRules,
                                  presetReg
                                )

                                // Calculate Euclidean distance
                                const distance = Math.sqrt(
                                  (regroupingIntensity - presetReg) ** 2 +
                                    (scaffoldingLevel - presetScaf) ** 2
                                )

                                if (distance <= snapThreshold) {
                                  if (!nearestPreset || distance < nearestPreset.distance) {
                                    nearestPreset = { distance, profile: p }
                                  }
                                }
                              }

                              // If we found a nearby preset, snap to it
                              if (nearestPreset) {
                                return {
                                  newRegrouping: nearestPreset.profile.regrouping,
                                  newDisplayRules: nearestPreset.profile.displayRules,
                                  matchedProfile: nearestPreset.profile.name,
                                  reg: calculateRegroupingIntensity(
                                    nearestPreset.profile.regrouping.pAnyStart,
                                    nearestPreset.profile.regrouping.pAllStart
                                  ),
                                  scaf: calculateScaffoldingLevel(
                                    nearestPreset.profile.displayRules,
                                    calculateRegroupingIntensity(
                                      nearestPreset.profile.regrouping.pAnyStart,
                                      nearestPreset.profile.regrouping.pAllStart
                                    )
                                  ),
                                }
                              }

                              // No preset nearby, use normal progression indices
                              const regroupingIdx = Math.round(
                                (regroupingIntensity / 10) * (REGROUPING_PROGRESSION.length - 1)
                              )
                              const scaffoldingIdx = Math.round(
                                ((10 - scaffoldingLevel) / 10) *
                                  (SCAFFOLDING_PROGRESSION.length - 1)
                              )

                              // Find nearest valid state (applies pedagogical constraints)
                              const validState = findNearestValidState(
                                regroupingIdx,
                                scaffoldingIdx
                              )

                              // Get actual values from progressions
                              const newRegrouping = REGROUPING_PROGRESSION[validState.regroupingIdx]
                              const newDisplayRules =
                                SCAFFOLDING_PROGRESSION[validState.scaffoldingIdx]

                              // Calculate display coordinates
                              const reg = calculateRegroupingIntensity(
                                newRegrouping.pAnyStart,
                                newRegrouping.pAllStart
                              )
                              const scaf = calculateScaffoldingLevel(newDisplayRules, reg)

                              // Check if this matches a preset
                              const matchedProfile = getProfileFromConfig(
                                newRegrouping.pAllStart,
                                newRegrouping.pAnyStart,
                                newDisplayRules
                              )

                              return { newRegrouping, newDisplayRules, matchedProfile, reg, scaf }
                            }

                            const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
                              const svg = e.currentTarget
                              const target = calculateValidTarget(e.clientX, e.clientY, svg)
                              setHoverPoint({ x: target.reg, y: target.scaf })
                              setHoverPreview({
                                pAnyStart: target.newRegrouping.pAnyStart,
                                pAllStart: target.newRegrouping.pAllStart,
                                displayRules: target.newDisplayRules,
                                matchedProfile: target.matchedProfile,
                              })
                            }

                            const handleMouseLeave = () => {
                              setHoverPoint(null)
                              setHoverPreview(null)
                            }

                            const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
                              const svg = e.currentTarget
                              const target = calculateValidTarget(e.clientX, e.clientY, svg)

                              // Update via onChange
                              onChange({
                                pAnyStart: target.newRegrouping.pAnyStart,
                                pAllStart: target.newRegrouping.pAllStart,
                                displayRules: target.newDisplayRules,
                                difficultyProfile:
                                  target.matchedProfile !== 'custom'
                                    ? target.matchedProfile
                                    : undefined,
                              })
                            }

                            return (
                              <svg
                                width="100%"
                                height={height}
                                viewBox={`0 0 ${width} ${height}`}
                                onClick={handleClick}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
                                className={css({
                                  maxWidth: `${maxSize}px`,
                                  cursor: 'crosshair',
                                  userSelect: 'none',
                                })}
                              >
                                {/* Grid lines */}
                                {[0, 2, 4, 6, 8, 10].map((val) => (
                                  <g key={`grid-${val}`}>
                                    <line
                                      x1={toX(val)}
                                      y1={padding}
                                      x2={toX(val)}
                                      y2={height - padding}
                                      stroke="#e5e7eb"
                                      strokeWidth="1"
                                      strokeDasharray="3,3"
                                    />
                                    <line
                                      x1={padding}
                                      y1={toY(val)}
                                      x2={width - padding}
                                      y2={toY(val)}
                                      stroke="#e5e7eb"
                                      strokeWidth="1"
                                      strokeDasharray="3,3"
                                    />
                                  </g>
                                ))}

                                {/* Axes */}
                                <line
                                  x1={padding}
                                  y1={height - padding}
                                  x2={width - padding}
                                  y2={height - padding}
                                  stroke="#374151"
                                  strokeWidth="2"
                                />
                                <line
                                  x1={padding}
                                  y1={padding}
                                  x2={padding}
                                  y2={height - padding}
                                  stroke="#374151"
                                  strokeWidth="2"
                                />

                                {/* Axis labels */}
                                <text
                                  x={width / 2}
                                  y={height - 10}
                                  textAnchor="middle"
                                  fontSize="13"
                                  fontWeight="500"
                                  fill="#4b5563"
                                >
                                  Regrouping Intensity →
                                </text>
                                <text
                                  x={15}
                                  y={height / 2}
                                  textAnchor="middle"
                                  fontSize="13"
                                  fontWeight="500"
                                  fill="#4b5563"
                                  transform={`rotate(-90, 15, ${height / 2})`}
                                >
                                  Scaffolding (more help) →
                                </text>

                                {/* Preset points */}
                                {DIFFICULTY_PROGRESSION.map((profileName) => {
                                  const p = DIFFICULTY_PROFILES[profileName]
                                  const reg = calculateRegroupingIntensity(
                                    p.regrouping.pAnyStart,
                                    p.regrouping.pAllStart
                                  )
                                  const scaf = calculateScaffoldingLevel(p.displayRules, reg)

                                  return (
                                    <g key={profileName}>
                                      <circle
                                        cx={toX(reg)}
                                        cy={toY(scaf)}
                                        r="5"
                                        fill="#6366f1"
                                        stroke="#4f46e5"
                                        strokeWidth="2"
                                        opacity="0.7"
                                      />
                                      <text
                                        x={toX(reg)}
                                        y={toY(scaf) - 10}
                                        textAnchor="middle"
                                        fontSize="11"
                                        fill="#4338ca"
                                        fontWeight="600"
                                      >
                                        {p.label}
                                      </text>
                                    </g>
                                  )
                                })}

                                {/* Hover preview - show where click will land */}
                                {hoverPoint && (
                                  <>
                                    {/* Dashed line from hover to target */}
                                    <line
                                      x1={toX(hoverPoint.x)}
                                      y1={toY(hoverPoint.y)}
                                      x2={toX(currentReg)}
                                      y2={toY(currentScaf)}
                                      stroke="#f59e0b"
                                      strokeWidth="2"
                                      strokeDasharray="5,5"
                                      opacity="0.5"
                                    />
                                    {/* Hover target marker */}
                                    <circle
                                      cx={toX(hoverPoint.x)}
                                      cy={toY(hoverPoint.y)}
                                      r="10"
                                      fill="#f59e0b"
                                      stroke="#d97706"
                                      strokeWidth="3"
                                      opacity="0.8"
                                    />
                                    <circle
                                      cx={toX(hoverPoint.x)}
                                      cy={toY(hoverPoint.y)}
                                      r="4"
                                      fill="white"
                                    />
                                  </>
                                )}

                                {/* Current position */}
                                <circle
                                  cx={toX(currentReg)}
                                  cy={toY(currentScaf)}
                                  r="8"
                                  fill="#10b981"
                                  stroke="#059669"
                                  strokeWidth="3"
                                />
                                <circle
                                  cx={toX(currentReg)}
                                  cy={toY(currentScaf)}
                                  r="3"
                                  fill="white"
                                />
                              </svg>
                            )
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Display Options Card - Manual Mode Only */}
      {formState.mode === 'manual' && (
        <>
          <div
            data-section="display"
            className={css({
              bg: 'gray.50',
              border: '1px solid',
              borderColor: 'gray.200',
              rounded: 'xl',
              p: '3',
            })}
          >
            <div className={stack({ gap: '3' })}>
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                })}
              >
                <div
                  className={css({
                    fontSize: 'xs',
                    fontWeight: 'semibold',
                    color: 'gray.500',
                    textTransform: 'uppercase',
                    letterSpacing: 'wider',
                  })}
                >
                  Display Options
                </div>
                <div className={css({ display: 'flex', gap: '1.5' })}>
                  <button
                    onClick={() =>
                      onChange({
                        showCarryBoxes: true,
                        showAnswerBoxes: true,
                        showPlaceValueColors: true,
                        showProblemNumbers: true,
                        showCellBorder: true,
                        showTenFrames: true,
                      })
                    }
                    className={css({
                      px: '2',
                      py: '0.5',
                      fontSize: '2xs',
                      color: 'brand.600',
                      border: '1px solid',
                      borderColor: 'brand.300',
                      bg: 'white',
                      rounded: 'md',
                      cursor: 'pointer',
                      _hover: { bg: 'brand.50' },
                    })}
                  >
                    Check All
                  </button>
                  <button
                    onClick={() =>
                      onChange({
                        showCarryBoxes: false,
                        showAnswerBoxes: false,
                        showPlaceValueColors: false,
                        showProblemNumbers: false,
                        showCellBorder: false,
                        showTenFrames: false,
                      })
                    }
                    className={css({
                      px: '2',
                      py: '0.5',
                      fontSize: '2xs',
                      color: 'gray.600',
                      border: '1px solid',
                      borderColor: 'gray.300',
                      bg: 'white',
                      rounded: 'md',
                      cursor: 'pointer',
                      _hover: { bg: 'gray.50' },
                    })}
                  >
                    Uncheck All
                  </button>
                </div>
              </div>

              {/* Two-column grid: toggle options on left, preview on right */}
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr',
                  gap: '3',
                })}
              >
                {/* Toggle Options in 2-column grid */}
                <div
                  className={css({
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '2',
                    alignItems: 'start',
                  })}
                >
                  <ToggleOption
                    checked={formState.showCarryBoxes ?? true}
                    onChange={(checked) => onChange({ showCarryBoxes: checked })}
                    label={
                      formState.operator === 'subtraction'
                        ? 'Borrow Boxes'
                        : formState.operator === 'mixed'
                          ? 'Carry/Borrow Boxes'
                          : 'Carry Boxes'
                    }
                    description={
                      formState.operator === 'subtraction'
                        ? 'Help students track borrowing during subtraction'
                        : formState.operator === 'mixed'
                          ? 'Help students track regrouping (carrying in addition, borrowing in subtraction)'
                          : 'Help students track regrouping during addition'
                    }
                  />

                  <ToggleOption
                    checked={formState.showAnswerBoxes ?? true}
                    onChange={(checked) => onChange({ showAnswerBoxes: checked })}
                    label="Answer Boxes"
                    description="Guide students to write organized, aligned answers"
                  />

                  <ToggleOption
                    checked={formState.showPlaceValueColors ?? true}
                    onChange={(checked) => onChange({ showPlaceValueColors: checked })}
                    label="Place Value Colors"
                    description="Reinforce place value understanding visually"
                  />

                  <ToggleOption
                    checked={formState.showProblemNumbers ?? true}
                    onChange={(checked) => onChange({ showProblemNumbers: checked })}
                    label="Problem Numbers"
                    description="Help students track progress and reference problems"
                  />

                  <ToggleOption
                    checked={formState.showCellBorder ?? true}
                    onChange={(checked) => onChange({ showCellBorder: checked })}
                    label="Cell Borders"
                    description="Organize problems visually for easier focus"
                  />

                  {formState.operator === 'subtraction' || formState.operator === 'mixed' ? (
                    <ToggleOption
                      checked={formState.showBorrowNotation ?? false}
                      onChange={(checked) => onChange({ showBorrowNotation: checked })}
                      label="Borrow Notation Boxes"
                      description="Empty scratch boxes for students to write borrowing work (cross out source, write modified values)"
                    />
                  ) : null}

                  <ToggleOption
                    checked={formState.showTenFrames ?? false}
                    onChange={(checked) => {
                      onChange({ showTenFrames: checked })
                      // Auto-disable "for all" when disabling ten-frames
                      if (!checked) {
                        onChange({ showTenFramesForAll: false })
                      }
                    }}
                    label="Ten-Frames"
                    description="Visualize regrouping with concrete counting tools"
                  >
                    {/* Sub-option: Show ten-frames for all - always rendered but hidden when parent is unchecked */}
                    <div
                      className={css({
                        display: 'flex',
                        gap: '2',
                        alignItems: 'center',
                        pt: '2',
                        mt: '1.5',
                        borderTop: '1px solid',
                        borderColor: 'brand.300',
                        opacity: formState.showTenFrames ? 1 : 0,
                        visibility: formState.showTenFrames ? 'visible' : 'hidden',
                        pointerEvents: formState.showTenFrames ? 'auto' : 'none',
                        transition: 'opacity 0.15s',
                      })}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox.Root
                        checked={formState.showTenFramesForAll ?? false}
                        onCheckedChange={(checked) =>
                          onChange({ showTenFramesForAll: checked as boolean })
                        }
                        onClick={(e) => e.stopPropagation()}
                        data-element="ten-frames-all-checkbox"
                        className={css({
                          w: '3.5',
                          h: '3.5',
                          cursor: 'pointer',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bg: formState.showTenFramesForAll ? 'brand.500' : 'white',
                          border: '2px solid',
                          borderColor: formState.showTenFramesForAll ? 'brand.500' : 'gray.300',
                          rounded: 'sm',
                          transition: 'all 0.15s',
                        })}
                      >
                        <Checkbox.Indicator>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 15 15"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                              fill="white"
                            />
                          </svg>
                        </Checkbox.Indicator>
                      </Checkbox.Root>
                      <label
                        className={css({
                          fontSize: '2xs',
                          fontWeight: 'medium',
                          color: 'brand.700',
                          cursor: 'pointer',
                        })}
                        onClick={(e) => {
                          e.stopPropagation()
                          onChange({
                            showTenFramesForAll: !formState.showTenFramesForAll,
                          })
                        }}
                      >
                        Show for all problems (not just regrouping)
                      </label>
                    </div>
                  </ToggleOption>
                </div>

                {/* Live Preview */}
                <DisplayOptionsPreview formState={formState} />
              </div>
            </div>
          </div>

          {/* Regrouping Frequency Card - Manual Mode Only */}
          <div
            data-section="regrouping"
            className={css({
              bg: 'gray.50',
              border: '1px solid',
              borderColor: 'gray.200',
              rounded: 'xl',
              p: '3',
              mt: '3',
            })}
          >
            <div className={stack({ gap: '2.5' })}>
              <div
                className={css({
                  fontSize: 'xs',
                  fontWeight: 'semibold',
                  color: 'gray.500',
                  textTransform: 'uppercase',
                  letterSpacing: 'wider',
                })}
              >
                Regrouping Frequency
              </div>

              {/* Current values display */}
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'xs',
                  color: 'gray.600',
                })}
              >
                <div>
                  Both:{' '}
                  <span className={css({ color: 'brand.600', fontWeight: 'semibold' })}>
                    {Math.round((formState.pAllStart || 0) * 100)}%
                  </span>
                </div>
                <div>
                  Any:{' '}
                  <span className={css({ color: 'brand.600', fontWeight: 'semibold' })}>
                    {Math.round((formState.pAnyStart || 0.25) * 100)}%
                  </span>
                </div>
              </div>

              {/* Double-thumbed range slider */}
              <Slider.Root
                className={css({
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  userSelect: 'none',
                  touchAction: 'none',
                  width: 'full',
                  height: '6',
                })}
                value={[(formState.pAllStart || 0) * 100, (formState.pAnyStart || 0.25) * 100]}
                onValueChange={(values) => {
                  onChange({
                    pAllStart: values[0] / 100,
                    pAnyStart: values[1] / 100,
                  })
                }}
                min={0}
                max={100}
                step={5}
                minStepsBetweenThumbs={0}
              >
                <Slider.Track
                  className={css({
                    position: 'relative',
                    flexGrow: 1,
                    bg: 'gray.200',
                    rounded: 'full',
                    height: '1.5',
                  })}
                >
                  <Slider.Range
                    className={css({
                      position: 'absolute',
                      bg: 'brand.500',
                      rounded: 'full',
                      height: 'full',
                    })}
                  />
                </Slider.Track>
                <Slider.Thumb
                  className={css({
                    display: 'block',
                    width: '3.5',
                    height: '3.5',
                    bg: 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    rounded: 'full',
                    border: '2px solid',
                    borderColor: 'brand.500',
                    cursor: 'pointer',
                    _hover: { transform: 'scale(1.1)' },
                    _focus: { outline: 'none', boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)' },
                  })}
                />
                <Slider.Thumb
                  className={css({
                    display: 'block',
                    width: '3.5',
                    height: '3.5',
                    bg: 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    rounded: 'full',
                    border: '2px solid',
                    borderColor: 'brand.600',
                    cursor: 'pointer',
                    _hover: { transform: 'scale(1.1)' },
                    _focus: { outline: 'none', boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)' },
                  })}
                />
              </Slider.Root>

              <div className={css({ fontSize: '2xs', color: 'gray.500', lineHeight: '1.3' })}>
                Regrouping difficulty at worksheet start (Both = all columns regroup, Any = at least
                one column regroups)
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
