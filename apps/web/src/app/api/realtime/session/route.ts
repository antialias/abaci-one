/**
 * API route that creates an ephemeral session token for OpenAI Realtime API.
 *
 * POST /api/realtime/session
 * Body: { number: number }
 * Returns: { clientSecret: string, expiresAt: number }
 */

import { NextResponse } from 'next/server'
import { generateNumberPersonality, getVoiceForNumber } from '@/components/toys/number-line/talkToNumber/generateNumberPersonality'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { number } = body

    if (typeof number !== 'number' || !isFinite(number)) {
      return NextResponse.json(
        { error: 'number must be a finite number' },
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

    const instructions = generateNumberPersonality(number)

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: getVoiceForNumber(number),
        instructions,
        tools: [
          {
            type: 'function',
            name: 'request_more_time',
            description:
              'Call this when the conversation is going great and you want more time to keep talking',
            parameters: { type: 'object', properties: {} },
          },
          {
            type: 'function',
            name: 'hang_up',
            description:
              'Call this to end the phone call. Use it after you say goodbye, or when the conversation has naturally wound down and the child seems done (e.g. long silence, repeated goodbyes, "ok bye").',
            parameters: { type: 'object', properties: {} },
          },
          {
            type: 'function',
            name: 'transfer_call',
            description:
              'Transfer the phone call to another number. Use this when the child asks to talk to a different number (e.g. "can I talk to 7?"). Say something like "Sure, let me transfer you!" then call this tool.',
            parameters: {
              type: 'object',
              properties: {
                target_number: {
                  type: 'number',
                  description: 'The number to transfer the call to',
                },
              },
              required: ['target_number'],
            },
          },
          {
            type: 'function',
            name: 'add_to_call',
            description:
              'Add another number to the current call as a conference/group call. Use this when the child wants multiple numbers talking together (e.g. "can 12 join us?", "add 5 to the call"). After calling this, you will play multiple characters.',
            parameters: {
              type: 'object',
              properties: {
                target_number: {
                  type: 'number',
                  description: 'The number to add to the conference call',
                },
              },
              required: ['target_number'],
            },
          },
          {
            type: 'function',
            name: 'start_exploration',
            description:
              'Start an animated visual exploration of a mathematical constant on the number line. The child will see a narrated animation while you watch together. You will receive the full narration script so you know exactly what is being shown and said. Stay quiet during the animation — when it finishes you will be notified and can discuss what you both just saw. Available constants: phi (Golden Ratio), pi, tau, e (Euler\'s Number), gamma (Euler-Mascheroni), sqrt2 (Square Root of 2), ramanujan (Ramanujan Summation / −1/12).',
            parameters: {
              type: 'object',
              properties: {
                constant_id: {
                  type: 'string',
                  enum: ['phi', 'pi', 'tau', 'e', 'gamma', 'sqrt2', 'ramanujan'],
                  description: 'Which mathematical constant to explore',
                },
              },
              required: ['constant_id'],
            },
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[realtime/session] OpenAI error:', response.status, errText)
      return NextResponse.json(
        { error: `OpenAI error: ${response.status}` },
        { status: 502 }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      clientSecret: data.client_secret?.value ?? data.client_secret,
      expiresAt: data.client_secret?.expires_at ?? Date.now() / 1000 + 60,
    })
  } catch (error) {
    console.error('[realtime/session] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
