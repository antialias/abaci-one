'use client'

import { css } from '../../../../../../styled-system/css'

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
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0',
          bg: isDark ? 'gray.800' : 'gray.100',
          p: '1',
          rounded: 'lg',
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
            px: '4',
            py: '2.5',
            bg: currentMethod === 'smart' ? (isDark ? 'gray.700' : 'white') : 'transparent',
            color: currentMethod === 'smart' ? (isDark ? 'gray.100' : 'gray.900') : (isDark ? 'gray.400' : 'gray.600'),
            fontWeight: currentMethod === 'smart' ? 'semibold' : 'medium',
            fontSize: 'sm',
            rounded: 'md',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: currentMethod === 'smart' ? (isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)') : 'none',
            _hover: {
              color: isDark ? 'gray.200' : 'gray.700',
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
            px: '4',
            py: '2.5',
            bg: currentMethod === 'mastery' ? (isDark ? 'gray.700' : 'white') : 'transparent',
            color: currentMethod === 'mastery' ? (isDark ? 'gray.100' : 'gray.900') : (isDark ? 'gray.400' : 'gray.600'),
            fontWeight: currentMethod === 'mastery' ? 'semibold' : 'medium',
            fontSize: 'sm',
            rounded: 'md',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: currentMethod === 'mastery' ? (isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)') : 'none',
            _hover: {
              color: isDark ? 'gray.200' : 'gray.700',
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
