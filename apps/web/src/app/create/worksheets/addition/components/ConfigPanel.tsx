'use client'

import * as Slider from '@radix-ui/react-slider'
import { useTranslations } from 'next-intl'
import { css } from '../../../../../../styled-system/css'
import { stack } from '../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../types'

interface ConfigPanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
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
            <div className={css({ display: 'flex', gap: '1.5' })}>
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
                  flex: 1,
                  px: '2.5',
                  py: '1.5',
                  border: '1.5px solid',
                  borderColor: currentOrientation === 'portrait' ? 'brand.500' : 'gray.300',
                  bg: currentOrientation === 'portrait' ? 'brand.50' : 'white',
                  rounded: 'lg',
                  cursor: 'pointer',
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  color: currentOrientation === 'portrait' ? 'brand.700' : 'gray.600',
                  transition: 'all 0.15s',
                  _hover: { borderColor: 'brand.400', transform: 'translateY(-1px)' },
                })}
              >
                Portrait
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
                  flex: 1,
                  px: '2.5',
                  py: '1.5',
                  border: '1.5px solid',
                  borderColor: currentOrientation === 'landscape' ? 'brand.500' : 'gray.300',
                  bg: currentOrientation === 'landscape' ? 'brand.50' : 'white',
                  rounded: 'lg',
                  cursor: 'pointer',
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  color: currentOrientation === 'landscape' ? 'brand.700' : 'gray.600',
                  transition: 'all 0.15s',
                  _hover: { borderColor: 'brand.400', transform: 'translateY(-1px)' },
                })}
              >
                Landscape
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
            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '1.5' })}>
              {(currentOrientation === 'portrait'
                ? [6, 8, 10, 12, 15]
                : [8, 10, 12, 15, 16, 20]
              ).map((count) => {
                const isSelected = currentProblemsPerPage === count
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
                    {count}
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

      {/* Difficulty Card */}
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
        <div className={stack({ gap: '2' })}>
          <div
            className={css({
              fontSize: 'xs',
              fontWeight: 'semibold',
              color: 'gray.500',
              textTransform: 'uppercase',
              letterSpacing: 'wider',
            })}
          >
            Difficulty
          </div>

          {/* Dual-range slider */}
          <div>
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'xs',
                fontWeight: 'medium',
                color: 'gray.600',
                mb: '2',
              })}
            >
              <div>
                Both:{' '}
                <span className={css({ color: 'brand.600', fontWeight: 'semibold' })}>
                  {Math.round((formState.pAllStart || 0.25) * 100)}%
                </span>
              </div>
              <div>
                Any:{' '}
                <span className={css({ color: 'brand.600', fontWeight: 'semibold' })}>
                  {Math.round((formState.pAnyStart || 0.75) * 100)}%
                </span>
              </div>
            </div>

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
              value={[(formState.pAllStart || 0.25) * 100, (formState.pAnyStart || 0.75) * 100]}
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

            <div
              className={css({ fontSize: '2xs', color: 'gray.500', mt: '1.5', lineHeight: '1.3' })}
            >
              Regrouping difficulty at worksheet start
            </div>
          </div>

          {/* Progressive difficulty */}
          <div className={css({ display: 'flex', gap: '2', alignItems: 'center' })}>
            <input
              id="interpolate"
              type="checkbox"
              checked={formState.interpolate ?? true}
              onChange={(e) => onChange({ interpolate: e.target.checked })}
              className={css({ w: '3.5', h: '3.5', cursor: 'pointer', flexShrink: 0 })}
            />
            <label
              htmlFor="interpolate"
              className={css({
                fontSize: 'xs',
                fontWeight: 'medium',
                color: 'gray.600',
                cursor: 'pointer',
              })}
            >
              Progressive difficulty (easy → hard)
            </label>
          </div>
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
        <div className={stack({ gap: '2' })}>
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

          {/* Checkboxes - 2 columns */}
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1.5',
              columnGap: '3',
            })}
          >
            <div className={css({ display: 'flex', gap: '1.5', alignItems: 'center' })}>
              <input
                id="showCarryBoxes"
                type="checkbox"
                checked={formState.showCarryBoxes ?? true}
                onChange={(e) => onChange({ showCarryBoxes: e.target.checked })}
                className={css({ w: '3.5', h: '3.5', cursor: 'pointer', flexShrink: 0 })}
              />
              <label
                htmlFor="showCarryBoxes"
                className={css({
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  color: 'gray.600',
                  cursor: 'pointer',
                })}
              >
                Carry Boxes
              </label>
            </div>

            <div className={css({ display: 'flex', gap: '1.5', alignItems: 'center' })}>
              <input
                id="showAnswerBoxes"
                type="checkbox"
                checked={formState.showAnswerBoxes ?? true}
                onChange={(e) => onChange({ showAnswerBoxes: e.target.checked })}
                className={css({ w: '3.5', h: '3.5', cursor: 'pointer', flexShrink: 0 })}
              />
              <label
                htmlFor="showAnswerBoxes"
                className={css({
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  color: 'gray.600',
                  cursor: 'pointer',
                })}
              >
                Answer Boxes
              </label>
            </div>

            <div className={css({ display: 'flex', gap: '1.5', alignItems: 'center' })}>
              <input
                id="showPlaceValueColors"
                type="checkbox"
                checked={formState.showPlaceValueColors ?? true}
                onChange={(e) => onChange({ showPlaceValueColors: e.target.checked })}
                className={css({ w: '3.5', h: '3.5', cursor: 'pointer', flexShrink: 0 })}
              />
              <label
                htmlFor="showPlaceValueColors"
                className={css({
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  color: 'gray.600',
                  cursor: 'pointer',
                })}
              >
                Place Value Colors
              </label>
            </div>

            <div className={css({ display: 'flex', gap: '1.5', alignItems: 'center' })}>
              <input
                id="showProblemNumbers"
                type="checkbox"
                checked={formState.showProblemNumbers ?? true}
                onChange={(e) => onChange({ showProblemNumbers: e.target.checked })}
                className={css({ w: '3.5', h: '3.5', cursor: 'pointer', flexShrink: 0 })}
              />
              <label
                htmlFor="showProblemNumbers"
                className={css({
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  color: 'gray.600',
                  cursor: 'pointer',
                })}
              >
                Problem Numbers
              </label>
            </div>

            <div className={css({ display: 'flex', gap: '1.5', alignItems: 'center' })}>
              <input
                id="showCellBorder"
                type="checkbox"
                checked={formState.showCellBorder ?? true}
                onChange={(e) => onChange({ showCellBorder: e.target.checked })}
                className={css({ w: '3.5', h: '3.5', cursor: 'pointer', flexShrink: 0 })}
              />
              <label
                htmlFor="showCellBorder"
                className={css({
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  color: 'gray.600',
                  cursor: 'pointer',
                })}
              >
                Cell Borders
              </label>
            </div>

            <div className={stack({ gap: '1.5' })}>
              <div className={css({ display: 'flex', gap: '1.5', alignItems: 'center' })}>
                <input
                  id="showTenFrames"
                  type="checkbox"
                  checked={formState.showTenFrames ?? false}
                  onChange={(e) => onChange({ showTenFrames: e.target.checked })}
                  className={css({ w: '3.5', h: '3.5', cursor: 'pointer', flexShrink: 0 })}
                />
                <label
                  htmlFor="showTenFrames"
                  className={css({
                    fontSize: 'xs',
                    fontWeight: 'medium',
                    color: 'gray.600',
                    cursor: 'pointer',
                  })}
                >
                  {formState.showTenFramesForAll ? 'Ten-Frames' : 'Ten-Frames for Regrouping'}
                </label>
              </div>

              {/* Sub-option: Show for all place values */}
              {formState.showTenFrames && (
                <div
                  className={css({
                    display: 'flex',
                    gap: '1.5',
                    alignItems: 'center',
                    ml: '5',
                  })}
                >
                  <input
                    id="showTenFramesForAll"
                    type="checkbox"
                    checked={formState.showTenFramesForAll ?? false}
                    onChange={(e) => onChange({ showTenFramesForAll: e.target.checked })}
                    className={css({ w: '3', h: '3', cursor: 'pointer', flexShrink: 0 })}
                  />
                  <label
                    htmlFor="showTenFramesForAll"
                    className={css({
                      fontSize: '2xs',
                      fontWeight: 'medium',
                      color: 'gray.500',
                      cursor: 'pointer',
                    })}
                  >
                    For all place values
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
