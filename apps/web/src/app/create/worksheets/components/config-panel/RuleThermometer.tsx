'use client'

import { css } from '@styled/css'
import type { RuleMode } from '../../displayRules'
import { OperatorIcon } from './OperatorIcon'

export interface RuleThermometerProps {
  label: string
  description: string
  value: RuleMode
  onChange: (value: RuleMode) => void
  isDark?: boolean
  /** When value is 'auto', this shows which value 'auto' resolves to (single operator mode) */
  resolvedValue?: RuleMode
  /** When value is 'auto' in mixed mode, shows which value addition defers to */
  resolvedAdditionValue?: RuleMode
  /** When value is 'auto' in mixed mode, shows which value subtraction defers to */
  resolvedSubtractionValue?: RuleMode
}

const RULE_OPTIONS: Array<{ value: RuleMode; label: string; short: string }> = [
  { value: 'auto', label: 'Auto (Use Mastery Progression)', short: 'Auto' },
  { value: 'always', label: 'Always', short: 'Always' },
  { value: 'whenRegrouping', label: 'When Regrouping', short: 'Regroup' },
  { value: 'whenMultipleRegroups', label: 'Multiple Regroups', short: '2+' },
  { value: 'when3PlusDigits', label: '3+ Digits', short: '3+ dig' },
  { value: 'never', label: 'Never', short: 'Never' },
]

export function RuleThermometer({
  label,
  description,
  value,
  onChange,
  isDark = false,
  resolvedValue,
  resolvedAdditionValue,
  resolvedSubtractionValue,
}: RuleThermometerProps) {
  const selectedIndex = RULE_OPTIONS.findIndex((opt) => opt.value === value)
  const isAutoSelected = value === 'auto'
  const isMixedMode = resolvedAdditionValue !== undefined && resolvedSubtractionValue !== undefined

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5',
      })}
    >
      {/* Label */}
      <div>
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
        <div
          className={css({
            fontSize: '2xs',
            color: isDark ? 'gray.400' : 'gray.500',
            lineHeight: '1.3',
          })}
        >
          {description}
        </div>
      </div>

      {/* Horizontal thermometer */}
      <div
        className={css({
          display: 'flex',
          gap: '0',
          bg: isDark ? 'gray.700' : 'gray.100',
          rounded: 'md',
          p: '1',
          border: '1px solid',
          borderColor: isDark ? 'gray.600' : 'gray.200',
        })}
      >
        {RULE_OPTIONS.map((option, index) => {
          const isSelected = value === option.value

          // Check which operators defer to this option (for mixed mode)
          const additionDefersHere =
            isMixedMode && isAutoSelected && resolvedAdditionValue === option.value
          const subtractionDefersHere =
            isMixedMode && isAutoSelected && resolvedSubtractionValue === option.value
          const isAutoResolvedMixed = additionDefersHere || subtractionDefersHere

          // For single operator mode
          const isAutoResolved = !isMixedMode && isAutoSelected && resolvedValue === option.value

          // Determine which operator to show
          let operatorToShow: 'addition' | 'subtraction' | 'mixed' | null = null
          if (isAutoResolvedMixed) {
            if (additionDefersHere && subtractionDefersHere) {
              operatorToShow = 'mixed' // Both defer here
            } else if (additionDefersHere) {
              operatorToShow = 'addition' // Only addition
            } else if (subtractionDefersHere) {
              operatorToShow = 'subtraction' // Only subtraction
            }
          }

          const showHighlight = isAutoResolved || isAutoResolvedMixed
          const isLeftmost = index === 0
          const isRightmost = index === RULE_OPTIONS.length - 1

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              title={
                isAutoResolvedMixed && operatorToShow
                  ? `${option.label} (${operatorToShow} selected by Auto)`
                  : isAutoResolved
                    ? `${option.label} (currently selected by Auto)`
                    : option.label
              }
              className={css({
                flex: 1,
                px: '2',
                py: '1.5',
                fontSize: '2xs',
                fontWeight: isSelected ? 'bold' : showHighlight ? 'semibold' : 'medium',
                color: isSelected
                  ? 'white'
                  : showHighlight
                    ? isDark
                      ? 'green.300'
                      : 'green.700'
                    : isDark
                      ? 'gray.400'
                      : 'gray.600',
                bg: isSelected
                  ? 'brand.500'
                  : showHighlight
                    ? isDark
                      ? 'green.900/30'
                      : 'green.100'
                    : 'transparent',
                outline: showHighlight ? '1px solid' : 'none',
                outlineColor: showHighlight ? (isDark ? 'green.700' : 'green.300') : 'transparent',
                borderTopLeftRadius: isLeftmost ? 'md' : '0',
                borderBottomLeftRadius: isLeftmost ? 'md' : '0',
                borderTopRightRadius: isRightmost ? 'md' : '0',
                borderBottomRightRadius: isRightmost ? 'md' : '0',
                cursor: 'pointer',
                transition: 'all 0.15s',
                position: 'relative', // For absolute positioning of operator symbol
                _hover: {
                  bg: isSelected
                    ? 'brand.600'
                    : showHighlight
                      ? isDark
                        ? 'green.800/40'
                        : 'green.200'
                      : isDark
                        ? 'gray.600'
                        : 'gray.200',
                  color: isSelected ? 'white' : isDark ? 'gray.200' : 'gray.800',
                },
              })}
            >
              {/* Operator icon for mixed mode - positioned absolutely on left */}
              {operatorToShow && (
                <div
                  className={css({
                    position: 'absolute',
                    left: '0.25rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  })}
                >
                  <OperatorIcon operator={operatorToShow} size="lg" isDark={isDark} color="green" />
                </div>
              )}
              {option.short}
            </button>
          )
        })}
      </div>
    </div>
  )
}
