'use client'

import { useState } from 'react'
import type React from 'react'
import * as Slider from '@radix-ui/react-slider'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { css } from '../../../../../../../styled-system/css'
import { stack } from '../../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../../types'
import {
  DIFFICULTY_PROFILES,
  DIFFICULTY_PROGRESSION,
  makeHarder,
  makeEasier,
  calculateOverallDifficulty,
  calculateRegroupingIntensity,
  calculateScaffoldingLevel,
  REGROUPING_PROGRESSION,
  SCAFFOLDING_PROGRESSION,
  findNearestValidState,
  getProfileFromConfig,
  type DifficultyLevel,
  type DifficultyMode,
} from '../../difficultyProfiles'
import type { DisplayRules } from '../../displayRules'
import { getScaffoldingSummary } from './utils'
import { RegroupingFrequencyPanel } from './RegroupingFrequencyPanel'
import { DigitRangeSection } from './DigitRangeSection'

export interface SmartModeControlsProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  isDark?: boolean
}

export function SmartModeControls({ formState, onChange, isDark = false }: SmartModeControlsProps) {
  const [showDebugPlot, setShowDebugPlot] = useState(false)
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)
  const [hoverPreview, setHoverPreview] = useState<{
    pAnyStart: number
    pAllStart: number
    displayRules: DisplayRules
    matchedProfile: string | 'custom'
  } | null>(null)

  // Helper function to handle difficulty adjustments
  const handleDifficultyChange = (mode: DifficultyMode, direction: 'harder' | 'easier') => {
    const currentState = {
      pAnyStart: formState.pAnyStart ?? 0.25,
      pAllStart: formState.pAllStart ?? 0,
      displayRules: {
        ...(formState.displayRules ?? DIFFICULTY_PROFILES.earlyLearner.displayRules),
        // Ensure new fields have defaults if missing (for backward compatibility)
        borrowNotation:
          (formState.displayRules as any)?.borrowNotation ??
          DIFFICULTY_PROFILES.earlyLearner.displayRules.borrowNotation,
        borrowingHints:
          (formState.displayRules as any)?.borrowingHints ??
          DIFFICULTY_PROFILES.earlyLearner.displayRules.borrowingHints,
      },
    }

    const result =
      direction === 'harder'
        ? makeHarder(currentState, mode, formState.operator)
        : makeEasier(currentState, mode, formState.operator)

    onChange({
      pAnyStart: result.pAnyStart,
      pAllStart: result.pAllStart,
      displayRules: result.displayRules,
      difficultyProfile:
        result.difficultyProfile !== 'custom' ? result.difficultyProfile : undefined,
    })
  }

  return (
    <div data-section="smart-mode" className={stack({ gap: '3' })}>
      {/* Digit Range */}
      <DigitRangeSection
        digitRange={formState.digitRange}
        onChange={(digitRange) => onChange({ digitRange })}
        isDark={isDark}
      />

      {/* Difficulty Level */}
      <div data-section="difficulty" className={stack({ gap: '2.5' })}>
        <div
          className={css({
            fontSize: 'xs',
            fontWeight: 'semibold',
            color: isDark ? 'gray.400' : 'gray.500',
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
          const displayRules: DisplayRules = {
            ...(formState.displayRules ?? profile.displayRules),
            // Ensure new fields have defaults (backward compatibility with old configs)
            borrowNotation:
              (formState.displayRules as any)?.borrowNotation ??
              profile.displayRules.borrowNotation,
            borrowingHints:
              (formState.displayRules as any)?.borrowingHints ??
              profile.displayRules.borrowingHints,
          }

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
            const currentScaffolding = calculateScaffoldingLevel(displayRules, currentRegrouping)

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
            const scaffoldingSummary = getScaffoldingSummary(displayRules, formState.operator)
            customDescription = (
              <>
                <div>{regroupingPercent}% regrouping</div>
                {scaffoldingSummary}
              </>
            )
          }

          // Calculate current difficulty position
          const currentDifficulty = calculateOverallDifficulty(pAnyStart, pAllStart, displayRules)

          // Calculate make easier/harder results for preview (all modes)
          const easierResultBoth = makeEasier(
            {
              pAnyStart,
              pAllStart,
              displayRules,
            },
            'both',
            formState.operator
          )

          const easierResultChallenge = makeEasier(
            {
              pAnyStart,
              pAllStart,
              displayRules,
            },
            'challenge',
            formState.operator
          )

          const easierResultSupport = makeEasier(
            {
              pAnyStart,
              pAllStart,
              displayRules,
            },
            'support',
            formState.operator
          )

          const harderResultBoth = makeHarder(
            {
              pAnyStart,
              pAllStart,
              displayRules,
            },
            'both',
            formState.operator
          )

          const harderResultChallenge = makeHarder(
            {
              pAnyStart,
              pAllStart,
              displayRules,
            },
            'challenge',
            formState.operator
          )

          const harderResultSupport = makeHarder(
            {
              pAnyStart,
              pAllStart,
              displayRules,
            },
            'support',
            formState.operator
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
                                    className={css({
                                      fontSize: 'xs',
                                      color: 'orange.500',
                                    })}
                                  >
                                    (hover preview)
                                  </span>
                                </>
                              ) : (
                                <>
                                  ✨ Custom{' '}
                                  <span
                                    className={css({
                                      fontSize: 'xs',
                                      color: 'orange.500',
                                    })}
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
                                hoverPreview.displayRules,
                                formState.operator
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
                                preset.displayRules,
                                formState.operator
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
                                Always: carry boxes, answer boxes, place value colors, ten-frames
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <span
                        className={css({
                          fontSize: 'xs',
                          color: 'gray.400',
                          flexShrink: 0,
                        })}
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
                        const scaffoldingSummary = getScaffoldingSummary(
                          preset.displayRules,
                          formState.operator
                        )
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
                        easierAlternativeMode === 'support' ? '↑ More support' : '← Less challenge'
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
                                style={
                                  {
                                    WebkitBoxOrient: 'vertical',
                                  } as React.CSSProperties
                                }
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
                        harderAlternativeMode === 'support' ? '↓ Less support' : '→ More challenge'
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
                                style={
                                  {
                                    WebkitBoxOrient: 'vertical',
                                  } as React.CSSProperties
                                }
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
                        return {
                          regrouping,
                          scaffolding,
                          difficulty,
                          name: presetName,
                        }
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
                            const presetScaf = calculateScaffoldingLevel(p.displayRules, presetReg)

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
                            ((10 - scaffoldingLevel) / 10) * (SCAFFOLDING_PROGRESSION.length - 1)
                          )

                          // Find nearest valid state (applies pedagogical constraints)
                          const validState = findNearestValidState(regroupingIdx, scaffoldingIdx)

                          // Get actual values from progressions
                          const newRegrouping = REGROUPING_PROGRESSION[validState.regroupingIdx]
                          const newDisplayRules = SCAFFOLDING_PROGRESSION[validState.scaffoldingIdx]

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

                          return {
                            newRegrouping,
                            newDisplayRules,
                            matchedProfile,
                            reg,
                            scaf,
                          }
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
                            <circle cx={toX(currentReg)} cy={toY(currentScaf)} r="3" fill="white" />
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

      {/* Regrouping Frequency */}
      <RegroupingFrequencyPanel formState={formState} onChange={onChange} isDark={isDark} />
    </div>
  )
}
