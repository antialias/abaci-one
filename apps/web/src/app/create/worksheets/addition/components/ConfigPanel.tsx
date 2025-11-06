'use client'

import * as Checkbox from '@radix-ui/react-checkbox'
import { useTranslations } from 'next-intl'
import { css } from '../../../../../../styled-system/css'
import { stack } from '../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../types'
import { DisplayOptionsPreview } from './DisplayOptionsPreview'

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
            <div className={css({ display: 'flex', gap: '2', justifyContent: 'center' })}>
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
                  _hover: { borderColor: 'brand.400', transform: 'translateY(-1px)' },
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
                  _hover: { borderColor: 'brand.400', transform: 'translateY(-1px)' },
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
            Regrouping
          </div>

          {/* Regrouping toggle */}
          <div className={css({ display: 'flex', gap: '2' })}>
            {[
              {
                value: false,
                label: 'Off',
                desc: 'Simple problems with no regrouping (e.g., 23 + 45 = 68)',
              },
              {
                value: true,
                label: 'On',
                desc: 'Include problems that require regrouping (carrying to the next place value)',
              },
            ].map(({ value, label, desc }) => {
              // Regrouping is ON if pAny > 0
              const hasRegrouping = (formState.pAnyStart ?? 0.75) > 0
              const isSelected = hasRegrouping === value

              return (
                <button
                  key={String(value)}
                  onClick={() => {
                    if (value) {
                      // Turn ON: set to Medium defaults
                      onChange({
                        pAllStart: 0.25,
                        pAnyStart: 0.75,
                      })
                    } else {
                      // Turn OFF: no regrouping at all
                      onChange({
                        pAllStart: 0,
                        pAnyStart: 0,
                      })
                    }
                  }}
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

          {/* Collapsible regrouping difficulty controls */}
          {(formState.pAnyStart ?? 0.75) > 0 && (
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '2.5', pt: '1' })}>
              {/* Regrouping difficulty level buttons */}
              <div>
                <div
                  className={css({
                    fontSize: 'xs',
                    fontWeight: 'semibold',
                    color: 'gray.500',
                    mb: '1.5',
                  })}
                >
                  Regrouping Frequency
                </div>
                <div className={css({ display: 'flex', gap: '2' })}>
                  {[
                    {
                      level: 'easy',
                      label: 'Occasional',
                      pAll: 0,
                      pAny: 0.25,
                      desc: 'Regrouping happens rarely, mostly in the ones place',
                    },
                    {
                      level: 'medium',
                      label: 'Regular',
                      pAll: 0.25,
                      pAny: 0.75,
                      desc: 'Balanced mix with regular regrouping from ones to tens, and tens to hundreds',
                    },
                    {
                      level: 'hard',
                      label: 'Frequent',
                      pAll: 0.5,
                      pAny: 0.9,
                      desc: 'Most problems require regrouping across multiple place values',
                    },
                  ].map(({ level, label, pAll, pAny, desc }) => {
                    // Determine which level is currently selected based on pAll/pAny values
                    const currentPAll = formState.pAllStart ?? 0.25
                    const currentPAny = formState.pAnyStart ?? 0.75

                    // Match logic: within 0.05 tolerance
                    const isSelected =
                      Math.abs(currentPAll - pAll) < 0.05 && Math.abs(currentPAny - pAny) < 0.05

                    return (
                      <button
                        key={level}
                        onClick={() => {
                          onChange({
                            pAllStart: pAll,
                            pAnyStart: pAny,
                          })
                        }}
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
                            lineHeight: '1.2',
                          })}
                        >
                          {desc}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Progressive difficulty toggle */}
              <div>
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
                      desc: 'All problems at the selected regrouping frequency',
                    },
                    {
                      value: true,
                      label: 'On',
                      desc: 'Start with simpler regrouping and gradually build up to the selected frequency, helping students warm up',
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
            </div>
          )}
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
          <div className={css({ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '3' })}>
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
                      onChange({ showTenFramesForAll: !formState.showTenFramesForAll })
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
