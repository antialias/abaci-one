/**
 * GET /api/abacus/print/printers/[id]/support-recommendation (Gitea #23)
 *
 * Pass-through of the service's pre-slice support-interface recommendation
 * (things-haunt-house#367): the availability-first rung ladder (dedicated →
 * same-material → cross-material → none) run over the live roster + owned
 * inventory. Never returns null — the abacus *declares* support intent
 * (enable_support) and asks which loaded spool should print the interface.
 *
 * `modelFamily` is REQUIRED and baked into the upstream path we build:
 * `proxyPass` forwards no arbitrary query params (by design — the proxy adds
 * auth + tenancy and nothing else), so the one param the upstream needs must
 * travel inside the path string.
 */
import { NextResponse } from 'next/server'
import { proxyPass } from '@/lib/abacus/print/proxy'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'

export const GET = withAuth(async (request, { params }) => {
  const { id } = (await params) as { id: string }
  const modelFamily = request.nextUrl.searchParams.get('modelFamily')
  if (!modelFamily) {
    return NextResponse.json({ error: 'modelFamily is required' }, { status: 400 })
  }
  const userId = await getUserId()
  return proxyPass(
    request,
    userId,
    `/printers/${encodeURIComponent(id)}/support-recommendation?modelFamily=${encodeURIComponent(modelFamily)}`
  )
})
