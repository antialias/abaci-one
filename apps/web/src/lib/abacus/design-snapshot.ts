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
import {
  AID_OPTS,
  AIDS,
  type AidKey,
  clampCols,
  defaultParams,
  LEGACY_PRESET_AID,
  type Params,
  TEXT_SLOTS,
} from '@/components/create/abacus/abacus-model'
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

/**
 * Pre-#28 envelopes stored perimeter-text placement PER RAIL, as
 * `<rail>_preset` ∈ {'custom', 'friends-of-10', 'friends-of-5'}. Those keys are
 * gone — placement is derived now — but unlike the feet keys #23 retired, they
 * can't just be dropped. The feet knobs were UI-unreachable and therefore
 * invariant across every stored design; these two had controls, so their values
 * VARY: friends-of-5 on top with friends-of-10 on the bottom is a real thing
 * somebody saved, and dropping the keys would silently re-normalize their
 * abacus.
 *
 * Two details that make the translation faithful rather than approximate:
 *   • An aid that no rail claimed becomes 'off', NOT 'auto'. A legacy design
 *     that deliberately blanked its top rail must stay blank, and 'auto' would
 *     put the aid straight back.
 *   • A claimed rail's `_text` is cleared, because the old `slotTokens` let the
 *     preset SHADOW the text. Leaving both would hand the rail to words-win and
 *     relocate the aid — i.e. render the design differently than it was saved.
 */
function adoptLegacyPresets(raw: Record<string, unknown>, out: Params): void {
  const present = TEXT_SLOTS.some((s) => typeof raw[`${s}_preset`] === 'string')
  if (!present) return
  const claimed = new Set<AidKey>()
  for (const slot of TEXT_SLOTS) {
    const aid = LEGACY_PRESET_AID[String(raw[`${slot}_preset`])]
    if (!aid || claimed.has(aid)) continue // first rail wins a doubly-named aid
    claimed.add(aid)
    out[aid] = slot
    out[`${slot}_text`] = ''
  }
  for (const aid of AIDS) if (!claimed.has(aid.key)) out[aid.key] = 'off'
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
  // an unrecognized aid intent would render as a blank <select>; 'auto' is what
  // it would have behaved as anyway (placeAids treats anything unnamed as auto)
  for (const aid of AIDS) if (!AID_OPTS.includes(out[aid.key])) out[aid.key] = 'auto'
  adoptLegacyPresets(raw, out)
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
