// Abacus Studio — the design's filament intent, as a `filament-plan/v1` request
// (Gitea #37).
//
// This module is the ONE place that says what the abacus means by its colors.
// Everything here is abacus semantics — which roles must differ, which are fused
// to each other, which one wants a flexible material regardless of color. What it
// deliberately does NOT contain is any notion of which spool satisfies them: no
// color distance, no family folding, no roster. THH's planner owns that, because
// "which loaded spool is closest / compatible / actually present" is printer
// truth, and Abaci was previously answering it with a redmean approximation over
// a family-name heuristic.
//
// The split to hold onto: a CONSTRAINT is a fact about the design ("the two ArUco
// fields must not be the same filament"); a MATCH is a fact about the printer
// ("slot 0.2 is the closest PETG to #2E86AB"). Constraints belong here, matching
// does not.
//
// Framework-free (no React, no three): a plain projection over `AbacusDesign`.

import type {
  FilamentIdentitySelector,
  FilamentPaletteEntry,
  FilamentPaletteInterface,
  FilamentPalettePair,
  FilamentPlanRequestV1,
} from '@eink/print-dialog'

import type { FilamentCatalog, FilamentSpool } from './abacus-catalog'

import type { AbacusDesign } from './abacus-design'
import { beadRoleColors, beadRoleIndex, beadRoleNames, textGroups } from './abacus-model'

export type PrintRoleKind = 'frame' | 'markerBlack' | 'markerWhite' | 'bead' | 'text' | 'feet'

export type PrintRole = {
  kind: PrintRoleKind
  /** Stable within a design; the plan and any user pin reference a role by this. */
  key: string
  label: string
  /** What the user designed — never snapped to a spool. */
  intrinsicHex: string
}

/**
 * Every role this design would print, in the historical precedence order:
 * markers first (they are CV-critical), then frame, then bead roles, then feet,
 * then one role per inset-text color group.
 *
 * Order is load-bearing: `computeFilamentMap` adapts these back to the legacy
 * `FilamentMap` by index, so appending is safe and reordering is not.
 *
 * Roles are minted from design INTENT, not from what a given render emits —
 * deliberately not gated on `show_frame` / `show_markers`, because the plan
 * answers "which spool would this role use", and the 3MF re-checks visibility
 * before consuming a slot. A visibility-gated role index here is inert.
 *
 * Bead roles are the exception to "mint from intent": a role NO bead can ever
 * resolve to is not inert, it is harmful. `beadRoleIndex` maps column `i` to
 * `(cols-1-i) % paletteLen` for place-value schemes, so a 3-column design never
 * references role 3 or 4 — yet those phantom entries used to join the palette
 * anyway, where they consumed slots in the all-bead-pairs `different`
 * constraints (crowding real roles off spools) and could push the request past
 * the planner's palette cap, a hard 400 (`palette_too_large`) for a distinction
 * the design itself never draws. So bead roles are trimmed to the reachable
 * set, enumerated through `beadRoleIndex` itself — the same function the
 * render-side mapping consults, which is what keeps the trim and the render
 * from ever disagreeing about which roles exist. (Every column renders exactly
 * one heaven bead and `earth` earth beads, so columns × types is the exact
 * domain.) The surviving keys stay a dense prefix — `bead-0 … bead-n` in order —
 * so the index-based FilamentMap projection is undisturbed.
 */
export function designRoles(design: AbacusDesign): PrintRole[] {
  const p = design.params
  const roleHexes = beadRoleColors(p.color_scheme, p.color_palette)
  const roleNames = beadRoleNames(p.color_scheme)

  const reachableBeadRoles = new Set<number>()
  for (let i = 0; i < p.cols; i += 1) {
    reachableBeadRoles.add(beadRoleIndex(i, true, p.color_scheme, p.cols, p.color_palette))
    reachableBeadRoles.add(beadRoleIndex(i, false, p.color_scheme, p.cols, p.color_palette))
  }

  const roles: PrintRole[] = [
    { kind: 'markerBlack', key: 'marker-black', label: 'ArUco black', intrinsicHex: '#000000' },
    { kind: 'markerWhite', key: 'marker-white', label: 'ArUco white', intrinsicHex: '#ffffff' },
    { kind: 'frame', key: 'frame', label: 'Frame', intrinsicHex: design.resolvedColors.frame },
    ...roleHexes.flatMap((intrinsicHex, r) =>
      // `r` must stay the ORIGINAL role index — `beadRoleIndex` resolves to it on
      // the render side. A filter-then-map would silently renumber the keys if a
      // future scheme's reachable set ever stopped being a dense prefix.
      reachableBeadRoles.has(r)
        ? [
            {
              kind: 'bead' as const,
              key: `bead-${r}`,
              label: roleNames[r] ?? `bead ${r}`,
              intrinsicHex,
            },
          ]
        : []
    ),
  ]

  // Printed feet (Gitea #23). The intrinsic hex is a fixed dark slate and is
  // decorative: feet are chosen by MATERIAL. See the `preferred` selector below,
  // which is how that preference reaches the planner now that there is no local
  // family heuristic to encode it.
  if (p.feet_mode === 'printed') {
    roles.push({ kind: 'feet', key: 'feet', label: 'Feet', intrinsicHex: '#1f2937' })
  }

  // One role per inset-text color group (Gitea #26): without these the plugs ride
  // no slot and the perimeter writing prints as bare pockets. Only `inset` mode
  // carves pockets that need filling.
  if (p.text_mode === 'inset') {
    const groups = textGroups(p)
    const single = groups.length === 1
    for (const t of groups) {
      roles.push({
        kind: 'text',
        key: `text-${t.g}`,
        label: single ? 'Inlay text' : t.tokens.slice(0, 2).join(' '),
        intrinsicHex: t.hex,
      })
    }
  }

  return roles
}

