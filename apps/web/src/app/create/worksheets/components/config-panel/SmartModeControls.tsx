'use client'

import { useState } from 'react'
import type React from 'react'
import * as Slider from '@radix-ui/react-slider'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { css } from '@styled/css'
import { stack } from '@styled/patterns'
import type { WorksheetFormState } from '../../types'
import { useTheme } from '@/contexts/ThemeContext'
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
import { DifficultyPresetDropdown } from './DifficultyPresetDropdown'
import { MakeEasierHarderButtons } from './MakeEasierHarderButtons'
import { OverallDifficultySlider } from './OverallDifficultySlider'

export interface SmartModeControlsProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
}

export function SmartModeControls({ formState, onChange }: SmartModeControlsProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
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
              <DifficultyPresetDropdown
                currentProfile={currentProfile}
                isCustom={isCustom}
                nearestEasier={nearestEasier}
                nearestHarder={nearestHarder}
                customDescription={customDescription}
                hoverPreview={hoverPreview}
                onChange={onChange}
              />

              {/* Make Easier/Harder buttons with preview */}
              <MakeEasierHarderButtons
                easierResultBoth={easierResultBoth}
                easierResultChallenge={easierResultChallenge}
                easierResultSupport={easierResultSupport}
                harderResultBoth={harderResultBoth}
                harderResultChallenge={harderResultChallenge}
                harderResultSupport={harderResultSupport}
                canMakeEasierBoth={canMakeEasierBoth}
                canMakeEasierChallenge={canMakeEasierChallenge}
                canMakeEasierSupport={canMakeEasierSupport}
                canMakeHarderBoth={canMakeHarderBoth}
                canMakeHarderChallenge={canMakeHarderChallenge}
                canMakeHarderSupport={canMakeHarderSupport}
                onEasier={(mode) => handleDifficultyChange(mode, 'easier')}
                onHarder={(mode) => handleDifficultyChange(mode, 'harder')}
              />

              {/* Overall Difficulty Slider */}
              <OverallDifficultySlider currentDifficulty={currentDifficulty} onChange={onChange} />

              {/* 2D Difficulty Space Visualizer */}
              <div
                className={css({
                  bg: isDark ? 'blue.950' : 'blue.50',
                  border: '1px solid',
                  borderColor: isDark ? 'blue.800' : 'blue.200',
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
                      bg: isDark ? 'blue.900' : 'blue.100',
                    },
                    transition: 'background 0.2s',
                  })}
                >
                  <div
                    className={css({
                      fontWeight: 'semibold',
                      color: isDark ? 'blue.200' : 'blue.900',
                      fontSize: 'sm',
                    })}
                  >
                    Difficulty Space Map
                  </div>
                  <div
                    className={css({
                      fontSize: 'sm',
                      color: isDark ? 'blue.300' : 'blue.700',
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
                        bg: isDark ? 'gray.900' : 'white',
                        rounded: 'lg',
                        p: '4',
                        border: '1px solid',
                        borderColor: isDark ? 'gray.700' : 'gray.200',
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
      <RegroupingFrequencyPanel />
    </div>
  )
}
