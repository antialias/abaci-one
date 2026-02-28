/**
 * API route for the "think hard" tool — GPT-5.2 Responses API with vision.
 *
 * POST /api/realtime/euclid/think-hard
 * Body: { question, effort, screenshot, proofState, propositionId, currentStep }
 * Returns: { answer: string }
 *
 * Uses the OpenAI Responses API with configurable reasoning effort.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { PROP_REGISTRY } from '@/components/toys/euclid/propositions/registry'
import { PROPOSITION_SUMMARIES, buildReferenceContext } from '@/components/toys/euclid/voice/euclidReferenceContext'

const VALID_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const
type Effort = (typeof VALID_EFFORTS)[number]

// Map our effort levels to the Responses API reasoning.effort values
const EFFORT_MAP: Record<Effort, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'high', // 'xhigh' maps to 'high' — the Responses API doesn't support 'xhigh'
}

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { question, effort, screenshot, proofState, propositionId, currentStep } = body

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    const effortLevel = VALID_EFFORTS.includes(effort) ? (effort as Effort) : 'medium'

    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
    }

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

    // Build input content parts
    const contentParts: Array<Record<string, unknown>> = [
      { type: 'input_text', text: `${systemText}\n\nQuestion: ${question}` },
    ]

    // Add screenshot if available
    if (screenshot && typeof screenshot === 'string') {
      const base64 = screenshot.includes(',') ? screenshot.split(',')[1] : screenshot
      contentParts.push({
        type: 'input_image',
        image_url: `data:image/png;base64,${base64}`,
      })
    }

    // Call the Responses API
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        input: [
          {
            role: 'user',
            content: contentParts,
          },
        ],
        reasoning: {
          effort: EFFORT_MAP[effortLevel],
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[think-hard] API error:', response.status, errText)
      return NextResponse.json(
        { error: 'Reasoning oracle is unavailable right now.' },
        { status: 502 }
      )
    }

    const data = await response.json()

    // Extract text from response output
    let answer = 'The oracle could not find an answer.'
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === 'output_text' && part.text) {
              answer = part.text
              break
            }
          }
        }
      }
    }

    return NextResponse.json({ answer })
  } catch (error) {
    console.error('[think-hard] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
