/**
 * POST /api/abacus/print/printers/[id]/filament-plan (Gitea #37)
 *
 * Pass-through of the service's `filament-plan/v1` planner
 * (things-haunt-house#442): the studio POSTs colour/material/role/interface
 * intent over stable palette ids, and the service maps them onto the spools
 * that are LOADED RIGHT NOW. It writes nothing and slices nothing — the
 * request carries no geometry and no ticket.
 *
 * POST for a read-shaped question on purpose: the palette, the same/different
 * constraints and the interface list are a structured body, not a query
 * string. That costs us HTTP caching, which is why the caller memoizes the
 * response against the design's identity and the plan's own
 * `rosterFingerprint` rather than against a URL.
 *
 * The reply is deliberately advisory: a plan the printer can't satisfy comes
 * back 200 with `status: 'degraded' | 'unresolved'` and reasons, so an
 * unloaded colour is a warning the studio can render, never an error page.
 * Only malformed input, auth and printer identity are 4xx — and those relay
 * upstream verbatim, because the service's `{code, message}` detail is the
 * only thing that says WHICH palette entry was malformed.
 */
import { proxyPass } from '@/lib/abacus/print/proxy'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'

export const POST = withAuth(async (request, { params }) => {
  const { id } = (await params) as { id: string }
  const userId = await getUserId()
  return proxyPass(request, userId, `/printers/${encodeURIComponent(id)}/filament-plan`)
})
