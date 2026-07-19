// Abacus Studio — the filament catalog (Gitea epic #5, Phase 1 #7 → quantization).
//
// The catalog is the SECOND boundary's fixed input: the spools the printer can
// actually lay down. It's deliberately NOT the whole filament library — it's the
// loaded-AMS reality (per the studio decision: "swatches come from THH active and
// available filament"). `materialize` (abacus-plan.ts) quantizes the design's
// intrinsic colors onto exactly these spools; nothing outside the catalog is
// printable.
//
// Two sources feed it:
//   • 'thh-ams'      — the live THH AMS snapshot (spools carry a real `material`,
//                      so material-family adhesion checks can run — see #357). The
//                      THH client that produces this lands in a later phase (P3).
//   • 'manual-params'— the offline fallback: the `filament_1..count` hexes on the
//                      params surface, color-only (material defaults to PLA, so the
//                      material-interface check stays inert until THH supplies real
//                      families). This is the "THH-only" decision made literal —
//                      manual mode never fabricates material data it doesn't have.
//
// Framework-free (no React, no three): a plain projection over `Params`.

import type { Params } from './abacus-model'

// The Bambu material families that matter for interface adhesion (PLA↔PETG↔TPU
// bond poorly). Open string tail keeps THH free to report families we don't
// enumerate yet without a type break.
export type FilamentMaterial = 'PLA' | 'PETG' | 'TPU' | 'ABS' | 'ASA' | (string & {})

export type FilamentSpool = {
  id: string // stable within a catalog; the plan references spools by this
  name: string
  hex: string
  material: FilamentMaterial
}

export type FilamentCatalog = {
  source: 'thh-ams' | 'manual-params'
  spools: FilamentSpool[]
  // Present for 'thh-ams' snapshots (an ISO timestamp); absent for params-derived
  // catalogs, which have no fetch moment.
  fetchedAt?: string
}

// The offline catalog: the up-to-8 loaded slots from the params surface, in
// filament_1..count order (clamped to [1,8], matching the historical filament
// map). Color-only — every spool defaults to PLA because the params carry no
// material data; real families arrive only via the THH AMS source.
export function catalogFromParams(p: Params): FilamentCatalog {
  const count = Math.max(1, Math.min(8, p.filament_count))
  const spools: FilamentSpool[] = []
  for (let n = 1; n <= count; n++) {
    spools.push({
      id: `filament-${n}`,
      name: `Filament ${n}`,
      hex: p[`filament_${n}` as 'filament_1'],
      material: 'PLA',
    })
  }
  return { source: 'manual-params', spools }
}
