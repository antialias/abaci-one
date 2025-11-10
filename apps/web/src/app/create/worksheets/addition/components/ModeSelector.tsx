'use client'

import { css } from '../../../../../../styled-system/css'

interface ModeSelectorProps {
  currentMode: 'smart' | 'manual' | 'mastery'
  onChange: (mode: 'smart' | 'manual' | 'mastery') => void
  isDark?: boolean
}

/**
 * Mode selector tabs for worksheet generation
 * Large, prominent tabs that switch between Smart Difficulty, Manual Control, and Mastery Progression modes
 */
export function ModeSelector({ currentMode, onChange, isDark = false }: ModeSelectorProps) {
  const modes = [
    {
      id: 'smart' as const,
      emoji: '🎯',
      label: 'Smart Difficulty',
      description: 'Research-backed progressive difficulty with adaptive scaffolding per problem',
    },
    {
      id: 'manual' as const,
      emoji: '🎛️',
      label: 'Manual Control',
      description: 'Full control over display options with uniform scaffolding across all problems',
    },
    {
      id: 'mastery' as const,
      emoji: '🎓',
      label: 'Mastery Progression',
      description: 'Skill-based progression with automatic review mixing for pedagogical practice',
    },
  ]

  const currentModeData = modes.find((m) => m.id === currentMode)

  return (
    <div data-component="mode-selector-tabs">
      {/* Tab buttons */}
      <div
        className={css({
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid',
          borderColor: isDark ? 'gray.600' : 'gray.200',
        })}
      >
        {modes.map((mode) => {
          const isActive = currentMode === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              data-action={`select-${mode.id}-mode`}
              data-selected={isActive}
              onClick={() => onChange(mode.id)}
              className={css({
                flex: 1,
                padding: '1rem 1.5rem',
                border: 'none',
                borderBottom: '3px solid',
                borderBottomColor: isActive ? 'blue.500' : 'transparent',
                backgroundColor: isActive
                  ? isDark
                    ? 'gray.700'
                    : 'white'
                  : isDark
                    ? 'gray.800'
                    : 'gray.50',
                color: isActive
                  ? isDark
                    ? 'blue.300'
                    : 'blue.600'
                  : isDark
                    ? 'gray.400'
                    : 'gray.600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '0.95rem',
                fontWeight: isActive ? '700' : '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                _hover: {
                  backgroundColor: isActive
                    ? isDark
                      ? 'gray.700'
                      : 'white'
                    : isDark
                      ? 'gray.700'
                      : 'gray.100',
                  borderBottomColor: isActive ? 'blue.500' : isDark ? 'gray.500' : 'gray.400',
                  color: isActive
                    ? isDark
                      ? 'blue.300'
                      : 'blue.600'
                    : isDark
                      ? 'gray.300'
                      : 'gray.700',
                },
              })}
            >
              <span className={css({ fontSize: '1.25rem' })}>{mode.emoji}</span>
              <span>{mode.label}</span>
            </button>
          )
        })}
      </div>

      {/* Description of active mode */}
      {currentModeData && (
        <p
          className={css({
            fontSize: 'sm',
            color: isDark ? 'gray.400' : 'gray.600',
            mt: '3',
            mb: '3',
            px: '2',
            lineHeight: '1.5',
          })}
        >
          {currentModeData.description}
        </p>
      )}
    </div>
  )
}