/** Unordered pair, in a stable order so a request is deterministic for caching. */
function pair(a: string, b: string): FilamentPalettePair {
  return { paletteIds: a < b ? [a, b] : [b, a] }
}

/**
 * Turn a design's roles into the planner request.
 *
 * Each rule below used to be an emergent property of the local quantizer's loop
 * order — distinct-first, frame-last, marker-locked — which meant the intent was
 * only legible by reading the algorithm. Stated as constraints, the same intent
 * survives a planner that resolves them however it likes, and the planner reports
 * which ones it had to relax instead of silently producing a worse answer.
 */
export interface PlanRequestContext {
  /** The loaded roster, needed only to turn a pinned spool id into an identity. */
  catalog?: FilamentCatalog
  /** roleKey → spoolId, the viewer's filament-mapping pins. */
  overrides?: Record<string, string>
  roles?: readonly PrintRole[]
}

/**
 * A user pin, as something the PLANNER can honour.
 *
 * The pin arrives as a catalog spool id — which is an AMS slot, and a slot is a
 * position, not a filament. `FilamentIdentitySelector` has no slot field on
 * purpose: pin by what the spool IS and the plan survives someone moving it to
 * another slot; pin by where it sits and the plan silently means a different
 * filament the moment the AMS is rearranged. So we send `profileKey` when the
 * service reports one (the durable handle) and fall back to brand/product/family.
 *
 * If two loaded spools share one identity the selector matches either — inherent
 * to identity pinning, and the right trade: both ARE the same filament.
 */
function pinSelector(spool: FilamentSpool): FilamentIdentitySelector | null {
  if (spool.profileKey) return { profileKey: spool.profileKey }
  const selector: FilamentIdentitySelector = {
    ...(spool.material ? { family: spool.material } : {}),
    ...(spool.brand ? { brand: spool.brand } : {}),
    ...(spool.product ? { product: spool.product } : {}),
  }
  return Object.keys(selector).length > 0 ? selector : null
}

