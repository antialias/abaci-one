'use client'

import type React from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../styled-system/css'

export function ThemeToggle({ style }: { style?: React.CSSProperties } = {}) {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const cycleTheme = () => {
    // Cycle: light → dark → system → light
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getThemeLabel = () => {
    if (theme === 'system') {
      return `Auto (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`
    }
    return theme === 'dark' ? 'Dark' : 'Light'
  }

  const getThemeIcon = () => {
    if (theme === 'system') {
      return '🌗' // Half moon for system/auto
    }
    return resolvedTheme === 'dark' ? '🌙' : '☀️'
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Current theme: ${getThemeLabel()}. Click to cycle.`}
      title={`Current: ${getThemeLabel()}. Click to cycle themes.`}
      style={style}
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: '0.5rem',
        py: '0.5rem',
        bg: 'bg.surface',
        color: 'text.primary',
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        fontSize: '1.1rem',
        transition: 'all 0.2s',
        _hover: {
          bg: 'interactive.hover',
          borderColor: 'border.emphasis',
        },
      })}
    >
      {getThemeIcon()}
    </button>
  )
}
