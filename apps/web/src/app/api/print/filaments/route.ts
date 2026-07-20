import { NextResponse } from 'next/server'
import { thhFilamentsToCatalog } from '@/components/create/abacus/abacus-catalog'
import { getLoadedFilaments } from '@/lib/thh/print-client'

// GET /api/print/filaments — the Abacus Studio's THH-AMS filament catalog.
//
// Spends the server-held THH token to read the printer's loaded spools and
// returns them as a studio FilamentCatalog. Expected-unavailable states (no
// token wired, gateway offline, no spools loaded) are reported as 200
// { ok: false, reason } — NOT an HTTP error — so the client falls back to the
// params-derived catalog silently instead of surfacing a failure. Open (like
// /api/build-info): the payload is just the printer's loaded filament colors.

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await getLoadedFilaments()
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason })
  }

  const catalog = thhFilamentsToCatalog(result.rows, result.fetchedAt)
  // An empty AMS is "unavailable" for our purposes — materialize needs at least
  // one spool, and the studio's params fallback is the right behavior here.
  if (catalog.spools.length === 0) {
    return NextResponse.json({ ok: false, reason: 'no-filaments' })
  }

  return NextResponse.json({ ok: true, catalog })
}
