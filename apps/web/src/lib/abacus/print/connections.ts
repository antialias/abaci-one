/**
 * Print-service connection CRUD + browser-safe projection (Phase 2a, #8.2).
 *
 * Every operation is owner-scoped by userId — the tenant boundary from the
 * schema. The browser-facing {@link PrintConnectionView} NEVER carries the
 * sealed token or ring secret; keep it that way.
 */
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { PrintServiceConnection } from '@/db/schema'
import { seal } from '@/lib/secret-box'
import { pairWithService, parsePairingArtifact } from './pairing'
import { PrintServiceError, ensureOk, printServiceFetch } from './print-service-fetch'
import { registerWebhook } from './webhook'

/** What the browser is allowed to see about a connection. No sealed fields — ever. */
export interface PrintConnectionView {
  id: string
  name: string
  origin: string
  webhookRegistered: boolean
  createdAt: Date
  updatedAt: Date
}

export function toConnectionView(row: PrintServiceConnection): PrintConnectionView {
  return {
    id: row.id,
    name: row.name,
    origin: row.origin,
    webhookRegistered: row.webhookRegisteredAt !== null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listConnections(userId: string): Promise<PrintConnectionView[]> {
  const rows = await db.query.printServiceConnections.findMany({
    where: eq(schema.printServiceConnections.userId, userId),
    orderBy: [asc(schema.printServiceConnections.createdAt)],
  })
  return rows.map(toConnectionView)
}

/** Full row (with sealed fields) for server-side use only — never serialize this. */
export async function getOwnedConnection(
  userId: string,
  connectionId: string
): Promise<PrintServiceConnection | undefined> {
  return db.query.printServiceConnections.findFirst({
    where: and(
      eq(schema.printServiceConnections.id, connectionId),
      eq(schema.printServiceConnections.userId, userId)
    ),
  })
}

/**
 * Resolve which connection a proxy call should use: an explicit
 * `?connectionId=` (must be owned), or the user's sole connection.
 * Throws a plain Error with `.status` when ambiguous or missing.
 */
export async function resolveConnection(
  userId: string,
  connectionId: string | null
): Promise<PrintServiceConnection> {
  if (connectionId) {
    const row = await getOwnedConnection(userId, connectionId)
    if (!row) throw Object.assign(new Error('Connection not found'), { status: 404 })
    return row
  }
  const rows = await db.query.printServiceConnections.findMany({
    where: eq(schema.printServiceConnections.userId, userId),
    limit: 2,
  })
  if (rows.length === 0) {
    throw Object.assign(new Error('No print service connected'), { status: 404 })
  }
  if (rows.length > 1) {
    throw Object.assign(new Error('Multiple connections — pass ?connectionId='), { status: 400 })
  }
  return rows[0]
}

export interface CreateConnectionResult {
  connection: PrintConnectionView
  /** Present when pairing succeeded but webhook registration didn't (retryable) */
  webhookWarning?: string
}

/**
 * The full create-via-pair flow: parse the `CODE@host` artifact, exchange the
 * code for a token, persist the sealed token, then best-effort register the
 * doorbell webhook. The connection row is committed BEFORE the webhook
 * attempt — pairing codes are single-use, so a webhook failure must never
 * lose the token. Never logs or returns the code/token.
 */
export async function createConnectionFromPairing(input: {
  userId: string
  artifact: string
  name?: string
  /** For the service admin's client list, e.g. the account email */
  userLabel?: string | null
}): Promise<CreateConnectionResult> {
  const { code, origin } = parsePairingArtifact(input.artifact)
  const { token } = await pairWithService({
    origin,
    code,
    clientName: input.userLabel ? `abaci.one (${input.userLabel})` : 'abaci.one',
  })

  const [row] = await db
    .insert(schema.printServiceConnections)
    .values({
      userId: input.userId,
      name: input.name?.trim() || new URL(origin).host,
      origin,
      tokenSealed: seal(token),
    })
    .returning()

  let webhookWarning: string | undefined
  try {
    await registerWebhook(row)
  } catch (err) {
    webhookWarning =
      err instanceof PrintServiceError && err.code === 'not_pairable'
        ? 'This service uses a fixed token and does not accept webhooks; job updates will rely on polling.'
        : 'Paired, but webhook registration failed; job updates will rely on polling until it is retried.'
  }

  const fresh = await getOwnedConnection(input.userId, row.id)
  return { connection: toConnectionView(fresh ?? row), webhookWarning }
}

export async function renameConnection(
  userId: string,
  connectionId: string,
  name: string
): Promise<PrintConnectionView | undefined> {
  const row = await getOwnedConnection(userId, connectionId)
  if (!row) return undefined
  const [updated] = await db
    .update(schema.printServiceConnections)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(schema.printServiceConnections.id, row.id))
    .returning()
  return toConnectionView(updated)
}

export async function deleteConnection(userId: string, connectionId: string): Promise<boolean> {
  const row = await getOwnedConnection(userId, connectionId)
  if (!row) return false
  await db
    .delete(schema.printServiceConnections)
    .where(eq(schema.printServiceConnections.id, row.id))
  return true
}

export interface ProbeResult {
  ok: boolean
  /** PrintServiceError code when not ok (e.g. "unreachable", "bad_response") */
  reason?: string
  printerCount?: number
}

/**
 * Reachability check via the service's own /printers read. Degrades to a
 * result object — never throws — so a broken connection can't take down the
 * roster UI.
 */
export async function probeConnection(connection: PrintServiceConnection): Promise<ProbeResult> {
  try {
    const res = await ensureOk(
      await printServiceFetch(
        { origin: connection.origin, tokenSealed: connection.tokenSealed },
        '/printers'
      )
    )
    const body = (await res.json().catch(() => null)) as { printers?: unknown[] } | null
    return { ok: true, printerCount: Array.isArray(body?.printers) ? body.printers.length : 0 }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof PrintServiceError ? err.code : 'bad_response',
    }
  }
}
