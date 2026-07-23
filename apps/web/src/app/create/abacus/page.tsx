'use client'

// /create/abacus — "Your Abacus": a full-bleed, Figma-style design studio for
// making your on-screen abacus a real, camera-readable object (Gitea epic #5,
// full-bleed CP1a). One shared design (columns + colors, grounded in the player's
// AbacusDisplayConfig identity) has two first-class OUTPUTS, chosen as an axis in
// the left rail rather than an up-front fork:
//   • paper markers — stick-on ArUco corners for an abacus you already own, and
//   • 3D print       — a printed frame with the markers baked in.
// Both converge on the same read-back: 📷 My Abacus finds the four markers and
// rectifies the user's N-column abacus from a camera. The immersive studio IS the
// page; the express (paper) lane never loads three.js. Absorbs the former
// /create/vision-markers and /toys/abacus-studio routes.

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AbacusMarkerSheet } from '@/components/create/abacus/AbacusMarkerSheet'
import {
  AbacusStudioProvider,
  useAbacusStudio,
} from '@/components/create/abacus/AbacusStudioContext'
import { intentOf } from '@/components/create/abacus/abacus-fabrication'
import { DesignInspectorRail } from '@/components/create/abacus/DesignInspectorRail'
import { FabricationErrorBoundary } from '@/components/create/abacus/FabricationErrorBoundary'
import { FabricationRail } from '@/components/create/abacus/FabricationRail'
import { FabricationSwitch } from '@/components/create/abacus/FabricationSwitch'
import { PageWithNav } from '@/components/PageWithNav'
import { StudioShell } from '@/components/studio/StudioShell'
import { usePlayerAbacusIdentity } from '@/hooks/usePlayerAbacusIdentity'
import { css } from '../../../../styled-system/css'

// three.js + OpenSCAD-WASM is heavy; only load it on the 3D-print target. The
// paper lane fits the far larger no-3D-printer audience and needs none of it.
const AbacusStudioViewer = dynamic(
  () => import('@/components/create/abacus/AbacusStudioViewer').then((m) => m.AbacusStudioViewer),
  {
    ssr: false,
    loading: () => (
      <div
        data-element="abacus-viewer-loading"
        className={css({
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(226,232,240,0.7)',
          fontSize: 'sm',
        })}
      >
        Loading 3D preview…
      </div>
    ),
  }
)

export default function CreateAbacusPage() {
  // Whose abacus is being made real: ?player=<id> selects a student (the studio
  // manifests their "my abacus"), absent = the signed-in user's own config. The
  // URL carries the selection so links shared across a family/classroom open on
  // the same student. A failed player fetch (revoked share, bad link) degrades to
  // the user's own abacus with a notice — the studio never dead-ends.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedPlayerId = searchParams.get('player')
  const playerIdentity = usePlayerAbacusIdentity(selectedPlayerId)
  const playerUnavailable = selectedPlayerId !== null && playerIdentity.isError

  const selectPlayer = (playerId: string | null) => {
    router.replace(playerId ? `${pathname}?player=${playerId}` : pathname, { scroll: false })
  }

  return (
    <PageWithNav navTitle="Your Abacus" navEmoji="🧮">
      <div
        data-component="create-abacus"
        className={css({
          // full-bleed: fill the viewport below the fixed nav (100dvh so the
          // mobile URL bar doesn't clip the studio).
          height: '100dvh',
          pt: 'var(--app-nav-height)',
          bg: '#0b0f14',
        })}
      >
        <AbacusStudioProvider playerId={playerUnavailable ? null : selectedPlayerId}>
          <StudioBody
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={selectPlayer}
            playerUnavailable={playerUnavailable}
          />
        </AbacusStudioProvider>
      </div>
    </PageWithNav>
  )
}

interface StudioBodyProps {
  selectedPlayerId: string | null
  onSelectPlayer: (playerId: string | null) => void
  playerUnavailable: boolean
}

// Inside the provider, so the shell's center/right can switch on the shared
// design's fabrication axis. The headline chooser (paper ↔ 3D print) rides in the
// shell's persistent top toolbar so it reads on every breakpoint; the shell swaps
// the center output (and the FDM-only fabrication rail) accordingly. Only the
// 3D-print target mounts the heavy three.js viewer + fabrication rail.
function StudioBody({ selectedPlayerId, onSelectPlayer, playerUnavailable }: StudioBodyProps) {
  const { fabrication } = useAbacusStudio()
  const isFdm = fabrication.kind === 'fdm'
  return (
    <StudioShell
      toolbar={<FabricationSwitch />}
      left={
        <DesignInspectorRail
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={onSelectPlayer}
          playerUnavailable={playerUnavailable}
        />
      }
      center={
        isFdm ? (
          <FabricationErrorBoundary label="3D preview">
            <AbacusStudioViewer />
          </FabricationErrorBoundary>
        ) : (
          <PaperMarkerCenter />
        )
      }
      right={
        isFdm ? (
          <FabricationErrorBoundary label="print panel">
            <FabricationRail />
          </FabricationErrorBoundary>
        ) : null
      }
    />
  )
}

// The paper target's center: the stick-on marker sheet, driven wholly by the
// shared design through the fabrication-neutral seam (intentOf) — column count
// AND marker size — so the paper output is provably the same design the 3D
// print renders, and cannot drift from it. Size edits route back into the
// design (set('marker_mm', …)), reshaping the FDM frame recess too.
function PaperMarkerCenter() {
  const { design, set } = useAbacusStudio()
  const intent = intentOf(design)
  return (
    <div
      data-element="abacus-tool-markers"
      className={css({
        h: 'full',
        overflow: 'auto',
        bg: 'bg.canvas',
        px: { base: 4, md: 6 },
        py: { base: 4, md: 6 },
      })}
    >
      <AbacusMarkerSheet
        columnCount={intent.columns}
        markerSizeMm={intent.markers.sizeMm}
        onMarkerSizeChange={(mm) => set('marker_mm', mm)}
      />
    </div>
  )
}
