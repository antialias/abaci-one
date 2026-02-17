'use client'

import { useState } from 'react'
import { AppNavBar } from '@/components/AppNavBar'
import { NumberLine } from '@/components/toys/number-line/NumberLine'
import { useTheme } from '@/contexts/ThemeContext'
import { PlayerPicker } from '@/components/shared/PlayerPicker'
import type { CallState } from '@/components/toys/number-line/talkToNumber/useRealtimeVoice'

export default function NumberLinePage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [callActive, setCallActive] = useState(false)

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: isDark ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)',
              }}
            >
              📏 Number Line
            </span>
            <PlayerPicker
              selectedPlayerId={selectedPlayerId}
              onSelect={setSelectedPlayerId}
              disabled={callActive}
              isDark={isDark}
            />
          </div>
        }
      />
      <div style={{ flex: 1, minHeight: 0, paddingTop: 'var(--app-nav-height)' }}>
        <NumberLine
          playerId={selectedPlayerId ?? undefined}
          onPlayerIdentified={(id) => setSelectedPlayerId(id)}
          onCallStateChange={(state: CallState) => setCallActive(state !== 'idle' && state !== 'error')}
        />
      </div>
    </div>
  )
}
