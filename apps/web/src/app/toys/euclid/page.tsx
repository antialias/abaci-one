'use client'

import { AppNavBar } from '@/components/AppNavBar'
import { EuclidCanvas } from '@/components/toys/euclid/EuclidCanvas'

export default function EuclidPage() {
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
            Euclid I.1
          </span>
        }
      />
      <div style={{ flex: 1, minHeight: 0, paddingTop: 'var(--app-nav-height)', touchAction: 'none' }}>
        <EuclidCanvas propositionId={1} />
      </div>
    </div>
  )
}
