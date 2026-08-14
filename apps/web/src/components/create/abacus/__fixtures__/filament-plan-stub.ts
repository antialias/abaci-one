// A stand-in for THH's `filament-plan/v1` answer (Gitea #37).
//
// Since the authority swap, nothing in the studio decides which spool serves
// which role — THH does, and `materialize` projects that answer. So a test or a
// story that wants a particular mapping has to STAGE one, the way it would stage
// any other service response.
//
// This is deliberately not a planner. It does no color math, honours no
// constraint, and will happily produce a mapping the real service would refuse:
// its whole job is to let a caller say "suppose the service answered THIS" in one
// line. Anything asserting about how a good answer is CHOSEN belongs in THH.
//
// Shared by `__tests__/` and `*.stories.tsx` so both exercise one shape of the
// response — a second hand-rolled literal is how a fixture drifts from the wire.

import type {
  FilamentPlanAssignment,
  FilamentPlanResponseV1,
  FilamentPlanWarning,
} from '@eink/print-dialog'

import type { FilamentCatalog } from '../abacus-catalog'
import type { AbacusDesign } from '../abacus-design'
import { designRoles } from '../abacus-plan-request'

/** roleKey → spoolId, or [spoolId, deltaE00] when the caller wants a color shift. */
export type StubPick = string | readonly [string, number]

export type StubPlanExtra = {
  status?: FilamentPlanResponseV1['status']
  warnings?: readonly FilamentPlanWarning[]
  /** roleKey → the planner relaxations to report for it. */
  relaxations?: Record<string, readonly string[]>
  /** roleKeys the planner could not place at all. */
  unplaced?: readonly string[]
}

/**
 * Stage a plan for `design` against `catalog`.
 *
 * Roles the caller doesn't name are dealt round-robin across the roster at ΔE00
 * 0, so a caller only has to say the part it is about. Round-robin rather than
 * "spool 0" because inset text landing on the frame's own filament is a real
 * warning, and it should be a fixture that ASKS for it.
 */
export function stubFilamentPlan(
  design: AbacusDesign,
  catalog: FilamentCatalog,
  picks: Record<string, StubPick> = {},
  extra: StubPlanExtra = {}
): FilamentPlanResponseV1 {
  const unplaced = new Set(extra.unplaced ?? [])
  const assignments: FilamentPlanAssignment[] = designRoles(design).map((role, i) => {
    const raw = picks[role.key]
    const fallback = [catalog.spools[i % Math.max(1, catalog.spools.length)]?.id, 0] as const
    const [spoolId, deltaE00] = typeof raw === 'string' ? [raw, 0] : (raw ?? fallback)
    const spool = catalog.spools.find((s) => s.id === spoolId)
    const relaxations = [...(extra.relaxations?.[role.key] ?? [])]
    if (!spool || unplaced.has(role.key)) {
      return {
        paletteId: role.key,
        status: 'unresolved',
        filament: null,
        deltaE00: null,
        reasons: [],
        relaxations,
      }
    }
    return {
      paletteId: role.key,
      status: 'matched',
      filament: {
        // The join `materialize` performs: a slot row is named by its slotId, the
        // single external row by the flag. Mirrors `thhFilamentsToCatalog`.
        slotId: spool.external ? null : spool.id,
        external: spool.external === true,
        family: spool.material,
        supportKind: spool.supportKind ?? null,
        colorHex: spool.hex,
        brand: spool.brand ?? null,
        product: spool.product ?? null,
        profileKey: spool.profileKey ?? null,
        remainingPct: null,
      },
      deltaE00,
      reasons: [],
      relaxations,
    }
  })
  return {
    contractVersion: 'filament-plan/v1',
    plannerVersion: 'stub',
    printerId: 'stub-printer',
    rosterFingerprint: 'stub',
    status: extra.status ?? 'satisfied',
    assignments,
    warnings: [...(extra.warnings ?? [])],
  }
}

/**
 * Stage the plan that maps every role onto a spool at its OWN intrinsic color —
 * "the roster had exactly what you designed". Returns both the catalog it had to
 * invent and the plan that lands on it, because the two are only meaningful
 * together.
 */
export function exactMatchPlan(
  design: AbacusDesign,
  material = 'PLA'
): { catalog: FilamentCatalog; plan: FilamentPlanResponseV1 } {
  const roles = designRoles(design)
  // One spool per DISTINCT intrinsic hex: two roles designed the same color are
  // served by the same spool, which is what a real roster would do.
  const byHex = new Map<string, string>()
  const catalog: FilamentCatalog = {
    source: 'thh-ams',
    fetchedAt: '2026-08-14T00:00:00Z',
    spools: [],
  }
  for (const role of roles) {
    const hex = role.intrinsicHex.toLowerCase()
    if (byHex.has(hex)) continue
    const id = `s${byHex.size}`
    byHex.set(hex, id)
    catalog.spools.push({ id, name: `Match ${byHex.size}`, hex: role.intrinsicHex, material })
  }
  const picks: Record<string, StubPick> = {}
  for (const role of roles) picks[role.key] = byHex.get(role.intrinsicHex.toLowerCase()) as string
  return { catalog, plan: stubFilamentPlan(design, catalog, picks) }
}

/** A compatibility warning shaped the way THH emits them. */
export function stubCompatWarning(
  code: string,
  paletteIds: readonly string[],
  detail: string,
  label: string | null = null
): FilamentPlanWarning {
  return {
    origin: 'compatibility',
    code,
    severity: 'caution',
    paletteIds: [...paletteIds],
    families: [],
    label,
    detail,
    provenance: {},
  }
}
