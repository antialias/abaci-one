'use client'

import * as Slider from '@radix-ui/react-slider'
import { css } from '../../../../../../../styled-system/css'
import { stack } from '../../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../../types'
import { DisplayOptionsPreview } from '../DisplayOptionsPreview'
import { ToggleOption } from './ToggleOption'
import { SubOption } from './SubOption'

export interface ManualModeControlsProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
}

export function ManualModeControls({ formState, onChange }: ManualModeControlsProps) {
  return (
    <>
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
                  checked={formState.showCarryBoxes ?? true}
                  onChange={(checked) => {
                    onChange({ showCarryBoxes: checked })
                  }}
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

                {(formState.operator === 'subtraction' || formState.operator === 'mixed') && (
                  <ToggleOption
                    checked={formState.showBorrowNotation ?? true}
                    onChange={(checked) => onChange({ showBorrowNotation: checked })}
                    label="Borrowed 10s Box"
                    description="Box for adding 10 to borrowing digit"
                  />
                )}

                {(formState.operator === 'subtraction' || formState.operator === 'mixed') && (
                  <ToggleOption
                    checked={formState.showBorrowingHints ?? false}
                    onChange={(checked) => onChange({ showBorrowingHints: checked })}
                    label="Borrowing Hints"
                    description="Show arrows and calculations guiding the borrowing process"
                  />
                )}

                <ToggleOption
                  checked={formState.showTenFrames ?? false}
                  onChange={(checked) => {
                    onChange({ showTenFrames: checked })
                  }}
                  label="Ten-Frames"
                  description="Visualize regrouping with concrete counting tools"
                >
                  <SubOption
                    checked={formState.showTenFramesForAll ?? false}
                    onChange={(checked) => onChange({ showTenFramesForAll: checked })}
                    label="Show for all problems (not just regrouping)"
                    parentEnabled={formState.showTenFrames ?? false}
                  />
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
    </>
  )
}
