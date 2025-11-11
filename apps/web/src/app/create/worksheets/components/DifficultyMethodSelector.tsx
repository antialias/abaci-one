'use client'

import { css } from '@styled/css'

interface DifficultyMethodSelectorProps {
  currentMethod: 'smart' | 'mastery'
  onChange: (method: 'smart' | 'mastery') => void
  isDark?: boolean
}

export function DifficultyMethodSelector({
  currentMethod,
  onChange,
  isDark = false,
}: DifficultyMethodSelectorProps) {
  return (
    <div data-component="difficulty-method-selector">
      {/* Tab buttons */}
      <div
        className={css({
          display: 'flex',
          gap: '0',
          borderBottom: '2px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        {/* Smart Difficulty Tab */}
        <button
          type="button"
          data-action="select-smart"
          onClick={() => onChange('smart')}
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2',
            px: '5',
            py: '3',
            flex: '1',
            bg: currentMethod === 'smart' ? (isDark ? 'gray.800' : 'white') : 'transparent',
            color:
              currentMethod === 'smart'
                ? isDark
                  ? 'brand.300'
                  : 'brand.600'
                : isDark
                  ? 'gray.500'
                  : 'gray.500',
            fontWeight: currentMethod === 'smart' ? 'bold' : 'medium',
            fontSize: 'sm',
            borderTopLeftRadius: 'lg',
            borderTopRightRadius: 'lg',
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderBottom: '3px solid',
            borderColor:
              currentMethod === 'smart' ? (isDark ? 'brand.500' : 'brand.500') : 'transparent',
            mb: '-2px',
            _hover: {
              color:
                currentMethod === 'smart'
                  ? isDark
                    ? 'brand.200'
                    : 'brand.700'
                  : isDark
                    ? 'gray.400'
                    : 'gray.600',
              bg:
                currentMethod === 'smart'
                  ? isDark
                    ? 'gray.800'
                    : 'white'
                  : isDark
                    ? 'gray.800/30'
                    : 'gray.50',
            },
          })}
        >
          <span>🎯</span>
          <span>Smart Difficulty</span>
        </button>

        {/* Mastery Progression Tab */}
        <button
          type="button"
          data-action="select-mastery"
          onClick={() => onChange('mastery')}
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2',
            px: '5',
            py: '3',
            flex: '1',
            bg: currentMethod === 'mastery' ? (isDark ? 'gray.800' : 'white') : 'transparent',
            color:
              currentMethod === 'mastery'
                ? isDark
                  ? 'brand.300'
                  : 'brand.600'
                : isDark
                  ? 'gray.500'
                  : 'gray.500',
            fontWeight: currentMethod === 'mastery' ? 'bold' : 'medium',
            fontSize: 'sm',
            borderTopLeftRadius: 'lg',
            borderTopRightRadius: 'lg',
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderBottom: '3px solid',
            borderColor:
              currentMethod === 'mastery' ? (isDark ? 'brand.500' : 'brand.500') : 'transparent',
            mb: '-2px',
            _hover: {
              color:
                currentMethod === 'mastery'
                  ? isDark
                    ? 'brand.200'
                    : 'brand.700'
                  : isDark
                    ? 'gray.400'
                    : 'gray.600',
              bg:
                currentMethod === 'mastery'
                  ? isDark
                    ? 'gray.800'
                    : 'white'
                  : isDark
                    ? 'gray.800/30'
                    : 'gray.50',
            },
          })}
        >
          <span>🎓</span>
          <span>Mastery Progression</span>
        </button>
      </div>

      {/* Description text */}
      <div
        className={css({
          mt: '2',
          px: '1',
          fontSize: 'xs',
          color: isDark ? 'gray.400' : 'gray.600',
          textAlign: 'center',
        })}
      >
        {currentMethod === 'smart'
          ? 'Choose a difficulty preset, then customize display options below'
          : 'Follow a structured skill progression with recommended scaffolding'}
      </div>
    </div>
  )
}
