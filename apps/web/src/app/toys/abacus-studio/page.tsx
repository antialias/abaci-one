'use client'

// Abacus Studio — design-your-own printable abacus (Gitea epic #5, Phase 0 #6).
// Full-bleed three.js viewport pinned below the fixed AppNavBar. Intentionally
// NOT added to the /toys hub registry yet — this is the Phase 0 graduation
// surface, reachable by direct URL while it firms up.

import { AppNavBar } from '@/components/AppNavBar'
import { AbacusStudioViewer } from '@/components/toys/abacus-studio/AbacusStudioViewer'

export default function AbacusStudioPage() {
  return (
    <div
      data-component="abacus-studio-page"
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#15181c' }}
    >
      <AppNavBar
        navSlot={
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(209,213,219,1)' }}>
            🧮 Abacus Studio
          </span>
        }
      />
      <div
        style={{
          position: 'fixed',
          top: 'var(--app-nav-height)',
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <AbacusStudioViewer />
      </div>
    </div>
  )
}