export function buildFilamentPlanRequest(
  design: AbacusDesign,
  context: PlanRequestContext = {},
): FilamentPlanRequestV1 {
  const { catalog, overrides = {} } = context
  const roles = context.roles ?? designRoles(design)
  const spoolById = new Map((catalog?.spools ?? []).map((s) => [s.id, s] as const))
  const requiredFor = (roleKey: string): FilamentIdentitySelector | null => {
    const pinned = overrides[roleKey]
    const spool = pinned ? spoolById.get(pinned) : undefined
    return spool ? pinSelector(spool) : null
  }
  const keyOf = (kind: PrintRoleKind): string[] =>
    roles.filter((role) => role.kind === kind).map((role) => role.key)
  const frameKey = keyOf('frame')[0]
  const beadKeys = keyOf('bead')
  const textKeys = keyOf('text')

  const palette: FilamentPaletteEntry[] = roles.map((role) => {
    // A pin is a HARD requirement, so it rides `required` and the planner treats it
    // as given — which is what lets it judge compatibility around the user's choice
    // instead of around the choice it would have made. This is also why the studio
    // no longer needs its own material-mix and weld warnings: a pin that creates a
    // bad joint comes back as `poor_interlayer_adhesion` from the authority that
    // actually knows.
    const required = requiredFor(role.key)
    const pin = required ? { required } : {}

    // Both ArUco fields are read by a camera, not admired: their separation is the
    // whole point of the marker, so they carry the contrast signal that tells the
    // planner a near-miss here is worse than a near-miss on a bead.
    if (role.kind === 'markerBlack' || role.kind === 'markerWhite') {
      return {
        id: role.key,
        colorHex: role.intrinsicHex,
        ...pin,
        roleSignals: ['contrast-critical', 'model'],
      }
    }
    // Feet want a FLEXIBLE material; their color is decorative. `preferred` says
    // that as an identity rather than as the old `/tpu\s*for\s*ams/i` match on a
    // product NAME — the planner knows which of its spools are TPU, and Bambu's
    // AMS-safe Shore-68D reports as its own family variant that a name test only
    // caught by luck.
    if (role.kind === 'feet') {
      return {
        id: role.key,
        colorHex: role.intrinsicHex,
        ...pin,
        preferred: [{ family: 'TPU' }],
        roleSignals: ['model'],
      }
    }
    // Inlay text is ink: decorative, and explicitly not model structure.
    if (role.kind === 'text') {
      return { id: role.key, colorHex: role.intrinsicHex, ...pin, roleSignals: ['decorative'] }
    }
    return { id: role.key, colorHex: role.intrinsicHex, ...pin, roleSignals: ['model'] }
  })

  const different: FilamentPalettePair[] = []

  // The markers must land on two different filaments or the marker is not a
  // marker. This is the one pair that was previously enforced by a hard-coded
  // `exclude` argument in the nearest-color search.
  const black = keyOf('markerBlack')[0]
  const white = keyOf('markerWhite')[0]
  if (black && white) different.push(pair(black, white))

  // Distinct-first for bead roles: a scheme's roles exist to be told apart, so
  // collapsing two onto one spool loses the distinction the user designed.
  for (let i = 0; i < beadKeys.length; i += 1) {
    for (let j = i + 1; j < beadKeys.length; j += 1) different.push(pair(beadKeys[i], beadKeys[j]))
  }

  // Text must not print in the frame's own filament. An inlay plug fills its
  // pocket FLUSH and level, so text in frame filament does not read as a near
  // miss — it VANISHES. This is the one role where the nearest color can be the
  // wrong answer, which no color-distance planner would infer on its own.
  if (frameKey) for (const key of textKeys) different.push(pair(key, frameKey))

  // Distinct-first for text groups, for the same reason as beads: five rainbow
  // groups each independently taking their nearest spool was the original bug —
  // four landed on one ink while two contrasting spools sat unused.
  //
  // KNOWN CONTRACT GAP (escalated, not worked around): `filament-plan/v1` has no
  // way to RANK a `different` pair's relaxation priority, and these pairs are not
  // equally sheddable. Two groups that render as ADJACENT words sharing one ink
  // read as a single blob; two groups on opposite sides of the frame sharing an
  // ink is merely a lost distinction. `textGroupNeighbors` knows which is which,
  // and under a scarce roster the local quantizer used to shed the far pair first.
  //
  // We emit the full set anyway rather than trimming it to the adjacent pairs.
  // Trimming would let the far groups collide even on a roster with spools to
  // spare — re-opening the exact rainbow bug above — to buy a preference the
  // planner may never need to exercise. So the whole intent is stated, and when
  // the planner does have to shed one it says so in `relaxations`, which the
  // studio surfaces. Ranking belongs upstream in the contract, not in a local
  // pre-trim that quietly re-takes matching authority.
  for (let i = 0; i < textKeys.length; i += 1) {
    for (let j = i + 1; j < textKeys.length; j += 1) different.push(pair(textKeys[i], textKeys[j]))
  }

  // Fused parts. The inlay is welded into the frame and the ArUco fields are
  // printed into the same body, so their materials have to BOND — a compatibility
  // question about two specific filaments, which is exactly what an interface
  // declares. Beads are deliberately absent: they are captive on a print
  // clearance gap, never welded, so they carry no bond requirement.
  //
  // `substrate: frameKey` makes each bond a HARD retention constraint
  // (things-haunt-house#448): inset text and marker fields are held in the frame
  // by the weld ALONE — the design has no mechanical lock — so a spool the
  // planner cannot certify to fuse (e.g. TPU into a PLA pocket) must come back
  // `unresolved`, never placed as a plug that falls out of the print. If the
  // design ever gains a mechanical retention feature, drop `substrate` to return
  // these bonds to advisory.
  const interfaces: (FilamentPaletteInterface & { substrate?: string })[] = []
  if (frameKey) {
    for (const key of [...keyOf('markerBlack'), ...keyOf('markerWhite'), ...textKeys]) {
      interfaces.push({ paletteIds: [frameKey, key], kind: 'bonded', label: `frame+${key}`, substrate: frameKey })
    }
  }

  return {
    schemaVersion: 1,
    palette,
    ...(different.length > 0 ? { constraints: { different } } : {}),
    ...(interfaces.length > 0 ? { interfaces } : {}),
  }
}

/**
 * Identity of the request for caching purposes.
 *
 * The plan is a pure function of (this request, the printer's roster), so a key
 * built from the request's own bytes plus the roster fingerprint the planner
 * returns is exact: it changes when and only when the answer could change. Built
 * from a canonically-ordered structure, so two equal designs agree.
 */
export function filamentPlanRequestKey(request: FilamentPlanRequestV1): string {
  return JSON.stringify(request)
}
