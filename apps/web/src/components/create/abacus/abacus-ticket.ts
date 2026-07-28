/**
 * v2 print-ticket assembly for the abacus (Phase 2b, Gitea #9).
 *
 * Builds the `PrintTicketV2` that rides the multipart submit next to the 3MF.
 * The filament list mirrors the model's extruder assignment: `meshesToThreeMf`
 * groups same-colour bodies onto one extruder in first-appearance order, so the
 * ticket lists one spool per DISTINCT body colour, in that same order — a spool
 * per extruder, never a spool per role.
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
import type { FilamentCatalog } from './abacus-catalog'

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
}

/** The abacus studio's `authoring` block (things-haunt-house#408). The link is
 *  SHALLOW for now (abaci#22): it reopens the studio — `?player=` restores the
 *  student's identity when one is selected — but the full ~70-key design isn't
 *  URL-addressable yet. `origin` defaults to the running instance's own origin,
 *  never hardcoded. Returns null off-https: the service rejects a non-https
 *  editUrl at submit, so a dev instance (http://localhost) omits the block
 *  rather than failing every submit. */
export function buildAbacusAuthoring(
  playerId: string | null,
  origin?: string
): TicketAuthoring | null {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  if (!base.startsWith('https://')) return null
  const editUrl = playerId
    ? `${base}/create/abacus?player=${encodeURIComponent(playerId)}`
    : `${base}/create/abacus`
  return { editUrl, editTool: 'Abacus Studio' }
}

export function buildAbacusTicket(args: AbacusTicketArgs): PrintTicketV2 {
  const { name, source, bodies, catalog, style, startPolicy, idempotencyKey, authoring } = args

  if (catalog.source !== 'thh-ams') {
    throw new Error(
      'print submission needs the AMS filament roster — the params catalog has no real slot ids'
    )
  }
  if (bodies.length === 0) {
    throw new Error('nothing to print — the 3MF has no bodies')
  }

  // One filament per distinct body colour, in body (= extruder) order.
  const seenColors = new Set<string>()
  const filaments: TicketFilament[] = []
  for (const body of bodies) {
    const color = body.colorHex.toLowerCase()
    if (seenColors.has(color)) continue
    seenColors.add(color)
    const spool = catalog.spools[body.slot]
    if (!spool) {
      throw new Error(`3MF body "${body.label}" references slot ${body.slot}, not in the catalog`)
    }
    // An AMS slot names its physical `slotId`; a no-AMS external spool (#19) has no
    // slot — the service resolves it by {external, family} instead. The catalog only
    // marks a spool external when its family is a real string, so `family` here is
    // always concrete (a null-family external is dropped before it reaches a spool).
    filaments.push(
      spool.external ? { external: true, family: spool.material } : { slotId: spool.id }
    )
  }

  // A no-AMS print is single-filament by construction — one nozzle, one external
  // spool. More than one external means the catalog projection went wrong upstream;
  // fail loud rather than silently collapse the design onto the wrong colour.
  if (filaments.filter((f) => 'external' in f).length > 1) {
    throw new Error('an external (no-AMS) print carries exactly one spool; got multiple')
  }

  return {
    name,
    source: { ...source, app: PRINT_SOURCE_APP },
    ...(authoring ? { authoring } : {}),
    filaments,
    style,
    start: { policy: startPolicy },
    idempotencyKey,
  }
}
