/**
 * Client-side voice error reporting endpoint.
 *
 * When the OpenAI Realtime API sends an error over the WebRTC data channel
 * (e.g. quota_exceeded), the server never sees it — the session was created
 * successfully. This endpoint lets the client report these errors so they
 * appear in server logs for admin visibility.
 *
 * POST /api/realtime/voice-error
 * Body: { code, message, source }
 */

import { withAuth } from '@/lib/auth/withAuth'

export const POST = withAuth(async (request) => {
  const body = await request.json()
  const { code, message, source } = body as {
    code?: string
    message?: string
    source?: string
  }

  const level = /quota|billing|insufficient/i.test(code ?? '') ? 'error' : 'warn'

  console[level](
    '[voice-error] Client reported %s: %s (source: %s)',
    code ?? 'unknown',
    message ?? 'no message',
    source ?? 'unknown'
  )

  return Response.json({ ok: true })
})
