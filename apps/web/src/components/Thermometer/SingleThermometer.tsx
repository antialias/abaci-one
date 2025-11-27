'use client'

import { css } from '@styled/css'
import type { SingleThermometerProps } from './types'

/**
 * A single-selection thermometer component that displays discrete options
 * in a horizontal or vertical layout. Supports custom overlay rendering
 * for additional visual indicators.
 */
export function SingleThermometer<T extends string>({
  options,
  value,
  onChange,
  orientation = 'horizontal',
  isDark = false,
  label,
  description,
  renderOverlay,
}: SingleThermometerProps<T>) {
  const isHorizontal = orientation === 'horizontal'

  return (
    <div
      data-component="single-thermometer"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5',
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

      {/* Thermometer track */}
      <div
        data-element="thermometer-track"
        className={css({
          display: 'flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          gap: '0',
          bg: isDark ? 'gray.700' : 'gray.100',
          rounded: 'md',
          p: '1',
          border: '1px solid',
          borderColor: isDark ? 'gray.600' : 'gray.200',
        })}
      >
        {options.map((option, index) => {
          const isSelected = value === option.value
          const isFirst = index === 0
          const isLast = index === options.length - 1

          return (
            <button
              key={option.value}
              type="button"
              data-option={option.value}
              data-selected={isSelected}
              onClick={() => onChange(option.value)}
              title={option.label}
              className={css({
                flex: 1,
                px: '2',
                py: '1.5',
                fontSize: '2xs',
                fontWeight: isSelected ? 'bold' : 'medium',
                color: isSelected ? 'white' : isDark ? 'gray.400' : 'gray.600',
                bg: isSelected ? 'brand.500' : 'transparent',
                // Rounded corners only on edges
                borderTopLeftRadius: isHorizontal ? (isFirst ? 'md' : '0') : isFirst ? 'md' : '0',
                borderBottomLeftRadius: isHorizontal ? (isFirst ? 'md' : '0') : isLast ? 'md' : '0',
                borderTopRightRadius: isHorizontal ? (isLast ? 'md' : '0') : isFirst ? 'md' : '0',
                borderBottomRightRadius: isHorizontal ? (isLast ? 'md' : '0') : isLast ? 'md' : '0',
                cursor: 'pointer',
                transition: 'all 0.15s',
                position: 'relative',
                _hover: {
                  bg: isSelected ? 'brand.600' : isDark ? 'gray.600' : 'gray.200',
                  color: isSelected ? 'white' : isDark ? 'gray.200' : 'gray.800',
                },
              })}
            >
              {/* Custom overlay content (e.g., auto-resolve indicator) */}
              {renderOverlay?.(option, index, isSelected)}

              {/* Option content */}
              <span className={css({ display: 'flex', alignItems: 'center', gap: '1' })}>
                {option.emoji && <span>{option.emoji}</span>}
                <span>{option.shortLabel || option.label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
