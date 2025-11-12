'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import { css } from '@styled/css'
import { useMemo } from 'react'
import { estimateUniqueProblemSpace } from '../utils/validateProblemSpace'
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
  // Config for problem space validation
  digitRange?: { min: number; max: number }
  pAnyStart?: number
  operator?: 'addition' | 'subtraction' | 'mixed'
  mode?: 'smart' | 'mastery'
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
  digitRange = { min: 2, max: 2 },
  pAnyStart = 0,
  operator = 'addition',
  mode = 'smart',
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

  // Calculate problem space and determine risk for each page count
  const estimatedSpace = useMemo(() => {
    // Skip validation for mastery + mixed mode (same logic as WorksheetPreviewContext)
    if (mode === 'mastery' && operator === 'mixed') {
      return Infinity // No validation
    }
    return estimateUniqueProblemSpace(digitRange, pAnyStart, operator)
  }, [digitRange, pAnyStart, operator, mode])

  // Helper to get duplicate risk for a given page count
  const getDuplicateRisk = (pageCount: number): 'none' | 'caution' | 'danger' => {
    if (estimatedSpace === Infinity) return 'none'

    const requestedProblems = problemsPerPage * pageCount
    const ratio = requestedProblems / estimatedSpace

    if (ratio < 0.5) return 'none'
    if (ratio < 0.8) return 'caution'
    return 'danger'
  }

  // Helper to get tooltip message for a page count
  const getTooltipMessage = (pageCount: number): string | null => {
    if (estimatedSpace === Infinity) return null

    const requestedProblems = problemsPerPage * pageCount
    const ratio = requestedProblems / estimatedSpace

    if (ratio < 0.5) return null // No warning needed

    if (ratio < 0.8) {
      return `⚠️ Limited variety: ${requestedProblems} problems requested, ~${Math.floor(estimatedSpace)} unique available.\n\nSome duplicates may occur.`
    }

    return `🚫 Too many duplicates: ${requestedProblems} problems requested, only ~${Math.floor(estimatedSpace)} unique available.\n\nConsider:\n• Reduce to ${Math.max(1, Math.floor((estimatedSpace * 0.5) / problemsPerPage))} pages\n• Increase digit range\n• Lower regrouping %`
  }

  return (
    <div
      data-section="orientation-panel"
      className={css({
        bg: isDark ? 'gray.800' : 'white',
        rounded: '2xl',
        shadow: 'card',
        p: '4',
        minWidth: 0,
        overflow: 'hidden',
        '@media (max-width: 400px)': {
          p: '3',
        },
        '@media (max-width: 300px)': {
          p: '2',
        },
      })}
    >
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
        {/* Row 1: Orientation + Pages */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'row',
            gap: '3',
            alignItems: 'end',
            '@media (max-width: 444px)': {
              flexDirection: 'column',
              gap: '2',
            },
          })}
        >
          {/* Orientation */}
          <div
            className={css({
              flex: '1',
              minWidth: 0,
            })}
          >
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
            <div
              className={css({
                display: 'flex',
                gap: '1.5',
                '@media (max-width: 400px)': {
                  gap: '1',
                },
              })}
            >
              <button
                type="button"
                data-action="select-portrait"
                onClick={() => handleOrientationChange('portrait')}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                  flex: '1',
                  px: '2',
                  py: '1.5',
                  border: '2px solid',
                  borderColor:
                    orientation === 'portrait' ? 'brand.500' : isDark ? 'gray.600' : 'gray.300',
                  bg:
                    orientation === 'portrait'
                      ? isDark
                        ? 'brand.900'
                        : 'brand.50'
                      : isDark
                        ? 'gray.700'
                        : 'white',
                  rounded: 'lg',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  justifyContent: 'center',
                  minWidth: 0,
                  _hover: {
                    borderColor: 'brand.400',
                  },
                  '@media (max-width: 400px)': {
                    px: '1.5',
                    py: '1',
                    gap: '1',
                  },
                  '@media (max-width: 200px)': {
                    px: '1',
                    py: '0.5',
                    gap: '0.5',
                  },
                })}
              >
                {/* Portrait page icon */}
                <svg
                  width="16"
                  height="20"
                  viewBox="0 0 16 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={css({
                    flexShrink: 0,
                    '@media (max-width: 300px)': {
                      width: '12px',
                      height: '16px',
                    },
                  })}
                >
                  <rect
                    x="1"
                    y="1"
                    width="14"
                    height="18"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                  <line
                    x1="3"
                    y1="4"
                    x2="13"
                    y2="4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="3"
                    y1="7"
                    x2="13"
                    y2="7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="3"
                    y1="10"
                    x2="10"
                    y2="10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  className={css({
                    fontSize: 'xs',
                    fontWeight: 'semibold',
                    color:
                      orientation === 'portrait'
                        ? isDark
                          ? 'brand.200'
                          : 'brand.700'
                        : isDark
                          ? 'gray.300'
                          : 'gray.600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    '@media (max-width: 200px)': {
                      fontSize: '2xs',
                    },
                    '@media (max-width: 150px)': {
                      display: 'none',
                    },
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
                  px: '2',
                  py: '1.5',
                  border: '2px solid',
                  borderColor:
                    orientation === 'landscape' ? 'brand.500' : isDark ? 'gray.600' : 'gray.300',
                  bg:
                    orientation === 'landscape'
                      ? isDark
                        ? 'brand.900'
                        : 'brand.50'
                      : isDark
                        ? 'gray.700'
                        : 'white',
                  rounded: 'lg',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  justifyContent: 'center',
                  minWidth: 0,
                  _hover: {
                    borderColor: 'brand.400',
                  },
                  '@media (max-width: 400px)': {
                    px: '1.5',
                    py: '1',
                    gap: '1',
                  },
                  '@media (max-width: 200px)': {
                    px: '1',
                    py: '0.5',
                    gap: '0.5',
                  },
                })}
              >
                {/* Landscape page icon */}
                <svg
                  width="20"
                  height="16"
                  viewBox="0 0 20 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={css({
                    flexShrink: 0,
                    '@media (max-width: 300px)': {
                      width: '16px',
                      height: '12px',
                    },
                  })}
                >
                  <rect
                    x="1"
                    y="1"
                    width="18"
                    height="14"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                  <line
                    x1="3"
                    y1="4"
                    x2="17"
                    y2="4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="3"
                    y1="7"
                    x2="17"
                    y2="7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="3"
                    y1="10"
                    x2="13"
                    y2="10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  className={css({
                    fontSize: 'xs',
                    fontWeight: 'semibold',
                    color:
                      orientation === 'landscape'
                        ? isDark
                          ? 'brand.200'
                          : 'brand.700'
                        : isDark
                          ? 'gray.300'
                          : 'gray.600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    '@media (max-width: 200px)': {
                      fontSize: '2xs',
                    },
                    '@media (max-width: 150px)': {
                      display: 'none',
                    },
                  })}
                >
                  Landscape
                </div>
              </button>
            </div>
          </div>

          {/* Pages */}
          <div
            className={css({
              flexShrink: 0,
              '@media (max-width: 444px)': {
                width: '100%',
              },
            })}
          >
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
            <div
              className={css({
                display: 'flex',
                gap: '1',
                alignItems: 'center',
                '@media (max-width: 444px)': {
                  width: '100%',
                  gap: '0.5',
                },
              })}
            >
              {/* Quick select buttons for 1-3 pages */}
              {[1, 2, 3].map((pageCount) => {
                const isSelected = pages === pageCount
                const risk = getDuplicateRisk(pageCount)
                const tooltipMessage = getTooltipMessage(pageCount)

                const button = (
                  <button
                    key={pageCount}
                    type="button"
                    data-action={`select-pages-${pageCount}`}
                    onClick={() => onPagesChange(pageCount)}
                    className={css({
                      w: '8',
                      h: '8',
                      border: '2px solid',
                      borderColor: isSelected
                        ? risk === 'danger'
                          ? 'red.500'
                          : risk === 'caution'
                            ? 'yellow.500'
                            : 'brand.500'
                        : risk === 'danger'
                          ? isDark
                            ? 'red.700'
                            : 'red.300'
                          : risk === 'caution'
                            ? isDark
                              ? 'yellow.700'
                              : 'yellow.300'
                            : isDark
                              ? 'gray.600'
                              : 'gray.300',
                      bg: isSelected
                        ? isDark
                          ? risk === 'danger'
                            ? 'red.900'
                            : risk === 'caution'
                              ? 'yellow.900'
                              : 'brand.900'
                          : risk === 'danger'
                            ? 'red.50'
                            : risk === 'caution'
                              ? 'yellow.50'
                              : 'brand.50'
                        : isDark
                          ? 'gray.700'
                          : 'white',
                      rounded: 'lg',
                      cursor: 'pointer',
                      fontSize: 'xs',
                      fontWeight: 'bold',
                      color: isSelected
                        ? isDark
                          ? risk === 'danger'
                            ? 'red.200'
                            : risk === 'caution'
                              ? 'yellow.200'
                              : 'brand.200'
                          : risk === 'danger'
                            ? 'red.700'
                            : risk === 'caution'
                              ? 'yellow.700'
                              : 'brand.700'
                        : isDark
                          ? 'gray.300'
                          : 'gray.600',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      position: 'relative',
                      _hover: {
                        borderColor:
                          risk === 'danger'
                            ? 'red.400'
                            : risk === 'caution'
                              ? 'yellow.400'
                              : 'brand.400',
                      },
                      '@media (max-width: 444px)': {
                        w: '6',
                        h: '6',
                        fontSize: '2xs',
                      },
                      '@media (max-width: 300px)': {
                        w: '5',
                        h: '5',
                        fontSize: '2xs',
                        borderWidth: '1px',
                      },
                    })}
                  >
                    {pageCount}
                    {/* Warning indicator dot */}
                    {risk !== 'none' && (
                      <span
                        className={css({
                          position: 'absolute',
                          top: '-1',
                          right: '-1',
                          w: '2',
                          h: '2',
                          bg: risk === 'danger' ? 'red.500' : 'yellow.500',
                          rounded: 'full',
                        })}
                      />
                    )}
                  </button>
                )

                // Wrap in tooltip if there's a warning message
                if (tooltipMessage) {
                  return (
                    <Tooltip.Provider key={pageCount}>
                      <Tooltip.Root delayDuration={300}>
                        <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            className={css({
                              bg: isDark ? 'gray.800' : 'white',
                              color: isDark ? 'gray.100' : 'gray.900',
                              px: '3',
                              py: '2',
                              rounded: 'lg',
                              shadow: 'lg',
                              border: '1px solid',
                              borderColor: isDark ? 'gray.600' : 'gray.200',
                              maxW: '64',
                              fontSize: 'xs',
                              lineHeight: '1.5',
                              whiteSpace: 'pre-wrap',
                              zIndex: 10000,
                            })}
                            sideOffset={5}
                          >
                            {tooltipMessage}
                            <Tooltip.Arrow
                              className={css({
                                fill: isDark ? 'gray.800' : 'white',
                              })}
                            />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  )
                }

                return button
              })}

              {/* Dropdown for 4+ pages */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    data-action="open-pages-dropdown"
                    className={css({
                      minW: '8',
                      h: '8',
                      px: '2',
                      border: '2px solid',
                      borderColor: pages > 3 ? 'brand.500' : isDark ? 'gray.600' : 'gray.300',
                      bg:
                        pages > 3
                          ? isDark
                            ? 'brand.900'
                            : 'brand.50'
                          : isDark
                            ? 'gray.700'
                            : 'white',
                      rounded: 'lg',
                      cursor: 'pointer',
                      fontSize: 'xs',
                      fontWeight: 'bold',
                      color:
                        pages > 3
                          ? isDark
                            ? 'brand.200'
                            : 'brand.700'
                          : isDark
                            ? 'gray.300'
                            : 'gray.600',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '1',
                      flexShrink: 0,
                      _hover: {
                        borderColor: 'brand.400',
                      },
                      '@media (max-width: 444px)': {
                        minW: '6',
                        h: '6',
                        fontSize: '2xs',
                      },
                      '@media (max-width: 300px)': {
                        minW: '5',
                        h: '5',
                        fontSize: '2xs',
                        borderWidth: '1px',
                      },
                    })}
                  >
                    {pages > 3 ? pages : '4+'}
                    <span className={css({ fontSize: '2xs', opacity: 0.7 })}>▼</span>
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
                      minW: '24',
                      zIndex: 50,
                    })}
                    sideOffset={5}
                  >
                    {[4, 10, 25, 50, 100].map((pageCount) => {
                      const isSelected = pages === pageCount
                      return (
                        <DropdownMenu.Item
                          key={pageCount}
                          data-action={`select-pages-${pageCount}`}
                          onSelect={() => onPagesChange(pageCount)}
                          className={
                            isDark
                              ? css({
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  px: '3',
                                  py: '2',
                                  rounded: 'md',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  fontSize: 'sm',
                                  fontWeight: isSelected ? 'semibold' : 'medium',
                                  color: isSelected ? 'brand.200' : 'gray.200',
                                  bg: isSelected ? 'gray.700' : 'transparent',
                                  _hover: {
                                    bg: 'gray.700',
                                  },
                                  _focus: {
                                    bg: 'gray.600',
                                  },
                                })
                              : css({
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  px: '3',
                                  py: '2',
                                  rounded: 'md',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  fontSize: 'sm',
                                  fontWeight: isSelected ? 'semibold' : 'medium',
                                  color: isSelected ? 'brand.700' : 'gray.700',
                                  bg: isSelected ? 'brand.50' : 'transparent',
                                  _hover: {
                                    bg: 'brand.50',
                                  },
                                  _focus: {
                                    bg: 'brand.100',
                                  },
                                })
                          }
                        >
                          <span>{pageCount}</span>
                          {isSelected && <span className={css({ fontSize: 'sm' })}>✓</span>}
                        </DropdownMenu.Item>
                      )
                    })}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
        </div>

        {/* Row 2: Problems per page dropdown + Total badge */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'row',
            gap: '3',
            alignItems: 'center',
            '@media (max-width: 444px)': {
              flexDirection: 'column',
              gap: '2',
            },
          })}
        >
          <div
            className={css({
              flex: '1',
              minWidth: 0,
            })}
          >
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
                    px: '2',
                    py: '2',
                    border: '2px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.300',
                    bg: isDark ? 'gray.700' : 'white',
                    rounded: 'lg',
                    cursor: 'pointer',
                    fontSize: 'xs',
                    fontWeight: 'medium',
                    color: isDark ? 'gray.200' : 'gray.700',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minWidth: 0,
                    gap: '2',
                    _hover: {
                      borderColor: 'brand.400',
                    },
                    '@media (max-width: 200px)': {
                      px: '1',
                      fontSize: '2xs',
                    },
                  })}
                >
                  <span
                    className={css({
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    })}
                  >
                    <span
                      className={css({
                        '@media (max-width: 250px)': {
                          display: 'none',
                        },
                      })}
                    >
                      {problemsPerPage} problems ({cols} cols × {Math.ceil(problemsPerPage / cols)}{' '}
                      rows)
                    </span>
                    <span
                      className={css({
                        display: 'none',
                        '@media (max-width: 250px)': {
                          display: 'inline',
                        },
                      })}
                    >
                      {problemsPerPage} ({cols}×{Math.ceil(problemsPerPage / cols)})
                    </span>
                  </span>
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
                          className={
                            isDark
                              ? css({
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3',
                                  px: '3',
                                  py: '2',
                                  rounded: 'md',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  bg: isSelected ? 'gray.700' : 'transparent',
                                  _hover: {
                                    bg: 'gray.700',
                                  },
                                  _focus: {
                                    bg: 'gray.600',
                                  },
                                })
                              : css({
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
                                })
                          }
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
                                  bg: isSelected ? 'brand.500' : isDark ? 'gray.500' : 'gray.400',
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
                                color: isSelected
                                  ? isDark
                                    ? 'white'
                                    : 'brand.700'
                                  : isDark
                                    ? 'gray.200'
                                    : 'gray.700',
                              })}
                            >
                              {count} problems
                            </div>
                            <div
                              className={css({
                                fontSize: 'xs',
                                color: isSelected
                                  ? isDark
                                    ? 'gray.200'
                                    : 'brand.600'
                                  : isDark
                                    ? 'gray.400'
                                    : 'gray.500',
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
              flexShrink: 0,
              '@media (max-width: 444px)': {
                flexDirection: 'row',
                justifyContent: 'space-between',
                width: '100%',
              },
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
        <div
          className={css({
            borderTop: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            pt: '3',
            mt: '1',
          })}
        >
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
              <button
                type="button"
                onClick={() => {
                  onProblemNumbersChange?.(problemNumbers === 'always' ? 'never' : 'always')
                }}
                className={css({
                  position: 'relative',
                  w: '12',
                  h: '6',
                  bg: problemNumbers === 'always' ? 'brand.500' : isDark ? 'gray.600' : 'gray.300',
                  rounded: 'full',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                })}
              >
                <div
                  className={css({
                    position: 'absolute',
                    top: '1',
                    left: problemNumbers === 'always' ? '7' : '1',
                    w: '4',
                    h: '4',
                    bg: 'white',
                    rounded: 'full',
                    transition: 'left 0.2s',
                  })}
                />
              </button>
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
              <button
                type="button"
                onClick={() => {
                  onCellBordersChange?.(cellBorders === 'always' ? 'never' : 'always')
                }}
                className={css({
                  position: 'relative',
                  w: '12',
                  h: '6',
                  bg: cellBorders === 'always' ? 'brand.500' : isDark ? 'gray.600' : 'gray.300',
                  rounded: 'full',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                })}
              >
                <div
                  className={css({
                    position: 'absolute',
                    top: '1',
                    left: cellBorders === 'always' ? '7' : '1',
                    w: '4',
                    h: '4',
                    bg: 'white',
                    rounded: 'full',
                    transition: 'left 0.2s',
                  })}
                />
              </button>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
