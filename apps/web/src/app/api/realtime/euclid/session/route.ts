/**
 * API route that creates an ephemeral session token for a geometry teacher voice call.
 *
 * POST /api/realtime/euclid/session
 * Body: { propositionId, currentStep, isComplete, playgroundMode, characterId? }
 * Returns: { clientSecret, expiresAt, instructions }
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createRealtimeSession } from '@/lib/voice/createRealtimeSession'
import { PROP_REGISTRY } from '@/components/toys/euclid/propositions/registry'
import { PLAYGROUND_PROP } from '@/components/toys/euclid/propositions/playground'
import { TOOL_HANG_UP } from '@/components/toys/euclid/voice/tools'
import type { GeometryModeContext } from '@/components/toys/euclid/voice/types'
import { getTeacherConfig } from '@/components/toys/euclid/characters/registry'
import type { AttitudeId } from '@/components/toys/euclid/voice/attitudes/types'

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { propositionId, currentStep, isComplete, playgroundMode, characterId, attitudeId } = body

    const prop = propositionId === 0 ? PLAYGROUND_PROP : PROP_REGISTRY[propositionId]
    if (typeof propositionId !== 'number' || !prop) {
      return NextResponse.json({ error: 'Invalid propositionId' }, { status: 400 })
    }

    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
    }

    const config = getTeacherConfig(characterId, attitudeId as AttitudeId | undefined)

    // Build greeting mode context for initial instructions
    const ctx: GeometryModeContext = {
      propositionId,
      propositionTitle: prop.title,
      propositionKind: prop.kind ?? 'construction',
      currentStep: typeof currentStep === 'number' ? currentStep : 0,
      totalSteps: prop.steps.length,
      isComplete: !!isComplete,
      construction: { elements: [], nextLabelIndex: 0, nextColorIndex: 0 },
      proofFacts: [],
      screenshotDataUrl: null,
      playgroundMode: !!playgroundMode,
      steps: prop.steps,
    }

    const instructions = config.modes.greeting.getInstructions(ctx)
    const tools = [TOOL_HANG_UP]

    const result = await createRealtimeSession({
      apiKey,
      voice: config.voice.id,
      instructions,
      tools,
    })

    return NextResponse.json({
      clientSecret: result.clientSecret,
      expiresAt: result.expiresAt,
      instructions,
    })
  } catch (error) {
    console.error('[realtime/euclid/session] Error:', error)

    // Pass through classified errors from createRealtimeSession
    if (error instanceof Error && 'code' in error) {
      const classified = error as Error & { code: string; status: number }
      return NextResponse.json(
        { error: classified.message, code: classified.code },
        { status: 502 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
