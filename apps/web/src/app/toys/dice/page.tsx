'use client'

import { AppNavBar } from '@/components/AppNavBar'
import { DiceTray } from '@/components/toys/dice/DiceTray'
import { useTheme } from '@/contexts/ThemeContext'

export default function DicePage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div
      data-component="dice-page"
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: isDark ? '#111827' : '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AppNavBar
        navSlot={
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: isDark ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)',
            }}
          >
            🎲 Dice
          </span>
        }
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <DiceTray />
      </div>
    </div>
  )
}
