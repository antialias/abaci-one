'use client'

// FabricationSwitch — the studio's headline choice, "what am I making?" (Gitea
// epic #5). Promoted OUT of the left inspector rail into the shell's persistent
// top toolbar so it reads on every breakpoint (and, on mobile, isn't buried in
// the drawer behind the ⚙ FAB). One shared design, two first-class outputs: the
// 3D print leads (the default the studio opens on) and paper markers are one tap
// away. It only reads the shared studio store, so wherever the shell mounts it,
// it drives the same fabrication axis.

import { SegmentedControl } from '@/components/studio/SegmentedControl'
import { useAbacusStudio } from './AbacusStudioContext'
import { FABRICATION_OPTIONS, type FabricationKind } from './abacus-fabrication'

export function FabricationSwitch() {
  const { fabrication, setFabricationKind } = useAbacusStudio()
  return (
    <div
      data-component="fabrication-switch"
      // cap the width so the pill stays a focused control on a wide desktop
      // toolbar, but fills a narrow phone bar.
      style={{ width: '100%', maxWidth: 360 }}
    >
      <SegmentedControl<FabricationKind>
        ariaLabel="How to make your abacus"
        size="md"
        options={FABRICATION_OPTIONS.map((o) => ({
          value: o.kind,
          label: o.label,
          icon: o.icon,
        }))}
        value={fabrication.kind}
        onChange={setFabricationKind}
        dataElement="abacus-target-chooser"
        dataAction="choose-abacus-path"
      />
    </div>
  )
}
