/**
 * THH wire shapes as they pass through the abacus print proxy (#8.5), plus
 * the studio's degrade vocabulary. Types only — safe to import client-side.
 *
 * The proxy is byte-faithful, so these mirror the service's own JSON; fields
 * are optional wherever the service may omit them. External (no-slot) spools
 * never appear in the filaments read — rows are loaded AMS slots.
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
  /** AMS slot, e.g. "0.1" — how a print ticket references the spool */
  slotId?: string
  /** Material family, e.g. "PLA" / "PETG" / "TPU" */
  family?: string
  /** 8-digit RGBA hex without '#', e.g. "A0A0A0FF" */
  colorHex?: string
  brand?: string
  product?: string
}

export interface ThhFilamentsResponse {
  printerId?: string
  filaments?: ThhFilamentRow[]
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
