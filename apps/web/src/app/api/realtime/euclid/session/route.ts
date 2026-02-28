/**
 * API route that creates an ephemeral session token for the Euclid voice call.
 *
 * POST /api/realtime/euclid/session
 * Body: { propositionId, currentStep, isComplete, playgroundMode }
 * Returns: { clientSecret, expiresAt, instructions }
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { createRealtimeSession } from '@/lib/voice/createRealtimeSession'
import { PROP_REGISTRY } from '@/components/toys/euclid/propositions/registry'
import { greetingMode } from '@/components/toys/euclid/voice/modes/greetingMode'
import { TOOL_HANG_UP } from '@/components/toys/euclid/voice/tools'
import type { EuclidModeContext } from '@/components/toys/euclid/voice/types'

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { propositionId, currentStep, isComplete, playgroundMode } = body

    if (typeof propositionId !== 'number' || !PROP_REGISTRY[propositionId]) {
      return NextResponse.json(
        { error: 'Invalid propositionId' },
        { status: 400 }
      )
    }

    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 503 }
      )
    }

    const prop = PROP_REGISTRY[propositionId]

    // Build greeting mode context for initial instructions
    const ctx: EuclidModeContext = {
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

    const instructions = greetingMode.getInstructions(ctx)
    const tools = [TOOL_HANG_UP]

    const result = await createRealtimeSession({
      apiKey,
      voice: 'ash',
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

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
