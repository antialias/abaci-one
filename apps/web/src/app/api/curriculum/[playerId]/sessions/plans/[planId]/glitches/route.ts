import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { BUILD_ID } from '@/lib/build-id'
import { canPerformAction } from '@/lib/classroom'
import { getSessionPlan } from '@/lib/curriculum'
import {
  GlitchBodyTooLargeError,
  GlitchLimitError,
  glitchCounterLabels,
  MALFORMED_GLITCH_LABELS,
  MalformedGlitchError,
  parseGlitch,
  readGlitchBody,
  storeGlitch,
} from '@/lib/curriculum/glitches'
import { practiceGlitchesTotal } from '@/lib/metrics'
import { getUserId } from '@/lib/viewer'

/**
 * POST /api/curriculum/[playerId]/sessions/plans/[planId]/glitches
 * Record a glitch the session's screen met (practice-kinds §8 A23.3, K5a-3c).
 *
 * Body: `{ ref, kind, clientAt, clientBuild, detail }`, at most 8 KB (413
 * `GLITCH_TOO_LARGE`, read under the cap), whitelisted by `parseGlitch` (400
 * `MALFORMED_GLITCH`); both refusals count as `kind="malformed"`.
 * The record route's checks, in its order: `start-session` → 403, the plan
 * belongs to the player in the path → 404. Idempotent by `(session, ref)`:
 * `{ id, ref, stored }` with 200 either way, so a resend is a no-op. A new
 * reference past 50 rows → 429 `GLITCH_LIMIT` (terminal; the client does not
 * retry). A glitch write never pushes the report: its `rowVersion` is the
 * plan's.
 */
export const POST = withAuth(async (request, { params }) => {
  const { playerId, planId } = (await params) as { playerId: string; planId: string }

  try {
    const userId = await getUserId()
    const canModify = await canPerformAction(userId, playerId, 'start-session')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const ownedPlan = await getSessionPlan(planId)
    if (!ownedPlan || ownedPlan.playerId !== playerId) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const glitch = parseGlitch(await readGlitchBody(request))

    const result = await storeGlitch({
      glitch,
      sessionPlanId: planId,
      playerId,
      serverBuild: BUILD_ID,
      userAgent: request.headers.get('user-agent'),
    })

    if (result.stored) {
      practiceGlitchesTotal.inc({ ...glitchCounterLabels(glitch) })
      // For a live tail only; the row is the record (pod logs die on deploy)
      console.log(
        `[glitch] ${JSON.stringify({
          ref: glitch.ref,
          kind: glitch.kind,
          planId,
          playerId,
          tryId: glitch.detail.tryId,
          shown: glitch.detail.shown,
          stored: glitch.detail.stored,
          reason: glitch.detail.reason,
          clientBuild: glitch.clientBuild,
          serverBuild: BUILD_ID,
          clientAt: glitch.clientAt,
        })}`
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof MalformedGlitchError) {
      practiceGlitchesTotal.inc({ ...MALFORMED_GLITCH_LABELS })
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    if (error instanceof GlitchBodyTooLargeError) {
      practiceGlitchesTotal.inc({ ...MALFORMED_GLITCH_LABELS })
      return NextResponse.json({ error: error.message, code: error.code }, { status: 413 })
    }
    if (error instanceof GlitchLimitError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 429 })
    }
    console.error('Error recording glitch:', error)
    return NextResponse.json({ error: 'Failed to record glitch' }, { status: 500 })
  }
})
