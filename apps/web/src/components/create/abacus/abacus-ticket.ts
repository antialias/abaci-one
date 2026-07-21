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
 * Only a THH-backed catalog can produce a ticket — its spool ids are the real
 * AMS `slotId`s the service resolves; the params stand-in catalog has no
 * physical slots to name.
 */
import type {
  PrintTicketV2,
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
  /** Must be a 'thh-ams' catalog — spool ids are the AMS slotIds. */
  catalog: FilamentCatalog
  /** The settings editor's controlled value, verbatim. */
  style: TicketStyle
  startPolicy: TicketStartPolicy
  /** Dedup key — mint one per submit intent, reuse across retries. */
  idempotencyKey: string
}

export function buildAbacusTicket(args: AbacusTicketArgs): PrintTicketV2 {
  const { name, source, bodies, catalog, style, startPolicy, idempotencyKey } = args

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
    filaments.push({ slotId: spool.id })
  }

  return {
    name,
    source: { ...source, app: PRINT_SOURCE_APP },
    filaments,
    style,
    start: { policy: startPolicy },
    idempotencyKey,
  }
}
