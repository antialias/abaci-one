'use client'

import type React from 'react'
import * as Checkbox from '@radix-ui/react-checkbox'
import * as Slider from '@radix-ui/react-slider'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useTranslations } from 'next-intl'
import { css } from '../../../../../../styled-system/css'
import { stack } from '../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../types'
import { DisplayOptionsPreview } from './DisplayOptionsPreview'
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
  findRegroupingIndex,
  findScaffoldingIndex,
  getProfileFromConfig,
  type DifficultyLevel,
  type DifficultyMode,
} from '../difficultyProfiles'
import { defaultAdditionConfig } from '../../config-schemas'

interface ConfigPanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
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

      {/* Worksheet Layout Card */}
      <div
        data-section="layout"
        className={css({
          bg: 'gray.50',
          border: '1px solid',
          borderColor: 'gray.200',
          rounded: 'xl',
          p: '3',
        })}
      >
        <div className={stack({ gap: '2.5' })}>
          {/* Orientation - Inline */}
          <div>
            <div
              className={css({
                fontSize: 'xs',
                fontWeight: 'semibold',
                color: 'gray.500',
                textTransform: 'uppercase',
                letterSpacing: 'wider',
                mb: '1.5',
              })}
            >
              Orientation
            </div>
            <div
              className={css({
                display: 'flex',
                gap: '2',
                justifyContent: 'center',
              })}
            >
              <button
                onClick={() => {
                  const newOrientation = 'portrait'
                  const newProblemsPerPage = 15 // Default for portrait
                  const newCols = getDefaultColsForProblemsPerPage(
                    newProblemsPerPage,
                    newOrientation
                  )
                  const newPages = currentPages
                  const derived = calculateDerivedState(newProblemsPerPage, newCols, newPages)
                  onChange({
                    orientation: newOrientation,
                    problemsPerPage: newProblemsPerPage,
                    cols: newCols,
                    pages: newPages,
                    ...derived,
                  })
                }}
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1',
                  w: '16',
                  h: '20',
                  border: '2px solid',
                  borderColor: currentOrientation === 'portrait' ? 'brand.500' : 'gray.300',
                  bg: currentOrientation === 'portrait' ? 'brand.50' : 'white',
                  rounded: 'md',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  _hover: {
                    borderColor: 'brand.400',
                    transform: 'translateY(-1px)',
                  },
                })}
              >
                <div
                  className={css({
                    w: '8',
                    h: '10',
                    border: '1.5px solid',
                    borderColor: currentOrientation === 'portrait' ? 'brand.400' : 'gray.400',
                    bg: 'white',
                    rounded: 'sm',
                  })}
                />
                <div
                  className={css({
                    fontSize: '2xs',
                    fontWeight: 'semibold',
                    color: currentOrientation === 'portrait' ? 'brand.700' : 'gray.600',
                  })}
                >
                  Portrait
                </div>
              </button>
              <button
                onClick={() => {
                  const newOrientation = 'landscape'
                  const newProblemsPerPage = 20 // Default for landscape
                  const newCols = getDefaultColsForProblemsPerPage(
                    newProblemsPerPage,
                    newOrientation
                  )
                  const newPages = currentPages
                  const derived = calculateDerivedState(newProblemsPerPage, newCols, newPages)
                  onChange({
                    orientation: newOrientation,
                    problemsPerPage: newProblemsPerPage,
                    cols: newCols,
                    pages: newPages,
                    ...derived,
                  })
                }}
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1',
                  w: '20',
                  h: '16',
                  border: '2px solid',
                  borderColor: currentOrientation === 'landscape' ? 'brand.500' : 'gray.300',
                  bg: currentOrientation === 'landscape' ? 'brand.50' : 'white',
                  rounded: 'md',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  _hover: {
                    borderColor: 'brand.400',
                    transform: 'translateY(-1px)',
                  },
                })}
              >
                <div
                  className={css({
                    w: '10',
                    h: '8',
                    border: '1.5px solid',
                    borderColor: currentOrientation === 'landscape' ? 'brand.400' : 'gray.400',
                    bg: 'white',
                    rounded: 'sm',
                  })}
                />
                <div
                  className={css({
                    fontSize: '2xs',
                    fontWeight: 'semibold',
                    color: currentOrientation === 'landscape' ? 'brand.700' : 'gray.600',
                  })}
                >
                  Landscape
                </div>
              </button>
            </div>
          </div>

          {/* Problems per page */}
          <div>
            <div
              className={css({
                fontSize: 'xs',
                fontWeight: 'semibold',
                color: 'gray.500',
                textTransform: 'uppercase',
                letterSpacing: 'wider',
                mb: '1.5',
              })}
            >
              Problems per Page
            </div>
            <div
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.5',
                justifyContent: 'center',
              })}
            >
              {(currentOrientation === 'portrait'
                ? [6, 8, 10, 12, 15]
                : [8, 10, 12, 15, 16, 20]
              ).map((count) => {
                const isSelected = currentProblemsPerPage === count
                const cols = getDefaultColsForProblemsPerPage(count, currentOrientation)
                const rows = Math.ceil(count / cols)

                return (
                  <button
                    key={count}
                    onClick={() => {
                      console.log('=== Problems per Page Button Clicked ===')
                      console.log('Clicked count:', count)
                      const newCols = getDefaultColsForProblemsPerPage(count, currentOrientation)
                      const newPages = currentPages
                      const derived = calculateDerivedState(count, newCols, newPages)
                      console.log('New state:', {
                        problemsPerPage: count,
                        cols: newCols,
                        pages: newPages,
                        ...derived,
                      })
                      onChange({
                        problemsPerPage: count,
                        cols: newCols,
                        pages: newPages,
                        ...derived,
                      })
                    }}
                    className={css({
                      display: 'grid',
                      gridTemplateRows: '1fr auto',
                      alignItems: 'center',
                      gap: '1',
                      w: currentOrientation === 'portrait' ? '14' : '16',
                      h: currentOrientation === 'portrait' ? '16' : '14',
                      p: '2',
                      border: '2px solid',
                      borderColor: isSelected ? 'brand.500' : 'gray.300',
                      bg: isSelected ? 'brand.50' : 'white',
                      rounded: 'lg',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      _hover: {
                        borderColor: 'brand.400',
                        transform: 'translateY(-1px)',
                      },
                    })}
                  >
                    {/* Grid visualization - fills available space with 1fr */}
                    <div
                      className={css({
                        display: 'grid',
                        placeItems: 'center',
                        w: 'full',
                        h: 'full',
                      })}
                      style={{
                        gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        gridTemplateRows: `repeat(${rows}, 1fr)`,
                        gap: currentOrientation === 'portrait' ? '3px' : '2px',
                      }}
                    >
                      {Array.from({ length: count }).map((_, i) => (
                        <div
                          key={i}
                          className={css({
                            w: '1.5',
                            h: '1.5',
                            bg: isSelected ? 'brand.500' : 'gray.400',
                            rounded: 'full',
                          })}
                        />
                      ))}
                    </div>
                    {/* Count label - fixed height */}
                    <div
                      className={css({
                        fontSize: '2xs',
                        fontWeight: 'semibold',
                        color: isSelected ? 'brand.700' : 'gray.600',
                        h: '4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      })}
                    >
                      {count}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Number of pages */}
          <div>
            <div
              className={css({
                fontSize: 'xs',
                fontWeight: 'semibold',
                color: 'gray.500',
                textTransform: 'uppercase',
                letterSpacing: 'wider',
                mb: '1.5',
              })}
            >
              Pages ({currentProblemsPerPage * currentPages} total problems)
            </div>
            <div className={css({ display: 'flex', gap: '1.5' })}>
              {[1, 2, 3, 4].map((pageCount) => {
                const isSelected = currentPages === pageCount
                return (
                  <button
                    key={pageCount}
                    onClick={() => {
                      console.log('=== Page Count Button Clicked ===')
                      console.log('Clicked page count:', pageCount)
                      const derived = calculateDerivedState(
                        currentProblemsPerPage,
                        currentCols,
                        pageCount
                      )
                      console.log('New state:', {
                        problemsPerPage: currentProblemsPerPage,
                        cols: currentCols,
                        pages: pageCount,
                        ...derived,
                      })
                      onChange({
                        problemsPerPage: currentProblemsPerPage,
                        cols: currentCols,
                        pages: pageCount,
                        ...derived,
                      })
                    }}
                    className={css({
                      flex: 1,
                      px: '3',
                      py: '1.5',
                      border: '1.5px solid',
                      borderColor: isSelected ? 'brand.500' : 'gray.300',
                      bg: isSelected ? 'brand.50' : 'white',
                      rounded: 'lg',
                      cursor: 'pointer',
                      fontSize: 'xs',
                      fontWeight: 'semibold',
                      color: isSelected ? 'brand.700' : 'gray.600',
                      transition: 'all 0.15s',
                      _hover: {
                        borderColor: 'brand.400',
                        transform: 'translateY(-1px)',
                      },
                    })}
                  >
                    {pageCount}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Difficulty Level Card */}
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

            // Calculate current difficulty position
            const currentDifficulty = calculateOverallDifficulty(pAnyStart, pAllStart, displayRules)

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
                {/* Overall Difficulty Slider */}
                <div className={css({ mb: '3' })}>
                  <div
                    className={css({
                      fontSize: 'xs',
                      fontWeight: 'medium',
                      color: 'gray.700',
                      mb: '2',
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
                        h: '12',
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

                  {/* Status text */}
                  <div
                    className={css({
                      fontSize: '2xs',
                      color: 'gray.600',
                      textAlign: 'center',
                      mt: '1.5',
                    })}
                  >
                    {isCustom ? (
                      <>
                        You're here (Custom) • {(() => {
                          const regrouping = calculateRegroupingIntensity(pAnyStart, pAllStart)
                          const nearest = findNearestPreset(
                            regrouping,
                            calculateScaffoldingLevel(displayRules, regrouping),
                            'any'
                          )
                          return nearest
                            ? `Moving toward ${nearest.profile.label}`
                            : 'Custom settings'
                        })()}
                      </>
                    ) : (
                      <>You're at {profile.label} level</>
                    )}
                  </div>
                </div>

                {/* DEBUG: 2D Cartesian Plane */}
                <div
                  className={css({
                    bg: 'orange.50',
                    border: '2px solid',
                    borderColor: 'orange.300',
                    rounded: 'lg',
                    p: '3',
                  })}
                >
                  <div
                    className={css({
                      fontWeight: 'bold',
                      color: 'orange.800',
                      mb: '2',
                      fontSize: '2xs',
                      textTransform: 'uppercase',
                      letterSpacing: 'wider',
                    })}
                  >
                    🐛 DEBUG: 2D Difficulty Space
                  </div>

                  {/* SVG Graph */}
                  {(() => {
                    const width = 300
                    const height = 300
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

                    const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
                      const svg = e.currentTarget
                      const rect = svg.getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const y = e.clientY - rect.top

                      // Convert to difficulty space (0-10)
                      const regroupingIntensity = fromX(x)
                      const scaffoldingLevel = fromY(y)

                      // Map to progression indices (0-10 → 0-18 for regrouping, 0-12 for scaffolding)
                      const regroupingIdx = Math.round(
                        (regroupingIntensity / 10) * (REGROUPING_PROGRESSION.length - 1)
                      )
                      const scaffoldingIdx = Math.round(
                        (scaffoldingLevel / 10) * (SCAFFOLDING_PROGRESSION.length - 1)
                      )

                      // Find nearest valid state (applies pedagogical constraints)
                      const validState = findNearestValidState(regroupingIdx, scaffoldingIdx)

                      // Get actual values from progressions
                      const newRegrouping = REGROUPING_PROGRESSION[validState.regroupingIdx]
                      const newDisplayRules = SCAFFOLDING_PROGRESSION[validState.scaffoldingIdx]

                      // Check if this matches a preset
                      const matchedProfile = getProfileFromConfig(
                        newRegrouping.pAllStart,
                        newRegrouping.pAnyStart,
                        newDisplayRules
                      )

                      // Update via onChange
                      onChange({
                        pAnyStart: newRegrouping.pAnyStart,
                        pAllStart: newRegrouping.pAllStart,
                        displayRules: newDisplayRules,
                        difficultyProfile: matchedProfile !== 'custom' ? matchedProfile : undefined,
                      })
                    }

                    return (
                      <svg
                        width={width}
                        height={height}
                        onClick={handleClick}
                        className={css({
                          display: 'block',
                          cursor: 'crosshair',
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
                              stroke="#fed7aa"
                              strokeWidth="1"
                              strokeDasharray="2,2"
                            />
                            <line
                              x1={padding}
                              y1={toY(val)}
                              x2={width - padding}
                              y2={toY(val)}
                              stroke="#fed7aa"
                              strokeWidth="1"
                              strokeDasharray="2,2"
                            />
                          </g>
                        ))}

                        {/* Axes */}
                        <line
                          x1={padding}
                          y1={height - padding}
                          x2={width - padding}
                          y2={height - padding}
                          stroke="#9a3412"
                          strokeWidth="2"
                        />
                        <line
                          x1={padding}
                          y1={padding}
                          x2={padding}
                          y2={height - padding}
                          stroke="#9a3412"
                          strokeWidth="2"
                        />

                        {/* Axis labels */}
                        <text
                          x={width / 2}
                          y={height - 10}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#9a3412"
                        >
                          Regrouping Intensity →
                        </text>
                        <text
                          x={15}
                          y={height / 2}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#9a3412"
                          transform={`rotate(-90, 15, ${height / 2})`}
                        >
                          ← Scaffolding Level (less help)
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
                                r="4"
                                fill="#ea580c"
                                stroke="#9a3412"
                                strokeWidth="1.5"
                              />
                              <text
                                x={toX(reg)}
                                y={toY(scaf) - 8}
                                textAnchor="middle"
                                fontSize="9"
                                fill="#9a3412"
                                fontWeight="bold"
                              >
                                {p.label}
                              </text>
                            </g>
                          )
                        })}

                        {/* Current position */}
                        <circle
                          cx={toX(currentReg)}
                          cy={toY(currentScaf)}
                          r="6"
                          fill="#3b82f6"
                          stroke="#1e40af"
                          strokeWidth="2"
                        />
                        <circle cx={toX(currentReg)} cy={toY(currentScaf)} r="3" fill="white" />
                      </svg>
                    )
                  })()}

                  {/* Numeric readout */}
                  <div
                    className={css({
                      mt: '2',
                      fontSize: '2xs',
                      fontFamily: 'mono',
                      color: 'orange.700',
                    })}
                  >
                    Current: ({(() => {
                      const reg = calculateRegroupingIntensity(pAnyStart, pAllStart)
                      const scaf = calculateScaffoldingLevel(displayRules, reg)
                      return `${reg.toFixed(2)}, ${scaf.toFixed(2)}`
                    })()})
                  </div>
                </div>

                {/* Difficulty level buttons */}
                <div
                  className={css({
                    display: 'flex',
                    gap: '2',
                    flexWrap: 'wrap',
                  })}
                >
                  {DIFFICULTY_PROGRESSION.map((profileName) => {
                    const p = DIFFICULTY_PROFILES[profileName]
                    const isSelected = currentProfile === profileName

                    return (
                      <button
                        key={profileName}
                        onClick={() => {
                          const selectedProfile = DIFFICULTY_PROFILES[profileName]
                          onChange({
                            difficultyProfile: profileName,
                            pAllStart: selectedProfile.regrouping.pAllStart,
                            pAnyStart: selectedProfile.regrouping.pAnyStart,
                            displayRules: selectedProfile.displayRules,
                          })
                        }}
                        className={css({
                          flex: 1,
                          minWidth: '120px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5',
                          p: '2.5',
                          border: '2px solid',
                          borderColor: isSelected ? 'brand.500' : 'gray.300',
                          bg: isSelected ? 'brand.50' : 'white',
                          rounded: 'lg',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          _hover: {
                            borderColor: 'brand.400',
                            transform: 'translateY(-1px)',
                          },
                        })}
                      >
                        <div
                          className={css({
                            fontSize: 'xs',
                            fontWeight: 'bold',
                            color: isSelected ? 'brand.700' : 'gray.700',
                          })}
                        >
                          {p.label}
                        </div>
                        <div
                          className={css({
                            fontSize: '2xs',
                            color: isSelected ? 'brand.600' : 'gray.500',
                            lineHeight: '1.3',
                          })}
                        >
                          {p.description}
                        </div>
                      </button>
                    )
                  })}
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
                    <div className={css({ display: 'flex', gap: '1' })}>
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
                          <>
                            {/* Alternative Easier Button (35%) */}
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <button
                                  onClick={() =>
                                    handleDifficultyChange(easierAlternativeMode, 'easier')
                                  }
                                  disabled={!canEasierAlternative}
                                  data-action={`easier-${easierAlternativeMode}`}
                                  className={css({
                                    flex: '0.35',
                                    px: '2',
                                    py: '2',
                                    minH: '10',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '2xs',
                                    fontWeight: 'medium',
                                    color: canEasierAlternative ? 'gray.600' : 'gray.400',
                                    bg: 'white',
                                    border: '1.5px solid',
                                    borderColor: canEasierAlternative ? 'gray.300' : 'gray.300',
                                    rounded: 'lg',
                                    cursor: canEasierAlternative ? 'pointer' : 'not-allowed',
                                    opacity: canEasierAlternative ? 1 : 0.5,
                                    transition: 'all 0.15s',
                                    _hover: canEasierAlternative
                                      ? {
                                          bg: 'gray.50',
                                          borderColor: 'gray.400',
                                        }
                                      : {},
                                  })}
                                >
                                  {easierAlternativeLabel}
                                </button>
                              </Tooltip.Trigger>
                              {canEasierAlternative && (
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
                              )}
                            </Tooltip.Root>

                            {/* Recommended Easier Button (65%) */}
                            <button
                              onClick={() => handleDifficultyChange('both', 'easier')}
                              disabled={!canMakeEasier}
                              data-action="easier-both"
                              className={css({
                                flex: '0.65',
                                px: '3',
                                py: '2',
                                minH: '10',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: '0.5',
                                color: canMakeEasier ? 'brand.700' : 'gray.400',
                                bg: 'white',
                                border: '1.5px solid',
                                borderColor: canMakeEasier ? 'brand.500' : 'gray.300',
                                rounded: 'lg',
                                cursor: canMakeEasier ? 'pointer' : 'not-allowed',
                                opacity: canMakeEasier ? 1 : 0.5,
                                transition: 'all 0.15s',
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
                          </>
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
                          <>
                            {/* Recommended Harder Button (65%) */}
                            <button
                              onClick={() => handleDifficultyChange('both', 'harder')}
                              disabled={!canMakeHarder}
                              data-action="harder-both"
                              className={css({
                                flex: '0.65',
                                px: '3',
                                py: '2',
                                minH: '10',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: '0.5',
                                color: canMakeHarder ? 'brand.700' : 'gray.400',
                                bg: 'white',
                                border: '1.5px solid',
                                borderColor: canMakeHarder ? 'brand.500' : 'gray.300',
                                rounded: 'lg',
                                cursor: canMakeHarder ? 'pointer' : 'not-allowed',
                                opacity: canMakeHarder ? 1 : 0.5,
                                transition: 'all 0.15s',
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

                            {/* Alternative Harder Button (35%) */}
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <button
                                  onClick={() =>
                                    handleDifficultyChange(harderAlternativeMode, 'harder')
                                  }
                                  disabled={!canHarderAlternative}
                                  data-action={`harder-${harderAlternativeMode}`}
                                  className={css({
                                    flex: '0.35',
                                    px: '2',
                                    py: '2',
                                    minH: '10',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '2xs',
                                    fontWeight: 'medium',
                                    color: canHarderAlternative ? 'gray.600' : 'gray.400',
                                    bg: 'white',
                                    border: '1.5px solid',
                                    borderColor: canHarderAlternative ? 'gray.300' : 'gray.300',
                                    rounded: 'lg',
                                    cursor: canHarderAlternative ? 'pointer' : 'not-allowed',
                                    opacity: canHarderAlternative ? 1 : 0.5,
                                    transition: 'all 0.15s',
                                    _hover: canHarderAlternative
                                      ? {
                                          bg: 'gray.50',
                                          borderColor: 'gray.400',
                                        }
                                      : {},
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
                          </>
                        )
                      })()}
                    </div>
                  </Tooltip.Provider>
                </div>

                {/* Progressive Difficulty toggle */}
                <div
                  className={css({
                    pt: '1',
                    borderTop: '1px solid',
                    borderColor: 'gray.200',
                  })}
                >
                  <div
                    className={css({
                      fontSize: 'xs',
                      fontWeight: 'semibold',
                      color: 'gray.500',
                      mb: '1.5',
                    })}
                  >
                    Progressive Difficulty
                  </div>
                  <div className={css({ display: 'flex', gap: '2' })}>
                    {[
                      {
                        value: false,
                        label: 'Off',
                        desc: 'All problems at the selected difficulty level',
                      },
                      {
                        value: true,
                        label: 'On',
                        desc: 'Start easier and gradually build up, helping students warm up',
                      },
                    ].map(({ value, label, desc }) => {
                      const isSelected = (formState.interpolate ?? true) === value

                      return (
                        <button
                          key={String(value)}
                          onClick={() => onChange({ interpolate: value })}
                          className={css({
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5',
                            p: '2.5',
                            border: '2px solid',
                            borderColor: isSelected ? 'brand.500' : 'gray.300',
                            bg: isSelected ? 'brand.50' : 'white',
                            rounded: 'lg',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            _hover: {
                              borderColor: 'brand.400',
                              transform: 'translateY(-1px)',
                            },
                          })}
                        >
                          <div
                            className={css({
                              fontSize: 'xs',
                              fontWeight: 'bold',
                              color: isSelected ? 'brand.700' : 'gray.700',
                            })}
                          >
                            {label}
                          </div>
                          <div
                            className={css({
                              fontSize: '2xs',
                              color: isSelected ? 'brand.600' : 'gray.500',
                              lineHeight: '1.3',
                            })}
                          >
                            {desc}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Display Options Card */}
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
                label="Carry Boxes"
                description="Help students track regrouping during addition"
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
    </div>
  )
}
