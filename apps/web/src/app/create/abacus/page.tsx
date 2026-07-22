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
import { useState } from 'react'
import { AbacusMarkerSheet } from '@/components/create/abacus/AbacusMarkerSheet'
import {
  AbacusStudioProvider,
  useAbacusStudio,
} from '@/components/create/abacus/AbacusStudioContext'
import { DesignInspectorRail, type MakePath } from '@/components/create/abacus/DesignInspectorRail'
import { FabricationRail } from '@/components/create/abacus/FabricationRail'
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

  // which output the shared design is being made into. The left rail owns the
  // chooser (the old 2-card fork); the shell swaps center + right accordingly.
  const [target, setTarget] = useState<MakePath>('markers')

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
          <StudioShell
            left={
              <DesignInspectorRail
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={selectPlayer}
                playerUnavailable={playerUnavailable}
                target={target}
                onTargetChange={setTarget}
              />
            }
            center={target === 'print' ? <AbacusStudioViewer /> : <PaperMarkerCenter />}
            right={target === 'print' ? <FabricationRail /> : null}
          />
        </AbacusStudioProvider>
      </div>
    </PageWithNav>
  )
}

// The paper target's center: the stick-on marker sheet, driven by the shared
// design's live column count so it can't drift from the 3D preview. (CP3 wires
// the rest of the design — marker size, B/W channel — into this realizer.)
function PaperMarkerCenter() {
  const { params } = useAbacusStudio()
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
      <AbacusMarkerSheet columnCount={params.cols} />
    </div>
  )
}
