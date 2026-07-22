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
}

/** Deterministic, key-order-independent serialization — two objects that differ
 *  only in property insertion order sign identically, so React re-renders that
 *  rebuild state objects don't spuriously rotate the key. */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`
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
  })
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
