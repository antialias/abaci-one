/**
 * v2 print-ticket assembly for the abacus (Phase 2b, Gitea #9).
 *
 * Builds the `PrintTicketV2` that rides the multipart submit next to the 3MF.
 * The filament list mirrors the model's extruder assignment: `buildAbacusThreeMf`
 * emits one body per filament SLOT (ascending, each on its own extruder), so the
 * ticket lists one spool per distinct slot, in that same order — a spool per
 * extruder, never a spool per role, and never collapsed by colour (two slots can
 * share a hex — a black TPU feet spool next to a black PLA frame spool — and
 * still need two entries or the extruder→spool alignment on THH shifts by one).
 *
 * The style block is the settings editor's controlled value, passed through
 * verbatim (v2 discipline: nothing here injects or defaults process keys).
 * Only a THH-backed catalog can produce a ticket — an AMS slot rides as its real
 * `slotId`, while a no-AMS external spool (#19) rides as `{external, family}`
 * since it has no slot; the params stand-in catalog has neither and is refused.
 */
import type {
  PrintTicketV2,
  TicketAuthoring,
  TicketFilament,
  TicketSource,
  TicketStartPolicy,
  TicketStyle,
} from '@eink/print-dialog'
import { PRINT_SOURCE_APP } from '@/lib/abacus/print/source-app'
import type { SpoolBodySummary } from './abacus-3mf'
import { coPrintGroup, type FilamentCatalog } from './abacus-catalog'
import { studioHref } from './studio-url'
import type { SeamToolOverrides, TwoStageChain, TwoStageSplit } from './two-stage-print'

export interface AbacusTicketArgs {
  /** Job name shown on the service, e.g. "Abacus — 13 columns". */
  name: string
  /** Provenance minus `app`, which this module owns. */
  source: Omit<TicketSource, 'app'>
  /** The bodies that actually went into the 3MF (ascending slot order). */
  bodies: readonly SpoolBodySummary[]
  /** Must be a 'thh-ams' catalog — an AMS spool rides as its slotId, a no-AMS
   *  external spool as `{external, family}`. */
  catalog: FilamentCatalog
  /** The settings editor's controlled value, verbatim. */
  style: TicketStyle
  startPolicy: TicketStartPolicy
  /** Dedup key — mint one per submit intent, reuse across retries. */
  idempotencyKey: string
  /** Source-editor hand-off (things-haunt-house#408) — the service renders
   *  "Edit in Abacus Studio ↗" on the job. Omitted (null) off-https, since the
   *  service 400s a non-https editUrl. Build with `buildAbacusAuthoring`. */
  authoring?: TicketAuthoring | null
  /** The operator's support-interface pick (Gitea #23, THH#367): which loaded
   *  AMS slot prints the support-interface layers. `null`/absent = print the
   *  interface in the model material — a real state, not an unset sentinel.
   *  The CALLER passes a pick only when the style enables supports — THH 400s
   *  a role entry on a supports-off ticket, and the v2 discipline here means
   *  this builder never reads or edits `style.process` to check. */
  supportInterfaceSlotId?: string | null
  /** THH's bounded profile + the pin packed into the emitted 3MF. Null on a
   *  single-filament job (no tower) or against a pre-contract service. */
  wipeTower?: AbacusWipeTowerRequest | null
  /** Two-stage feet print (Gitea #38 / things-haunt-house#456). Stage A rides
   *  `split` (seam + external feed), Stage B rides `chain` — never both. */
  split?: TwoStageSplit | null
  chain?: TwoStageChain | null
  /** Filament overlay for filaments[0], the seam tool — the two-stage recipe
   *  rides it on BOTH stages so the resolved plans match. */
  seamToolOverrides?: SeamToolOverrides | null
  /** The feet-only variant (Gitea #45 / things-haunt-house#466): the loaded slot
   *  that prints the SUPPORT BODY, tagged `role: 'support'` on its EXISTING model
   *  entry — the frame's spool supporting the frame. Rides both stages. With it,
   *  Stage A's `split` carries `partition: 'seam-tool-model'`, and the support
   *  interface may be any loaded slot: it prints in Stage B, not below the seam. */
  supportBodySlotId?: string | null
}

export interface AbacusWipeTowerRequest {
  profile: string
  pinMm: { x: number; y: number }
  /** The filament count whose envelope row the plate reserved bed area for. THH
   *  compares it against the resolved plan and rejects a disagreement synchronously
   *  (`wipe_tower_filament_mismatch`) — a wrong-sized hole caught in the API call
   *  instead of minutes later as a slice-time conflict. Omitted, the service takes
   *  the pre-#433 legacy leg and checks nothing. */
  packedForFilaments?: number
}

export interface AbacusPrintTicket extends Omit<PrintTicketV2, 'filaments'> {
  readonly filaments: readonly TicketFilament[]
  wipeTower?: AbacusWipeTowerRequest
  split?: TwoStageSplit
  chain?: TwoStageChain
}

