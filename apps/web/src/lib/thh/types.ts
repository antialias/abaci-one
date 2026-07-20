// THH print gateway — wire types for the filament-catalog source (Gitea epic #5, P3).
//
// The Abacus Studio consumes THH's loaded-AMS snapshot as its `thh-ams`
// FilamentCatalog. These are the shapes of the two read endpoints we touch:
//   GET /api/print/v1/printers                — pick the multi-material printer
//   GET /api/print/v1/printers/{id}/filaments — the spools currently loaded
//
// On "v2" (the studio directive): "v2" names the JOB-TICKET format used on the
// SUBMIT path, NOT a URL version — the path prefix is permanently `/api/print/v1`
// (things-haunt-house docs/print-api.md, the #339 rewrite). The read endpoints
// below are version-neutral; we're on the current documented surface. Job-ticket
// submission (where the v1↔v2 distinction actually bites) is a later phase.
//
// Pure types, framework-free (no `server-only`), so the framework-free catalog
// mapper (abacus-catalog.ts, which the client viewer bundles) can import them
// without dragging the server client into the browser build.

/** One loaded filament as reported by GET /printers/{id}/filaments. */
export type ThhFilamentRow = {
  /** "<amsUnit>.<slot>", e.g. "0.1". Absent for an external (non-AMS) spool. */
  slotId?: string
  /** Material family (PLA, PETG, TPU, …). Present on entries today (THH #357). */
  family?: string
  /** 8-digit RGBA hex WITHOUT a leading '#', e.g. "A0A0A0FF". */
  colorHex?: string
  brand?: string
  product?: string
  /** 0–100, or null when the gateway can't read how much is left (≠ 0%). */
  remainingPct?: number | null
  /** true for a spool on the external holder (no AMS slot → no slotId). */
  external?: boolean
}

export type ThhFilamentsResponse = {
  printerId: string
  filaments: ThhFilamentRow[]
}

/** One printer row from GET /printers (only the fields we branch on). */
export type ThhPrinterRow = {
  id: string
  multiMaterial?: boolean
}

export type ThhPrintersResponse = {
  printers: ThhPrinterRow[]
}

// Why the THH catalog isn't available — the studio falls back to the
// params-derived, color-only catalog for every one of these. 'not-configured'
// (no token wired) and 'unreachable' (gateway offline) are the expected,
// non-error states, so the route reports them as 200 { ok: false }.
export type ThhUnavailableReason =
  | 'not-configured'
  | 'unreachable'
  | 'unauthorized'
  | 'no-printer'
  | 'no-filaments'
  | 'bad-response'
