/**
 * Doorbell event contract (Phase 2a, #8.4) — client-safe: just the event name
 * and payload shape, no server imports, so the browser listener and the
 * server emitter share one definition.
 *
 * Design triad: the ring is a HINT ("something about your print changed"),
 * the authenticated proxy read is truth, and a slow poll is the backstop.
 * The payload therefore carries identifiers only — never job state — and the
 * client responds by invalidating queries and re-reading through the proxy.
 */

export const PRINT_JOB_UPDATED_EVENT = 'print-job-updated'

export interface PrintJobUpdatedEvent {
  /** The connection the ring arrived on (always known — it's in the ring URL) */
  connectionId: string
  /** Best-effort fields from the service's ring body — may be absent */
  jobId?: string
  printerId?: string
  phase?: string
}
