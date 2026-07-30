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

import type { ThhFilamentRow } from '@/lib/abacus/print/filament-wire'
import type { Params } from './abacus-model'

// The Bambu material families that matter for interface adhesion (PLA↔PETG↔TPU
// bond poorly). Open string tail keeps THH free to report families we don't
// enumerate yet without a type break.
export type FilamentMaterial = 'PLA' | 'PETG' | 'TPU' | 'ABS' | 'ASA' | (string & {})

// ---- family knowledge -------------------------------------------------------
// Two orthogonal facts about a family string, both deliberately approximate:
// the THH wire carries `family` only (no nozzle temps), and the slicer stays
// the final authority on what actually prints together.

// Support families are engineered to bond WEAKLY (that's how they break away)
// and print chalky — never a sensible pick for a visible role. Bambu reports
// them as the base family + "-S" (PLA-S, PA-S); PVA and HIPS are the classic
// dissolvable/breakaway supports.
export function isSupportMaterial(material: FilamentMaterial): boolean {
  const m = material.toUpperCase()
  return m.endsWith('-S') || m === 'PVA' || m === 'HIPS'
}

// What KIND of support media is this spool? The service's `supportKind`
// (things-haunt-house#367) is authoritative when present — including an
// explicit null ("plain model material"). The family-name heuristic above only
// answers when the wire didn't carry the field (pre-#367 service, manual
// catalogs), and it maps a heuristic hit onto 'interface': PLA-S/PVA/HIPS are
// interface-grade breakaway/dissolvable media, and guessing 'body' would hide
// the spool from the support-interface picker. The kit's
// `SupportRosterEntry.supportKind` consumes this projection directly.
export function spoolSupportKind(spool: FilamentSpool): 'interface' | 'body' | null {
  if (spool.supportKind !== undefined) return spool.supportKind
  return isSupportMaterial(spool.material) ? 'interface' : null
}

// Is this SPOOL support media at all? Both 'interface' (dedicated interface,
// PLA-S) and 'body' (support-body material) count: neither is a sensible
// auto-pick for a visible surface. Every "never auto-pick / warn on
// visible-role" check should go through THIS, not the raw name heuristic.
export function isSupportSpool(spool: FilamentSpool): boolean {
  return spoolSupportKind(spool) !== null
}

// Co-print group: families that share a plate temperature window. Support-for-X
// and filled variants (X-CF/GF/HF) print alongside X by design; ASA and HIPS
// ride with ABS; PVA rides with PLA. An unknown family forms its own group —
// compatibility is never assumed.
export function coPrintGroup(material: FilamentMaterial): string {
  const base = material.toUpperCase().replace(/-(S|CF|GF|HF)$/, '')
  if (base === 'ASA' || base === 'HIPS') return 'ABS'
  if (base === 'PVA') return 'PLA'
  return base
}

export type FilamentSpool = {
  id: string // stable within a catalog; the plan references spools by this
  name: string
  hex: string
  material: FilamentMaterial
  // True for the loaded external/direct spool on a no-AMS printer (things-haunt-house
  // #382): it has no AMS slot, so the ticket references it by {external,family}, not by
  // `id`. Absent/false for every AMS-slot and params spool. A print with an external
  // spool is single-filament by construction (one nozzle, one spool).
  external?: boolean
  // Service-side support capability (things-haunt-house#367), projected verbatim
  // from the wire. When PRESENT it is authoritative and `isSupportSpool` ignores
  // the name heuristic; absent (pre-#367 service, params catalog) falls back to
  // `isSupportMaterial`.
  supportKind?: 'interface' | 'body' | null
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
  // Clamp to [1,8] AND coerce a missing / non-numeric filament_count to the
  // default: a NaN count would run the loop zero times and yield an EMPTY spool
  // list, and the quantizer crashes on a catalog with no slot to pick
  // (snapWithin's `allowed` is empty → hexes[undefined]). There is always ≥1.
  const raw = Number(p.filament_count)
  const count = Number.isFinite(raw) ? Math.max(1, Math.min(8, Math.floor(raw))) : 8
  const spools: FilamentSpool[] = []
  for (let n = 1; n <= count; n++) {
    spools.push({
      id: `filament-${n}`,
      name: `Filament ${n}`,
      // Guard the crash, not the color: a missing slot (filament_count can
      // exceed the defined filament_N params) would otherwise seed hex:undefined,
      // which crashes hexRGB('undefined'.replace) downstream. A present value is
      // already "#RRGGBB" — pass it through verbatim (the offline catalog mirrors
      // the user's params exactly); only the absent one falls back to grey.
      hex: p[`filament_${n}` as 'filament_1'] ?? '#808080',
      material: 'PLA',
    })
  }
  return { source: 'manual-params', spools }
}

