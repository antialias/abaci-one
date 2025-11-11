'use client'

import type React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { css } from '../../../../../../../styled-system/css'
import {
  DIFFICULTY_PROFILES,
  DIFFICULTY_PROGRESSION,
  calculateRegroupingIntensity,
  type DifficultyLevel,
} from '../../difficultyProfiles'
import type { DisplayRules } from '../../displayRules'
import { getScaffoldingSummary } from './utils'

export interface DifficultyPresetDropdownProps {
  currentProfile: DifficultyLevel | null
  isCustom: boolean
  nearestEasier: DifficultyLevel | null
  nearestHarder: DifficultyLevel | null
  customDescription: React.ReactNode
  hoverPreview: {
    pAnyStart: number
    pAllStart: number
    displayRules: DisplayRules
    matchedProfile: string | 'custom'
  } | null
  operator: 'addition' | 'subtraction' | 'mixed'
  onChange: (updates: {
    difficultyProfile: DifficultyLevel
    pAnyStart: number
    pAllStart: number
    displayRules: DisplayRules
  }) => void
  isDark?: boolean
}

export function DifficultyPresetDropdown({
  currentProfile,
  isCustom,
  nearestEasier,
  nearestHarder,
  customDescription,
  hoverPreview,
  operator,
  onChange,
  isDark = false,
}: DifficultyPresetDropdownProps) {
  return (
    <div className={css({ mb: '3' })}>
      <div
        className={css({
          fontSize: 'xs',
          fontWeight: 'medium',
          color: isDark ? 'gray.300' : 'gray.700',
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
              borderColor: isCustom
                ? isDark
                  ? 'orange.500'
                  : 'orange.400'
                : isDark
                  ? 'gray.600'
                  : 'gray.300',
              bg: isCustom
                ? isDark
                  ? 'orange.900'
                  : 'orange.50'
                : isDark
                  ? 'gray.800'
                  : 'white',
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
                  color: hoverPreview
                    ? isDark
                      ? 'orange.300'
                      : 'orange.700'
                    : isDark
                      ? 'gray.200'
                      : 'gray.700',
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
                    ? isDark
                      ? 'orange.400'
                      : 'orange.600'
                    : isCustom
                      ? isDark
                        ? 'orange.400'
                        : 'orange.600'
                      : isDark
                        ? 'gray.400'
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
                    const scaffoldingSummary = getScaffoldingSummary(hoverPreview.displayRules, operator)
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
                    const regroupingPercent = Math.round(preset.regrouping.pAnyStart * 100)
                    const scaffoldingSummary = getScaffoldingSummary(preset.displayRules, operator)
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
                    <div>Always: carry boxes, answer boxes, place value colors, ten-frames</div>
                  </>
                )}
              </div>
            </div>
            <span
              className={css({
                fontSize: 'xs',
                color: isDark ? 'gray.500' : 'gray.400',
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
              bg: isDark ? 'gray.800' : 'white',
              rounded: 'lg',
              shadow: 'modal',
              border: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
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
              const scaffoldingSummary = getScaffoldingSummary(preset.displayRules, operator)
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
                      color: isSelected ? 'brand.700' : isDark ? 'gray.200' : 'gray.700',
                    })}
                  >
                    {preset.label}
                  </div>
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: isSelected ? 'brand.600' : isDark ? 'gray.400' : 'gray.500',
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
  )
}
