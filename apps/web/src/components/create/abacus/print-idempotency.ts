/**
 * Content-bound idempotency keys for abacus print submits.
 *
 * THH dedupes a submit on `(printerId, idempotencyKey)` ALONE — it never
 * compares the model or ticket (verified in the gateway: `find_idempotent`
 * matches the key and returns the existing job's view at HTTP 202, no payload
 * check). So a key is only safe to reuse for the *same logical print*: reusing
 * it after the design changed makes THH silently replay the OLD job while
 * reporting success, and the edit is lost.
 *
 * Binding the key to the panel's lifetime (mint once, reset on success) breaks
 * exactly this way: if a submit's 202 is lost in transit, the key survives, and
 * the next submit — with edited settings — is deduped onto the stale job.
 *
 * The fix here binds the key to a SIGNATURE of everything that determines the
 * print. An unchanged resubmit (the lost/ambiguous-response retry idempotency
 * exists for) keeps its key, so THH safely replays the one job. Any edit
 * rotates the key, so the edit becomes a new job instead of a silent no-op.
 */
import type { TicketStartPolicy, TicketStyle } from '@eink/print-dialog'
import { fnv1a32Hex } from '@/lib/fnv1a'
import { stableStringify } from '@/lib/stable-stringify'
import type { FilamentMap, Params } from './abacus-model'

/** A minted key paired with the content signature it was minted for. */
export interface IdempotencyToken {
  readonly sig: string
  readonly key: string
}

/** Everything a submit encodes that changes the physical artifact. `slotLabels`
 *  are the catalog spool names the model embeds; the rest are the user's knobs. */
export interface AbacusPrintSignatureInputs {
  readonly params: Params
  readonly filamentMap: FilamentMap
  readonly slotLabels: readonly string[]
  readonly style: TicketStyle
  readonly startPolicy: TicketStartPolicy
  /** The support-interface pick riding the ticket (THH#367) — `null` when
   *  supports are off or the interface prints in the model material. Changing
   *  the pick changes the physical print, so it must rotate the key. */
  readonly supportInterfaceSlotId: string | null
}

/** The content signature: identical inputs → identical string, any change → a
 *  different string. Err toward including anything the user can edit — an extra
 *  rotation only costs a safe replay; a missed field risks a silent stale print. */
export function abacusPrintSignature(inputs: AbacusPrintSignatureInputs): string {
  return stableStringify({
    params: inputs.params,
    filamentMap: inputs.filamentMap,
    slotLabels: inputs.slotLabels,
    style: inputs.style,
    startPolicy: inputs.startPolicy,
    supportInterfaceSlotId: inputs.supportInterfaceSlotId,
  })
}

/**
 * The filename the 3MF is uploaded under — content-bound, for the same reason
 * the idempotency key is.
 *
 * THH derives a model's IDENTITY from its filename: `normalizeModelKey` takes
 * the basename, strips the extension, a trailing Bambu `_plate_N` suffix and a
 * trailing copy counter, then lowercases. That key addresses the cached mesh its
 * ghost/orbit viewer renders. A constant name like `abacus-13col.3mf` therefore
 * collapses EVERY 13-column design onto one model, and the viewer shows whichever
 * abacus THH cached first no matter what we just sent. (THH treating a filename
 * as content identity is its own bug, tracked separately — this keeps us honest
 * regardless of when that lands.)
 *
 * Binding the name to the same signature the idempotency key uses gives distinct
 * designs distinct models, and an unchanged resubmit the same one.
 *
 * The `h` prefix on the hash is load-bearing: THH's copy-counter rule strips a
 * trailing `-<digits>`, and an all-digit hex hash (~2.3% of them) would be eaten
 * right back off, silently restoring the collision we are fixing.
 */
export function abacusModelFileName(cols: number, sig: string): string {
  return `abacus-${cols}col-h${fnv1a32Hex(sig)}.3mf`
}

/**
 * Resolve the idempotency token for a submit whose content hashes to `sig`.
 * Reuses `prev` iff it was minted for the same signature; otherwise mints a
 * fresh key via `mint`. Pure — the panel keeps the returned token in a ref and
 * clears it to `null` on success so the next print (even an identical one) is a
 * new job.
 */
export function resolveIdempotencyKey(
  prev: IdempotencyToken | null,
  sig: string,
  mint: () => string
): IdempotencyToken {
  return prev && prev.sig === sig ? prev : { sig, key: mint() }
}
