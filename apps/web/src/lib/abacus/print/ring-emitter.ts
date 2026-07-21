/**
 * Doorbell → socket fan-out (Phase 2a, #8.4), modeled on
 * `lib/classroom/socket-emitter.ts`.
 *
 * TENANT SCOPING IS THE WHOLE POINT: a ring resolves to exactly one owning
 * user (the connection row's userId) and emits to that user's room only —
 * `io.to('user:' + userId)`, never a global `io.emit`. Another account's
 * browser must never observe that this user's printer did anything.
 */

import { getSocketIO } from '@/lib/socket-io'
import { PRINT_JOB_UPDATED_EVENT, type PrintJobUpdatedEvent } from './ring-events'

/**
 * Emit a print-job-updated hint to the owning user's room. Payload is
 * identifiers only (see ring-events.ts) — the client re-reads real state
 * through the authenticated proxy.
 */
export async function emitPrintJobUpdated(
  userId: string,
  payload: PrintJobUpdatedEvent
): Promise<void> {
  const io = await getSocketIO()
  if (!io) return

  try {
    io.to(`user:${userId}`).emit(PRINT_JOB_UPDATED_EVENT, payload)
    console.log(`[PrintRing] ${PRINT_JOB_UPDATED_EVENT} -> user:${userId}`)
  } catch (error) {
    console.error('[PrintRing] Failed to emit print-job-updated:', error)
  }
}
