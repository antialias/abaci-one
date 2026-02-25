'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppNavBar } from '@/components/AppNavBar'
import { EuclidMap } from '@/components/toys/euclid/EuclidMap'
import { PlayerPicker } from '@/components/shared/PlayerPicker'
import { useEuclidProgress } from '@/hooks/useEuclidProgress'

export default function EuclidPage() {
  const router = useRouter()
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const { data: completedList } = useEuclidProgress(selectedPlayerId)

  const completed = useMemo(() => new Set(completedList ?? []), [completedList])

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
            <button
              type="button"
              onClick={() => {
                const params = selectedPlayerId ? `?player=${encodeURIComponent(selectedPlayerId)}` : ''
                router.push(`/toys/euclid/foundations${params}`)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid rgba(203, 213, 225, 0.8)',
                background: 'rgba(255, 255, 255, 0.9)',
                color: 'rgba(55, 65, 81, 1)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              aria-label="Open Euclid foundations"
            >
              Foundations
            </button>
            <PlayerPicker selectedPlayerId={selectedPlayerId} onSelect={setSelectedPlayerId} />
          </div>
        }
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          paddingTop: 'var(--app-nav-height)',
          position: 'relative',
        }}
      >
        <EuclidMap
          completed={completed}
          onSelectProp={(propId) => {
            const params = selectedPlayerId ? `?player=${encodeURIComponent(selectedPlayerId)}` : ''
            router.push(`/toys/euclid/${propId}${params}`)
          }}
          onSelectPlayground={() => router.push('/toys/euclid/playground')}
        />
      </div>
    </div>
  )
}
