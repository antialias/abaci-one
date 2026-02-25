'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppNavBar } from '@/components/AppNavBar'
import { PlayerPicker } from '@/components/shared/PlayerPicker'
import { useUserPlayers } from '@/hooks/useUserPlayers'
import { usePlayerSessionPreferences } from '@/hooks/usePlayerSessionPreferences'
import { resolveKidLanguageStyle } from '@/lib/kidLanguageStyle'
import { FoundationsDeck } from '@/components/toys/euclid/foundations/FoundationsDeck'
import { css } from '../../../../../styled-system/css'

export default function EuclidFoundationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    searchParams.get('player')
  )
  const { data: players } = useUserPlayers()

  const selectedPlayer = useMemo(
    () => (selectedPlayerId ? players?.find((p) => p.id === selectedPlayerId) : null),
    [players, selectedPlayerId]
  )

  const { data: preferences } = usePlayerSessionPreferences(selectedPlayerId)
  const languageStyle = useMemo(
    () => resolveKidLanguageStyle(preferences?.kidLanguageStyle, selectedPlayer?.age),
    [preferences?.kidLanguageStyle, selectedPlayer?.age]
  )

  return (
    <div
      data-component="euclid-foundations-page"
      style={{
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: '#FAFAF0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AppNavBar
        navSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => router.push('/toys/euclid')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid rgba(203, 213, 225, 0.8)',
                background: 'rgba(255, 255, 255, 0.9)',
                color: 'rgba(55, 65, 81, 1)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Euclid
            </button>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'rgba(55, 65, 81, 0.9)',
              }}
            >
              Foundations
            </span>
            <PlayerPicker selectedPlayerId={selectedPlayerId} onSelect={setSelectedPlayerId} />
          </div>
        }
      />

      <main
        className={css({
          flex: 1,
          minHeight: 0,
          paddingTop: 'var(--app-nav-height)',
          overflowY: 'auto',
          padding: { base: '1rem', md: '1.5rem' },
        })}
      >
        <div className={css({ maxWidth: '1100px', margin: '0 auto' })}>
          <FoundationsDeck languageStyle={languageStyle} />
        </div>
      </main>
    </div>
  )
}
