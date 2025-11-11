'use client'

import * as Slider from '@radix-ui/react-slider'
import { css } from '../../../../../../../styled-system/css'
import {
  DIFFICULTY_PROFILES,
  DIFFICULTY_PROGRESSION,
  calculateOverallDifficulty,
  calculateRegroupingIntensity,
  calculateScaffoldingLevel,
  REGROUPING_PROGRESSION,
  SCAFFOLDING_PROGRESSION,
  findNearestValidState,
  getProfileFromConfig,
  type DifficultyLevel,
} from '../../difficultyProfiles'
import type { DisplayRules } from '../../displayRules'

export interface OverallDifficultySliderProps {
  currentDifficulty: number
  onChange: (updates: {
    pAnyStart: number
    pAllStart: number
    displayRules: DisplayRules
    difficultyProfile?: DifficultyLevel
  }) => void
  isDark?: boolean
}

export function OverallDifficultySlider({
  currentDifficulty,
  onChange,
  isDark = false,
}: OverallDifficultySliderProps) {
  const handleValueChange = (value: number[]) => {
    const targetDifficulty = value[0] / 10

    // Calculate preset positions in 2D space
    const presetPoints = DIFFICULTY_PROGRESSION.map((presetName) => {
      const preset = DIFFICULTY_PROFILES[presetName]
      const regrouping = calculateRegroupingIntensity(
        preset.regrouping.pAnyStart,
        preset.regrouping.pAllStart
      )
      const scaffolding = calculateScaffoldingLevel(preset.displayRules, regrouping)
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

      if (targetDifficulty >= start.difficulty && targetDifficulty <= end.difficulty) {
        // Interpolate between start and end
        const t = (targetDifficulty - start.difficulty) / (end.difficulty - start.difficulty)
        idealRegrouping = start.regrouping + t * (end.regrouping - start.regrouping)
        idealScaffolding = start.scaffolding + t * (end.scaffolding - start.scaffolding)
        console.log('[Slider] Interpolating between', start.name, 'and', end.name, {
          t,
          idealRegrouping,
          idealScaffolding,
        })
        break
      }
    }

    // Handle edge cases (before first or after last preset)
    if (targetDifficulty < presetPoints[0].difficulty) {
      idealRegrouping = presetPoints[0].regrouping
      idealScaffolding = presetPoints[0].scaffolding
    } else if (targetDifficulty > presetPoints[presetPoints.length - 1].difficulty) {
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
      for (let scaffIdx = 0; scaffIdx < SCAFFOLDING_PROGRESSION.length; scaffIdx++) {
        const validState = findNearestValidState(regIdx, scaffIdx)
        if (validState.regroupingIdx !== regIdx || validState.scaffoldingIdx !== scaffIdx) {
          continue
        }

        const regrouping = REGROUPING_PROGRESSION[regIdx]
        const displayRules = SCAFFOLDING_PROGRESSION[scaffIdx]

        const actualRegrouping = calculateRegroupingIntensity(
          regrouping.pAnyStart,
          regrouping.pAllStart
        )
        const actualScaffolding = calculateScaffoldingLevel(displayRules, actualRegrouping)

        // Euclidean distance to ideal point on pedagogical path
        const distance = Math.sqrt(
          (actualRegrouping - idealRegrouping) ** 2 + (actualScaffolding - idealScaffolding) ** 2
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
        regrouping: calculateRegroupingIntensity(closestConfig.pAnyStart, closestConfig.pAllStart),
        scaffolding: calculateScaffoldingLevel(
          closestConfig.displayRules,
          calculateRegroupingIntensity(closestConfig.pAnyStart, closestConfig.pAllStart)
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
        difficultyProfile: matchedProfile !== 'custom' ? matchedProfile : undefined,
      })
    }
  }

  return (
    <div className={css({ mb: '2' })}>
      <div
        className={css({
          fontSize: 'xs',
          fontWeight: 'medium',
          color: isDark ? 'gray.300' : 'gray.700',
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
          onValueChange={handleValueChange}
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
              bg: isDark ? 'gray.700' : 'gray.100',
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
  )
}
