/**
 * API route for realtime voice session usage heartbeats.
 *
 * POST /api/realtime/voice-heartbeat
 * Body: { durationSeconds, turnCount, modelCharacters, userCharacters,
 *         toolCallCount, endReason?, final?, model?, feature? }
 *
 * Called periodically (~15s) by the client during a voice session and
 * once more via sendBeacon on disconnect. Each heartbeat overwrites the
 * previous one for the same session (idempotent accumulator pattern).
 */

import { withAuth } from '@/lib/auth/withAuth'
import { recordRealtimeHeartbeat } from '@/lib/ai-usage/helpers'
import { AiFeature, type AiFeatureValue } from '@/lib/ai-usage/features'

const VALID_FEATURES = new Set<AiFeatureValue>([
  AiFeature.EUCLID_VOICE,
  AiFeature.NUMBER_LINE_VOICE,
])

export const POST = withAuth(async (request, { userId }) => {
  try {
    const body = await request.json()
    const {
      durationSeconds,
      turnCount,
      modelCharacters,
      userCharacters,
      toolCallCount,
      endReason,
      final,
      model,
      feature,
    } = body

    if (typeof durationSeconds !== 'number' || durationSeconds < 0) {
      return Response.json({ error: 'durationSeconds is required' }, { status: 400 })
    }

    const resolvedFeature: AiFeatureValue =
      feature && VALID_FEATURES.has(feature) ? feature : AiFeature.NUMBER_LINE_VOICE
    const resolvedModel = typeof model === 'string' ? model : 'gpt-realtime-1.5'

    recordRealtimeHeartbeat(
      {
        durationSeconds: durationSeconds ?? 0,
        turnCount: turnCount ?? 0,
        modelCharacters: modelCharacters ?? 0,
        userCharacters: userCharacters ?? 0,
        toolCallCount: toolCallCount ?? 0,
        endReason: endReason ?? undefined,
        final: final ?? false,
      },
      resolvedModel,
      { userId, feature: resolvedFeature }
    )

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[voice-heartbeat] Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})
