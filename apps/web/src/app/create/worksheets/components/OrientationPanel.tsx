'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import { css } from '@styled/css'
import { useEffect, useRef, useState } from 'react'
import { getDefaultColsForProblemsPerPage } from '../utils/layoutCalculations'
import type { ProblemSpaceValidation } from '../utils/validateProblemSpace'
import { validateProblemSpace } from '../utils/validateProblemSpace'
import { LayoutPreview } from './config-sidebar/LayoutPreview'

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
  mode?: 'custom' | 'mastery'
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
  mode = 'custom',
  problemNumbers = 'always',
  cellBorders = 'always',
  onProblemNumbersChange,
  onCellBordersChange,
}: OrientationPanelProps) {
  // Calculate best problems per page for an orientation to minimize total change
  const getBestProblemsPerPage = (targetOrientation: 'portrait' | 'landscape') => {
    const currentTotal = problemsPerPage * pages
    const options = targetOrientation === 'portrait' ? [6, 8, 10, 12, 15] : [8, 10, 12, 15, 16, 20]

    let bestOption = options[options.length - 1] // default to largest
    let smallestDiff = Math.abs(bestOption * pages - currentTotal)

    for (const option of options) {
      const diff = Math.abs(option * pages - currentTotal)
      if (diff < smallestDiff) {
        smallestDiff = diff
        bestOption = option
      }
    }

    return bestOption
  }

  const handleOrientationChange = (newOrientation: 'portrait' | 'landscape') => {
    const newProblemsPerPage = getBestProblemsPerPage(newOrientation)
    const newCols = getDefaultColsForProblemsPerPage(newProblemsPerPage, newOrientation)
    onOrientationChange(newOrientation, newProblemsPerPage, newCols)
  }

  const handleProblemsPerPageChange = (count: number) => {
    const newCols = getDefaultColsForProblemsPerPage(count, orientation)
    onProblemsPerPageChange(count, newCols)
  }

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track container width to determine which buttons are visible
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // All possible page options
  const allPageOptions = [1, 2, 3, 4, 10, 25, 50, 100]

  // Determine which buttons are visible based on container width
  const getVisibleButtonCount = (): number => {
    if (containerWidth <= 280) return 4
    if (containerWidth <= 320) return 6
    return 8 // Show all options as buttons
  }

  const visibleButtonCount = getVisibleButtonCount()
  const visibleButtons = allPageOptions.slice(0, visibleButtonCount)
  const dropdownOptions = allPageOptions.slice(visibleButtonCount)

  const problemsForOrientation =
    orientation === 'portrait' ? [6, 8, 10, 12, 15] : [8, 10, 12, 15, 16, 20]

  /**
   * Get validation result for a specific page count
   * Uses the same validateProblemSpace() function as the banner warning
   */
  const getValidationForPageCount = (pageCount: number): ProblemSpaceValidation | null => {
    // Skip validation for mastery + mixed mode (same logic as WorksheetPreviewContext)
    if (mode === 'mastery' && operator === 'mixed') {
      return null
    }
    return validateProblemSpace(problemsPerPage, pageCount, digitRange, pAnyStart, operator)
  }

  /**
   * Map duplicate risk levels to UI warning states
   * - none: No visual warning (green/default)
   * - low/medium: Caution (yellow)
   * - high/extreme: Danger (red)
   */
  const getRiskLevel = (
    validation: ProblemSpaceValidation | null
  ): 'none' | 'caution' | 'danger' => {
    if (!validation) return 'none'
    const { duplicateRisk } = validation
    if (duplicateRisk === 'none') return 'none'
    if (duplicateRisk === 'low' || duplicateRisk === 'medium') return 'caution'
    return 'danger' // high or extreme
  }

  /**
   * Format validation warnings for tooltip display
   */
  const getTooltipMessage = (validation: ProblemSpaceValidation | null): string | null => {
    if (!validation || validation.warnings.length === 0) return null
    return validation.warnings.join('\n\n')
  }

  /**
   * Get the mildest (most severe) warning among dropdown items
   * Returns 'none' if no warnings, 'caution' if any caution, 'danger' if any danger
   */
  const getDropdownMildestWarning = (): 'none' | 'caution' | 'danger' => {
    let hasCaution = false
    let hasDanger = false

    for (const pageCount of dropdownOptions) {
      const risk = getRiskLevel(getValidationForPageCount(pageCount))
      if (risk === 'danger') hasDanger = true
      if (risk === 'caution') hasCaution = true
    }

    if (hasDanger) return 'danger'
    if (hasCaution) return 'caution'
    return 'none'
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
        overflowX: 'hidden',
        overflowY: 'auto',
        containerType: 'inline-size',
        '@container (max-width: 400px)': {
          p: '3',
        },
        '@container (max-width: 300px)': {
          p: '2',
        },
      })}
    >
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '3',
          '@container (min-width: 400px)': {
            gap: '4',
          },
        })}
      >
        {/* Orientation + Pages - Always stacked for better visual hierarchy */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '3',
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
                '@container (min-width: 400px)': {
                  mb: '2',
                },
              })}
            >
              Orientation
            </div>
            <div
              className={css({
                display: 'flex',
                gap: '2',
                width: '100%',
                '@container (min-width: 500px)': {
                  gap: '3',
                },
              })}
            >
              <div
                className={css({
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                {(() => {
                  const portraitProblemsPerPage =
                    orientation === 'portrait'
                      ? problemsPerPage
                      : getBestProblemsPerPage('portrait')
                  const portraitCols = getDefaultColsForProblemsPerPage(
                    portraitProblemsPerPage,
                    'portrait'
                  )
                  return (
                    <LayoutPreview
                      orientation="portrait"
                      cols={portraitCols}
                      rows={Math.ceil(portraitProblemsPerPage / portraitCols)}
                      onClick={() => handleOrientationChange('portrait')}
                      isSelected={orientation === 'portrait'}
                      maxSize={80}
                    />
                  )
                })()}
              </div>
              <div
                className={css({
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                {(() => {
                  const landscapeProblemsPerPage =
                    orientation === 'landscape'
                      ? problemsPerPage
                      : getBestProblemsPerPage('landscape')
                  const landscapeCols = getDefaultColsForProblemsPerPage(
                    landscapeProblemsPerPage,
                    'landscape'
                  )
                  return (
                    <LayoutPreview
                      orientation="landscape"
                      cols={landscapeCols}
                      rows={Math.ceil(landscapeProblemsPerPage / landscapeCols)}
                      onClick={() => handleOrientationChange('landscape')}
                      isSelected={orientation === 'landscape'}
                      maxSize={80}
                    />
                  )
                })()}
              </div>
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
                '@container (min-width: 400px)': {
                  mb: '2',
                },
              })}
            >
              Pages
            </div>
            <div
              ref={containerRef}
              className={css({
                display: 'flex',
                gap: '1',
                alignItems: 'center',
                width: '100%',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
              })}
            >
              {/* Quick select buttons - dynamically shown based on container width */}
              {visibleButtons.map((pageCount) => {
                const isSelected = pages === pageCount
                const validation = getValidationForPageCount(pageCount)
                const risk = getRiskLevel(validation)
                const tooltipMessage = getTooltipMessage(validation)

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
                      '@container (max-width: 280px)': {
                        w: '7',
                        h: '7',
                        fontSize: '2xs',
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
                      <Tooltip.Root delayDuration={0} disableHoverableContent={true}>
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

              {/* Dropdown for remaining options (only if more than one option) */}
              {dropdownOptions.length === 1 ? (
                // Render single dropdown option as a button
                (() => {
                  const pageCount = dropdownOptions[0]
                  const isSelected = pages === pageCount
                  const validation = getValidationForPageCount(pageCount)
                  const risk = getRiskLevel(validation)
                  const tooltipMessage = getTooltipMessage(validation)

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
                        '@container (max-width: 280px)': {
                          w: '7',
                          h: '7',
                          fontSize: '2xs',
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
                        <Tooltip.Root delayDuration={0} disableHoverableContent={true}>
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
                })()
              ) : dropdownOptions.length > 1 ? (
                <DropdownMenu.Root open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <Tooltip.Provider>
                    <Tooltip.Root
                      delayDuration={0}
                      disableHoverableContent={true}
                      open={
                        !dropdownOpen &&
                        dropdownOptions.includes(pages) &&
                        getTooltipMessage(getValidationForPageCount(pages)) !== null
                          ? undefined
                          : false
                      }
                    >
                      <Tooltip.Trigger asChild>
                        <DropdownMenu.Trigger asChild>
                          <button
                            type="button"
                            data-action="open-pages-dropdown"
                            className={css({
                              minW: '8',
                              h: '8',
                              px: '2',
                              border: '2px solid',
                              borderColor: dropdownOptions.includes(pages)
                                ? 'brand.500'
                                : isDark
                                  ? 'gray.600'
                                  : 'gray.300',
                              bg: dropdownOptions.includes(pages)
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
                              color: dropdownOptions.includes(pages)
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
                              position: 'relative',
                              _hover: {
                                borderColor: 'brand.400',
                              },
                              '@container (max-width: 280px)': {
                                minW: '7',
                                h: '7',
                                fontSize: '2xs',
                              },
                            })}
                          >
                            {dropdownOptions.includes(pages)
                              ? pages
                              : dropdownOptions.length > 0
                                ? `${dropdownOptions[0]}+`
                                : '•••'}
                            <span className={css({ fontSize: '2xs', opacity: 0.7 })}>▼</span>
                            {/* Warning indicator dot - shows mildest warning from all dropdown items */}
                            {getDropdownMildestWarning() !== 'none' && (
                              <span
                                className={css({
                                  position: 'absolute',
                                  top: '-1',
                                  right: '-1',
                                  w: '2',
                                  h: '2',
                                  bg:
                                    getDropdownMildestWarning() === 'danger'
                                      ? 'red.500'
                                      : 'yellow.500',
                                  rounded: 'full',
                                })}
                              />
                            )}
                          </button>
                        </DropdownMenu.Trigger>
                      </Tooltip.Trigger>
                      {dropdownOptions.includes(pages) &&
                        getTooltipMessage(getValidationForPageCount(pages)) && (
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
                              {getTooltipMessage(getValidationForPageCount(pages))}
                              <Tooltip.Arrow
                                className={css({
                                  fill: isDark ? 'gray.800' : 'white',
                                })}
                              />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        )}
                    </Tooltip.Root>
                  </Tooltip.Provider>

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
                      {dropdownOptions.map((pageCount) => {
                        const isSelected = pages === pageCount
                        const validation = getValidationForPageCount(pageCount)
                        const risk = getRiskLevel(validation)
                        const tooltipMessage = getTooltipMessage(validation)

                        const menuItem = (
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
                                    gap: '2',
                                    px: '3',
                                    py: '2',
                                    rounded: 'md',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    fontSize: 'sm',
                                    fontWeight: isSelected ? 'semibold' : 'medium',
                                    color: isSelected ? 'brand.200' : 'gray.200',
                                    bg: isSelected ? 'gray.700' : 'transparent',
                                    position: 'relative',
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
                                    gap: '2',
                                    px: '3',
                                    py: '2',
                                    rounded: 'md',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    fontSize: 'sm',
                                    fontWeight: isSelected ? 'semibold' : 'medium',
                                    color: isSelected ? 'brand.700' : 'gray.700',
                                    bg: isSelected ? 'brand.50' : 'transparent',
                                    position: 'relative',
                                    _hover: {
                                      bg: 'brand.50',
                                    },
                                    _focus: {
                                      bg: 'brand.100',
                                    },
                                  })
                            }
                          >
                            <div
                              className={css({
                                display: 'flex',
                                gap: '2',
                                alignItems: 'center',
                              })}
                            >
                              {/* Warning indicator dot (same style as page buttons 1-3) */}
                              {risk !== 'none' && (
                                <span
                                  className={css({
                                    w: '2',
                                    h: '2',
                                    bg: risk === 'danger' ? 'red.500' : 'yellow.500',
                                    rounded: 'full',
                                    flexShrink: 0,
                                  })}
                                />
                              )}
                              <span>{pageCount} pages</span>
                            </div>
                            <div
                              className={css({
                                display: 'flex',
                                gap: '2',
                                alignItems: 'center',
                              })}
                            >
                              {isSelected && <span className={css({ fontSize: 'sm' })}>✓</span>}
                            </div>
                          </DropdownMenu.Item>
                        )

                        // Wrap in tooltip if there's a warning message
                        if (tooltipMessage) {
                          return (
                            <Tooltip.Provider key={pageCount}>
                              <Tooltip.Root delayDuration={0} disableHoverableContent={true}>
                                <Tooltip.Trigger asChild>{menuItem}</Tooltip.Trigger>
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
                                      maxW: '80',
                                      fontSize: 'xs',
                                      lineHeight: '1.5',
                                      whiteSpace: 'pre-wrap',
                                      zIndex: 10000,
                                    })}
                                    side="left"
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

                        return menuItem
                      })}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              ) : null}
            </div>
          </div>
        </div>

        {/* Problems per page dropdown */}
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
              '@container (min-width: 400px)': {
                mb: '2',
              },
            })}
          >
            Problems per Page
          </div>
          <div>
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
                    {problemsPerPage} problems ({cols} cols × {Math.ceil(problemsPerPage / cols)}{' '}
                    rows)
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
        </div>

        {/* Layout Options */}
        <div
          className={css({
            borderTop: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            pt: '3',
            '@container (min-width: 400px)': {
              pt: '4',
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
              mb: '2',
              '@container (min-width: 400px)': {
                mb: '3',
              },
            })}
          >
            Layout Options
          </div>

          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '2',
              '@container (min-width: 400px)': {
                gap: '3',
              },
            })}
          >
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
