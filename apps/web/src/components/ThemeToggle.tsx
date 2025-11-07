'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../styled-system/css'

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        px: '1rem',
        py: '0.5rem',
        bg: 'bg.surface',
        color: 'text.primary',
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: '500',
        transition: 'all 0.2s',
        _hover: {
          bg: 'interactive.hover',
          borderColor: 'border.emphasis',
        },
      })}
    >
      {resolvedTheme === 'dark' ? '☀️' : '🌙'}
      <span>{resolvedTheme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  )
}
