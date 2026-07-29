/**
 * Abacus design snapshots (Gitea #22) — the persisted, restorable form of a
 * studio design that a `?design=<id>` deep link (and THH's "Edit in Abacus
 * Studio ↗" hand-off, things-haunt-house#408) rehydrates.
 *
 * The envelope is RESTORABLE INTENT only: the ~70-key params surface, the
 * user's manual filament-role pins (`overrides`), and the printer profile.
 * The AMS projection of submit time (filamentMap / slotLabels) is deliberately
 * provenance, not part of the envelope — rehydrating a stale spool roster
 * would lie about what's loaded NOW, whereas re-applying pins is graceful
 * (`materialize` ignores pins onto spools that are no longer loaded).
 *
 * `parseDesignSnapshot` is the single guard on both write and read: the POST
 * route refuses what it can't parse, and the GET route re-parses the stored
 * envelope so a schema drift degrades to "design unavailable" instead of
 * hydrating garbage into the studio. Per-key tolerance mirrors
 * `parseAbacusIdentity`: unknown keys drop, a missing/mistyped key falls back
 * to its default — a snapshot from an older params surface still restores.
 */
import { clampCols, defaultParams, type Params } from '@/components/create/abacus/abacus-model'
import { DEFAULT_PROFILE_ID, PRINTER_PROFILES } from '@/components/create/abacus/abacus-solver'
import { stableStringify } from '@/lib/stable-stringify'

export const ABACUS_DESIGN_SNAPSHOT_VERSION = 1

export interface AbacusDesignSnapshot {
  v: typeof ABACUS_DESIGN_SNAPSHOT_VERSION
  params: Params
  /** Manual filament-role pins, roleKey → spoolId. Re-applied on restore;
   *  pins onto spools that are gone are ignored by `materialize`. */
  overrides: Record<string, string>
  profileId: string
}

/** What the submit ALSO knew, kept for the record but never rehydrated: the
 *  AMS projection (slot→color map + spool names) the printed object used. */
export interface AbacusDesignProvenance {
  [key: string]: unknown
}

function parseParams(input: unknown): Params | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null
  const raw = input as Record<string, unknown>
  const out = { ...defaultParams }
  for (const key of Object.keys(defaultParams) as (keyof Params)[]) {
    const value = raw[key]
    if (typeof value === typeof defaultParams[key]) {
      ;(out as Record<string, unknown>)[key] = value
    }
  }
  out.cols = clampCols(out.cols)
  return out
}

function parseOverrides(input: unknown): Record<string, string> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

/**
 * Total parse guard: a versioned envelope in, a normalized snapshot or null
 * out — never a throw. Null means "not a v1 design snapshot" (wrong shape,
 * wrong version, params missing); per-key junk inside a well-formed envelope
 * degrades to defaults instead.
 */
export function parseDesignSnapshot(input: unknown): AbacusDesignSnapshot | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null
  const raw = input as Record<string, unknown>
  if (raw.v !== ABACUS_DESIGN_SNAPSHOT_VERSION) return null
  const params = parseParams(raw.params)
  if (!params) return null
  const profileId =
    typeof raw.profileId === 'string' && PRINTER_PROFILES.some((p) => p.id === raw.profileId)
      ? raw.profileId
      : DEFAULT_PROFILE_ID
  return {
    v: ABACUS_DESIGN_SNAPSHOT_VERSION,
    params,
    overrides: parseOverrides(raw.overrides),
    profileId,
  }
}

/** The canonical serialization the content hash is computed over: key-order
 *  independent, so two submits of the same design (however React assembled
 *  the objects) converge on one stored row. */
export function canonicalDesignSnapshot(snapshot: AbacusDesignSnapshot): string {
  return stableStringify(snapshot)
}