// Normalize THH's 8-digit RGBA hex (no '#', e.g. "A0A0A0FF") to the catalog's
// "#RRGGBB". Tolerates a leading '#' and an already-6-digit value; falls back to
// a neutral grey when the field is missing or malformed, so a spool still gets a
// renderable swatch rather than breaking the color math.
function normalizeThhHex(raw: string | undefined): string {
  const hex = (raw ?? '').replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6,8}$/.test(hex)) return '#808080'
  return `#${hex.slice(0, 6).toUpperCase()}`
}

// Human-readable spool name from the identifying fields THH reports, in the
// order that reads best: brand+product, else family, else the slot label, else a
// positional stand-in. Shared by both row kinds so the naming stays identical.
function spoolName(row: ThhFilamentRow, i: number): string {
  return (
    [row.brand, row.product].filter(Boolean).join(' ').trim() ||
    row.family ||
    row.slotId ||
    `Slot ${i + 1}`
  )
}

// Project the proxy's filaments read onto the studio's FilamentCatalog. Spools
// keep the AMS order THH reports (slot 0.1, 0.2, …) — the order the picker shows.
// This is the 'thh-ams' source: spools carry a real `material` family, so once
// the design has mixed materials the material-interface checks (P4) come alive;
// today the studio just gets true colors + names instead of the params stand-in.
// `fetchedAt` stamps the snapshot for cache/debugging.
//
// Post things-haunt-house#382 the read can also carry ONE external (no-slot)
// spool — a no-AMS printer running off its direct spool holder (`external:true`,
// `slotId:null`). We fold it in as an `external` spool ONLY when its `family` is
// resolved; an external row with a null/empty family is the printer saying "a
// spool is loaded but I can't identify its material" — we DROP it rather than
// invent a PLA default (the honest-unknown rule, #19). So the `|| 'PLA'` default
// below is scoped to AMS-slot rows, whose family THH always resolves.
export function thhFilamentsToCatalog(rows: ThhFilamentRow[], fetchedAt: string): FilamentCatalog {
  const spools: FilamentSpool[] = []
  rows.forEach((row, i) => {
    if (row.external) {
      // A loaded external spool with no identifiable material is not printable —
      // skip it (never a PLA-defaulted spool). The hook surfaces this to the UI
      // separately, from the raw rows, since the catalog drops the evidence here.
      if (!row.family) return
      spools.push({
        id: `external-${i}`,
        name: spoolName(row, i),
        hex: normalizeThhHex(row.colorHex),
        material: row.family as FilamentMaterial,
        external: true,
      })
      return
    }
    spools.push({
      // slotId is how a print ticket references the spool; the positional
      // fallback only guards against a degenerate row within this snapshot.
      id: row.slotId ?? `slot-${i}`,
      name: spoolName(row, i),
      hex: normalizeThhHex(row.colorHex),
      material: (row.family as FilamentMaterial) || 'PLA',
      // supportKind projects verbatim (including an explicit null); omitted
      // entirely when the service predates #367 so isSupportSpool falls back.
      ...(row.supportKind !== undefined ? { supportKind: row.supportKind } : {}),
    })
  })
  return { source: 'thh-ams', spools, fetchedAt }
}
