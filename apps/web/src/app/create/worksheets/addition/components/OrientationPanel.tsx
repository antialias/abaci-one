'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { css } from '../../../../../../styled-system/css'
import { getDefaultColsForProblemsPerPage } from '../utils/layoutCalculations'

interface OrientationPanelProps {
  orientation: 'portrait' | 'landscape'
  problemsPerPage: number
  pages: number
  cols: number
  onOrientationChange: (
    orientation: 'portrait' | 'landscape',
    problemsPerPage: number,
    cols: number
  ) => void
  onProblemsPerPageChange: (problemsPerPage: number, cols: number) => void
  onPagesChange: (pages: number) => void
  isDark?: boolean
  // Layout options
  problemNumbers?: 'always' | 'never'
  cellBorders?: 'always' | 'never'
  onProblemNumbersChange?: (value: 'always' | 'never') => void
  onCellBordersChange?: (value: 'always' | 'never') => void
}

/**
 * Orientation, pages, and problems per page controls
 * Compact layout with grid visualizations in dropdown
 */
export function OrientationPanel({
  orientation,
  problemsPerPage,
  pages,
  cols,
  onOrientationChange,
  onProblemsPerPageChange,
  onPagesChange,
  isDark = false,
  problemNumbers = 'always',
  cellBorders = 'always',
  onProblemNumbersChange,
  onCellBordersChange,
}: OrientationPanelProps) {
  const handleOrientationChange = (newOrientation: 'portrait' | 'landscape') => {
    const newProblemsPerPage = newOrientation === 'portrait' ? 15 : 20
    const newCols = getDefaultColsForProblemsPerPage(newProblemsPerPage, newOrientation)
    onOrientationChange(newOrientation, newProblemsPerPage, newCols)
  }

  const handleProblemsPerPageChange = (count: number) => {
    const newCols = getDefaultColsForProblemsPerPage(count, orientation)
    onProblemsPerPageChange(count, newCols)
  }

  const total = problemsPerPage * pages
  const problemsForOrientation =
    orientation === 'portrait' ? [6, 8, 10, 12, 15] : [8, 10, 12, 15, 16, 20]

  return (
    <div
      data-section="orientation-panel"
      className={css({
        bg: isDark ? 'gray.800' : 'white',
        rounded: '2xl',
        shadow: 'card',
        p: '4',
      })}
    >
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
        {/* Row 1: Orientation + Pages */}
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '3',
            alignItems: 'end',
          })}
        >
          {/* Orientation */}
          <div>
            <div
              className={css({
                fontSize: '2xs',
                fontWeight: 'semibold',
                color: isDark ? 'gray.400' : 'gray.500',
                textTransform: 'uppercase',
                letterSpacing: 'wider',
                mb: '1.5',
              })}
            >
              Orientation
            </div>
            <div className={css({ display: 'flex', gap: '1.5' })}>
              <button
                type="button"
                data-action="select-portrait"
                onClick={() => handleOrientationChange('portrait')}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                  flex: '1',
                  px: '3',
                  py: '2',
                  border: '2px solid',
                  borderColor:
                    orientation === 'portrait' ? 'brand.500' : isDark ? 'gray.600' : 'gray.300',
                  bg: orientation === 'portrait' ? 'brand.50' : isDark ? 'gray.700' : 'white',
                  rounded: 'lg',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  _hover: {
                    borderColor: 'brand.400',
                  },
                })}
              >
                <div
                  className={css({
                    fontSize: 'lg',
                  })}
                >
                  📄
                </div>
                <div
                  className={css({
                    fontSize: 'sm',
                    fontWeight: 'semibold',
                    color:
                      orientation === 'portrait' ? 'brand.700' : isDark ? 'gray.300' : 'gray.600',
                  })}
                >
                  Portrait
                </div>
              </button>
              <button
                type="button"
                data-action="select-landscape"
                onClick={() => handleOrientationChange('landscape')}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                  flex: '1',
                  px: '3',
                  py: '2',
                  border: '2px solid',
                  borderColor:
                    orientation === 'landscape' ? 'brand.500' : isDark ? 'gray.600' : 'gray.300',
                  bg: orientation === 'landscape' ? 'brand.50' : isDark ? 'gray.700' : 'white',
                  rounded: 'lg',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  _hover: {
                    borderColor: 'brand.400',
                  },
                })}
              >
                <div
                  className={css({
                    fontSize: 'lg',
                  })}
                >
                  📃
                </div>
                <div
                  className={css({
                    fontSize: 'sm',
                    fontWeight: 'semibold',
                    color:
                      orientation === 'landscape' ? 'brand.700' : isDark ? 'gray.300' : 'gray.600',
                  })}
                >
                  Landscape
                </div>
              </button>
            </div>
          </div>

          {/* Pages */}
          <div>
            <div
              className={css({
                fontSize: '2xs',
                fontWeight: 'semibold',
                color: isDark ? 'gray.400' : 'gray.500',
                textTransform: 'uppercase',
                letterSpacing: 'wider',
                mb: '1.5',
              })}
            >
              Pages
            </div>
            <div className={css({ display: 'flex', gap: '1' })}>
              {[1, 2, 3, 4].map((pageCount) => {
                const isSelected = pages === pageCount
                return (
                  <button
                    key={pageCount}
                    type="button"
                    data-action={`select-pages-${pageCount}`}
                    onClick={() => onPagesChange(pageCount)}
                    className={css({
                      w: '10',
                      h: '10',
                      border: '2px solid',
                      borderColor: isSelected ? 'brand.500' : isDark ? 'gray.600' : 'gray.300',
                      bg: isSelected ? 'brand.50' : isDark ? 'gray.700' : 'white',
                      rounded: 'lg',
                      cursor: 'pointer',
                      fontSize: 'sm',
                      fontWeight: 'bold',
                      color: isSelected ? 'brand.700' : isDark ? 'gray.300' : 'gray.600',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      _hover: {
                        borderColor: 'brand.400',
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

        {/* Row 2: Problems per page dropdown + Total badge */}
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '3',
            alignItems: 'center',
          })}
        >
          <div>
            <div
              className={css({
                fontSize: '2xs',
                fontWeight: 'semibold',
                color: isDark ? 'gray.400' : 'gray.500',
                textTransform: 'uppercase',
                letterSpacing: 'wider',
                display: 'block',
                mb: '1.5',
              })}
            >
              Problems per Page
            </div>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  data-action="open-problems-dropdown"
                  className={css({
                    w: 'full',
                    px: '3',
                    py: '2',
                    border: '2px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.300',
                    bg: isDark ? 'gray.700' : 'white',
                    rounded: 'lg',
                    cursor: 'pointer',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: isDark ? 'gray.200' : 'gray.700',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    _hover: {
                      borderColor: 'brand.400',
                    },
                  })}
                >
                  <span>
                    {problemsPerPage} problems ({cols} cols × {Math.ceil(problemsPerPage / cols)}{' '}
                    rows)
                  </span>
                  <span
                    className={css({
                      fontSize: 'xs',
                      color: isDark ? 'gray.500' : 'gray.400',
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
                  <div
                    className={css({
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '1',
                    })}
                  >
                    {problemsForOrientation.map((count) => {
                      const itemCols = getDefaultColsForProblemsPerPage(count, orientation)
                      const rows = Math.ceil(count / itemCols)
                      const isSelected = problemsPerPage === count

                      return (
                        <DropdownMenu.Item
                          key={count}
                          data-action={`select-problems-${count}`}
                          onSelect={() => handleProblemsPerPageChange(count)}
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3',
                            px: '3',
                            py: '2',
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
                          {/* Grid visualization */}
                          <div
                            className={css({
                              display: 'grid',
                              placeItems: 'center',
                              w: '12',
                              h: '12',
                              flexShrink: 0,
                            })}
                            style={{
                              gridTemplateColumns: `repeat(${itemCols}, 1fr)`,
                              gridTemplateRows: `repeat(${rows}, 1fr)`,
                              gap: '2px',
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
                          {/* Text description */}
                          <div className={css({ flex: 1 })}>
                            <div
                              className={css({
                                fontSize: 'sm',
                                fontWeight: 'semibold',
                                color: isSelected ? 'brand.700' : isDark ? 'gray.200' : 'gray.700',
                              })}
                            >
                              {count} problems
                            </div>
                            <div
                              className={css({
                                fontSize: 'xs',
                                color: isSelected ? 'brand.600' : isDark ? 'gray.400' : 'gray.500',
                              })}
                            >
                              {itemCols} cols × {rows} rows
                            </div>
                          </div>
                        </DropdownMenu.Item>
                      )
                    })}
                  </div>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          {/* Total problems badge */}
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1',
            })}
          >
            <div
              className={css({
                fontSize: '2xs',
                fontWeight: 'semibold',
                color: isDark ? 'gray.400' : 'gray.500',
                textTransform: 'uppercase',
                letterSpacing: 'wider',
              })}
            >
              Total
            </div>
            <div
              className={css({
                px: '4',
                py: '2',
                bg: 'brand.100',
                rounded: 'full',
                fontSize: 'lg',
                fontWeight: 'bold',
                color: 'brand.700',
              })}
            >
              {total}
            </div>
          </div>
        </div>

        {/* Row 3: Layout Options */}
        <div className={css({ borderTop: '1px solid', borderColor: isDark ? 'gray.700' : 'gray.200', pt: '3', mt: '1' })}>
          <div
            className={css({
              fontSize: '2xs',
              fontWeight: 'semibold',
              color: isDark ? 'gray.400' : 'gray.500',
              textTransform: 'uppercase',
              letterSpacing: 'wider',
              mb: '2',
            })}
          >
            Layout Options
          </div>

          <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
            {/* Problem Numbers Toggle */}
            <label
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              })}
            >
              <div>
                <div
                  className={css({
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: isDark ? 'gray.200' : 'gray.800',
                  })}
                >
                  Problem Numbers
                </div>
                <div
                  className={css({
                    fontSize: 'xs',
                    color: isDark ? 'gray.400' : 'gray.600',
                  })}
                >
                  Show problem numbers for reference
                </div>
              </div>
              <input
                type="checkbox"
                checked={problemNumbers === 'always'}
                onChange={(e) => {
                  onProblemNumbersChange?.(e.target.checked ? 'always' : 'never')
                }}
                className={css({
                  w: '12',
                  h: '6',
                  cursor: 'pointer',
                })}
              />
            </label>

            {/* Cell Borders Toggle */}
            <label
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              })}
            >
              <div>
                <div
                  className={css({
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: isDark ? 'gray.200' : 'gray.800',
                  })}
                >
                  Cell Borders
                </div>
                <div
                  className={css({
                    fontSize: 'xs',
                    color: isDark ? 'gray.400' : 'gray.600',
                  })}
                >
                  Show borders around answer cells
                </div>
              </div>
              <input
                type="checkbox"
                checked={cellBorders === 'always'}
                onChange={(e) => {
                  onCellBordersChange?.(e.target.checked ? 'always' : 'never')
                }}
                className={css({
                  w: '12',
                  h: '6',
                  cursor: 'pointer',
                })}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
