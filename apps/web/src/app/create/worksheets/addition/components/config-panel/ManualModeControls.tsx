'use client'

import * as Slider from '@radix-ui/react-slider'
import { css } from '../../../../../../../styled-system/css'
import { stack } from '../../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../../types'
import type { DisplayRules } from '../../displayRules'
import { defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { RuleThermometer } from './RuleThermometer'
import { DigitRangeSection } from './DigitRangeSection'
import { DisplayOptionsPreview } from '../DisplayOptionsPreview'

export interface ManualModeControlsProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  isDark?: boolean
}

export function ManualModeControls({
  formState,
  onChange,
  isDark = false,
}: ManualModeControlsProps) {
  // Get current displayRules or use defaults
  const displayRules: DisplayRules = formState.displayRules ?? defaultAdditionConfig.displayRules

  // Helper to update a single display rule
  const updateRule = (key: keyof DisplayRules, value: DisplayRules[keyof DisplayRules]) => {
    onChange({
      displayRules: {
        ...displayRules,
        [key]: value,
      },
    })
  }

  return (
    <div data-section="manual-mode" className={stack({ gap: '3' })}>
      {/* Digit Range Selector */}
      <DigitRangeSection
        digitRange={formState.digitRange}
        onChange={(digitRange) => onChange({ digitRange })}
        isDark={isDark}
      />

      {/* Pedagogical Scaffolding Options */}
      <div data-section="scaffolding" className={stack({ gap: '3' })}>
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
              color: isDark ? 'gray.400' : 'gray.500',
              textTransform: 'uppercase',
              letterSpacing: 'wider',
            })}
          >
            Pedagogical Scaffolding
          </div>
          <div className={css({ display: 'flex', gap: '1.5' })}>
            <button
              onClick={() =>
                onChange({
                  displayRules: {
                    ...displayRules,
                    carryBoxes: 'always',
                    answerBoxes: 'always',
                    placeValueColors: 'always',
                    tenFrames: 'always',
                    borrowNotation: 'always',
                    borrowingHints: 'always',
                  },
                })
              }
              className={css({
                px: '2',
                py: '0.5',
                fontSize: '2xs',
                color: isDark ? 'brand.300' : 'brand.600',
                border: '1px solid',
                borderColor: isDark ? 'brand.500' : 'brand.300',
                bg: isDark ? 'gray.700' : 'white',
                rounded: 'md',
                cursor: 'pointer',
                _hover: { bg: isDark ? 'gray.600' : 'brand.50' },
              })}
            >
              All Always
            </button>
            <button
              onClick={() =>
                onChange({
                  displayRules: {
                    ...displayRules,
                    carryBoxes: 'never',
                    answerBoxes: 'never',
                    placeValueColors: 'never',
                    tenFrames: 'never',
                    borrowNotation: 'never',
                    borrowingHints: 'never',
                  },
                })
              }
              className={css({
                px: '2',
                py: '0.5',
                fontSize: '2xs',
                color: isDark ? 'gray.300' : 'gray.600',
                border: '1px solid',
                borderColor: isDark ? 'gray.500' : 'gray.300',
                bg: isDark ? 'gray.700' : 'white',
                rounded: 'md',
                cursor: 'pointer',
                _hover: { bg: isDark ? 'gray.600' : 'gray.50' },
              })}
            >
              Minimal
            </button>
          </div>
        </div>

        {/* Pedagogical scaffolding thermometers */}
        <div className={stack({ gap: '3' })}>
          <RuleThermometer
            label="Answer Boxes"
            description="Guide students to write organized, aligned answers"
            value={displayRules.answerBoxes}
            onChange={(value) => updateRule('answerBoxes', value)}
            isDark={isDark}
          />

          <RuleThermometer
            label="Place Value Colors"
            description="Reinforce place value understanding visually"
            value={displayRules.placeValueColors}
            onChange={(value) => updateRule('placeValueColors', value)}
            isDark={isDark}
          />

          <RuleThermometer
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
            value={displayRules.carryBoxes}
            onChange={(value) => updateRule('carryBoxes', value)}
            isDark={isDark}
          />

          {(formState.operator === 'subtraction' || formState.operator === 'mixed') && (
            <RuleThermometer
              label="Borrowed 10s Box"
              description="Box for adding 10 to borrowing digit"
              value={displayRules.borrowNotation}
              onChange={(value) => updateRule('borrowNotation', value)}
              isDark={isDark}
            />
          )}

          {(formState.operator === 'subtraction' || formState.operator === 'mixed') && (
            <RuleThermometer
              label="Borrowing Hints"
              description="Show arrows and calculations guiding the borrowing process"
              value={displayRules.borrowingHints}
              onChange={(value) => updateRule('borrowingHints', value)}
              isDark={isDark}
            />
          )}

          <RuleThermometer
            label="Ten-Frames"
            description="Visualize regrouping with concrete counting tools"
            value={displayRules.tenFrames}
            onChange={(value) => updateRule('tenFrames', value)}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Regrouping Frequency Card - Manual Mode */}
      <div
        data-section="regrouping"
        className={css({
          bg: isDark ? 'gray.800' : 'gray.50',
          border: '1px solid',
          borderColor: isDark ? 'gray.600' : 'gray.200',
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
              color: isDark ? 'gray.400' : 'gray.500',
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
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            <div>
              Both:{' '}
              <span
                className={css({
                  color: 'brand.600',
                  fontWeight: 'semibold',
                })}
              >
                {Math.round((formState.pAllStart || 0) * 100)}%
              </span>
            </div>
            <div>
              Any:{' '}
              <span
                className={css({
                  color: 'brand.600',
                  fontWeight: 'semibold',
                })}
              >
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
                _focus: {
                  outline: 'none',
                  boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
                },
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
                _focus: {
                  outline: 'none',
                  boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
                },
              })}
            />
          </Slider.Root>

          <div
            className={css({
              fontSize: '2xs',
              color: isDark ? 'gray.400' : 'gray.500',
              lineHeight: '1.3',
            })}
          >
            Regrouping difficulty at worksheet start (Both = all columns regroup, Any = at least one
            column regroups)
          </div>
        </div>
      </div>
    </div>
  )
}
