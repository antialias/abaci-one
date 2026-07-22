// Abacus Studio — the fabrication axis + the fabrication-neutral intent seam
// (Gitea epic #5, CP2).
//
// An AbacusDesign says WHAT abacus the user wants; it does not say HOW that
// becomes a physical object. The "how" is a separate axis — FabricationKind —
// and the two realizers (the stick-on ArUco paper marker sheet, the FDM 3D
// print) are two projections of ONE shared design.
//
// `intentOf` is the seam between them: the fabrication-neutral core both
// realizers agree on (column count, per-column colors, corner-marker geometry),
// DERIVED from the design so the paper output can never silently drift from the
// printed one. The FDM realizer additionally consumes the full params (printer
// profile, clearance, OpenSCAD knobs); the paper realizer needs only this
// intent. Pure and framework-free — no React, no three, no geometry.

import type { AbacusDesign, ResolvedColors } from './abacus-design'

// The output axis. 'paper' = stick-on ArUco corner markers for an abacus you
// already own — the express lane, loads none of the 3D stack. 'fdm' = a printed
// frame with the markers baked in. These two are the whole axis.
export type FabricationKind = 'paper' | 'fdm'

export interface FabricationTarget {
  kind: FabricationKind
}

// 3D print is the default: the studio leads with its most compelling output — a
// spinnable printed frame — rather than opening on the utilitarian marker sheet.
// This is a deliberate product trade: the no-3D-printer majority now pays the
// three.js/OpenSCAD download on first paint, in exchange for the exciting path
// being the star instead of hidden behind a control. Paper stays one tap away
// and, when selected, still mounts none of the 3D stack (the express lane and
// its code-split are unchanged — see the express-lane-isolation guard).
export const DEFAULT_FABRICATION: FabricationTarget = { kind: 'fdm' }

// One source of truth for the axis chooser's presentation, so the label/icon
// can't fork across the surfaces that render it (left rail today, more later).
export const FABRICATION_OPTIONS: ReadonlyArray<{
  kind: FabricationKind
  label: string
  icon: string
}> = [
  { kind: 'paper', label: 'Paper markers', icon: '🏷️' },
  { kind: 'fdm', label: '3D print', icon: '🖨️' },
]

// The four-corner ArUco geometry both realizers place. `sizeMm` is the printed
// edge length of one marker; `enabled` is whether the design carries markers at
// all (a plain abacus can opt out).
export interface MarkerIntent {
  enabled: boolean
  sizeMm: number
}

// The fabrication-neutral core of a design: everything a realizer needs that is
// independent of HOW the abacus is made. Never authored — always derived — so
// the paper and FDM realizations stay in lockstep with the one shared design.
export interface AbacusIntent {
  columns: number
  resolvedColors: ResolvedColors
  markers: MarkerIntent
}

export function intentOf(design: AbacusDesign): AbacusIntent {
  const { params, resolvedColors } = design
  return {
    columns: params.cols,
    resolvedColors,
    markers: { enabled: params.show_markers, sizeMm: params.marker_mm },
  }
}
