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
}

export interface ThhFilamentsResponse {
  printerId?: string
  filaments?: ThhFilamentRow[]
  /** Live AMS presence (#382): whether an AMS is reporting slots right now, NOT the
   *  static model capability. Absent when talking to a pre-#382 service. */
  amsPresent?: boolean
}

/**
 * Why the live roster isn't available. The studio silently falls back to the
 * params-derived catalog on any of these — a missing print service is a
 * degraded state, never an error page.
 */
export type PrintUnavailableReason =
  | 'not-configured' // no paired connection
  | 'unreachable' // proxy could not reach the service
  | 'unauthorized' // service rejected the connection's token
  | 'no-printer' // service reachable but reports no printers
  // any other failure (ambiguous-connection 400, 5xx, malformed response):
  // surfaced with remediation, never masked as success
  | 'error'
