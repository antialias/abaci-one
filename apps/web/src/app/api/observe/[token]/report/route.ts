import { NextResponse } from 'next/server'
import { isEndedOutcome, sessionOutcome } from '@/db/schema/session-plan-normalize'
import { withAuth } from '@/lib/auth/withAuth'
import { getSessionPlan } from '@/lib/curriculum/session-planner'
import { loadSessionReport } from '@/lib/curriculum/session-report-server'
import { validateSessionShare } from '@/lib/session-share'

/**
 * GET /api/observe/[token]/report
 *
 * The session report for a share link (session architecture §4, Phase 4a).
 * No login: the token is the credential. Completion revokes a session's
 * shares, so a revoked (or session-expired) token still serves the report of
 * a session that has ended, and is refused (410) while the session is live.
 */
export const GET = withAuth(async (_request, { params }) => {
  const { token } = (await params) as { token: string }

  try {
    const validation = await validateSessionShare(token, { allowEnded: true })
    if (!validation.valid || !validation.share) {
      return NextResponse.json({ error: validation.error || 'Invalid share link' }, { status: 404 })
    }

    const plan = await getSessionPlan(validation.share.sessionId)
    const outcome = plan ? sessionOutcome(plan) : null
    if (!plan || outcome === 'deleted' || outcome === 'sentinel') {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (validation.requiresEndedSession && !isEndedOutcome(outcome!)) {
      return NextResponse.json({ error: 'Share link is no longer active' }, { status: 410 })
    }

    return NextResponse.json({ report: await loadSessionReport(plan) })
  } catch (error) {
    console.error('Error building shared session report:', error)
    return NextResponse.json({ error: 'Failed to build session report' }, { status: 500 })
  }
})