/** The abacus studio's `authoring` block (things-haunt-house#408). With a
 *  `designId` (abaci#22) the link is DEEP: `?design=` restores the persisted
 *  full-fidelity snapshot, `?player=` keeps selecting the student. Without one
 *  (snapshot persist failed — it never blocks a print) the link degrades to
 *  the shallow reopen-the-studio form. The URL shares `studioHref` with the
 *  page's own navigation — one derivation, so the hand-off link and the
 *  address bar can't drift. `origin` defaults to the running instance's own
 *  origin, never hardcoded. Returns null off-https: the service rejects a
 *  non-https editUrl at submit, so a dev instance (http://localhost) omits
 *  the block rather than failing every submit. */
export function buildAbacusAuthoring(
  playerId: string | null,
  opts?: { designId?: string | null; origin?: string }
): TicketAuthoring | null {
  const base = opts?.origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  if (!base.startsWith('https://')) return null
  const editUrl = `${base}${studioHref('/create/abacus', {
    playerId,
    designId: opts?.designId ?? null,
  })}`
  return { editUrl, editTool: 'Abacus Studio' }
}

export function buildAbacusTicket(args: AbacusTicketArgs): AbacusPrintTicket {
  const {
    name,
    source,
    bodies,
    catalog,
    style,
    startPolicy,
    idempotencyKey,
    authoring,
    supportInterfaceSlotId = null,
    wipeTower,
    split = null,
    chain = null,
    seamToolOverrides = null,
    supportBodySlotId = null,
  } = args

  if (catalog.source !== 'thh-ams') {
    throw new Error(
      'print submission needs the AMS filament roster — the params catalog has no real slot ids'
    )
  }
  if (bodies.length === 0) {
    throw new Error('nothing to print — the 3MF has no bodies')
  }

  // One filament per distinct SLOT, in body (= extruder) order. Slot — not
  // colour — is the extruder key: the 3MF assembly gives every slot its own
  // extruder, so two same-hex slots (black TPU feet + black PLA frame, the
  // likely printed-feet default) must emit two entries. Colour-dedupe here was
  // a latent misalignment inherited from meshesToThreeMf's receipt-path
  // grouping; the abacus assembly never merges bodies by colour. The slot set
  // is belt-and-braces — buildAbacusThreeMf already emits one body per slot.
  const seenSlots = new Set<number>()
  const filaments: TicketFilament[] = []
  for (const body of bodies) {
    if (seenSlots.has(body.slot)) continue
    seenSlots.add(body.slot)
    const spool = catalog.spools[body.slot]
    if (!spool) {
      // Post-#37 this has one likely cause worth naming: `planToFilamentMap`
      // appends a DESIGN-COLOR slot past the end of the roster for any role the
      // service could not place, so the viewer can paint the user's intent. Such a
      // slot has no spool and must never reach a ticket — the panel gates on it
      // (`unplacedRoles`), and this is the backstop behind that gate.
      throw new Error(
        `3MF body "${body.label}" references slot ${body.slot}, not in the catalog` +
          (body.slot >= catalog.spools.length
            ? ' — this is an unplaced role rendering in its designed color, which has no filament to print in'
            : '')
      )
    }
    // An AMS slot names its physical `slotId`; a no-AMS external spool (#19) has no
    // slot — the service resolves it by {external, family} instead. The catalog only
    // marks a spool external when its family is a real string, so `family` here is
    // always concrete (a null-family external is dropped before it reaches a spool).
    filaments.push(
      spool.external ? { external: true, family: spool.material } : { slotId: spool.id }
    )
  }

  // A printer has ONE external spool holder, so at most one external entry can
  // ever be real — more means the catalog projection went wrong upstream, and
  // silently collapsing the design onto the wrong colour is the worse failure.
  //
  // Note what this deliberately does NOT refuse: an external entry alongside AMS
  // slots. The holder is a selectable feed, not a no-AMS fallback — a printer with
  // an AMS can still pull from it, and that mixed roster is a normal multi-material
  // print. "No AMS" is the narrower shape the panel detects as the external being
  // the ONLY spool (`monochromeExternal`).
  const externals = filaments.filter((f) => 'external' in f).length
  if (externals > 1) {
    throw new Error('a printer has one external spool holder; got multiple external filaments')
  }

  // The support-interface role entry (THH#367). THH's contract: at most one,
  // must reference a LOADED slot (never external), must be the LAST filaments
  // entry, must not be the only one — THH computes `support_interface_filament`
  // from entry order (the key itself is policy-blocked in client style.process).
  // The model entries above must stay in body order or extruder→spool alignment
  // shifts, so a pick that coincides with a model entry is NOT appended: tagging
  // it would either duplicate the slot or move a model entry out of extruder
  // order. This is the backstop, not the user-facing story — the panel already
  // withholds design slots from the pickable roster (`designSlotIds`), so the
  // editor never shows a pick that would land here and be dropped.
  if (supportInterfaceSlotId !== null) {
    const spool = catalog.spools.find((s) => s.id === supportInterfaceSlotId)
    if (!spool) {
      throw new Error(
        `support-interface slot "${supportInterfaceSlotId}" is not in the loaded roster`
      )
    }
    if (spool.external) {
      throw new Error('the support interface must be a loaded AMS slot, never the external spool')
    }
    if (filaments.some((f) => 'external' in f)) {
      throw new Error(
        'a no-AMS (external-spool) print cannot route its support interface to an AMS slot'
      )
    }
    const coincides = filaments.some((f) => 'slotId' in f && f.slotId === supportInterfaceSlotId)
    if (!coincides) {
      filaments.push({ slotId: supportInterfaceSlotId, role: 'support-interface' })
    }
  }

  // The support-BODY role (things-haunt-house#466) rides an EXISTING model entry:
  // no new entry and no position rule, so extruder→spool alignment is untouched.
  // It is the feet-only variant's whole filament story — the frame's PLA supports
  // the frame — and the interface follows it unless an interface entry above says
  // otherwise. THH: at most one, a loaded slot, the same `enable_support` gate.
  if (supportBodySlotId !== null) {
    const spool = catalog.spools.find((s) => s.id === supportBodySlotId)
    if (!spool) {
      throw new Error(`support-body slot "${supportBodySlotId}" is not in the loaded roster`)
    }
    if (spool.external) {
      throw new Error('the support body must be a loaded AMS slot, never the external spool')
    }
    const idx = filaments.findIndex((f) => 'slotId' in f && f.slotId === supportBodySlotId)
    const entry = idx >= 0 ? filaments[idx] : undefined
    if (!entry || !('slotId' in entry)) {
      throw new Error(
        `support-body slot "${supportBodySlotId}" prints no model body — the role rides the frame's own entry, it does not add one`
      )
    }
    filaments[idx] = { ...entry, role: 'support' }
  }

  // Two-stage feet print (Gitea #38 / things-haunt-house#456): Stage A = this same
  // filament list + `split`, Stage B = the same list + `chain`. THH's slice
  // invariants are refused HERE, at submit, rather than surfacing as a
  // `split_failed` minutes into a slice: the seam tool is filaments[0] and must
  // be a LOADED slot (the external feed is declared in `split.feed`, never as a
  // filament entry — that would be the #19 no-AMS shape); the feed family must
  // be filament 0's (alias-folded, TPU-AMS ≡ TPU); and no tool may change below
  // the seam, so a routed support interface — whose layers sit right under the
  // frame, i.e. under the seam — has to coincide with filament 0.
  if (split && chain) {
    throw new Error(
      'split and chain cannot ride one ticket — Stage B chains, it does not split again'
    )
  }
  if (split || chain) {
    const seamTool = filaments[0]
    if (!('slotId' in seamTool)) {
      throw new Error(
        'a two-stage print needs a loaded AMS slot as filament 0 — the external feed rides in split.feed'
      )
    }
    // The feet-only variant (Gitea #45): a role-partitioned Stage A keeps only the
    // seam tool's model runs, so the support interface no longer sits below the
    // seam and may be any loaded slot. The variant is named by its support body
    // and, on Stage A, by the partition — one without the other is half a ticket.
    const feetOnly = supportBodySlotId !== null
    if (split && (split.partition === 'seam-tool-model') !== feetOnly) {
      throw new Error(
        feetOnly
          ? 'a support body without split.partition "seam-tool-model" — the feet-only variant needs both'
          : 'split.partition "seam-tool-model" names no support body — the feet-only variant prints its supports in the frame spool (role: "support")'
      )
    }
    if (feetOnly && supportBodySlotId === seamTool.slotId) {
      throw new Error(
        'the feet-only variant prints its supports in a spool other than the feet — the seam tool cannot be the support body'
      )
    }
    if (
      !feetOnly &&
      supportInterfaceSlotId !== null &&
      supportInterfaceSlotId !== seamTool.slotId
    ) {
      throw new Error(
        'a two-stage print prints its support interface in filament 0 — routing it to another slot is a tool change below the seam'
      )
    }
    if (split) {
      if (!(split.atZMm > 0 && split.atZMm <= 100)) {
        throw new Error(`split.atZMm must be in (0, 100] mm above the plate; got ${split.atZMm}`)
      }
      const spool = catalog.spools.find((s) => s.id === seamTool.slotId)
      if (!spool || coPrintGroup(spool.material) !== coPrintGroup(split.feed.family)) {
        throw new Error(
          `split.feed.family "${split.feed.family}" is not filament 0's family (${spool?.material ?? 'unknown'})`
        )
      }
    }
  }
  if (seamToolOverrides && Object.keys(seamToolOverrides).length > 0) {
    filaments[0] = { ...filaments[0], overrides: seamToolOverrides }
  }
  return {
    name,
    source: { ...source, app: PRINT_SOURCE_APP },
    ...(authoring ? { authoring } : {}),
    filaments,
    style,
    start: { policy: startPolicy },
    idempotencyKey,
    ...(wipeTower ? { wipeTower } : {}),
    ...(split ? { split } : {}),
    ...(chain ? { chain } : {}),
  }
}
