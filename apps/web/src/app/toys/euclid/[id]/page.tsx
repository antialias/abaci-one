'use client'

import { useParams } from 'next/navigation'
import { AppNavBar } from '@/components/AppNavBar'
import { EuclidCanvas } from '@/components/toys/euclid/EuclidCanvas'

const PROP_TITLES: Record<number, string> = {
  1: 'Euclid I.1',
  2: 'Euclid I.2',
}

export default function EuclidPropPage() {
  const params = useParams()
  const propId = Number(params.id) || 1
  const title = PROP_TITLES[propId] ?? `Euclid I.${propId}`

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
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(55, 65, 81, 1)',
            }}
          >
            {title}
          </span>
        }
      />
      <div style={{ flex: 1, minHeight: 0, paddingTop: 'var(--app-nav-height)', touchAction: 'none' }}>
        <EuclidCanvas propositionId={propId} />
      </div>
    </div>
  )
}
