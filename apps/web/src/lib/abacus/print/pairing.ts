/**
 * Pairing with a THH print service (Abacus Studio Phase 2a, #8.2).
 *
 * The service's admin UI hands the user a one-shot artifact `CODE@host`
 * (single-use, ~10-minute TTL). We exchange it server-side for a durable
 * bearer token via the unauthenticated POST /pair, then seal the token at
 * rest. Codes and tokens are credentials: never logged, never echoed back
 * to the browser.
 */
import { PrintServiceError, ensureOk, printServiceFetch } from './print-service-fetch'

export interface PairingArtifact {
  code: string
  /** Normalized origin with scheme, no trailing slash */
  origin: string
}

/** Malformed `CODE@host` input. Messages are user-safe (never contain the code). */
export class PairingArtifactError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PairingArtifactError'
  }
}

/**
 * Parse a `CODE@host` pairing artifact. Split on the LAST `@` — codes are
 * opaque and could themselves contain `@`. The host part may omit the scheme
 * (defaults to https). Throws {@link PairingArtifactError} on malformed input.
 */
export function parsePairingArtifact(artifact: string): PairingArtifact {
  const trimmed = artifact.trim()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at === trimmed.length - 1) {
    throw new PairingArtifactError('Pairing code must look like CODE@host')
  }
  const code = trimmed.slice(0, at)
  const host = trimmed.slice(at + 1)
  const withScheme = /^https?:\/\//i.test(host) ? host : `https://${host}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new PairingArtifactError('Pairing code has an unrecognizable host part')
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new PairingArtifactError('Pairing host must be a bare origin (no path)')
  }
  return { code, origin: url.origin }
}

/**
 * Exchange a pairing code for a durable bearer token.
 * Returns the PLAINTEXT token — the caller seals it before persisting.
 * Throws {@link PrintServiceError} on any upstream failure (invalid/expired
 * code, unreachable service, malformed response).
 */
export async function pairWithService(input: {
  origin: string
  code: string
  /** Client name shown in the service's admin (e.g. "abaci.one (user@example.com)") */
  clientName: string
}): Promise<{ token: string }> {
  const res = await printServiceFetch({ origin: input.origin }, '/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: input.code, name: input.clientName }),
  })
  await ensureOk(res.clone())
  const body = (await res.json().catch(() => null)) as { token?: unknown } | null
  if (!body || typeof body.token !== 'string' || !body.token) {
    throw new PrintServiceError(res.status, 'bad_response', 'pair succeeded but no token returned')
  }
  return { token: body.token }
}
