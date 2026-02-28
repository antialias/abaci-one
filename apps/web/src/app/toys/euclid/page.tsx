'use client'

import { useMemo, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppNavBar } from '@/components/AppNavBar'
import { PlayerPicker } from '@/components/shared/PlayerPicker'
import { useUserPlayers } from '@/hooks/useUserPlayers'
import { usePlayerSessionPreferences } from '@/hooks/usePlayerSessionPreferences'
import { useEuclidProgress } from '@/hooks/useEuclidProgress'
import { resolveKidLanguageStyle } from '@/lib/kidLanguageStyle'
import { getAgeFromBirthday } from '@/lib/playerAge'
import { FoundationsDeck } from '@/components/toys/euclid/foundations/FoundationsDeck'
import type { FoundationCategory } from '@/components/toys/euclid/foundations/foundationsData'
import { css } from '../../../../styled-system/css'

export default function EuclidPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    searchParams.get('player')
  )
  const focusId = searchParams.get('focus')
  const activeTab = (searchParams.get('tab') as FoundationCategory) || 'propositions'
  const { data: players } = useUserPlayers()

  const selectedPlayer = useMemo(
    () => (selectedPlayerId ? players?.find((p) => p.id === selectedPlayerId) : null),
    [players, selectedPlayerId]
  )

  const { data: preferences } = usePlayerSessionPreferences(selectedPlayerId)
  const languageStyle = useMemo(
    () =>
      resolveKidLanguageStyle(
        preferences?.kidLanguageStyle,
        getAgeFromBirthday(selectedPlayer?.birthday)
      ),
    [preferences?.kidLanguageStyle, selectedPlayer?.birthday]
  )

  const { data: completedList } = useEuclidProgress(selectedPlayerId)
  const completed = useMemo(() => new Set(completedList ?? []), [completedList])

  const handleTabChange = useCallback(
    (tab: FoundationCategory) => {
      const params = new URLSearchParams()
      params.set('tab', tab)
      if (selectedPlayerId) params.set('player', selectedPlayerId)
      router.replace(`/toys/euclid?${params.toString()}`, { scroll: false })
    },
    [router, selectedPlayerId]
  )

  const handleFocusChange = useCallback(
    (id: string) => {
      const params = new URLSearchParams()
      params.set('tab', activeTab)
      params.set('focus', id)
      if (selectedPlayerId) params.set('player', selectedPlayerId)
      router.replace(`/toys/euclid?${params.toString()}`, { scroll: false })
    },
    [router, activeTab, selectedPlayerId]
  )

  return (
    <div
      data-component="euclid-page"
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
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'rgba(55, 65, 81, 1)',
              }}
            >
              Euclid
            </span>
            <PlayerPicker selectedPlayerId={selectedPlayerId} onSelect={setSelectedPlayerId} />
          </div>
        }
      />

      <main
        className={css({
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingTop: { base: 'calc(var(--app-nav-height) + 16px)' },
          paddingX: { base: '1rem', md: '1.5rem' },
          paddingBottom: { base: '1rem', md: '1.5rem' },
          display: 'flex',
          flexDirection: 'column',
        })}
      >
        <div
          className={css({
            maxWidth: '1100px',
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
          })}
        >
          <FoundationsDeck
            languageStyle={languageStyle}
            focusId={focusId}
            onFocusChange={handleFocusChange}
            completed={completed}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onSelectProp={(propId) => {
              const params = selectedPlayerId
                ? `?player=${encodeURIComponent(selectedPlayerId)}`
                : ''
              router.push(`/toys/euclid/${propId}${params}`)
            }}
          />
        </div>
      </main>
    </div>
  )
}
