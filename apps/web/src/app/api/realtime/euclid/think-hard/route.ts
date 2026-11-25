/**
 * API route for the "think hard" tool: a reasoning call with vision.
 *
 * POST /api/realtime/euclid/think-hard
 * Body: { question, effort, screenshot, proofState, propositionId, currentStep }
 * Returns: { answer: string }
 *
 * Goes through the app's LLM client (default provider: claude_code) with the
 * requested reasoning effort.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  buildReferenceContext,
  PROPOSITION_SUMMARIES,
} from '@/components/toys/euclid/agent/euclidReferenceContext'
import { PROP_REGISTRY } from '@/components/toys/euclid/propositions/registry'
import { AiFeature } from '@/lib/ai-usage/features'
import { trackedCall } from '@/lib/ai-usage/llm-middleware'
import { withAuth } from '@/lib/auth/withAuth'
import { llm } from '@/lib/llm'

const VALID_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const
type Effort = (typeof VALID_EFFORTS)[number]

const AnswerSchema = z.object({
  answer: z.string().describe('Your answer, to be spoken aloud by Euclid'),
})

export const POST = withAuth(async (request, { userId }) => {
  try {
    const body = await request.json()
    const { question, effort, screenshot, proofState, propositionId, currentStep } = body

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    const effortLevel = VALID_EFFORTS.includes(effort) ? (effort as Effort) : 'medium'

    // Build context for the reasoning model
    const propId = typeof propositionId === 'number' ? propositionId : 1
    const prop = PROP_REGISTRY[propId]
    const propSummary = PROPOSITION_SUMMARIES[propId]
    const referenceContext = buildReferenceContext(propId)

    const systemText = `You are a geometry reasoning engine analyzing Euclid's Elements Book I.

=== CURRENT PROPOSITION ===
Proposition I.${propId}: "${propSummary?.statement ?? prop?.title ?? 'Unknown'}" (${propSummary?.type ?? 'Unknown'})
Current step: ${typeof currentStep === 'number' ? currentStep + 1 : 'unknown'}

=== PROOF STATE ===
${typeof proofState === 'string' ? proofState : 'Not available'}

=== REFERENCE MATERIAL ===
${referenceContext}

=== TASK ===
Answer the following geometric question. Be rigorous and cite specific postulates, definitions, common notions, and previously proven propositions by name. If the question involves the visual construction, analyze the screenshot carefully.

Keep your answer concise but thorough — it will be spoken aloud by an AI character playing Euclid.`

    const images: string[] = []
    if (screenshot && typeof screenshot === 'string') {
      const base64 = screenshot.includes(',') ? screenshot.split(',')[1] : screenshot
      images.push(`data:image/png;base64,${base64}`)
    }

    let answer: string
    try {
      const response = await trackedCall(
        llm,
        {
          system: systemText,
          prompt: `Question: ${question}`,
          images: images.length ? images : undefined,
          schema: AnswerSchema,
          reasoningEffort: effortLevel,
          timeoutMs: 180_000,
        },
        { userId, feature: AiFeature.EUCLID_THINK_HARD }
      )
      answer = response.data.answer.trim() || 'I could not find the answer in my writings.'
    } catch (err) {
      console.error('[think-hard] LLM error:', err)
      return NextResponse.json(
        { error: 'Could not work through the proof right now.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('[think-hard] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
