'use client'

import { AppNavBar } from '@/components/AppNavBar'
import { NumberLine } from '@/components/toys/number-line/NumberLine'
import { PlayerPicker } from '@/components/toys/number-line/PlayerPicker'
import { useTheme } from '@/contexts/ThemeContext'

export default function NumberLinePage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div
      data-component="number-line-page"
      style={{
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: isDark ? '#111827' : '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AppNavBar
        navSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: isDark ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)',
              }}
            >
              📏 Number Line
            </span>
            <PlayerPicker isDark={isDark} />
          </div>
        }
      />
      <div style={{ flex: 1, minHeight: 0, paddingTop: 'var(--app-nav-height)' }}>
        <NumberLine />
      </div>
    </div>
  )
}
