/**
 * Who an on-demand request is, for the hourly caps. Never a header the
 * client sets.
 *
 * 1. A signed-in user: their user id.
 * 2. A guest: the `sid` in the signed guest cookie (verifyGuestToken). The
 *    middleware doesn't run on /api, so no header is trusted here.
 * 3. Otherwise: the client address as the proxy in front of the pod saw it.
 *
 * Prod: NAS Traefik → k3s Traefik → pod. k3s Traefik trusts no forwarded
 * headers (no forwardedHeaders.trustedIPs), so it drops any X-Forwarded-For
 * a client sends and appends the address it saw; that rightmost entry is the
 * only one no client can write. Today that address is the k3s node's SNAT
 * gateway (externalTrafficPolicy: Cluster), so every cookieless client
 * shares one bucket. Real guests carry the cookie; the pod-wide cap is the
 * hard bound either way.
 */
import type { NextRequest } from 'next/server'
import { GUEST_COOKIE_NAME, verifyGuestToken } from '@/lib/guest-token'

/** Proxies between the client and the pod that append to X-Forwarded-For. */
const TRUSTED_PROXY_HOPS = 1

/** The address the nearest trusted proxy saw, or null without one (dev). */
export function trustedClientAddress(headers: Headers): string | null {
  const hops = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
  return hops.length >= TRUSTED_PROXY_HOPS ? hops[hops.length - TRUSTED_PROXY_HOPS] : null
}

export async function requestIdentity(request: NextRequest, userId: string): Promise<string> {
  if (userId) return `user:${userId}`
  const cookie = request.cookies.get(GUEST_COOKIE_NAME)?.value
  if (cookie) {
    try {
      const { sid } = await verifyGuestToken(cookie)
      return `guest:${sid}`
    } catch {
      // Forged or expired: fall through to the address.
    }
  }
  return `ip:${trustedClientAddress(request.headers) ?? 'unknown'}`
}
