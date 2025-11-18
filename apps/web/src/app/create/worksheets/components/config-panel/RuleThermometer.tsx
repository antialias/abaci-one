'use client'

import { css } from '@styled/css'
import type { RuleMode } from '../../displayRules'

export interface RuleThermometerProps {
  label: string
  description: string
  value: RuleMode
  onChange: (value: RuleMode) => void
  isDark?: boolean
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
}: RuleThermometerProps) {
  const selectedIndex = RULE_OPTIONS.findIndex((opt) => opt.value === value)

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
          const isLeftmost = index === 0
          const isRightmost = index === RULE_OPTIONS.length - 1

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              title={option.label}
              className={css({
                flex: 1,
                px: '2',
                py: '1.5',
                fontSize: '2xs',
                fontWeight: isSelected ? 'bold' : 'medium',
                color: isSelected ? (isDark ? 'white' : 'white') : isDark ? 'gray.400' : 'gray.600',
                bg: isSelected ? 'brand.500' : 'transparent',
                border: 'none',
                borderTopLeftRadius: isLeftmost ? 'md' : '0',
                borderBottomLeftRadius: isLeftmost ? 'md' : '0',
                borderTopRightRadius: isRightmost ? 'md' : '0',
                borderBottomRightRadius: isRightmost ? 'md' : '0',
                cursor: 'pointer',
                transition: 'all 0.15s',
                _hover: {
                  bg: isSelected ? 'brand.600' : isDark ? 'gray.600' : 'gray.200',
                  color: isSelected ? 'white' : isDark ? 'gray.200' : 'gray.800',
                },
              })}
            >
              {option.short}
            </button>
          )
        })}
      </div>
    </div>
  )
}
