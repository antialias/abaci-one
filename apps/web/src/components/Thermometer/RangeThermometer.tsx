'use client'

import { css } from '@styled/css'
import * as Slider from '@radix-ui/react-slider'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RangeThermometerProps } from './types'

/**
 * A range thermometer component that displays discrete options with two handles
 * for selecting a min/max range. Uses Radix Slider for accessibility and interaction.
 */
export function RangeThermometer<T extends string>({
  options,
  minValue,
  maxValue,
  onChange,
  orientation = 'vertical',
  isDark = false,
  label,
  description,
  counts,
  showTotalCount = true,
  onHoverPreview,
}: RangeThermometerProps<T>) {
  const isVertical = orientation === 'vertical'
  const [isDragging, setIsDragging] = useState(false)

  // Track last sent values to prevent duplicate onChange calls during async updates
  const lastSentRef = useRef<[number, number] | null>(null)

  // Sync ref when props change from outside (e.g., parent resets values)
  useEffect(() => {
    const currentMinIndex = options.findIndex((opt) => opt.value === minValue)
    const currentMaxIndex = options.findIndex((opt) => opt.value === maxValue)
    // Only sync if we're not dragging (to avoid overwriting during drag)
    if (!isDragging) {
      lastSentRef.current = [currentMinIndex, currentMaxIndex]
    }
  }, [minValue, maxValue, options, isDragging])

  // Convert values to indices - memoize to prevent recalculation
  const minIndex = useMemo(
    () => options.findIndex((opt) => opt.value === minValue),
    [options, minValue]
  )
  const maxIndex = useMemo(
    () => options.findIndex((opt) => opt.value === maxValue),
    [options, maxValue]
  )

  // Handle slider value changes - memoized to prevent Slider re-renders
  // Only call onChange when values actually change to prevent server thrashing
  const handleValueChange = useCallback(
    (values: number[]) => {
      const [newMinIndex, newMaxIndex] = values
      const last = lastSentRef.current

      // Only fire if values differ from what we last sent (not props, which may be stale)
      if (!last || newMinIndex !== last[0] || newMaxIndex !== last[1]) {
        lastSentRef.current = [newMinIndex, newMaxIndex]
        onChange(options[newMinIndex].value, options[newMaxIndex].value)
      }
    },
    [onChange, options]
  )

  // Calculate what the range would be if clicking on a specific option
  // (moves nearest handle to that position)
  const getPreviewRange = useCallback(
    (hoveredIndex: number): { previewMin: T; previewMax: T } => {
      const distToMin = Math.abs(hoveredIndex - minIndex)
      const distToMax = Math.abs(hoveredIndex - maxIndex)
      if (distToMin <= distToMax) {
        // Would move min handle
        return {
          previewMin: options[hoveredIndex].value,
          previewMax: options[maxIndex].value,
        }
      } else {
        // Would move max handle
        return {
          previewMin: options[minIndex].value,
          previewMax: options[hoveredIndex].value,
        }
      }
    },
    [options, minIndex, maxIndex]
  )

  // Handle hover enter on an option - memoized
  // Skip hover events while dragging to prevent interference
  const handleOptionHover = useCallback(
    (index: number) => {
      if (onHoverPreview && !isDragging) {
        onHoverPreview(getPreviewRange(index))
      }
    },
    [onHoverPreview, getPreviewRange, isDragging]
  )

  // Handle hover leave - memoized
  // Skip hover events while dragging to prevent interference
  const handleOptionLeave = useCallback(() => {
    if (onHoverPreview && !isDragging) {
      onHoverPreview(null)
    }
  }, [onHoverPreview, isDragging])

  // Handle drag start/end for the slider
  const handlePointerDown = useCallback(() => {
    setIsDragging(true)
    // Clear any existing preview when starting to drag
    if (onHoverPreview) {
      onHoverPreview(null)
    }
  }, [onHoverPreview])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Listen for global pointer up to handle drag release anywhere on screen
  useEffect(() => {
    if (isDragging) {
      const handleGlobalPointerUp = () => {
        setIsDragging(false)
      }
      window.addEventListener('pointerup', handleGlobalPointerUp)
      window.addEventListener('pointercancel', handleGlobalPointerUp)
      return () => {
        window.removeEventListener('pointerup', handleGlobalPointerUp)
        window.removeEventListener('pointercancel', handleGlobalPointerUp)
      }
    }
  }, [isDragging])

  // Calculate total count for selected range
  const totalCount = useMemo(() => {
    if (!counts || !showTotalCount) return null
    let total = 0
    for (let i = minIndex; i <= maxIndex; i++) {
      const opt = options[i]
      total += counts[opt.value] || 0
    }
    return total
  }, [counts, showTotalCount, options, minIndex, maxIndex])

  // Check if an option is within the selected range
  const isInRange = (index: number) => index >= minIndex && index <= maxIndex

  return (
    <div
      data-component="range-thermometer"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '2',
      })}
    >
      {/* Label and description */}
      {(label || description) && (
        <div>
          {label && (
            <div
              className={css({
                fontSize: 'xs',
                fontWeight: 'semibold',
                color: isDark ? 'gray.300' : 'gray.700',
                mb: '0.5',
              })}
            >
              {label}
            </div>
          )}
          {description && (
            <div
              className={css({
                fontSize: '2xs',
                color: isDark ? 'gray.400' : 'gray.500',
                lineHeight: '1.3',
              })}
            >
              {description}
            </div>
          )}
        </div>
      )}

      {/* Main container with labels and slider */}
      <div
        data-element="range-thermometer-track"
        className={css({
          display: 'flex',
          flexDirection: isVertical ? 'row' : 'column',
          gap: '2',
        })}
      >
        {/* Labels column */}
        <div
          className={css({
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            justifyContent: 'space-between',
            flex: isVertical ? 'none' : 1,
          })}
        >
          {options.map((option, index) => {
            const inRange = isInRange(index)
            const count = counts?.[option.value]

            return (
              <button
                key={option.value}
                type="button"
                data-option={option.value}
                data-in-range={inRange}
                onClick={() => {
                  // Click moves nearest handle to this position
                  const distToMin = Math.abs(index - minIndex)
                  const distToMax = Math.abs(index - maxIndex)
                  if (distToMin <= distToMax) {
                    onChange(option.value, options[maxIndex].value)
                  } else {
                    onChange(options[minIndex].value, option.value)
                  }
                }}
                onMouseEnter={() => handleOptionHover(index)}
                onMouseLeave={handleOptionLeave}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                  py: '1',
                  px: '2',
                  rounded: 'md',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  bg: inRange ? (isDark ? 'blue.900/40' : 'blue.50') : 'transparent',
                  opacity: inRange ? 1 : 0.5,
                  _hover: {
                    bg: isDark ? 'gray.700' : 'gray.100',
                    opacity: 1,
                  },
                })}
              >
                {/* Emoji */}
                {option.emoji && <span className={css({ fontSize: 'sm' })}>{option.emoji}</span>}

                {/* Label */}
                <span
                  className={css({
                    fontSize: 'xs',
                    fontWeight: inRange ? '600' : '500',
                    color: inRange
                      ? isDark
                        ? 'blue.300'
                        : 'blue.700'
                      : isDark
                        ? 'gray.400'
                        : 'gray.600',
                    flex: 1,
                    textAlign: 'left',
                  })}
                >
                  {option.shortLabel || option.label}
                </span>

                {/* Count badge */}
                {count !== undefined && (
                  <span
                    className={css({
                      fontSize: '2xs',
                      fontWeight: '600',
                      color: inRange
                        ? isDark
                          ? 'blue.200'
                          : 'blue.600'
                        : isDark
                          ? 'gray.500'
                          : 'gray.400',
                      bg: inRange
                        ? isDark
                          ? 'blue.800'
                          : 'blue.100'
                        : isDark
                          ? 'gray.700'
                          : 'gray.200',
                      px: '1.5',
                      py: '0.5',
                      rounded: 'full',
                      minWidth: '6',
                      textAlign: 'center',
                    })}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Slider track */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isVertical ? '8' : 'auto',
            height: isVertical ? 'auto' : '8',
            minHeight: isVertical ? '180px' : 'auto',
          })}
        >
          <Slider.Root
            value={[minIndex, maxIndex]}
            min={0}
            max={options.length - 1}
            step={1}
            orientation={isVertical ? 'vertical' : 'horizontal'}
            inverted={isVertical} // Vertical sliders need inversion so top = index 0
            onValueChange={handleValueChange}
            onPointerDown={handlePointerDown}
            className={css({
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              userSelect: 'none',
              touchAction: 'none',
              width: isVertical ? '3' : '100%',
              height: isVertical ? '100%' : '3',
            })}
          >
            <Slider.Track
              className={css({
                bg: isDark ? 'gray.700' : 'gray.200',
                position: 'relative',
                flexGrow: 1,
                rounded: 'full',
                width: isVertical ? '3' : '100%',
                height: isVertical ? '100%' : '3',
              })}
            >
              <Slider.Range
                className={css({
                  position: 'absolute',
                  bg: isDark ? 'blue.600' : 'blue.500',
                  rounded: 'full',
                  width: isVertical ? '100%' : 'auto',
                  height: isVertical ? 'auto' : '100%',
                })}
              />
            </Slider.Track>

            {/* Min thumb */}
            <Slider.Thumb
              data-handle="min"
              className={css({
                display: 'block',
                w: '4',
                h: '4',
                bg: 'white',
                border: '2px solid',
                borderColor: isDark ? 'blue.400' : 'blue.500',
                rounded: 'full',
                cursor: 'grab',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                _hover: {
                  bg: isDark ? 'blue.100' : 'blue.50',
                  transform: 'scale(1.1)',
                },
                _focus: {
                  outline: 'none',
                  boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
                },
                _active: {
                  cursor: 'grabbing',
                },
              })}
            />

            {/* Max thumb */}
            <Slider.Thumb
              data-handle="max"
              className={css({
                display: 'block',
                w: '4',
                h: '4',
                bg: 'white',
                border: '2px solid',
                borderColor: isDark ? 'blue.400' : 'blue.500',
                rounded: 'full',
                cursor: 'grab',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                _hover: {
                  bg: isDark ? 'blue.100' : 'blue.50',
                  transform: 'scale(1.1)',
                },
                _focus: {
                  outline: 'none',
                  boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
                },
                _active: {
                  cursor: 'grabbing',
                },
              })}
            />
          </Slider.Root>
        </div>
      </div>

      {/* Total count display */}
      {totalCount !== null && (
        <div
          data-element="total-count"
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1',
            py: '1.5',
            px: '2',
            bg: isDark ? 'blue.900/30' : 'blue.50',
            rounded: 'md',
            border: '1px solid',
            borderColor: isDark ? 'blue.800' : 'blue.200',
          })}
        >
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'bold',
              color: isDark ? 'blue.300' : 'blue.700',
            })}
          >
            {totalCount}
          </span>
          <span
            className={css({
              fontSize: 'xs',
              color: isDark ? 'blue.400' : 'blue.600',
            })}
          >
            regions
          </span>
        </div>
      )}
    </div>
  )
}
