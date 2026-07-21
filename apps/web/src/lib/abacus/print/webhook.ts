/**
 * Doorbell webhook registration (Abacus Studio Phase 2a, #8.2/#8.4).
 *
 * After pairing, we register a per-connection ring URL with the print
 * service: `PUT /webhook {url, secret}` (full-replacement semantics on the
 * service side). The secret authenticates inbound rings at
 * `/api/abacus/print/ring/[connectionId]` and is sealed at rest.
 *
 * Registration is deliberately separable from pairing: pairing codes are
 * single-use, so a webhook failure must never lose a freshly minted token.
 * Callers persist the connection first, then attempt registration, and can
 * re-run it any time.
 */
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { PrintServiceConnection } from '@/db/schema'
import { seal } from '@/lib/secret-box'
import { ensureOk, printServiceFetch } from './print-service-fetch'

/**
 * Origin the print service should ring back to. `PRINT_RING_ORIGIN` overrides
 * for split-horizon setups; otherwise the public site origin (which
 * split-horizon DNS makes LAN-reachable in the home deployment).
 */
export function ringOrigin(): string {
  return process.env.PRINT_RING_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || 'https://abaci.one'
}

export function ringUrlFor(connectionId: string): string {
  return `${ringOrigin().replace(/\/+$/, '')}/api/abacus/print/ring/${connectionId}`
}

/**
 * Mint a fresh ring secret, register the webhook upstream, and persist the
 * sealed secret + registration timestamp on the connection row.
 *
 * Throws {@link PrintServiceError} on upstream failure (notably
 * `409 not_pairable` for env-token services) — the caller decides whether
 * that's fatal (explicit re-register) or a degraded state (initial pairing).
 * Nothing is persisted unless the upstream PUT succeeded.
 */
export async function registerWebhook(connection: PrintServiceConnection): Promise<void> {
  const secret = randomBytes(32).toString('base64url')

  const res = await printServiceFetch(
    { origin: connection.origin, tokenSealed: connection.tokenSealed },
    '/webhook',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: ringUrlFor(connection.id), secret }),
    }
  )
  await ensureOk(res)

  await db
    .update(schema.printServiceConnections)
    .set({
      ringSecretSealed: seal(secret),
      webhookRegisteredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.printServiceConnections.id, connection.id))
}
