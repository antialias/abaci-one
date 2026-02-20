/**
 * API route for evolving an ongoing call scenario.
 *
 * POST /api/realtime/evolve
 * Body: { number, scenario, recentTranscripts, conferenceNumbers }
 * Returns: { evolution: ScenarioEvolution | null }
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { evolveScenario } from '@/components/toys/number-line/talkToNumber/generateScenario'
import type {
  GeneratedScenario,
  TranscriptEntry,
} from '@/components/toys/number-line/talkToNumber/generateScenario'

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { number, scenario, recentTranscripts, conferenceNumbers } = body as {
      number: number
      scenario: GeneratedScenario
      recentTranscripts: TranscriptEntry[]
      conferenceNumbers: number[]
    }

    if (typeof number !== 'number' || !isFinite(number)) {
      return NextResponse.json({ error: 'number must be a finite number' }, { status: 400 })
    }

    if (!scenario?.situation) {
      return NextResponse.json({ error: 'scenario is required' }, { status: 400 })
    }

    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
    }

    const evolution = await evolveScenario(
      apiKey,
      number,
      scenario,
      recentTranscripts ?? [],
      conferenceNumbers ?? [number]
    )

    return NextResponse.json({ evolution })
  } catch (error) {
    console.error('[realtime/evolve] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
