'use client'

import { useSearchParams } from 'next/navigation'
import { AppNavBar } from '@/components/AppNavBar'
import { EuclidCanvas } from '@/components/toys/euclid/EuclidCanvas'

export default function EuclidPlaygroundPage() {
  const searchParams = useSearchParams()
  const playerId = searchParams.get('player') || null

  return (
    <div
      data-component="euclid-playground-page"
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
          <a
            href="/toys/euclid"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(55, 65, 81, 1)',
              textDecoration: 'none',
            }}
          >
            ← Euclid&apos;s Elements
          </a>
        }
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          paddingTop: 'var(--app-nav-height)',
          touchAction: 'none',
          position: 'relative',
        }}
      >
        <EuclidCanvas propositionId={0} playgroundMode playerId={playerId} />
      </div>
    </div>
  )
}
