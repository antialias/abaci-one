/**
 * THH wire shapes as they pass through the abacus print proxy (#8.5), plus
 * the studio's degrade vocabulary. Types only — safe to import client-side.
 *
 * The proxy is byte-faithful, so these mirror the service's own JSON; fields
 * are optional wherever the service may omit them. Post things-haunt-house#382
 * the read also reports the loaded external (no-slot) spool as a single row
 * (`external:true`, `slotId:null`), and carries a live `amsPresent` flag; a
 * `family:null` on an external row means the spool is loaded but its material
 * couldn't be resolved — physically present, not printable.
 */

export interface ThhPrinterRow {
  id: string
  name?: string
  /** True for AMS-equipped printers — preferred for multi-color abacus prints */
  multiMaterial?: boolean
  /** Live machine-profile geometry — the same bed/exclusions THH gives Orca. */
  bed?: ThhBedGeometry
  /** Versioned, pin-relative reservation THH promises to enforce for this printer. */
  wipeTower?: ThhWipeTowerCapability | null
}

export interface ThhBedGeometry {
  sizeMm: { x: number; y: number; z?: number }
  exclusionsMm?: { pointsMm: readonly (readonly [number, number])[] }[]
}

export interface ThhWipeTowerEnvelope {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ThhWipeTowerCapability {
  version: 1
  profile: string
  orcaVersion?: string
  maxFilaments: number
  pinReference?: string
  /** The count-unaware bound — the max-filament row. Always safe to pack against. */
  envelopeMm: ThhWipeTowerEnvelope
  /** The same promise per filament count, keyed by the count as a JSON string
   *  (`"2"`…). The tower is far shallower at low counts — THH's measured table runs
   *  70×21 at two filaments to 70×63 at six — so a plate that knows its count
   *  reserves much less bed. Absent on a pre-#433 service; consumers fall back to
   *  `envelopeMm` then. */
  envelopeByFilamentsMm?: Readonly<Record<string, ThhWipeTowerEnvelope>>
  process: {
    prime_tower_width: number
    prime_tower_brim_width: number
    wipe_tower_wall_type: string
  }
}

export interface ThhPrintersResponse {
  printers?: ThhPrinterRow[]
}

export interface ThhFilamentRow {
  /** AMS slot, e.g. "0.1" — how a print ticket references the spool. `null` on an
   *  external row (#382): a direct/external spool has no slot and is referenced by
   *  `{external:true, family}` instead. */
  slotId?: string | null
  /** True for the loaded external/direct spool (no AMS slot) — #382. */
  external?: boolean
  /** Material family, e.g. "PLA" / "PETG" / "TPU". `null` on an external row means
   *  the spool is loaded but its material couldn't be resolved — not printable. */
  family?: string | null
  /** 8-digit RGBA hex without '#', e.g. "A0A0A0FF" */
  colorHex?: string
  brand?: string
  product?: string
  /** Remaining filament, 0–100 (#382); absent/unknown on sensorless spools. */
  remainingPct?: number
  /** Service-side support capability (things-haunt-house#367): 'interface' for a
   *  dedicated support-interface material (family PLA-S exactly), 'body' for a
   *  support-body material, null for a plain model material. Absent when talking
   *  to a pre-#367 service — consumers fall back to the local heuristic then. */
  supportKind?: 'interface' | 'body' | null
  /**
   * Is the printer live-reporting a loaded spool in this slot RIGHT NOW
   * (things-haunt-house#343)?
   *
   * A mapping row can OUTLIVE the physical spool — THH's seeder never expires
   * rows — so the roster deliberately keeps stale rows and marks them instead of
   * dropping them, letting a wake/RFID-reread blip stay a cosmetic toggle rather
   * than a spool that vanishes and reappears. `false` means the mapping is stale:
   * render it grayed and never assign it. Absent on a pre-#343 service.
   */
  livePresent?: boolean
  /**
   * The slice profile of the spool loaded in this slot.
   *
   * This is the DURABLE handle. `slotId` names a tray and goes stale the moment
   * the spool is moved; `profileKey` follows the material itself, so a saved
   * design's requirement survives a spool changing slots. `null` for an unmapped
   * or unprofiled slot.
   */
  profileKey?: string | null
  /**
   * Temperature window of the profile the slot would actually SLICE with
   * (things-haunt-house#365) — the generic family profile, not the RFID tray
   * profile. Service truth, so compatibility can be read rather than inferred
   * from family names. `null` when it cannot be answered honestly: no family, an
   * unmapped family, or the slicer sidecar unreachable.
   */
  nozzleTempC?: { value?: number; min?: number; max?: number } | null
  /** True when a human explicitly attached this spool to the slot, rather than it
   *  being seeded from an RFID read. */
  userAttached?: boolean
  /** Live drying state, when the service tracks it for this slot. */
  moisture?: { state?: string; rh?: number | null } | null
}

export interface ThhFilamentsResponse {
  printerId?: string
  filaments?: ThhFilamentRow[]
  /** Live AMS presence (#382): whether an AMS is reporting slots right now, NOT the
   *  static model capability. Absent when talking to a pre-#382 service. */
  amsPresent?: boolean
}

/**
 * Why a live service read isn't available — shared by the roster read
 * (`useThhFilamentCatalog`) and the plan read (`useFilamentPlan`). The studio
 * silently falls back to the params-derived catalog on any of these — a missing
 * print service is a degraded state, never an error page.
 */
export type PrintUnavailableReason =
  | 'not-configured' // no paired connection
  | 'unreachable' // proxy could not reach the service
  | 'unauthorized' // service rejected the connection's token
  | 'no-printer' // service reachable but reports no printers
  // the PLANNER read the request and refused it (a 4xx carrying the service's
  // own {code, message}) — e.g. a palette past its cap. Deterministic: the same
  // design gets the same answer, so there is nothing to retry. Only
  // `useFilamentPlan` produces this; the roster read's own 400 (an ambiguous
  // connection, minted by our proxy in a different shape) stays 'error'.
  | 'refused'
  // any other failure (ambiguous-connection 400, 5xx, malformed response):
  // surfaced with remediation, never masked as success
  | 'error'
